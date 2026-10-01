import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  addMarketSnippetApi,
  checkUpdate,
  deleteSnippetApi,
  discoverExtensions,
  discoverSnippets,
  discoverThemes,
  fixSpicetify,
  getInstalls,
  getStatus,
  installExtension,
  installTheme,
  listLocalExtensions,
  listLocalThemes,
  listMarketSnippets,
  listSnippets,
  onCliOutput,
  onSnippetsConnected,
  removeExtension,
  removeMarketSnippetApi,
  removeTheme,
  runCli,
  saveSnippetApi,
  setActiveTheme,
  setDevtools,
  setExtensionEnabled,
  setSnippetsBridge,
  snippetsConnected,
  toggleMarketSnippetApi,
  watchRunning,
  watchStart,
  watchStop,
  type CliLine,
  type ExtensionCard,
  type InstallOrigin,
  type LocalExtension,
  type LocalTheme,
  type MarketSnippet,
  type Snippet,
  type SnippetCard,
  type Status,
  type ThemeCard,
} from "@/lib/api";

export type View =
  | "dashboard"
  | "browse"
  | "installed"
  | "snippets"
  | "advanced"
  | "settings";

export type ActivityKind =
  | "run"
  | "install"
  | "apply"
  | "remove"
  | "update"
  | "fix"
  | "theme"
  | "watch"
  | "info";

export type ActivityState = "running" | "done" | "error";

export interface Activity {
  id: number;
  kind: ActivityKind;
  text: string;
  state: ActivityState;
}

const MAX_LINES = 500;
const MAX_ACTIVITY = 60;
const ADV_KEY = "guify.advanced";
const AAP_KEY = "guify.autoApply";

interface Ctx {
  view: View;
  setView: (v: View) => void;
  booting: boolean;
  advanced: boolean;
  setAdvanced: (v: boolean) => void;
  status: Status | null;
  localThemes: LocalTheme[];
  localExtensions: LocalExtension[];
  installs: InstallOrigin[];
  activeTheme: string;
  enabledExtensions: string[];
  cards: ThemeCard[];
  browseLoading: boolean;
  showArchived: boolean;
  setShowArchived: (v: boolean) => void;
  extCards: ExtensionCard[];
  extLoading: boolean;
  snippets: Snippet[];
  snippetCards: SnippetCard[];
  snippetLoading: boolean;
  marketSnippets: MarketSnippet[];
  spotifyConnected: boolean;
  cliLines: CliLine[];
  clearCli: () => void;
  activities: Activity[];
  clearActivities: () => void;
  logOpen: boolean;
  setLogOpen: (v: boolean) => void;
  watchOn: boolean;
  busy: string | null;
  pending: boolean;
  autoApply: boolean;
  setAutoApply: (v: boolean) => void;
  updateAvailable: string | null;
  devtools: boolean;
  refreshStatus: () => Promise<void>;
  refreshLocal: () => Promise<void>;
  loadBrowse: (reset?: boolean) => Promise<void>;
  moreBrowse: () => Promise<void>;
  loadExtensions: (reset?: boolean) => Promise<void>;
  moreExtensions: () => Promise<void>;
  toggleWatch: () => Promise<void>;
  install: (card: ThemeCard, scheme?: string | null) => Promise<void>;
  activate: (name: string, scheme?: string | null) => Promise<void>;
  remove: (name: string) => Promise<void>;
  installExt: (card: ExtensionCard) => Promise<void>;
  removeExt: (name: string) => Promise<void>;
  toggleExtEnabled: (name: string, enabled: boolean) => Promise<void>;
  loadSnippets: () => Promise<void>;
  saveSnippet: (snippet: Snippet) => Promise<void>;
  deleteSnippet: (id: string) => Promise<void>;
  setSnippetsEnabled: (enabled: boolean) => Promise<void>;
  addSnippet: (card: SnippetCard) => Promise<void>;
  removeSnippet: (id: string) => Promise<void>;
  toggleSnippet: (id: string, enabled: boolean) => Promise<void>;
  applyChanges: () => Promise<void>;
  run: (command: string, args?: string[]) => Promise<void>;
  runCustom: (text: string) => Promise<void>;
  fix: () => Promise<void>;
  update: () => Promise<void>;
  toggleDevtools: (v: boolean) => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp outside provider");
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>("dashboard");
  const [advanced, setAdvancedState] = useState<boolean>(
    () => localStorage.getItem(ADV_KEY) === "1",
  );
  const [autoApply, setAutoApplyState] = useState<boolean>(
    () => localStorage.getItem(AAP_KEY) !== "0",
  );
  const [status, setStatus] = useState<Status | null>(null);
  const [localThemes, setLocalThemes] = useState<LocalTheme[]>([]);
  const [localExtensions, setLocalExtensions] = useState<LocalExtension[]>([]);
  const [installs, setInstalls] = useState<InstallOrigin[]>([]);
  const [cards, setCards] = useState<ThemeCard[]>([]);
  const [extCards, setExtCards] = useState<ExtensionCard[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [snippetCards, setSnippetCards] = useState<SnippetCard[]>([]);
  const [snippetLoading, setSnippetLoading] = useState(false);
  const [marketSnippets, setMarketSnippets] = useState<MarketSnippet[]>([]);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [extLoading, setExtLoading] = useState(false);
  const [showArchived, setShowArchivedState] = useState(false);
  const [cliLines, setCliLines] = useState<CliLine[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [watchOn, setWatchOn] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);
  const [devtools, setDevtoolsState] = useState(false);
  const [booting, setBooting] = useState(true);
  const themePage = useRef(0);
  const extPage = useRef(0);
  const themeReq = useRef(0);
  const extReq = useRef(0);
  const actId = useRef(0);
  const logOpenRef = useRef(false);
  const loadedOnce = useRef(false);

  const setAdvanced = useCallback((v: boolean) => {
    setAdvancedState(v);
    localStorage.setItem(ADV_KEY, v ? "1" : "0");
  }, []);

  const setAutoApply = useCallback((v: boolean) => {
    setAutoApplyState(v);
    localStorage.setItem(AAP_KEY, v ? "1" : "0");
  }, []);

  const clearCli = useCallback(() => setCliLines([]), []);
  const clearActivities = useCallback(() => setActivities([]), []);

  const pushActivity = useCallback(
    (kind: ActivityKind, text: string, state: ActivityState = "running") => {
      const id = ++actId.current;
      setActivities((prev) => {
        const next = [...prev, { id, kind, text, state }];
        return next.length > MAX_ACTIVITY ? next.slice(next.length - MAX_ACTIVITY) : next;
      });
      return id;
    },
    [],
  );

  const finishActivity = useCallback(
    (id: number, text: string, state: ActivityState = "done") => {
      setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, text, state } : a)));
    },
    [],
  );

  useEffect(() => {
    logOpenRef.current = logOpen;
  }, [logOpen]);

  // Opens Mission Control for an action; returns whether it was already open.
  const openLogFor = useCallback(() => {
    const wasOpen = logOpenRef.current;
    if (!wasOpen) setLogOpen(true);
    return wasOpen;
  }, []);

  const closeLogAfter = useCallback((wasOpen: boolean) => {
    if (!wasOpen) window.setTimeout(() => setLogOpen(false), 1400);
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await getStatus());
    } catch {
      setStatus(null);
    }
  }, []);

  const refreshLocal = useCallback(async () => {
    try {
      const [themes, exts, origins] = await Promise.all([
        listLocalThemes(),
        listLocalExtensions().catch(() => [] as LocalExtension[]),
        getInstalls(),
      ]);
      setLocalThemes(themes);
      setLocalExtensions(exts);
      setInstalls(origins);
    } catch {
      setLocalThemes([]);
    }
  }, []);

  const fetchThemes = useCallback(
    async (p: number, archived: boolean, reset: boolean) => {
      const req = ++themeReq.current;
      setBrowseLoading(true);
      try {
        const res = await discoverThemes(p, archived);
        if (req !== themeReq.current) return;
        setCards((prev) => (reset ? res : [...prev, ...res]));
        themePage.current = p + 1;
      } catch (e) {
        if (req !== themeReq.current) return;
        toast.error(`Could not load themes: ${String(e)}`);
      } finally {
        if (req === themeReq.current) setBrowseLoading(false);
      }
    },
    [],
  );

  const fetchExtensions = useCallback(async (p: number, reset: boolean) => {
    const req = ++extReq.current;
    setExtLoading(true);
    try {
      const res = await discoverExtensions(p, false);
      if (req !== extReq.current) return;
      setExtCards((prev) => (reset ? res : [...prev, ...res]));
      extPage.current = p + 1;
    } catch (e) {
      if (req !== extReq.current) return;
      toast.error(`Could not load extensions: ${String(e)}`);
    } finally {
      if (req === extReq.current) setExtLoading(false);
    }
  }, []);

  const loadBrowse = useCallback(
    (reset = true) => fetchThemes(0, showArchived, reset),
    [fetchThemes, showArchived],
  );
  const moreBrowse = useCallback(
    () => fetchThemes(themePage.current, showArchived, false),
    [fetchThemes, showArchived],
  );
  const loadExtensions = useCallback(
    (reset = true) => fetchExtensions(0, reset),
    [fetchExtensions],
  );
  const moreExtensions = useCallback(
    () => fetchExtensions(extPage.current, false),
    [fetchExtensions],
  );

  const setShowArchived = useCallback(
    (v: boolean) => {
      setShowArchivedState(v);
      fetchThemes(0, v, true);
    },
    [fetchThemes],
  );

  const toggleWatch = useCallback(async () => {
    try {
      if (watchOn) {
        await watchStop();
        setWatchOn(false);
        pushActivity("watch", "Stopped watching", "done");
        toast.success("Stopped watching");
      } else {
        await watchStart();
        setWatchOn(true);
        pushActivity("watch", "Watching for changes", "done");
        toast.success("Watching - edits apply automatically");
      }
    } catch (e) {
      pushActivity("watch", "Watch toggle failed", "error");
      toast.error(String(e));
    }
  }, [watchOn, pushActivity]);

  const finalize = useCallback(
    async (aid: number, id: string | number, msg: string, doneText: string) => {
      if (!autoApply) {
        setPending(true);
        finishActivity(aid, doneText, "done");
        toast.success(`${msg} - apply your changes`, { id });
        return;
      }
      toast.loading("Applying changes…", { id });
      try {
        await runCli("apply", []);
        setPending(false);
        finishActivity(aid, doneText, "done");
        toast.success(msg, { id });
      } catch (e) {
        setPending(true);
        finishActivity(aid, doneText, "done");
        toast.error(`${msg} - apply failed`, { id });
      }
    },
    [autoApply, finishActivity],
  );

  const install = useCallback(
    async (card: ThemeCard, scheme?: string | null) => {
      setBusy(card.repo);
      const aid = pushActivity("install", `Installing ${card.title}`);
      const id = toast.loading(`Installing ${card.title}…`);
      try {
        await installTheme(card, scheme ?? null);
        await finalize(aid, id, `${card.title} installed`, `Installed ${card.title}`);
        await Promise.all([refreshStatus(), refreshLocal()]);
      } catch (e) {
        finishActivity(aid, `Failed to install ${card.title}`, "error");
        toast.error(String(e), { id });
      } finally {
        setBusy(null);
      }
    },
    [refreshStatus, refreshLocal, pushActivity, finishActivity, finalize],
  );

  const activate = useCallback(
    async (name: string, scheme?: string | null) => {
      setBusy(name);
      const aid = pushActivity("theme", `Selecting ${name}`);
      const id = toast.loading(`Applying ${name}…`);
      try {
        await setActiveTheme(name, scheme ?? null);
        await finalize(aid, id, `${name} selected`, `Selected ${name}`);
        await refreshStatus();
      } catch (e) {
        finishActivity(aid, `Failed to select ${name}`, "error");
        toast.error(String(e), { id });
      } finally {
        setBusy(null);
      }
    },
    [refreshStatus, pushActivity, finishActivity, finalize],
  );

  const remove = useCallback(
    async (name: string) => {
      setBusy(name);
      const aid = pushActivity("remove", `Removing ${name}`);
      const id = toast.loading(`Removing ${name}…`);
      try {
        await removeTheme(name);
        await finalize(aid, id, `${name} removed`, `Removed ${name}`);
        await Promise.all([refreshStatus(), refreshLocal()]);
      } catch (e) {
        finishActivity(aid, `Failed to remove ${name}`, "error");
        toast.error(String(e), { id });
      } finally {
        setBusy(null);
      }
    },
    [refreshStatus, refreshLocal, pushActivity, finishActivity, finalize],
  );

  const installExt = useCallback(
    async (card: ExtensionCard) => {
      setBusy(card.repo);
      const aid = pushActivity("install", `Installing ${card.title}`);
      const id = toast.loading(`Installing ${card.title}…`);
      try {
        await installExtension(card);
        await finalize(aid, id, `${card.title} installed`, `Installed ${card.title}`);
        await Promise.all([refreshStatus(), refreshLocal()]);
      } catch (e) {
        finishActivity(aid, `Failed to install ${card.title}`, "error");
        toast.error(String(e), { id });
      } finally {
        setBusy(null);
      }
    },
    [refreshStatus, refreshLocal, pushActivity, finishActivity, finalize],
  );

  const removeExt = useCallback(
    async (name: string) => {
      setBusy(name);
      const aid = pushActivity("remove", `Removing ${name}`);
      const id = toast.loading(`Removing ${name}…`);
      try {
        await removeExtension(name);
        await finalize(aid, id, `${name} removed`, `Removed ${name}`);
        await Promise.all([refreshStatus(), refreshLocal()]);
      } catch (e) {
        finishActivity(aid, `Failed to remove ${name}`, "error");
        toast.error(String(e), { id });
      } finally {
        setBusy(null);
      }
    },
    [refreshStatus, refreshLocal, pushActivity, finishActivity, finalize],
  );

  const toggleExtEnabled = useCallback(
    async (name: string, enabled: boolean) => {
      setBusy(name);
      const aid = pushActivity("run", enabled ? `Enabling ${name}` : `Disabling ${name}`);
      const id = toast.loading(enabled ? `Enabling ${name}…` : `Disabling ${name}…`);
      try {
        await setExtensionEnabled(name, enabled);
        await finalize(
          aid,
          id,
          `${name} ${enabled ? "enabled" : "disabled"}`,
          enabled ? `Enabled ${name}` : `Disabled ${name}`,
        );
        await refreshStatus();
      } catch (e) {
        finishActivity(aid, `Failed to ${enabled ? "enable" : "disable"} ${name}`, "error");
        toast.error(String(e), { id });
      } finally {
        setBusy(null);
      }
    },
    [refreshStatus, pushActivity, finishActivity, finalize],
  );

  const loadSnippets = useCallback(async () => {
    try {
      setSnippets(await listSnippets());
    } catch {
      setSnippets([]);
    }
  }, []);

  const saveSnippet = useCallback(
    async (snippet: Snippet) => {
      try {
        setSnippets(await saveSnippetApi(snippet));
      } catch (e) {
        toast.error(String(e));
      }
    },
    [],
  );

  const deleteSnippet = useCallback(
    async (id: string) => {
      try {
        setSnippets(await deleteSnippetApi(id));
      } catch (e) {
        toast.error(String(e));
      }
    },
    [],
  );

  const setSnippetsEnabled = useCallback(
    async (enabled: boolean) => {
      setBusy("snippets");
      const aid = pushActivity("run", enabled ? "Enabling snippets" : "Disabling snippets");
      const id = toast.loading(enabled ? "Enabling snippets…" : "Disabling snippets…");
      try {
        await setSnippetsBridge(enabled);
        await finalize(
          aid,
          id,
          enabled ? "Snippets enabled" : "Snippets disabled",
          enabled ? "Snippets enabled" : "Snippets disabled",
        );
        await Promise.all([refreshStatus(), refreshLocal()]);
      } catch (e) {
        finishActivity(aid, "Snippets toggle failed", "error");
        toast.error(String(e), { id });
      } finally {
        setBusy(null);
      }
    },
    [refreshStatus, refreshLocal, pushActivity, finishActivity, finalize],
  );

  const addSnippet = useCallback(
    async (card: SnippetCard) => {
      setBusy(card.id);
      const aid = pushActivity("install", `Adding ${card.title}`);
      const id = toast.loading(`Adding ${card.title}…`);
      try {
        setMarketSnippets(await addMarketSnippetApi(card));
        finishActivity(aid, `Added ${card.title}`, "done");
        toast.success(`${card.title} added`, { id });
        await refreshStatus();
      } catch (e) {
        finishActivity(aid, `Failed to add ${card.title}`, "error");
        toast.error(String(e), { id });
      } finally {
        setBusy(null);
      }
    },
    [refreshStatus, pushActivity, finishActivity],
  );

  const removeSnippet = useCallback(
    async (id: string) => {
      setBusy(id);
      const aid = pushActivity("remove", "Removing snippet");
      const tid = toast.loading("Removing snippet…");
      try {
        setMarketSnippets(await removeMarketSnippetApi(id));
        finishActivity(aid, "Snippet removed", "done");
        toast.success("Snippet removed", { id: tid });
      } catch (e) {
        finishActivity(aid, "Failed to remove snippet", "error");
        toast.error(String(e), { id: tid });
      } finally {
        setBusy(null);
      }
    },
    [pushActivity, finishActivity],
  );

  const toggleSnippet = useCallback(
    async (id: string, enabled: boolean) => {
      setBusy(id);
      const aid = pushActivity("run", enabled ? "Enabling snippet" : "Disabling snippet");
      try {
        setMarketSnippets(await toggleMarketSnippetApi(id, enabled));
        finishActivity(aid, enabled ? "Snippet enabled" : "Snippet disabled", "done");
      } catch (e) {
        finishActivity(aid, "Snippet toggle failed", "error");
        toast.error(String(e));
      } finally {
        setBusy(null);
      }
    },
    [pushActivity, finishActivity],
  );

  const fetchSnippetCards = useCallback(async () => {
    setSnippetLoading(true);
    try {
      setSnippetCards(await discoverSnippets());
    } catch (e) {
      toast.error(`Could not load snippets: ${String(e)}`);
    } finally {
      setSnippetLoading(false);
    }
  }, []);

  const loadMarketSnippets = useCallback(async () => {
    try {
      setMarketSnippets(await listMarketSnippets());
    } catch {
      setMarketSnippets([]);
    }
  }, []);

  const applyChanges = useCallback(async () => {
    setBusy("apply");
    const wasOpen = openLogFor();
    const aid = pushActivity("apply", "Applying changes");
    const id = toast.loading("Applying changes…");
    try {
      await runCli("apply", []);
      setPending(false);
      await refreshStatus();
      finishActivity(aid, "Applied Spicetify", "done");
      toast.success("Changes applied", { id });
    } catch (e) {
      finishActivity(aid, "Apply failed", "error");
      toast.error(String(e), { id });
    } finally {
      setBusy(null);
      closeLogAfter(wasOpen);
    }
  }, [refreshStatus, pushActivity, finishActivity, openLogFor, closeLogAfter]);

  const run = useCallback(
    async (command: string, args: string[] = []) => {
      setBusy(command);
      const label = ["spicetify", command, ...args].join(" ");
      const aid = pushActivity("run", `Running ${label}`);
      try {
        await runCli(command, args);
        await refreshStatus();
        finishActivity(aid, `Ran ${label}`, "done");
      } catch (e) {
        finishActivity(aid, `${label} failed`, "error");
        toast.error(String(e));
      } finally {
        setBusy(null);
      }
    },
    [refreshStatus, pushActivity, finishActivity],
  );

  const runCustom = useCallback(
    async (text: string) => {
      const tokens = text.trim().split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return;
      const [command, ...args] = tokens;
      const wasOpen = openLogFor();
      await run(command, args);
      closeLogAfter(wasOpen);
    },
    [run, openLogFor, closeLogAfter],
  );

  const fix = useCallback(async () => {
    setBusy("fix");
    const wasOpen = openLogFor();
    const aid = pushActivity("fix", "Fixing Spicetify");
    const id = toast.loading("Fixing Spicetify…");
    try {
      await fixSpicetify();
      await refreshStatus();
      finishActivity(aid, "Fixed Spicetify", "done");
      toast.success("Spicetify fixed", { id });
    } catch (e) {
      finishActivity(aid, "Fix failed", "error");
      toast.error(String(e), { id });
    } finally {
      setBusy(null);
      closeLogAfter(wasOpen);
    }
  }, [refreshStatus, pushActivity, finishActivity, openLogFor, closeLogAfter]);

  const update = useCallback(async () => {
    setBusy("update");
    const wasOpen = openLogFor();
    const aid = pushActivity("update", "Updating Spicetify");
    const id = toast.loading("Updating Spicetify…");
    try {
      await runCli("update", []);
      setUpdateAvailable(null);
      await refreshStatus();
      finishActivity(aid, "Updated Spicetify", "done");
      toast.success("Spicetify updated", { id });
    } catch (e) {
      finishActivity(aid, "Update failed", "error");
      toast.error(String(e), { id });
    } finally {
      setBusy(null);
      closeLogAfter(wasOpen);
    }
  }, [refreshStatus, pushActivity, finishActivity, openLogFor, closeLogAfter]);

  const toggleDevtools = useCallback((v: boolean) => {
    setDevtoolsState(v);
    setDevtools(v).catch(() => {});
  }, []);

  useEffect(() => {
    snippetsConnected().then(setSpotifyConnected).catch(() => {});
    const un = onSnippetsConnected(setSpotifyConnected);
    return () => {
      un.then((f) => f());
    };
  }, []);

  useEffect(() => {
    const un = onCliOutput((line) => {
      setCliLines((prev) => {
        const next = [...prev, line];
        return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
      });
    });
    return () => {
      un.then((f) => f());
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      await Promise.all([refreshStatus(), refreshLocal(), loadSnippets(), loadMarketSnippets()]);
      if (alive) setBooting(false);
    })();
    watchRunning().then(setWatchOn).catch(() => {});
    checkUpdate().then(setUpdateAvailable).catch(() => {});
    if (!loadedOnce.current) {
      loadedOnce.current = true;
      pushActivity("info", "GUIFY ready", "done");
      fetchThemes(0, false, true);
      fetchExtensions(0, true);
      fetchSnippetCards();
    }
    return () => {
      alive = false;
    };
  }, [refreshStatus, refreshLocal, loadSnippets, loadMarketSnippets, fetchThemes, fetchExtensions, fetchSnippetCards, pushActivity]);

  const value = useMemo<Ctx>(
    () => ({
      view,
      setView,
      booting,
      advanced,
      setAdvanced,
      status,
      localThemes,
      localExtensions,
      installs,
      activeTheme:
        status?.currentTheme && localThemes.some((t) => t.name === status.currentTheme)
          ? status.currentTheme
          : "",
      enabledExtensions: status?.extensions ?? [],
      cards,
      browseLoading,
      showArchived,
      setShowArchived,
      extCards,
      extLoading,
      snippets,
      snippetCards,
      snippetLoading,
      marketSnippets,
      spotifyConnected,
      cliLines,
      clearCli,
      activities,
      clearActivities,
      logOpen,
      setLogOpen,
      watchOn,
      busy,
      pending,
      autoApply,
      setAutoApply,
      updateAvailable,
      devtools,
      refreshStatus,
      refreshLocal,
      loadBrowse,
      moreBrowse,
      loadExtensions,
      moreExtensions,
      toggleWatch,
      install,
      activate,
      remove,
      installExt,
      removeExt,
      toggleExtEnabled,
      loadSnippets,
      saveSnippet,
      deleteSnippet,
      setSnippetsEnabled,
      addSnippet,
      removeSnippet,
      toggleSnippet,
      applyChanges,
      run,
      runCustom,
      fix,
      update,
      toggleDevtools,
    }),
    [
      view, advanced, setAdvanced, status, localThemes, localExtensions, installs, booting,
      cards, browseLoading, showArchived, setShowArchived, extCards, extLoading, snippets,
      snippetCards, snippetLoading, marketSnippets, spotifyConnected,
      cliLines, clearCli, activities, clearActivities, logOpen, watchOn, busy, pending, autoApply, setAutoApply, updateAvailable, devtools,
      refreshStatus, refreshLocal, loadBrowse, moreBrowse, loadExtensions,
      moreExtensions, toggleWatch, install, activate, remove, installExt, removeExt, toggleExtEnabled,
      loadSnippets, saveSnippet, deleteSnippet, setSnippetsEnabled, addSnippet, removeSnippet, toggleSnippet,
      applyChanges, run, runCustom, fix, update, toggleDevtools,
    ],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
