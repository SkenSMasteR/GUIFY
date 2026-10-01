use crate::cli;
use crate::error::{Error, Result};
use serde::Serialize;
use std::collections::BTreeMap;

const SECTIONS: [&str; 4] = ["Settings", "Preprocesses", "AdditionalFeatures", "Backup"];

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub installed: bool,
    pub version: String,
    pub spicetify_path: String,
    pub userdata_path: String,
    pub current_theme: String,
    pub color_scheme: String,
    pub extensions: Vec<String>,
    pub custom_apps: Vec<String>,
    pub spotify_path: String,
    pub backup_version: String,
    pub config: BTreeMap<String, String>,
}

impl Status {
    fn missing() -> Self {
        Status {
            installed: false,
            version: String::new(),
            spicetify_path: String::new(),
            userdata_path: String::new(),
            current_theme: String::new(),
            color_scheme: String::new(),
            extensions: vec![],
            custom_apps: vec![],
            spotify_path: String::new(),
            backup_version: String::new(),
            config: BTreeMap::new(),
        }
    }
}

pub fn parse_config(output: &str) -> BTreeMap<String, String> {
    let mut map = BTreeMap::new();
    for raw in output.lines() {
        let trimmed = raw.trim();
        if trimmed.is_empty() || SECTIONS.contains(&trimmed) {
            continue;
        }
        if let Some((k, v)) = trimmed.split_once(char::is_whitespace) {
            map.insert(k.trim().to_string(), v.trim().to_string());
        }
    }
    map
}

pub async fn gather() -> Result<Status> {
    let version = match cli::run(&["-v"]).await {
        Ok(v) => v.trim().to_string(),
        Err(Error::SpicetifyNotFound) => return Ok(Status::missing()),
        Err(e) => return Err(e),
    };

    let spicetify_path = cli::run(&["path"]).await.unwrap_or_default().trim().to_string();
    let userdata_path = cli::run(&["path", "userdata"]).await.unwrap_or_default().trim().to_string();
    let config = parse_config(&cli::run(&["config"]).await.unwrap_or_default());

    let get = |k: &str| config.get(k).cloned().unwrap_or_default();
    let list = |k: &str| {
        get(k)
            .split('|')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
    };

    Ok(Status {
        installed: true,
        version,
        spicetify_path,
        userdata_path,
        current_theme: get("current_theme"),
        color_scheme: get("color_scheme"),
        extensions: list("extensions"),
        custom_apps: list("custom_apps"),
        spotify_path: get("spotify_path"),
        backup_version: get("version"),
        config,
    })
}
