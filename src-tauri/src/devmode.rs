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
    if !is_safe_file_name(&meta.entries.js) || !is_safe_file_name(&meta.entries.css) {
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
    write_file_if_missing(&dir, &meta.entries.css, &format!("/* {} */\n", meta.name)).await?;
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

fn project_dir(app: &AppHandle, name: &str) -> Result<PathBuf> {
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
            if entry.file_type().await?.is_dir() {
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
