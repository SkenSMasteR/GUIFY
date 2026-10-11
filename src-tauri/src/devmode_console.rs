use crate::error::{Error, Result};
use crate::state::AppState;
use serde::Serialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::Ordering;
use std::sync::{Mutex, MutexGuard};
use tauri::{AppHandle, Emitter, State};

pub struct LiveConsole {
    pub stdin: ChildStdin,
    pub child: Child,
}

pub type ConsoleMap = Mutex<HashMap<u64, LiveConsole>>;

pub fn next_id(state: &AppState) -> u64 {
    state.devmode_console_seq.fetch_add(1, Ordering::SeqCst)
}

fn locked<'a>(map: &'a ConsoleMap) -> Result<MutexGuard<'a, HashMap<u64, LiveConsole>>> {
    map.lock().map_err(|_| Error::Other("Console state poisoned".into()))
}

fn build_command(provider: &str) -> Result<(String, Vec<String>)> {
    match provider {
        // /Q disables command echo, the UI echoes what it sends
        "cmd" => Ok(("cmd".into(), vec!["/Q".into()])),
        "powershell" => Ok((
            "powershell".into(),
            vec![
                "-NoProfile".into(),
                "-NonInteractive".into(),
                "-Command".into(),
                "while ($true) { $line = [Console]::In.ReadLine(); if ($null -eq $line -or $line -eq 'exit') { break }; try { Invoke-Expression $line } catch { Write-Output ($_.Exception | Out-String) } }".into(),
            ],
        )),
        "bash" => Ok(("bash".into(), vec![])),
        _ => Err(Error::Command(format!("Unknown console provider '{provider}'"))),
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConsoleLine {
    id: u64,
    line: String,
}

fn pump(app: &AppHandle, id: u64, reader: impl std::io::Read + Send + 'static) {
    let app = app.clone();
    std::thread::spawn(move || {
        let mut reader = BufReader::new(reader);
        let mut buf = String::new();
        loop {
            buf.clear();
            match reader.read_line(&mut buf) {
                Ok(0) => break,
                Ok(_) => {
                    // tools like rollup redraw progress with \r, so each part gets its own line
                    for part in buf.trim_end_matches(['\r', '\n']).split('\r') {
                        let line = ConsoleLine {
                            id,
                            line: part.to_string(),
                        };
                        let _ = app.emit("devmode-console-line", line);
                    }
                }
                Err(_) => break,
            }
        }
        let _ = app.emit(
            "devmode-console-line",
            ConsoleLine {
                id,
                line: "[session ended]".into(),
            },
        );
    });
}

pub fn open(app: &AppHandle, state: &AppState, provider: &str, project: Option<&str>) -> Result<u64> {
    let (program, args) = build_command(provider)?;
    let mut command = Command::new(&program);
    command
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(name) = project.filter(|p| !p.is_empty()) {
        if let Ok(dir) = crate::devmode::project_dir(app, name) {
            if dir.exists() {
                command.current_dir(dir);
            }
        }
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW: keep cmd/powershell from flashing a console window
        command.creation_flags(0x0800_0000);
    }
    let mut child = command
        .spawn()
        .map_err(|e| Error::Other(format!("Failed to start {program}: {e}")))?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| Error::Other("Console stdin missing".into()))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| Error::Other("Console stdout missing".into()))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| Error::Other("Console stderr missing".into()))?;
    let id = next_id(state);
    pump(app, id, stdout);
    pump(app, id, stderr);
    locked(&state.devmode_consoles)?.insert(id, LiveConsole { stdin, child });
    Ok(id)
}

pub fn write(state: &AppState, id: u64, line: &str) -> Result<()> {
    let mut map = locked(&state.devmode_consoles)?;
    let console = map
        .get_mut(&id)
        .ok_or_else(|| Error::Command("Console session not found".into()))?;
    console
        .stdin
        .write_all(line.as_bytes())
        .map_err(|e| Error::Other(e.to_string()))?;
    console
        .stdin
        .write_all(b"\n")
        .map_err(|e| Error::Other(e.to_string()))?;
    console.stdin.flush().map_err(|e| Error::Other(e.to_string()))?;
    Ok(())
}

pub fn close(state: &AppState, id: u64) -> Result<()> {
    if let Some(mut console) = locked(&state.devmode_consoles)?.remove(&id) {
        let _ = console.child.kill();
        let _ = console.child.wait();
    }
    Ok(())
}

#[tauri::command]
pub async fn devmode_console_open(
    app: AppHandle,
    state: State<'_, AppState>,
    provider: String,
    project: Option<String>,
) -> Result<u64> {
    open(&app, state.inner(), &provider, project.as_deref())
}

#[tauri::command]
pub async fn devmode_console_write(state: State<'_, AppState>, id: u64, line: String) -> Result<()> {
    write(state.inner(), id, &line)
}

#[tauri::command]
pub async fn devmode_console_close(state: State<'_, AppState>, id: u64) -> Result<()> {
    close(state.inner(), id)
}
