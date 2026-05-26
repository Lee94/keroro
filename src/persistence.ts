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
  // Populated by the backend on read. The replace path ignores it so layout
  // saves don't clobber the value persisted by [[setSessionLastCommand]].
  lastCommand?: string | null;
}

export interface ProjectCommandRow {
  id: string;
  projectId: string;
  title?: string | null;
  command: string;
  position?: number;
}

export type CommandRunState =
  | "idle"
  | "running"
  | "success"
  | "failed"
  | "killed";

export interface CommandSnapshot {
  commandId: string;
  state: CommandRunState;
  exitCode: number | null;
  startedAt: number | null;
  finishedAt: number | null;
  output: string;
}

export interface CommandStatusEvent {
  commandId: string;
  state: CommandRunState;
  exitCode: number | null;
  startedAt: number | null;
  finishedAt: number | null;
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

export const setSessionLastCommand = (
  id: string,
  command: string | null,
): Promise<void> => invoke("session_last_command_set", { id, command });

export const listCommands = (projectId: string): Promise<ProjectCommandRow[]> =>
  invoke<ProjectCommandRow[]>("project_commands_list", { projectId });

export const replaceCommands = (
  projectId: string,
  commands: ProjectCommandRow[],
): Promise<void> => invoke("project_commands_replace", { projectId, commands });

export const runCommandBg = (
  commandId: string,
  command: string,
  cwd: string,
): Promise<void> => invoke("command_run", { commandId, command, cwd });

export const killCommandBg = (commandId: string): Promise<void> =>
  invoke("command_kill", { commandId });

export const fetchCommandOutput = (
  commandId: string,
): Promise<CommandSnapshot> =>
  invoke<CommandSnapshot>("command_output", { commandId });

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

export interface GitBranchInfo {
  current: string | null;
  locals: string[];
}

export const listGitBranches = (cwd: string): Promise<GitBranchInfo> =>
  invoke<GitBranchInfo>("list_git_branches", { cwd });

export const checkoutGitBranch = (cwd: string, branch: string): Promise<void> =>
  invoke("checkout_git_branch", { cwd, branch });

export const gitDiff = (cwd: string): Promise<string> =>
  invoke<string>("git_diff", { cwd });

export const claudeSessionTitle = (
  sessionId: string,
  cwd: string | undefined,
): Promise<string | null> =>
  invoke<string | null>("claude_session_title", { sessionId, cwd });

export const claudeUnlockSession = (sessionId: string): Promise<boolean> =>
  invoke<boolean>("claude_unlock_session", { sessionId });

export interface SessionStat {
  id: string;
  pid: number | null;
  cpuPercent: number;
  memoryBytes: number;
  alive: boolean;
}

export const ptySessionStats = (): Promise<SessionStat[]> =>
  invoke<SessionStat[]>("pty_session_stats");

export const ptyForceKill = (id: string): Promise<void> =>
  invoke("pty_force_kill", { id });

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
