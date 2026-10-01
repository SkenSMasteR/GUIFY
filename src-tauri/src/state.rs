use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::AtomicUsize;
use tauri::{AppHandle, Manager};
use tokio::sync::{broadcast, Mutex};

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstallOrigin {
    pub name: String,
    pub user: String,
    pub repo: String,
    pub branch: String,
    pub installed_at: String,
    #[serde(default)]
    pub image_url: Option<String>,
}

pub struct AppState {
    pub client: reqwest::Client,
    pub watch: Mutex<Option<tokio::process::Child>>,
    pub installs: Mutex<HashMap<String, InstallOrigin>>,
    pub snippets: Mutex<Vec<crate::snippets::Snippet>>,
    pub market: Mutex<Vec<crate::snippets::MarketSnippet>>,
    pub css_tx: broadcast::Sender<String>,
    pub ws_clients: AtomicUsize,
}

impl AppState {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent("GUIFY")
            .build()
            .expect("failed to build http client");
        let (css_tx, _) = broadcast::channel(16);
        Self {
            client,
            watch: Mutex::new(None),
            installs: Mutex::new(HashMap::new()),
            snippets: Mutex::new(Vec::new()),
            market: Mutex::new(Vec::new()),
            css_tx,
            ws_clients: AtomicUsize::new(0),
        }
    }
}

pub fn now() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_default()
}

fn state_file(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join("installs.json"))
}

pub async fn load_installs(app: &AppHandle, state: &AppState) {
    let Some(path) = state_file(app) else { return };
    if let Ok(text) = tokio::fs::read_to_string(&path).await {
        if let Ok(map) = serde_json::from_str::<HashMap<String, InstallOrigin>>(&text) {
            *state.installs.lock().await = map;
        }
    }
}

pub async fn save_installs(app: &AppHandle, state: &AppState) {
    let Some(path) = state_file(app) else { return };
    if let Some(parent) = path.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }
    let map = state.installs.lock().await.clone();
    if let Ok(text) = serde_json::to_string_pretty(&map) {
        let _ = tokio::fs::write(&path, text).await;
    }
}
