import { getCurrentWindow } from "@tauri-apps/api/window";

const win = () => getCurrentWindow();

export const minimize = () => win().minimize();
export const toggleMaximize = () => win().toggleMaximize();
export const closeWindow = () => win().close();
export const isMaximized = () => win().isMaximized();
