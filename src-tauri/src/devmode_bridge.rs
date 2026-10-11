use crate::cli;
use crate::error::Result;
use crate::extension::extensions_dir;
use crate::state::AppState;
use futures::{SinkExt, StreamExt};
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::net::TcpListener;
use tokio_tungstenite::tungstenite::Message;

pub const EXT_FILE: &str = "betterdevmode.js";
pub const WS_PORT: u16 = 17322;
pub const CONNECTED_EVENT: &str = "devmode-connected";

const EXT_TEMPLATE: &str = r#"
(function betterDevMode() {
  if (!Spicetify.Player || !Spicetify.Platform) {
    setTimeout(betterDevMode, 100);
    return;
  }
  const KEY = "guify-devmode";
  const STYLE_ID = "guify-devmode-css";
  const SCRIPT_ID = "guify-devmode-js";
  const load = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch {
      return {};
    }
  };
  const save = (state) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  };
  const injectCss = (css) => {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = css || "";
  };
  const injectJs = (js) => {
    let el = document.getElementById(SCRIPT_ID);
    if (!el) {
      el = document.createElement("script");
      el.id = SCRIPT_ID;
      document.head.appendChild(el);
    }
    el.textContent = js || "";
  };
  const stored = load();
  if (stored.css) injectCss(stored.css);
  if (stored.js) injectJs(stored.js);
  const connect = () => {
    let ws;
    try {
      ws = new WebSocket("ws://127.0.0.1:__PORT__");
    } catch {
      setTimeout(connect, 3000);
      return;
    }
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "apply_css") {
          const next = { css: msg.css || "", js: load().js || "" };
          save(next);
          injectCss(next.css);
        } else if (msg.type === "apply_js") {
          save({ css: load().css || "", js: msg.js || "" });
          window.location.reload();
        } else if (msg.type === "apply_all") {
          save({ css: msg.css || "", js: msg.js || "" });
          window.location.reload();
        } else if (msg.type === "clear") {
          localStorage.removeItem(KEY);
          window.location.reload();
        } else if (msg.type === "console_eval") {
          let ok = true;
          let out;
          try {
            const r = window.eval(msg.code);
            if (typeof r === "string") out = r;
            else if (r === undefined) out = "undefined";
            else {
              try { out = JSON.stringify(r); } catch { out = String(r); }
            }
          } catch (err) {
            ok = false;
            out = err && err.message ? String(err.message) : String(err);
          }
          try {
            ws.send(JSON.stringify({ type: "console_result", id: msg.id, ok, result: out }));
          } catch {}
        }
      } catch {}
    };
    ws.onclose = () => setTimeout(connect, 3000);
    ws.onerror = () => {
      try {
        ws.close();
      } catch {}
    };
  };
  connect();
})();
"#;

pub fn ext_js() -> String {
    EXT_TEMPLATE.replace("__PORT__", &WS_PORT.to_string())
}

pub async fn install_bridge() -> Result<()> {
    let dir = extensions_dir().await?;
    tokio::fs::create_dir_all(&dir).await?;
    tokio::fs::write(dir.join(EXT_FILE), ext_js()).await?;
    cli::run(&["config", "extensions", EXT_FILE]).await?;
    Ok(())
}

pub async fn broadcast(state: &AppState, payload: String) {
    let _ = state.devmode_tx.send(payload);
}

pub async fn serve(app: AppHandle) {
    let Ok(listener) = TcpListener::bind(("127.0.0.1", WS_PORT)).await else {
        return;
    };
    while let Ok((stream, _)) = listener.accept().await {
        let app = app.clone();
        tokio::spawn(async move {
            let state = app.state::<AppState>();
            let Ok(mut ws) = tokio_tungstenite::accept_async(stream).await else {
                return;
            };
            let mut rx = state.devmode_tx.subscribe();
            if state
                .inner()
                .devmode_clients
                .fetch_add(1, Ordering::SeqCst)
                == 0
            {
                let _ = app.emit(CONNECTED_EVENT, true);
            }
            loop {
                tokio::select! {
                    msg = rx.recv() => match msg {
                        Ok(payload) => {
                            if ws.send(Message::Text(payload.into())).await.is_err() {
                                break;
                            }
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                        Err(_) => break,
                    },
                    frame = ws.next() => match frame {
                        Some(Ok(Message::Close(_))) | None => break,
                        Some(Ok(Message::Text(text))) => {
                            forward_console_result(&app, text.as_str());
                        }
                        Some(Ok(_)) => {}
                        Some(Err(_)) => break,
                    },
                }
            }
            let _ = ws.close(None).await;
            if state
                .inner()
                .devmode_clients
                .fetch_sub(1, Ordering::SeqCst)
                == 1
            {
                let _ = app.emit(CONNECTED_EVENT, false);
            }
        });
    }
}

#[tauri::command]
pub async fn devmode_install_bridge() -> Result<()> {
    install_bridge().await
}

#[tauri::command]
pub async fn devmode_connected(state: State<'_, AppState>) -> Result<bool> {
    Ok(state.devmode_clients.load(Ordering::SeqCst) > 0)
}

#[tauri::command]
pub async fn devmode_send(state: State<'_, AppState>, payload: String) -> Result<()> {
    broadcast(state.inner(), payload).await;
    Ok(())
}

#[tauri::command]
pub async fn devmode_console_eval(state: State<'_, AppState>, id: u64, code: String) -> Result<()> {
    let payload = serde_json::json!({ "type": "console_eval", "id": id, "code": code }).to_string();
    broadcast(state.inner(), payload).await;
    Ok(())
}

fn forward_console_result(app: &AppHandle, text: &str) {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(text) else {
        return;
    };
    if value.get("type").and_then(|t| t.as_str()) != Some("console_result") {
        return;
    }
    let Some(id) = value.get("id").and_then(|v| v.as_u64()) else {
        return;
    };
    let payload = serde_json::json!({
        "id": id,
        "ok": value.get("ok").and_then(|v| v.as_bool()).unwrap_or(false),
        "result": value.get("result").and_then(|v| v.as_str()).unwrap_or(""),
    });
    let _ = app.emit("devmode-console-result", payload);
}
