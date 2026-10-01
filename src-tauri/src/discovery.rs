use crate::error::{Error, Result};
use futures::stream::{self, StreamExt};
use serde::{Deserialize, Serialize};

const SEARCH_URL: &str = "https://api.github.com/search/repositories";
const RAW: &str = "https://raw.githubusercontent.com";
const MARKETPLACE_RAW: &str = "https://raw.githubusercontent.com/spicetify/marketplace/main";
const MARKET_SNIPPETS_URL: &str =
    "https://raw.githubusercontent.com/spicetify/marketplace/main/resources/snippets.json";
const BLACKLIST_URL: &str = "https://raw.githubusercontent.com/spicetify/marketplace/main/resources/blacklist.json";
const LATEST_RELEASE_URL: &str = "https://api.github.com/repos/spicetify/spicetify-cli/releases/latest";
const PER_PAGE: u32 = 100;

#[derive(Deserialize)]
struct SearchResponse {
    items: Vec<Repo>,
}

#[derive(Deserialize)]
struct Repo {
    full_name: String,
    html_url: String,
    default_branch: String,
    stargazers_count: u64,
    archived: bool,
    updated_at: Option<String>,
    created_at: Option<String>,
}

#[derive(Deserialize)]
struct Blacklist {
    repos: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct Release {
    tag_name: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Author {
    pub name: String,
    pub url: String,
}

#[derive(Deserialize)]
struct Manifest {
    name: Option<String>,
    description: Option<String>,
    usercss: Option<String>,
    main: Option<String>,
    authors: Option<Vec<Author>>,
    preview: Option<String>,
    readme: Option<String>,
    tags: Option<Vec<String>>,
    branch: Option<String>,
    schemes: Option<String>,
    include: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ThemeCard {
    pub title: String,
    pub subtitle: String,
    pub authors: Vec<Author>,
    pub user: String,
    pub repo: String,
    pub branch: String,
    pub image_url: Option<String>,
    pub readme_url: Option<String>,
    pub stars: u64,
    pub tags: Vec<String>,
    pub css_url: Option<String>,
    pub schemes_url: Option<String>,
    pub include: Vec<String>,
    pub archived: bool,
    pub updated_at: String,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionCard {
    pub title: String,
    pub subtitle: String,
    pub authors: Vec<Author>,
    pub user: String,
    pub repo: String,
    pub branch: String,
    pub image_url: Option<String>,
    pub readme_url: Option<String>,
    pub stars: u64,
    pub tags: Vec<String>,
    pub main_url: Option<String>,
    pub archived: bool,
    pub updated_at: String,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SnippetCard {
    pub id: String,
    pub title: String,
    pub description: String,
    pub code: String,
    pub preview_url: Option<String>,
}

#[derive(Deserialize)]
struct RawSnippet {
    title: Option<String>,
    description: Option<String>,
    code: Option<String>,
    preview: Option<String>,
}

fn resolve(user: &str, repo: &str, branch: &str, path: &str) -> String {
    if path.starts_with("http") {
        path.to_string()
    } else {
        format!("{RAW}/{user}/{repo}/{branch}/{path}")
    }
}

fn split_full(full: &str) -> (&str, &str) {
    match full.split_once('/') {
        Some((u, r)) => (u, r),
        None => (full, full),
    }
}

fn default_authors(user: &str) -> Vec<Author> {
    vec![Author {
        name: user.to_string(),
        url: format!("https://github.com/{user}"),
    }]
}

fn glob_match(pattern: &str, text: &str) -> bool {
    let p: Vec<char> = pattern.chars().collect();
    let t: Vec<char> = text.chars().collect();
    let (mut pi, mut ti) = (0usize, 0usize);
    let (mut star, mut mark) = (usize::MAX, 0usize);
    while ti < t.len() {
        if pi < p.len() && p[pi] == t[ti] {
            pi += 1;
            ti += 1;
        } else if pi < p.len() && p[pi] == '*' {
            star = pi;
            mark = ti;
            pi += 1;
        } else if star != usize::MAX {
            pi = star + 1;
            mark += 1;
            ti = mark;
        } else {
            return false;
        }
    }
    while pi < p.len() && p[pi] == '*' {
        pi += 1;
    }
    pi == p.len()
}

fn is_blacklisted(html_url: &str, patterns: &[String]) -> bool {
    let url = html_url.trim_end_matches('/').to_lowercase();
    patterns.iter().any(|raw| {
        let p = raw.trim();
        if p.is_empty() || p.starts_with("//") {
            return false;
        }
        glob_match(&p.trim_end_matches('/').to_lowercase(), &url)
    })
}

async fn fetch_blacklist(client: &reqwest::Client) -> Vec<String> {
    let Some(resp) = client
        .get(BLACKLIST_URL)
        .send()
        .await
        .ok()
        .and_then(|r| r.error_for_status().ok())
    else {
        return vec![];
    };
    resp.json::<Blacklist>().await.ok().and_then(|b| b.repos).unwrap_or_default()
}

async fn fetch_manifest(client: &reqwest::Client, user: &str, repo: &str, branch: &str) -> Vec<Manifest> {
    let url = format!("{RAW}/{user}/{repo}/{branch}/manifest.json");
    let Some(text) = client
        .get(&url)
        .send()
        .await
        .ok()
        .and_then(|r| r.error_for_status().ok())
    else {
        return vec![];
    };
    let Ok(text) = text.text().await else { return vec![] };
    if let Ok(arr) = serde_json::from_str::<Vec<Manifest>>(&text) {
        return arr;
    }
    serde_json::from_str::<Manifest>(&text).map(|m| vec![m]).unwrap_or_default()
}

async fn search_repos(
    client: &reqwest::Client,
    topic: &str,
    page: u32,
    show_archived: bool,
) -> Result<Vec<Repo>> {
    let q = urlencoding::encode(&format!("topic:{topic}")).to_string();
    let url = format!("{SEARCH_URL}?q={q}&sort=stars&order=desc&per_page={PER_PAGE}&page={page}");

    let resp: SearchResponse = client
        .get(&url)
        .send()
        .await?
        .error_for_status()
        .map_err(|e| Error::Other(format!("GitHub search failed: {e}")))?
        .json()
        .await?;

    let blacklist = fetch_blacklist(client).await;

    Ok(resp
        .items
        .into_iter()
        .filter(|r| !is_blacklisted(&r.html_url, &blacklist))
        .filter(|r| show_archived || !r.archived)
        .collect())
}

fn build_theme(m: &Manifest, user: &str, repo: &str, r: &Repo) -> Option<ThemeCard> {
    let title = m.name.clone()?;
    let usercss = m.usercss.clone()?;
    let subtitle = m.description.clone()?;
    let branch = m.branch.clone().unwrap_or_else(|| r.default_branch.clone());

    Some(ThemeCard {
        title,
        subtitle,
        authors: m.authors.clone().unwrap_or_else(|| default_authors(user)),
        user: user.to_string(),
        repo: repo.to_string(),
        branch: branch.clone(),
        image_url: m.preview.as_ref().map(|p| resolve(user, repo, &branch, p)),
        readme_url: m.readme.as_ref().map(|p| resolve(user, repo, &branch, p)),
        stars: r.stargazers_count,
        tags: m.tags.clone().unwrap_or_default(),
        css_url: Some(resolve(user, repo, &branch, &usercss)),
        schemes_url: m.schemes.as_ref().map(|s| resolve(user, repo, &branch, s)),
        include: m.include.clone().unwrap_or_default(),
        archived: r.archived,
        updated_at: r.updated_at.clone().unwrap_or_default(),
        created_at: r.created_at.clone().unwrap_or_default(),
    })
}

fn build_extension(m: &Manifest, user: &str, repo: &str, r: &Repo) -> Option<ExtensionCard> {
    let title = m.name.clone()?;
    let main = m.main.clone()?;
    let subtitle = m.description.clone().unwrap_or_default();
    let branch = m.branch.clone().unwrap_or_else(|| r.default_branch.clone());

    Some(ExtensionCard {
        title,
        subtitle,
        authors: m.authors.clone().unwrap_or_else(|| default_authors(user)),
        user: user.to_string(),
        repo: repo.to_string(),
        branch: branch.clone(),
        image_url: m.preview.as_ref().map(|p| resolve(user, repo, &branch, p)),
        readme_url: m.readme.as_ref().map(|p| resolve(user, repo, &branch, p)),
        stars: r.stargazers_count,
        tags: m.tags.clone().unwrap_or_default(),
        main_url: Some(resolve(user, repo, &branch, &main)),
        archived: r.archived,
        updated_at: r.updated_at.clone().unwrap_or_default(),
        created_at: r.created_at.clone().unwrap_or_default(),
    })
}

pub async fn discover_themes(client: &reqwest::Client, page: u32, show_archived: bool) -> Result<Vec<ThemeCard>> {
    let repos = search_repos(client, "spicetify-themes", page, show_archived).await?;
    let pages: Vec<Vec<ThemeCard>> = stream::iter(repos.into_iter().map(|r| {
        let client = client.clone();
        async move {
            let (user, repo) = split_full(&r.full_name);
            let manifests = fetch_manifest(&client, user, repo, &r.default_branch).await;
            manifests.iter().filter_map(|m| build_theme(m, user, repo, &r)).collect::<Vec<_>>()
        }
    }))
    .buffer_unordered(8)
    .collect()
    .await;
    Ok(pages.into_iter().flatten().collect())
}

pub async fn discover_extensions(client: &reqwest::Client, page: u32, show_archived: bool) -> Result<Vec<ExtensionCard>> {
    let repos = search_repos(client, "spicetify-extensions", page, show_archived).await?;
    let pages: Vec<Vec<ExtensionCard>> = stream::iter(repos.into_iter().map(|r| {
        let client = client.clone();
        async move {
            let (user, repo) = split_full(&r.full_name);
            let manifests = fetch_manifest(&client, user, repo, &r.default_branch).await;
            manifests
                .iter()
                .filter_map(|m| build_extension(m, user, repo, &r))
                .collect::<Vec<_>>()
        }
    }))
    .buffer_unordered(8)
    .collect()
    .await;
    Ok(pages.into_iter().flatten().collect())
}

pub async fn discover_snippets(client: &reqwest::Client) -> Result<Vec<SnippetCard>> {
    let resp = client
        .get(MARKET_SNIPPETS_URL)
        .send()
        .await?
        .error_for_status()
        .map_err(|e| Error::Other(format!("marketplace snippets fetch failed: {e}")))?;
    let raw: Vec<RawSnippet> = resp.json().await?;
    Ok(raw
        .into_iter()
        .filter_map(|s| {
            let title = s.title?.trim().to_string();
            let code = s.code?;
            if title.is_empty() || code.trim().is_empty() {
                return None;
            }
            let preview_url = s.preview.and_then(|p| {
                if p.is_empty() {
                    None
                } else if p.starts_with("http") {
                    Some(p)
                } else {
                    Some(format!("{MARKETPLACE_RAW}/{p}"))
                }
            });
            Some(SnippetCard {
                id: title.to_lowercase(),
                title,
                description: s.description.unwrap_or_default(),
                code,
                preview_url,
            })
        })
        .collect())
}

pub async fn fetch_text(client: &reqwest::Client, url: &str) -> Result<String> {
    Ok(client.get(url).send().await?.error_for_status()?.text().await?)
}

pub async fn latest_spicetify_version(client: &reqwest::Client) -> Result<String> {
    let rel: Release = client
        .get(LATEST_RELEASE_URL)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok(rel.tag_name.trim_start_matches('v').to_string())
}

pub fn is_newer(latest: &str, current: &str) -> bool {
    let parse = |v: &str| -> Vec<u64> {
        v.split('.')
            .filter_map(|p| p.chars().take_while(|c| c.is_ascii_digit()).collect::<String>().parse().ok())
            .collect()
    };
    let (a, b) = (parse(latest), parse(current));
    let n = a.len().max(b.len());
    for i in 0..n {
        let x = a.get(i).copied().unwrap_or(0);
        let y = b.get(i).copied().unwrap_or(0);
        if x != y {
            return x > y;
        }
    }
    false
}
