use crate::cli;
use crate::error::Result;
use crate::extension::extensions_dir;
use crate::state::AppState;
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, Manager};
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tokio_tungstenite::tungstenite::Message;

pub const EXT_FILE: &str = "guify-snippets.js";
const WS_PORT: u16 = 17321;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Snippet {
    pub id: String,
    pub title: String,
    pub css: String,
    #[serde(default)]
    pub enabled: bool,
}

fn default_enabled() -> bool {
    true
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MarketSnippet {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub description: String,
    pub code: String,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default)]
    pub preview_url: Option<String>,
}

const BRIDGE_TEMPLATE: &str = r#"// NAME: GUIFY Snippets
// AUTHOR: GUIFY
(async () => {
  const style = document.createElement("style");
  style.id = "guify-snippets";
  style.textContent = __CSS__;
  document.head.appendChild(style);
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
        if (msg.type === "sync") style.textContent = msg.css || "";
      } catch {}
    };
    ws.onclose = () => setTimeout(connect, 3000);
    ws.onerror = () => {
      try { ws.close(); } catch {}
    };
  };
  connect();
})();
"#;

fn bridge_js(css: &str) -> String {
    let encoded = serde_json::to_string(css).unwrap_or_else(|_| "\"\"".into());
    BRIDGE_TEMPLATE
        .replace("__CSS__", &encoded)
        .replace("__PORT__", &WS_PORT.to_string())
}

fn snippets_file(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join("snippets.json"))
}

fn market_file(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join("market-snippets.json"))
}

pub async fn load(app: &AppHandle, state: &AppState) {
    let Some(path) = snippets_file(app) else { return };
    if let Ok(text) = tokio::fs::read_to_string(&path).await {
        if let Ok(list) = serde_json::from_str::<Vec<Snippet>>(&text) {
            *state.snippets.lock().await = list;
        }
    }
}

pub async fn save(app: &AppHandle, state: &AppState) {
    let Some(path) = snippets_file(app) else { return };
    if let Some(parent) = path.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }
    let list = state.snippets.lock().await.clone();
    if let Ok(text) = serde_json::to_string_pretty(&list) {
        let _ = tokio::fs::write(&path, text).await;
    }
}

pub async fn load_market(app: &AppHandle, state: &AppState) {
    let Some(path) = market_file(app) else { return };
    if let Ok(text) = tokio::fs::read_to_string(&path).await {
        if let Ok(list) = serde_json::from_str::<Vec<MarketSnippet>>(&text) {
            *state.market.lock().await = list;
        }
    }
}

pub async fn save_market(app: &AppHandle, state: &AppState) {
    let Some(path) = market_file(app) else { return };
    if let Some(parent) = path.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }
    let list = state.market.lock().await.clone();
    if let Ok(text) = serde_json::to_string_pretty(&list) {
        let _ = tokio::fs::write(&path, text).await;
    }
}

pub fn build_css(list: &[Snippet]) -> String {
    list.iter()
        .filter(|s| s.enabled)
        .map(|s| format!("/* {} */\n{}", s.title, s.css.trim()))
        .collect::<Vec<_>>()
        .join("\n\n")
}

pub async fn market_css(state: &AppState) -> String {
    let list = state.market.lock().await;
    list.iter()
        .filter(|s| s.enabled)
        .map(|s| format!("/* {} */\n{}", s.title, s.code.trim()))
        .collect::<Vec<_>>()
        .join("\n\n")
}

async fn bridge_css(state: &AppState) -> String {
    let mut css = build_css(&state.snippets.lock().await);
    let market = market_css(state).await;
    if !market.is_empty() {
        if css.is_empty() {
            css = market;
        } else {
            css.push_str(&format!("\n\n{market}"));
        }
    }
    css
}

async fn sync_payload(state: &AppState) -> String {
    let css = bridge_css(state).await;
    serde_json::json!({ "type": "sync", "css": css }).to_string()
}

pub async fn broadcast(state: &AppState) {
    let _ = state.css_tx.send(sync_payload(state).await);
}

pub async fn write_bridge(state: &AppState) -> Result<()> {
    let dir = extensions_dir().await?;
    tokio::fs::create_dir_all(&dir).await?;
    let css = bridge_css(state).await;
    tokio::fs::write(dir.join(EXT_FILE), bridge_js(&css)).await?;
    Ok(())
}

pub async fn install_bridge(state: &AppState) -> Result<()> {
    write_bridge(state).await?;
    cli::run(&["config", "extensions", EXT_FILE]).await?;
    Ok(())
}

pub async fn remove_bridge() -> Result<()> {
    let disabled = format!("{EXT_FILE}-");
    cli::run(&["config", "extensions", &disabled]).await?;
    if let Ok(dir) = extensions_dir().await {
        let path = dir.join(EXT_FILE);
        if path.exists() {
            tokio::fs::remove_file(path).await?;
        }
    }
    Ok(())
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
            let mut rx = state.css_tx.subscribe();
            if ws
                .send(Message::Text(sync_payload(state.inner()).await.into()))
                .await
                .is_err()
            {
                return;
            }
            if state.inner().ws_clients.fetch_add(1, Ordering::SeqCst) == 0 {
                let _ = app.emit("snippets-connected", true);
            }
            loop {
                tokio::select! {
                    msg = rx.recv() => match msg {
                        Ok(payload) => {
                            if ws.send(Message::Text(payload.into())).await.is_err() {
                                break;
                            }
                        }
                        Err(broadcast::error::RecvError::Lagged(_)) => continue,
                        Err(_) => break,
                    },
                    frame = ws.next() => match frame {
                        Some(Ok(Message::Close(_))) | None => break,
                        Some(Ok(_)) => {}
                        Some(Err(_)) => break,
                    },
                }
            }
            let _ = ws.close(None).await;
            if state.inner().ws_clients.fetch_sub(1, Ordering::SeqCst) == 1 {
                let _ = app.emit("snippets-connected", false);
            }
        });
    }
}
