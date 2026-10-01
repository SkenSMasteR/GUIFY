use crate::cli;
use crate::discovery::ExtensionCard;
use crate::error::{Error, Result};
use crate::theme::sanitize;
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LocalExtension {
    pub name: String,
}

pub async fn extensions_dir() -> Result<PathBuf> {
    let userdata = cli::run(&["path", "userdata"]).await?.trim().to_string();
    if userdata.is_empty() {
        return Err(Error::Other("could not resolve spicetify userdata path".into()));
    }
    Ok(PathBuf::from(userdata).join("Extensions"))
}

fn safe_file(name: &str) -> Result<String> {
    let n = sanitize(name);
    if n.is_empty() || n.contains("..") || n.contains('/') || n.contains('\\') {
        return Err(Error::Other("invalid extension name".into()));
    }
    Ok(n)
}

pub fn list_local(dir: &Path) -> Vec<LocalExtension> {
    let mut out = vec![];
    if let Ok(entries) = std::fs::read_dir(dir) {
        for e in entries.flatten() {
            let path = e.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("js") {
                out.push(LocalExtension {
                    name: e.file_name().to_string_lossy().to_string(),
                });
            }
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    out
}

pub async fn install(client: &reqwest::Client, card: &ExtensionCard) -> Result<String> {
    let dir = extensions_dir().await?;
    tokio::fs::create_dir_all(&dir).await?;

    let stem = sanitize(if card.repo.is_empty() { &card.title } else { &card.repo });
    let file = safe_file(&format!("{stem}.js"))?;

    let main_url = card
        .main_url
        .clone()
        .ok_or_else(|| Error::Other("extension manifest has no main file".into()))?;
    let js = client.get(&main_url).send().await?.error_for_status()?.text().await?;
    tokio::fs::write(dir.join(&file), js).await?;

    cli::run(&["config", "extensions", &file]).await?;
    Ok(file)
}

pub async fn set_enabled(name: &str, enabled: bool) -> Result<()> {
    let file = safe_file(name)?;
    let value = if enabled { file } else { format!("{file}-") };
    cli::run(&["config", "extensions", &value]).await?;
    Ok(())
}

pub async fn remove(name: &str) -> Result<()> {
    let file = safe_file(name)?;
    let disable = format!("{file}-");
    cli::run(&["config", "extensions", &disable]).await?;
    let dir = extensions_dir().await?;
    let path = dir.join(&file);
    if path.exists() {
        tokio::fs::remove_file(path).await?;
    }
    Ok(())
}
