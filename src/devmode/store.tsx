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
import { devmodeCreateProject, devmodeListProjects, type ProjectMeta } from "@/lib/api";

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
    }),
    [screen, openEditor, backToProjects, activeProject, projects, loading, reload, createProject],
  );

  return <DevModeCtx.Provider value={value}>{children}</DevModeCtx.Provider>;
}
