use crate::error::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectEntries {
    pub js: String,
    pub css: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMeta {
    pub name: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub authors: Vec<String>,
    #[serde(default)]
    pub description: String,
    pub entries: ProjectEntries,
    #[serde(default)]
    pub has_mixins: bool,
    #[serde(default)]
    pub dependencies: BTreeMap<String, String>,
    #[serde(default)]
    pub preview: String,
}

pub fn projects_root(app: &AppHandle) -> Result<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| Error::Other(e.to_string()))?;
    Ok(dir.join("devmode").join("projects"))
}

fn is_safe_part(value: &str) -> bool {
    !value.is_empty()
        && value != "."
        && value != ".."
        && value
            .chars()
            .all(|c| c.is_alphanumeric() || matches!(c, '.' | '_' | '-' | ' '))
        && !value.contains('/')
        && !value.contains('\\')
}

fn is_safe_file_name(value: &str) -> bool {
    is_safe_part(value) && !value.contains("..")
}

pub async fn list_projects(app: &AppHandle) -> Result<Vec<ProjectMeta>> {
    let root = projects_root(app)?;
    let mut list = Vec::new();
    let Ok(read) = std::fs::read_dir(&root) else {
        return Ok(list);
    };
    for entry in read.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        if let Ok(text) = std::fs::read_to_string(path.join("metadata.json")) {
            if let Ok(meta) = serde_json::from_str::<ProjectMeta>(&text) {
                list.push(meta);
            }
        }
    }
    list.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(list)
}

async fn write_file_if_missing(dir: &Path, name: &str, content: &str) -> Result<()> {
    let path = dir.join(name);
    if path.exists() {
        return Ok(());
    }
    tokio::fs::write(&path, content).await?;
    Ok(())
}

pub async fn create_project(app: &AppHandle, meta: ProjectMeta) -> Result<ProjectMeta> {
    if !is_safe_part(&meta.name) {
        return Err(Error::Command(
            "Project name may only contain letters, numbers, spaces, dots, dashes and underscores".into(),
        ));
    }
    if !is_safe_file_name(&meta.entries.js)
        || (!meta.entries.css.is_empty() && !is_safe_file_name(&meta.entries.css))
    {
        return Err(Error::Command("Entry file names are invalid".into()));
    }
    let root = projects_root(app)?;
    tokio::fs::create_dir_all(&root).await?;
    let dir = root.join(&meta.name);
    if dir.exists() {
        return Err(Error::Command(format!(
            "Project '{}' already exists",
            meta.name
        )));
    }
    tokio::fs::create_dir_all(&dir).await?;
    let json = serde_json::to_string_pretty(&meta)?;
    tokio::fs::write(dir.join("metadata.json"), json).await?;
    write_file_if_missing(&dir, &meta.entries.js, &format!("// NAME: {}\n", meta.name)).await?;
    if !meta.entries.css.is_empty() {
        write_file_if_missing(&dir, &meta.entries.css, &format!("/* {} */\n", meta.name)).await?;
    }
    write_file_if_missing(&dir, "color.ini", "[base]\n").await?;
    Ok(meta)
}

#[tauri::command]
pub async fn devmode_list_projects(app: AppHandle) -> Result<Vec<ProjectMeta>> {
    list_projects(&app).await
}

#[tauri::command]
pub async fn devmode_create_project(app: AppHandle, meta: ProjectMeta) -> Result<ProjectMeta> {
    create_project(&app, meta).await
}

fn repo_folder_name(url: &str) -> Result<String> {
    let last = url
        .trim()
        .trim_end_matches('/')
        .rsplit(['/', ':'])
        .next()
        .unwrap_or_default()
        .trim_end_matches(".git")
        .to_string();
    if last.is_empty() || !is_safe_part(&last) {
        return Err(Error::Command(
            "Could not derive a project name from that URL".into(),
        ));
    }
    Ok(last)
}

fn is_cloneable_url(url: &str) -> bool {
    if url.starts_with('-') {
        return false;
    }
    let lower = url.to_lowercase();
    ["https://", "http://", "git://", "ssh://"]
        .iter()
        .any(|p| lower.starts_with(p))
        || (lower.starts_with("git@") && url.contains(':'))
}

// git writes read-only files under .git that block remove_dir_all on Windows
#[cfg(windows)]
fn clear_read_only(dir: &Path) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                clear_read_only(&path);
            }
            if let Ok(meta) = entry.metadata() {
                let mut perms = meta.permissions();
                if perms.readonly() {
                    perms.set_readonly(false);
                    let _ = std::fs::set_permissions(&path, perms);
                }
            }
        }
    }
}

async fn remove_tree(dir: &Path) {
    #[cfg(windows)]
    clear_read_only(dir);
    let _ = tokio::fs::remove_dir_all(dir).await;
}

pub async fn clone_project(app: &AppHandle, url: &str) -> Result<ProjectMeta> {
    let url = url.trim();
    if !is_cloneable_url(url) {
        return Err(Error::Command(
            "Enter a repository URL like https://github.com/user/repo".into(),
        ));
    }
    let name = repo_folder_name(url)?;
    let root = projects_root(app)?;
    tokio::fs::create_dir_all(&root).await?;
    let dest = root.join(&name);
    if dest.exists() {
        return Err(Error::Command(format!("Project '{name}' already exists")));
    }

    let mut command = tokio::process::Command::new("git");
    command
        .args(["clone", "--depth", "1", url])
        .arg(&dest)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(std::process::Stdio::null());
    #[cfg(windows)]
    command.creation_flags(0x0800_0000);
    let output = command.output().await.map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            Error::Command("git was not found in PATH".into())
        } else {
            Error::Io(e)
        }
    })?;
    if !output.status.success() {
        remove_tree(&dest).await;
        let stderr = String::from_utf8_lossy(&output.stderr);
        let reason = stderr.trim().lines().last().unwrap_or("unknown error");
        return Err(Error::Command(format!("git clone failed: {reason}")));
    }

    let meta_path = dest.join("metadata.json");
    let text = match tokio::fs::read_to_string(&meta_path).await {
        Ok(t) => t,
        Err(_) => {
            remove_tree(&dest).await;
            return Err(Error::Command(
                "The cloned repository has no metadata.json, so it is not a DevMode project"
                    .into(),
            ));
        }
    };
    let meta = match serde_json::from_str::<ProjectMeta>(&text) {
        Ok(m) => m,
        Err(_) => {
            remove_tree(&dest).await;
            return Err(Error::Command(
                "metadata.json in the repository is not valid".into(),
            ));
        }
    };
    if !is_safe_part(&meta.name) {
        remove_tree(&dest).await;
        return Err(Error::Command(
            "metadata.json has a project name that cannot be used as a folder".into(),
        ));
    }
    if meta.name != name {
        // on Windows a case-only difference means the clone already sits at the target folder
        #[cfg(windows)]
        let same_folder = name.eq_ignore_ascii_case(&meta.name);
        #[cfg(not(windows))]
        let same_folder = false;
        if !same_folder {
            let target = root.join(&meta.name);
            if target.exists() {
                remove_tree(&dest).await;
                return Err(Error::Command(format!(
                    "Project '{}' already exists",
                    meta.name
                )));
            }
            tokio::fs::rename(&dest, &target).await?;
        }
    }
    Ok(meta)
}

#[tauri::command]
pub async fn devmode_clone_project(app: AppHandle, url: String) -> Result<ProjectMeta> {
    clone_project(&app, &url).await
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectAction {
    pub name: String,
    pub commands: Vec<String>,
}

fn list_actions(app: &AppHandle, project: &str) -> Result<Vec<ProjectAction>> {
    let path = project_dir(app, project)?.join(".guify").join("actions.yaml");
    let Ok(text) = std::fs::read_to_string(path) else {
        return Ok(Vec::new());
    };
    let value: serde_yaml::Value = serde_yaml::from_str(&text)
        .map_err(|e| Error::Command(format!("actions.yaml is invalid: {e}")))?;
    let Some(map) = value.as_mapping() else {
        return Err(Error::Command(
            "actions.yaml must map action names to commands".into(),
        ));
    };
    let mut out = Vec::new();
    for (key, value) in map {
        let Some(name) = key.as_str() else { continue };
        let raw = match value {
            serde_yaml::Value::String(s) => vec![s.as_str()],
            serde_yaml::Value::Sequence(items) => items.iter().filter_map(|i| i.as_str()).collect(),
            _ => Vec::new(),
        };
        let commands: Vec<String> = raw
            .into_iter()
            .map(|c| c.trim().to_string())
            .filter(|c| !c.is_empty())
            .collect();
        if !commands.is_empty() {
            out.push(ProjectAction {
                name: name.to_string(),
                commands,
            });
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

#[tauri::command]
pub async fn devmode_list_actions(app: AppHandle, project: String) -> Result<Vec<ProjectAction>> {
    list_actions(&app, &project)
}

pub(crate) fn project_dir(app: &AppHandle, name: &str) -> Result<PathBuf> {
    if !is_safe_part(name) {
        return Err(Error::Command("Invalid project name".into()));
    }
    Ok(projects_root(app)?.join(name))
}

fn is_safe_rel_path(rel: &str) -> bool {
    !rel.is_empty() && rel.split(['/', '\\']).all(is_safe_part)
}

fn normalize_rel_path(rel: &str) -> String {
    rel.replace('\\', "/")
}

async fn walk(dir: &Path, base: &Path, out: &mut Vec<String>) -> Result<()> {
    let mut stack = vec![dir.to_path_buf()];
    while let Some(current) = stack.pop() {
        let mut entries = tokio::fs::read_dir(&current).await?;
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            if entry.file_name() == ".git" {
                continue;
            }
            if entry.file_type().await?.is_dir() {
                if let Some(rel) = path.strip_prefix(base).ok() {
                    out.push(format!("{}/", normalize_rel_path(&rel.to_string_lossy())));
                }
                stack.push(path);
            } else if let Some(rel) = path.strip_prefix(base).ok() {
                out.push(normalize_rel_path(&rel.to_string_lossy()));
            }
        }
    }
    Ok(())
}

pub async fn list_files(app: &AppHandle, project: &str) -> Result<Vec<String>> {
    let dir = project_dir(app, project)?;
    let mut out = Vec::new();
    walk(&dir, &dir, &mut out).await?;
    out.sort();
    Ok(out)
}

pub async fn read_file(app: &AppHandle, project: &str, path: &str) -> Result<String> {
    if !is_safe_rel_path(path) {
        return Err(Error::Command("Invalid file path".into()));
    }
    let full = project_dir(app, project)?.join(path);
    let bytes = tokio::fs::read(&full).await?;
    String::from_utf8(bytes)
        .map_err(|_| Error::Command(format!("{path} is not a text file; binary editing is unsupported")))
}

pub async fn write_file(app: &AppHandle, project: &str, path: &str, contents: &str) -> Result<()> {
    if !is_safe_rel_path(path) {
        return Err(Error::Command("Invalid file path".into()));
    }
    let full = project_dir(app, project)?.join(path);
    if let Some(parent) = full.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    tokio::fs::write(&full, contents).await?;
    Ok(())
}

#[tauri::command]
pub async fn devmode_list_files(app: AppHandle, project: String) -> Result<Vec<String>> {
    list_files(&app, &project).await
}

#[tauri::command]
pub async fn devmode_read_file(app: AppHandle, project: String, path: String) -> Result<String> {
    read_file(&app, &project, &path).await
}

#[tauri::command]
pub async fn devmode_write_file(
    app: AppHandle,
    project: String,
    path: String,
    contents: String,
) -> Result<()> {
    write_file(&app, &project, &path, &contents).await
}

pub async fn create_path(app: &AppHandle, project: &str, path: &str, is_dir: bool) -> Result<()> {
    if !is_safe_rel_path(path) {
        return Err(Error::Command("Invalid file path".into()));
    }
    let full = project_dir(app, project)?.join(path);
    if full.exists() {
        return Err(Error::Command(format!("{path} already exists")));
    }
    if is_dir {
        tokio::fs::create_dir_all(&full).await?;
    } else {
        if let Some(parent) = full.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        tokio::fs::write(&full, "").await?;
    }
    Ok(())
}

pub async fn rename_path(app: &AppHandle, project: &str, from: &str, to: &str) -> Result<()> {
    if !is_safe_rel_path(from) || !is_safe_rel_path(to) {
        return Err(Error::Command("Invalid file path".into()));
    }
    if from == "metadata.json" {
        return Err(Error::Command("metadata.json cannot be renamed".into()));
    }
    let dir = project_dir(app, project)?;
    let old = dir.join(from);
    let new = dir.join(to);
    if !old.exists() {
        return Err(Error::Command(format!("{from} does not exist")));
    }
    if new.exists() {
        return Err(Error::Command(format!("{to} already exists")));
    }
    if let Some(parent) = new.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    tokio::fs::rename(&old, &new).await?;
    Ok(())
}

pub async fn delete_path(app: &AppHandle, project: &str, path: &str) -> Result<()> {
    if !is_safe_rel_path(path) {
        return Err(Error::Command("Invalid file path".into()));
    }
    if path == "metadata.json" {
        return Err(Error::Command("metadata.json is required and cannot be deleted".into()));
    }
    let full = project_dir(app, project)?.join(path);
    let meta = tokio::fs::metadata(&full).await?;
    if meta.is_dir() {
        tokio::fs::remove_dir_all(&full).await?;
    } else {
        tokio::fs::remove_file(&full).await?;
    }
    Ok(())
}

pub async fn update_project(
    app: &AppHandle,
    old_name: &str,
    meta: ProjectMeta,
) -> Result<ProjectMeta> {
    if !is_safe_part(&meta.name) {
        return Err(Error::Command(
            "Project name may only contain letters, numbers, spaces, dots, dashes and underscores".into(),
        ));
    }
    if !is_safe_file_name(&meta.entries.js)
        || (!meta.entries.css.is_empty() && !is_safe_file_name(&meta.entries.css))
    {
        return Err(Error::Command("Entry file names are invalid".into()));
    }
    let old_dir = project_dir(app, old_name)?;
    if !old_dir.exists() {
        return Err(Error::Command(format!("Project '{old_name}' not found")));
    }
    let new_dir = projects_root(app)?.join(&meta.name);
    if meta.name != old_name {
        if new_dir.exists() {
            return Err(Error::Command(format!(
                "Project '{}' already exists",
                meta.name
            )));
        }
        tokio::fs::rename(&old_dir, &new_dir).await?;
    }
    let json = serde_json::to_string_pretty(&meta)?;
    tokio::fs::write(new_dir.join("metadata.json"), json).await?;
    write_file_if_missing(&new_dir, &meta.entries.js, &format!("// NAME: {}\n", meta.name)).await?;
    if !meta.entries.css.is_empty() {
        write_file_if_missing(&new_dir, &meta.entries.css, &format!("/* {} */\n", meta.name)).await?;
    }
    Ok(meta)
}

pub async fn delete_project(app: &AppHandle, name: &str) -> Result<()> {
    let dir = project_dir(app, name)?;
    if !dir.exists() {
        return Err(Error::Command(format!("Project '{name}' not found")));
    }
    tokio::fs::remove_dir_all(&dir).await?;
    Ok(())
}

#[tauri::command]
pub async fn devmode_create_path(
    app: AppHandle,
    project: String,
    path: String,
    is_dir: bool,
) -> Result<()> {
    create_path(&app, &project, &path, is_dir).await
}

#[tauri::command]
pub async fn devmode_rename_path(
    app: AppHandle,
    project: String,
    from_path: String,
    to_path: String,
) -> Result<()> {
    rename_path(&app, &project, &from_path, &to_path).await
}

#[tauri::command]
pub async fn devmode_delete_path(app: AppHandle, project: String, path: String) -> Result<()> {
    delete_path(&app, &project, &path).await
}

#[tauri::command]
pub async fn devmode_update_project(
    app: AppHandle,
    old_name: String,
    meta: ProjectMeta,
) -> Result<ProjectMeta> {
    update_project(&app, &old_name, meta).await
}

#[tauri::command]
pub async fn devmode_delete_project(app: AppHandle, name: String) -> Result<()> {
    delete_project(&app, &name).await
}

#[tauri::command]
pub async fn devmode_project_path(app: AppHandle, name: String) -> Result<String> {
    let dir = project_dir(&app, &name)?;
    if !dir.exists() {
        return Err(Error::Command(format!("Project '{name}' not found")));
    }
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn devmode_reveal_project(app: AppHandle, name: String) -> Result<()> {
    let dir = project_dir(&app, &name)?;
    if !dir.exists() {
        return Err(Error::Command(format!("Project '{name}' not found")));
    }
    #[cfg(windows)]
    {
        std::process::Command::new("explorer")
            .arg(dir.as_os_str())
            .spawn()
            .map_err(|e| Error::Other(e.to_string()))?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = dir;
        Err(Error::Command("Reveal in folder is only supported on Windows".into()))
    }
}
