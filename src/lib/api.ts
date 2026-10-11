import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";

export interface Author {
  name: string;
  url: string;
}

export interface ThemeCard {
  title: string;
  subtitle: string;
  authors: Author[];
  user: string;
  repo: string;
  branch: string;
  imageUrl: string | null;
  readmeUrl: string | null;
  stars: number;
  tags: string[];
  cssUrl: string | null;
  schemesUrl: string | null;
  include: string[];
  archived: boolean;
  updatedAt: string;
  createdAt: string;
}

export interface Status {
  installed: boolean;
  version: string;
  spicetifyPath: string;
  userdataPath: string;
  currentTheme: string;
  colorScheme: string;
  extensions: string[];
  customApps: string[];
  spotifyPath: string;
  backupVersion: string;
  config: Record<string, string>;
}

export interface LocalTheme {
  name: string;
  schemes: string[];
}

export interface ExtensionCard {
  title: string;
  subtitle: string;
  authors: Author[];
  user: string;
  repo: string;
  branch: string;
  imageUrl: string | null;
  readmeUrl: string | null;
  stars: number;
  tags: string[];
  mainUrl: string | null;
  archived: boolean;
  updatedAt: string;
  createdAt: string;
}

export interface LocalExtension {
  name: string;
}

export interface InstallOrigin {
  name: string;
  user: string;
  repo: string;
  branch: string;
  installedAt: string;
  imageUrl: string | null;
}

export interface CliLine {
  stream: string;
  line: string;
}

export interface Snippet {
  id: string;
  title: string;
  css: string;
  enabled: boolean;
}

export interface SnippetCard {
  id: string;
  title: string;
  description: string;
  code: string;
  previewUrl: string | null;
}

export interface MarketSnippet {
  id: string;
  title: string;
  description: string;
  code: string;
  enabled: boolean;
  previewUrl: string | null;
}

export const SNIPPET_EXT = "guify-snippets.js";

export interface ProjectEntries {
  js: string;
  css: string;
}

export interface ProjectMeta {
  name: string;
  tags: string[];
  version: string;
  authors: string[];
  description: string;
  entries: ProjectEntries;
  hasMixins: boolean;
  dependencies: Record<string, string>;
  preview: string;
}

export const getStatus = () => invoke<Status>("get_status");
export const runCli = (command: string, args: string[] = []) =>
  invoke<number>("run_cli", { command, args });
export const watchStart = () => invoke<void>("watch_start");
export const watchStop = () => invoke<void>("watch_stop");
export const watchRunning = () => invoke<boolean>("watch_running");
export const discoverThemes = (page: number, showArchived: boolean) =>
  invoke<ThemeCard[]>("discover_themes", { page, showArchived });
export const getReadme = (url: string) => invoke<string>("get_readme", { url });
export const listLocalThemes = () => invoke<LocalTheme[]>("list_local_themes");
export const installTheme = (card: ThemeCard, scheme?: string | null) =>
  invoke<string>("install_theme", { card, scheme: scheme ?? null });
export const removeTheme = (name: string) => invoke<void>("remove_theme", { name });
export const setActiveTheme = (name: string, scheme?: string | null) =>
  invoke<void>("set_active_theme", { name, scheme: scheme ?? null });
export const getInstalls = () => invoke<InstallOrigin[]>("get_installs");
export const discoverExtensions = (page: number, showArchived: boolean) =>
  invoke<ExtensionCard[]>("discover_extensions", { page, showArchived });
export const listLocalExtensions = () => invoke<LocalExtension[]>("list_local_extensions");
export const installExtension = (card: ExtensionCard) =>
  invoke<string>("install_extension", { card });
export const removeExtension = (name: string) => invoke<void>("remove_extension", { name });
export const setExtensionEnabled = (name: string, enabled: boolean) =>
  invoke<void>("set_extension_enabled", { name, enabled });
export const checkUpdate = () => invoke<string | null>("check_update");
export const fixSpicetify = () => invoke<void>("fix_spicetify");
export const setDevtools = (open: boolean) => invoke<void>("set_devtools", { open });
export const listSnippets = () => invoke<Snippet[]>("list_snippets");
export const saveSnippetApi = (snippet: Snippet) => invoke<Snippet[]>("save_snippet", { snippet });
export const deleteSnippetApi = (id: string) => invoke<Snippet[]>("delete_snippet", { id });
export const setSnippetsBridge = (enabled: boolean) =>
  invoke<void>("set_snippets_enabled", { enabled });
export const discoverSnippets = () => invoke<SnippetCard[]>("discover_snippets");
export const listMarketSnippets = () => invoke<MarketSnippet[]>("list_market_snippets");
export const addMarketSnippetApi = (card: SnippetCard) =>
  invoke<MarketSnippet[]>("add_market_snippet", { card });
export const removeMarketSnippetApi = (id: string) =>
  invoke<MarketSnippet[]>("remove_market_snippet", { id });
export const toggleMarketSnippetApi = (id: string, enabled: boolean) =>
  invoke<MarketSnippet[]>("toggle_market_snippet", { id, enabled });
export const snippetsConnected = () => invoke<boolean>("snippets_connected");
export type WindowControls = "macos" | "linux" | "windows" | "hyprland";
export const getWindowControls = () => invoke<WindowControls>("window_controls");
export const onCliOutput = (cb: (line: CliLine) => void) =>
  listen<CliLine>("cli-output", (e) => cb(e.payload));
export const onSnippetsConnected = (cb: (connected: boolean) => void) =>
  listen<boolean>("snippets-connected", (e) => cb(e.payload));
export const devmodeListProjects = () => invoke<ProjectMeta[]>("devmode_list_projects");
export const devmodeCreateProject = (meta: ProjectMeta) =>
  invoke<ProjectMeta>("devmode_create_project", { meta });
export const devmodeCloneProject = (url: string) =>
  invoke<ProjectMeta>("devmode_clone_project", { url });
export interface DevmodeAction {
  name: string;
  commands: string[];
}
export const devmodeListActions = (project: string) =>
  invoke<DevmodeAction[]>("devmode_list_actions", { project });
export const devmodeListFiles = (project: string) =>
  invoke<string[]>("devmode_list_files", { project });
export const devmodeReadFile = (project: string, path: string) =>
  invoke<string>("devmode_read_file", { project, path });
export const devmodeWriteFile = (project: string, path: string, contents: string) =>
  invoke<void>("devmode_write_file", { project, path, contents });
export const devmodeCreatePath = (project: string, path: string, isDir: boolean) =>
  invoke<void>("devmode_create_path", { project, path, isDir });
export const devmodeRenamePath = (project: string, fromPath: string, toPath: string) =>
  invoke<void>("devmode_rename_path", { project, fromPath, toPath });
export const devmodeDeletePath = (project: string, path: string) =>
  invoke<void>("devmode_delete_path", { project, path });
export const devmodeUpdateProject = (oldName: string, meta: ProjectMeta) =>
  invoke<ProjectMeta>("devmode_update_project", { oldName, meta });
export const devmodeDeleteProject = (name: string) =>
  invoke<void>("devmode_delete_project", { name });
export const devmodeProjectPath = (name: string) =>
  invoke<string>("devmode_project_path", { name });
export const devmodeRevealProject = (name: string) =>
  invoke<void>("devmode_reveal_project", { name });
export const devmodeInstallBridge = () => invoke<void>("devmode_install_bridge");
export const devmodeSend = (payload: string) => invoke<void>("devmode_send", { payload });
export const devmodeConnected = () => invoke<boolean>("devmode_connected");
export const onDevmodeConnected = (cb: (connected: boolean) => void) =>
  listen<boolean>("devmode-connected", (e) => cb(e.payload));

export interface DevmodeConsoleLine {
  id: number;
  line: string;
}

export interface DevmodeConsoleResult {
  id: number;
  ok: boolean;
  result: string;
}

export const devmodeConsoleOpen = (provider: string, project: string) =>
  invoke<number>("devmode_console_open", { provider, project });
export const devmodeConsoleWrite = (id: number, line: string) =>
  invoke<void>("devmode_console_write", { id, line });
export const devmodeConsoleClose = (id: number) =>
  invoke<void>("devmode_console_close", { id });
export const devmodeConsoleEval = (id: number, code: string) =>
  invoke<void>("devmode_console_eval", { id, code });
export const onDevmodeConsoleLine = (cb: (line: DevmodeConsoleLine) => void) =>
  listen<DevmodeConsoleLine>("devmode-console-line", (e) => cb(e.payload));
export const onDevmodeConsoleResult = (cb: (result: DevmodeConsoleResult) => void) =>
  listen<DevmodeConsoleResult>("devmode-console-result", (e) => cb(e.payload));

export { openUrl };
