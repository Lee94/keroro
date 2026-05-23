import { invoke } from "@tauri-apps/api/core";

// ─── DB row types (must mirror src-tauri/src/db.rs) ──────────────────
export interface ProjectRow {
  id: string;
  name: string;
  path: string;
  mascot: string;
  position?: number;
}

export interface SessionRow {
  id: string;
  projectId: string;
  kind: string;
  title: string;
  cliSessionId?: string | null;
}

export interface CliInfo {
  kind: string;
  found: boolean;
  path: string | null;
}

export interface GitStatus {
  branch: string | null;
  ahead: number;
  behind: number;
  additions: number;
  deletions: number;
  dirty: boolean;
}

// ─── Slim layout JSON stored in project_layouts.tree_json ────────────
export type LayoutNode = LayoutSplit | LayoutLeaf;
export interface LayoutSplit {
  type: "split";
  id: string;
  direction: "horizontal" | "vertical";
  ratio: number;
  first: LayoutNode;
  second: LayoutNode;
}
export interface LayoutLeaf {
  type: "leaf";
  id: string;
  tabIds: string[];
  activeTabId: string;
}

// ─── Typed command wrappers ──────────────────────────────────────────
export const listProjects = (): Promise<ProjectRow[]> =>
  invoke<ProjectRow[]>("projects_list");

export const upsertProject = (project: ProjectRow): Promise<void> =>
  invoke("project_upsert", { project });

export const replaceProjects = (projects: ProjectRow[]): Promise<void> =>
  invoke("projects_replace", { projects });

export const deleteProject = (id: string): Promise<void> =>
  invoke("project_delete", { id });

export const listSessions = (projectId: string): Promise<SessionRow[]> =>
  invoke<SessionRow[]>("sessions_list", { projectId });

export const replaceSessions = (
  projectId: string,
  sessions: SessionRow[],
): Promise<void> => invoke("sessions_replace", { projectId, sessions });

export const getLayout = (projectId: string): Promise<string | null> =>
  invoke<string | null>("layout_get", { projectId });

export const setLayout = (projectId: string, treeJson: string): Promise<void> =>
  invoke("layout_set", { projectId, treeJson });

export const getActiveProject = (): Promise<string | null> =>
  invoke<string | null>("active_project_get");

export const setActiveProject = (id: string | null): Promise<void> =>
  invoke("active_project_set", { id });

export const detectClis = (): Promise<CliInfo[]> =>
  invoke<CliInfo[]>("detect_clis");

export const detectNodeVersion = (cwd: string): Promise<string | null> =>
  invoke<string | null>("detect_node_version", { cwd });

export const detectGitStatus = (cwd: string): Promise<GitStatus | null> =>
  invoke<GitStatus | null>("detect_git_status", { cwd });

export const claudeSessionTitle = (
  sessionId: string,
  cwd: string | undefined,
): Promise<string | null> =>
  invoke<string | null>("claude_session_title", { sessionId, cwd });

export const claudeUnlockSession = (sessionId: string): Promise<boolean> =>
  invoke<boolean>("claude_unlock_session", { sessionId });

// ─── Debounce helper ─────────────────────────────────────────────────
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void | Promise<void>,
  ms: number,
): (...args: A) => void {
  let handle: ReturnType<typeof setTimeout> | null = null;
  let pending: A | null = null;
  return (...args: A) => {
    pending = args;
    if (handle !== null) clearTimeout(handle);
    handle = setTimeout(() => {
      handle = null;
      const a = pending!;
      pending = null;
      void fn(...a);
    }, ms);
  };
}
