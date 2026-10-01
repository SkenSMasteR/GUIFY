use crate::cli::{self, CliLine, OUTPUT_EVENT};
use crate::config::{self, Status};
use crate::discovery::{self, ExtensionCard, SnippetCard, ThemeCard};
use crate::error::Result;
use crate::extension::{self, LocalExtension};
use crate::snippets::{self, MarketSnippet, Snippet};
use crate::state::{self, AppState, InstallOrigin};
use crate::theme::{self, LocalTheme};
use tauri::{AppHandle, Emitter, Manager, State};

#[tauri::command]
pub async fn get_status() -> Result<Status> {
    config::gather().await
}

#[tauri::command]
pub async fn run_cli(app: AppHandle, command: String, args: Vec<String>) -> Result<i32> {
    let line = format!("$ spicetify {command} {}", args.join(" "));
    let _ = app.emit(
        OUTPUT_EVENT,
        CliLine { stream: "info".into(), line: line.trim_end().to_string() },
    );
    if command == "apply" {
        let _ = theme::clear_dangling_current().await;
    }
    let owned: Vec<String> = std::iter::once(command).chain(args).collect();
    let refs: Vec<&str> = owned.iter().map(|s| s.as_str()).collect();
    cli::run_streaming(app.clone(), &refs).await
}

#[tauri::command]
pub async fn watch_start(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    let mut guard = state.watch.lock().await;
    if guard.is_some() {
        return Ok(());
    }
    let child = cli::spawn_watch(app.clone()).await?;
    *guard = Some(child);
    Ok(())
}

#[tauri::command]
pub async fn watch_stop(state: State<'_, AppState>) -> Result<()> {
    let mut guard = state.watch.lock().await;
    if let Some(mut child) = guard.take() {
        let _ = child.start_kill();
        let _ = child.wait().await;
    }
    Ok(())
}

#[tauri::command]
pub async fn watch_running(state: State<'_, AppState>) -> Result<bool> {
    Ok(state.watch.lock().await.is_some())
}

#[tauri::command]
pub async fn discover_themes(
    state: State<'_, AppState>,
    page: u32,
    show_archived: bool,
) -> Result<Vec<ThemeCard>> {
    discovery::discover_themes(&state.client, page, show_archived).await
}

#[tauri::command]
pub async fn get_readme(state: State<'_, AppState>, url: String) -> Result<String> {
    discovery::fetch_text(&state.client, &url).await
}

#[tauri::command]
pub async fn list_local_themes() -> Result<Vec<LocalTheme>> {
    let dir = theme::themes_dir().await?;
    Ok(theme::list_local(&dir))
}

#[tauri::command]
pub async fn install_theme(
    app: AppHandle,
    state: State<'_, AppState>,
    card: ThemeCard,
    scheme: Option<String>,
) -> Result<String> {
    let name = theme::install(&state.client, &card, scheme).await?;
    {
        let mut installs = state.installs.lock().await;
        installs.insert(
            name.clone(),
            InstallOrigin {
                name: name.clone(),
                user: card.user.clone(),
                repo: card.repo.clone(),
                branch: card.branch.clone(),
                installed_at: state::now(),
                image_url: card.image_url.clone(),
            },
        );
    }
    state::save_installs(&app, &state).await;
    Ok(name)
}

#[tauri::command]
pub async fn remove_theme(app: AppHandle, state: State<'_, AppState>, name: String) -> Result<()> {
    theme::remove(&name).await?;
    {
        let mut installs = state.installs.lock().await;
        installs.remove(&name);
    }
    state::save_installs(&app, &state).await;
    Ok(())
}

#[tauri::command]
pub async fn set_active_theme(name: String, scheme: Option<String>) -> Result<()> {
    theme::set_active(&name, scheme.as_deref()).await
}

#[tauri::command]
pub async fn get_installs(state: State<'_, AppState>) -> Result<Vec<InstallOrigin>> {
    Ok(state.installs.lock().await.values().cloned().collect())
}

#[tauri::command]
pub async fn discover_extensions(
    state: State<'_, AppState>,
    page: u32,
    show_archived: bool,
) -> Result<Vec<ExtensionCard>> {
    discovery::discover_extensions(&state.client, page, show_archived).await
}

#[tauri::command]
pub async fn list_local_extensions() -> Result<Vec<LocalExtension>> {
    let dir = extension::extensions_dir().await?;
    Ok(extension::list_local(&dir))
}

#[tauri::command]
pub async fn install_extension(
    app: AppHandle,
    state: State<'_, AppState>,
    card: ExtensionCard,
) -> Result<String> {
    let file = extension::install(&state.client, &card).await?;
    {
        let mut installs = state.installs.lock().await;
        installs.insert(
            file.clone(),
            InstallOrigin {
                name: file.clone(),
                user: card.user.clone(),
                repo: card.repo.clone(),
                branch: card.branch.clone(),
                installed_at: state::now(),
                image_url: card.image_url.clone(),
            },
        );
    }
    state::save_installs(&app, &state).await;
    Ok(file)
}

#[tauri::command]
pub async fn remove_extension(
    app: AppHandle,
    state: State<'_, AppState>,
    name: String,
) -> Result<()> {
    extension::remove(&name).await?;
    {
        let mut installs = state.installs.lock().await;
        installs.remove(&name);
    }
    state::save_installs(&app, &state).await;
    Ok(())
}

#[tauri::command]
pub async fn set_extension_enabled(name: String, enabled: bool) -> Result<()> {
    extension::set_enabled(&name, enabled).await
}

#[tauri::command]
pub async fn check_update(state: State<'_, AppState>) -> Result<Option<String>> {
    let current = match cli::run(&["-v"]).await {
        Ok(v) => v.trim().to_string(),
        Err(_) => return Ok(None),
    };
    let latest = discovery::latest_spicetify_version(&state.client).await?;
    Ok(discovery::is_newer(&latest, &current).then(|| latest))
}

#[tauri::command]
pub async fn fix_spicetify(app: AppHandle) -> Result<()> {
    let _ = theme::clear_dangling_current().await;
    let steps: [&[&str]; 3] = [&["update"], &["restore"], &["backup", "apply"]];
    for args in steps {
        let owned: Vec<String> = args.iter().map(|s| s.to_string()).collect();
        let line = format!("$ spicetify {}", owned.join(" "));
        let _ = app.emit(
            OUTPUT_EVENT,
            CliLine { stream: "info".into(), line },
        );
        let refs: Vec<&str> = owned.iter().map(|s| s.as_str()).collect();
        let _ = cli::run_streaming(app.clone(), &refs).await;
    }
    Ok(())
}

#[tauri::command]
pub fn set_devtools(app: AppHandle, open: bool) {
    #[cfg(any(debug_assertions, feature = "devtools"))]
    if let Some(w) = app.get_webview_window("main") {
        if open {
            w.open_devtools();
        } else {
            w.close_devtools();
        }
    }
    #[cfg(not(any(debug_assertions, feature = "devtools")))]
    let _ = (app, open);
}

#[tauri::command]
pub fn window_controls() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        "macos"
    }
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("HYPRLAND_INSTANCE_SIGNATURE").is_some() {
            "hyprland"
        } else {
            "linux"
        }
    }
    #[cfg(target_os = "windows")]
    {
        "windows"
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        "linux"
    }
}

#[tauri::command]
pub async fn list_snippets(state: State<'_, AppState>) -> Result<Vec<Snippet>> {
    Ok(state.snippets.lock().await.clone())
}

#[tauri::command]
pub async fn save_snippet(
    app: AppHandle,
    state: State<'_, AppState>,
    mut snippet: Snippet,
) -> Result<Vec<Snippet>> {
    {
        let mut list = state.snippets.lock().await;
        if snippet.id.trim().is_empty() {
            snippet.id = format!("s{}-{}", state::now(), list.len());
        }
        match list.iter_mut().find(|s| s.id == snippet.id) {
            Some(slot) => *slot = snippet.clone(),
            None => list.push(snippet),
        }
    }
    snippets::save(&app, state.inner()).await;
    let _ = snippets::write_bridge(state.inner()).await;
    snippets::broadcast(state.inner()).await;
    Ok(state.snippets.lock().await.clone())
}

#[tauri::command]
pub async fn delete_snippet(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Vec<Snippet>> {
    state.snippets.lock().await.retain(|s| s.id != id);
    snippets::save(&app, state.inner()).await;
    let _ = snippets::write_bridge(state.inner()).await;
    snippets::broadcast(state.inner()).await;
    Ok(state.snippets.lock().await.clone())
}

#[tauri::command]
pub async fn set_snippets_enabled(state: State<'_, AppState>, enabled: bool) -> Result<()> {
    if enabled {
        snippets::install_bridge(state.inner()).await
    } else {
        snippets::remove_bridge().await
    }
}

#[tauri::command]
pub async fn discover_snippets(state: State<'_, AppState>) -> Result<Vec<SnippetCard>> {
    discovery::discover_snippets(&state.client).await
}

#[tauri::command]
pub async fn list_market_snippets(state: State<'_, AppState>) -> Result<Vec<MarketSnippet>> {
    Ok(state.market.lock().await.clone())
}

#[tauri::command]
pub async fn add_market_snippet(
    app: AppHandle,
    state: State<'_, AppState>,
    card: SnippetCard,
) -> Result<Vec<MarketSnippet>> {
    {
        let mut list = state.market.lock().await;
        if !list.iter().any(|s| s.id == card.id) {
            list.push(MarketSnippet {
                id: card.id.clone(),
                title: card.title.clone(),
                description: card.description.clone(),
                code: card.code.clone(),
                enabled: true,
                preview_url: card.preview_url.clone(),
            });
        }
    }
    snippets::save_market(&app, state.inner()).await;
    snippets::install_bridge(state.inner()).await?;
    snippets::broadcast(state.inner()).await;
    Ok(state.market.lock().await.clone())
}

#[tauri::command]
pub async fn remove_market_snippet(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Vec<MarketSnippet>> {
    state.market.lock().await.retain(|s| s.id != id);
    snippets::save_market(&app, state.inner()).await;
    snippets::write_bridge(state.inner()).await?;
    snippets::broadcast(state.inner()).await;
    Ok(state.market.lock().await.clone())
}

#[tauri::command]
pub async fn toggle_market_snippet(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    enabled: bool,
) -> Result<Vec<MarketSnippet>> {
    if let Some(s) = state.market.lock().await.iter_mut().find(|s| s.id == id) {
        s.enabled = enabled;
    }
    snippets::save_market(&app, state.inner()).await;
    snippets::write_bridge(state.inner()).await?;
    snippets::broadcast(state.inner()).await;
    Ok(state.market.lock().await.clone())
}

#[tauri::command]
pub async fn snippets_connected(state: State<'_, AppState>) -> Result<bool> {
    Ok(state.ws_clients.load(std::sync::atomic::Ordering::SeqCst) > 0)
}
