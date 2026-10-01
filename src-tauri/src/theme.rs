use crate::cli;
use crate::discovery::ThemeCard;
use crate::error::{Error, Result};
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LocalTheme {
    pub name: String,
    pub schemes: Vec<String>,
}

pub async fn themes_dir() -> Result<PathBuf> {
    let userdata = cli::run(&["path", "userdata"]).await?.trim().to_string();
    if userdata.is_empty() {
        return Err(Error::Other("could not resolve spicetify userdata path".into()));
    }
    Ok(PathBuf::from(userdata).join("Themes"))
}

pub fn sanitize(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c => c,
        })
        .collect::<String>()
        .trim()
        .to_string()
}

fn parse_schemes(text: &str) -> Vec<String> {
    text.lines()
        .filter_map(|l| {
            let t = l.trim();
            (t.starts_with('[') && t.ends_with(']') && t.len() > 2)
                .then(|| t[1..t.len() - 1].trim().to_string())
        })
        .collect()
}

pub fn list_local(dir: &Path) -> Vec<LocalTheme> {
    let mut out = vec![];
    if let Ok(entries) = std::fs::read_dir(dir) {
        for e in entries.flatten() {
            let path = e.path();
            if !path.is_dir() {
                continue;
            }
            let name = e.file_name().to_string_lossy().to_string();
            let schemes = std::fs::read_to_string(path.join("color.ini"))
                .map(|t| parse_schemes(&t))
                .unwrap_or_default();
            out.push(LocalTheme { name, schemes });
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    out
}

pub async fn install(client: &reqwest::Client, card: &ThemeCard, scheme: Option<String>) -> Result<String> {
    let dir = themes_dir().await?;
    let name = sanitize(&card.title);
    if name.is_empty() {
        return Err(Error::Other("theme has no usable name".into()));
    }
    let theme_dir = dir.join(&name);
    tokio::fs::create_dir_all(&theme_dir).await?;

    let css_url = card
        .css_url
        .clone()
        .ok_or_else(|| Error::Other("theme manifest has no usercss".into()))?;
    let css = client.get(&css_url).send().await?.error_for_status()?.text().await?;
    tokio::fs::write(theme_dir.join("user.css"), css).await?;

    let mut chosen = scheme;
    if let Some(schemes_url) = &card.schemes_url {
        let text = client.get(schemes_url).send().await?.error_for_status()?.text().await?;
        tokio::fs::write(theme_dir.join("color.ini"), &text).await?;
        if chosen.is_none() {
            chosen = parse_schemes(&text).first().cloned();
        }
    } else {
        tokio::fs::write(theme_dir.join("color.ini"), "[base]\n").await?;
        chosen.get_or_insert_with(|| "base".into());
    }

    for inc in &card.include {
        let (url, rel) = if inc.starts_with("http") {
            let name = inc.rsplit('/').next().unwrap_or("asset.bin");
            (inc.clone(), name.to_string())
        } else {
            (
                format!(
                    "https://raw.githubusercontent.com/{}/{}/{}/{}",
                    card.user, card.repo, card.branch, inc
                ),
                inc.clone(),
            )
        };
        // never let a remote manifest write outside the theme folder
        if Path::new(&rel).is_absolute() || rel.split(['/', '\\']).any(|c| c == "..") {
            continue;
        }
        if let Ok(resp) = client.get(&url).send().await {
            if let Ok(resp) = resp.error_for_status() {
                if let Ok(bytes) = resp.bytes().await {
                    let dest = theme_dir.join(&rel);
                    if let Some(parent) = dest.parent() {
                        let _ = tokio::fs::create_dir_all(parent).await;
                    }
                    let _ = tokio::fs::write(dest, &bytes).await;
                }
            }
        }
    }

    set_active(&name, chosen.as_deref()).await?;
    Ok(name)
}

pub async fn set_active(name: &str, scheme: Option<&str>) -> Result<()> {
    let name = sanitize(name);
    if name.is_empty() || name.contains("..") {
        return Err(Error::Other("invalid theme name".into()));
    }
    cli::run(&["config", "current_theme", &name]).await?;
    if let Some(s) = scheme {
        if !s.is_empty() {
            cli::run(&["config", "color_scheme", s]).await?;
        }
    }
    Ok(())
}

async fn current_theme() -> String {
    let raw = cli::run(&["config"]).await.unwrap_or_default();
    crate::config::parse_config(&raw)
        .get("current_theme")
        .cloned()
        .unwrap_or_default()
}

// if config points at a theme folder that no longer exists, reset it so `apply` won't fail
pub async fn clear_dangling_current() -> Result<()> {
    let current = current_theme().await;
    if current.is_empty() {
        return Ok(());
    }
    let dir = themes_dir().await?;
    if !dir.join(&current).exists() {
        cli::run(&["config", "current_theme", ""]).await?;
    }
    Ok(())
}

pub async fn remove(name: &str) -> Result<()> {
    let name = sanitize(name);
    if name.is_empty() || name.contains("..") {
        return Err(Error::Other("invalid theme name".into()));
    }
    let dir = themes_dir().await?;
    let theme_dir = dir.join(&name);
    if theme_dir.exists() {
        tokio::fs::remove_dir_all(&theme_dir).await?;
    }

    // if this was the active theme, clear it so `apply` doesn't look for a deleted folder
    if current_theme().await == name {
        cli::run(&["config", "current_theme", ""]).await?;
    }
    Ok(())
}
