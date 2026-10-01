use crate::error::{Error, Result};
use serde::Serialize;
use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::process::Command;

pub const OUTPUT_EVENT: &str = "cli-output";

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliLine {
    pub stream: String,
    pub line: String,
}

pub fn command() -> Command {
    #[cfg_attr(not(windows), allow(unused_mut))]
    let mut cmd = Command::new("spicetify");
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

fn spawn_err(e: std::io::Error) -> Error {
    if e.kind() == std::io::ErrorKind::NotFound {
        Error::SpicetifyNotFound
    } else {
        Error::Io(e)
    }
}

fn strip_ansi(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    while let Some(c) = chars.next() {
        if c != '\x1b' {
            out.push(c);
            continue;
        }
        match chars.peek() {
            Some('[') => {
                chars.next();
                while let Some(&nc) = chars.peek() {
                    chars.next();
                    if ('@'..='~').contains(&nc) {
                        break;
                    }
                }
            }
            Some(']') => {
                chars.next();
                while let Some(&nc) = chars.peek() {
                    chars.next();
                    if nc == '\x07' {
                        break;
                    }
                    if nc == '\x1b' {
                        if chars.peek() == Some(&'\\') {
                            chars.next();
                        }
                        break;
                    }
                }
            }
            _ => {
                chars.next();
            }
        }
    }
    out
}

// spicetify renders an inline spinner; collapse it to one clean line per message
fn clean_segment(raw: &str) -> Option<String> {
    let collapsed = strip_ansi(raw).split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.is_empty() {
        return None;
    }
    let body = ["- ", "\\ ", "| ", "/ "]
        .iter()
        .find_map(|p| collapsed.strip_prefix(p))
        .unwrap_or(&collapsed)
        .trim();
    (!body.is_empty()).then(|| body.to_string())
}

pub async fn run(args: &[&str]) -> Result<String> {
    let out = command().args(args).output().await.map_err(spawn_err)?;
    let stdout = strip_ansi(&String::from_utf8_lossy(&out.stdout));
    if !out.status.success() {
        let stderr = strip_ansi(&String::from_utf8_lossy(&out.stderr));
        let msg = if stderr.trim().is_empty() { stdout } else { stderr };
        return Err(Error::Command(msg.trim().to_string()));
    }
    Ok(stdout)
}

fn spawn_reader<R>(app: AppHandle, reader: R, stream: &'static str)
where
    R: AsyncRead + Unpin + Send + 'static,
{
    tokio::spawn(async move {
        let mut lines = BufReader::new(reader).lines();
        let mut last: Option<String> = None;
        while let Ok(Some(raw)) = lines.next_line().await {
            for seg in raw.split('\r') {
                let Some(cleaned) = clean_segment(seg) else { continue };
                if last.as_deref() == Some(cleaned.as_str()) {
                    continue;
                }
                last = Some(cleaned.clone());
                let _ = app.emit(OUTPUT_EVENT, CliLine { stream: stream.into(), line: cleaned });
            }
        }
    });
}

pub async fn run_streaming(app: AppHandle, args: &[&str]) -> Result<i32> {
    let mut child = command()
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(spawn_err)?;

    if let Some(stdout) = child.stdout.take() {
        spawn_reader(app.clone(), stdout, "stdout");
    }
    if let Some(stderr) = child.stderr.take() {
        spawn_reader(app.clone(), stderr, "stderr");
    }

    let status = child.wait().await?;
    Ok(status.code().unwrap_or(-1))
}

pub async fn spawn_watch(app: AppHandle) -> Result<tokio::process::Child> {
    let mut child = command()
        .args(["watch", "-q"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(spawn_err)?;

    if let Some(stdout) = child.stdout.take() {
        spawn_reader(app.clone(), stdout, "stdout");
    }
    if let Some(stderr) = child.stderr.take() {
        spawn_reader(app.clone(), stderr, "stderr");
    }
    Ok(child)
}
