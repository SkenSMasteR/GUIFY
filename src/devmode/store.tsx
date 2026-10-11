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
  devmodeConnected,
  devmodeCloneProject,
  devmodeCreateProject,
  devmodeDeleteProject,
  devmodeInstallBridge,
  devmodeListProjects,
  devmodeUpdateProject,
  onDevmodeConnected,
  type ProjectMeta,
} from "@/lib/api";

export type { ProjectMeta };

export const EMPTY_PROJECT: ProjectMeta = {
  name: "",
  tags: [],
  version: "1.0.0",
  authors: [],
  description: "",
  entries: { js: "", css: "" },
  hasMixins: false,
  dependencies: {},
  preview: "",
};

export type Screen = "projects" | "editor";

interface Ctx {
  screen: Screen;
  openEditor: (project: ProjectMeta) => void;
  backToProjects: () => void;
  activeProject: ProjectMeta | null;
  projects: ProjectMeta[];
  loading: boolean;
  reload: () => Promise<void>;
  createProject: (meta: ProjectMeta) => Promise<boolean>;
  cloneProject: (url: string) => Promise<ProjectMeta | null>;
  editProject: (oldName: string, meta: ProjectMeta) => Promise<boolean>;
  deleteProject: (name: string) => Promise<void>;
  syncMeta: (meta: ProjectMeta) => void;
  spotifyConnected: boolean;
  installBridge: () => Promise<void>;
}

const DevModeCtx = createContext<Ctx | null>(null);

export function useDevMode() {
  const ctx = useContext(DevModeCtx);
  if (!ctx) throw new Error("useDevMode outside provider");
  return ctx;
}

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>("projects");
  const [activeProject, setActiveProject] = useState<ProjectMeta | null>(null);
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const req = useRef(0);

  const reload = useCallback(async () => {
    const id = ++req.current;
    setLoading(true);
    try {
      const list = await devmodeListProjects();
      if (id === req.current) setProjects(list);
    } catch (e) {
      if (id === req.current) toast.error(String(e));
    } finally {
      if (id === req.current) setLoading(false);
    }
  }, []);

  const createProject = useCallback(
    async (meta: ProjectMeta) => {
      const id = toast.loading(`Creating ${meta.name}…`);
      try {
        const created = await devmodeCreateProject(meta);
        setProjects((prev) =>
          [...prev, created].sort((a, b) =>
            a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
          ),
        );
        toast.success(`Project ${created.name} created`, { id });
        return true;
      } catch (e) {
        toast.error(String(e), { id });
        return false;
      }
    },
    [],
  );

  const cloneProject = useCallback(
    async (url: string): Promise<ProjectMeta | null> => {
      const id = toast.loading("Cloning repository…");
      try {
        const cloned = await devmodeCloneProject(url);
        setProjects((prev) =>
          [...prev, cloned].sort((a, b) =>
            a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
          ),
        );
        toast.success(`Project ${cloned.name} cloned`, { id });
        return cloned;
      } catch (e) {
        toast.error(String(e), { id });
        return null;
      }
    },
    [],
  );

  const editProject = useCallback(
    async (oldName: string, meta: ProjectMeta) => {
      const id = toast.loading(`Saving ${oldName}…`);
      try {
        const updated = await devmodeUpdateProject(oldName, meta);
        await reload();
        setActiveProject((prev) => (prev && prev.name === oldName ? updated : prev));
        toast.success(`Project ${updated.name} saved`, { id });
        return true;
      } catch (e) {
        toast.error(String(e), { id });
        return false;
      }
    },
    [reload],
  );

  const deleteProject = useCallback(
    async (name: string) => {
      const id = toast.loading(`Deleting ${name}…`);
      try {
        await devmodeDeleteProject(name);
        setProjects((prev) => prev.filter((p) => p.name !== name));
        setActiveProject((prev) => (prev?.name === name ? null : prev));
        toast.success(`Project ${name} deleted`, { id });
      } catch (e) {
        toast.error(String(e), { id });
      }
    },
    [],
  );

  const syncMeta = useCallback((meta: ProjectMeta) => {
    setActiveProject((prev) => (prev && prev.name === meta.name ? meta : prev));
    setProjects((prev) => prev.map((p) => (p.name === meta.name ? meta : p)));
  }, []);

  const [spotifyConnected, setSpotifyConnected] = useState(false);

  useEffect(() => {
    devmodeConnected().then(setSpotifyConnected).catch(() => {});
    const un = onDevmodeConnected(setSpotifyConnected);
    return () => {
      un.then((f) => f());
    };
  }, []);

  const installBridge = useCallback(async () => {
    const id = toast.loading("Installing bridge extension…");
    try {
      await devmodeInstallBridge();
      toast.success("betterdevmode installed. Apply Spicetify, then restart Spotify", { id });
    } catch (e) {
      toast.error(String(e), { id });
    }
  }, []);

  const openEditor = useCallback((project: ProjectMeta) => {
    setActiveProject(project);
    setScreen("editor");
  }, []);

  const backToProjects = useCallback(() => {
    setActiveProject(null);
    setScreen("projects");
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<Ctx>(
    () => ({
      screen,
      openEditor,
      backToProjects,
      activeProject,
      projects,
      loading,
      reload,
      createProject,
      cloneProject,
      editProject,
      deleteProject,
      syncMeta,
      spotifyConnected,
      installBridge,
    }),
    [
      screen, openEditor, backToProjects, activeProject, projects, loading, reload,
      createProject, cloneProject, editProject, deleteProject, syncMeta, spotifyConnected, installBridge,
    ],
  );

  return <DevModeCtx.Provider value={value}>{children}</DevModeCtx.Provider>;
}
