export type AgentKind = "terminal" | "claude" | "codex";

export type ChatAgentKind = Exclude<AgentKind, "terminal">;

export const CLI_REGISTRY = [
  { kind: "claude" as const, label: "Claude Code", binary: "claude" },
  { kind: "codex" as const, label: "Codex", binary: "codex" },
  // { kind: "gemini" as const, label: "Gemini", binary: "gemini" },
  // { kind: "pi" as const, label: "Pi", binary: "pi" },
] satisfies {
  kind: Exclude<AgentKind, "terminal">;
  label: string;
  binary: string;
}[];

const CLI_KINDS: ReadonlySet<AgentKind> = new Set(
  CLI_REGISTRY.map((c) => c.kind),
);

export const AGENT_LABEL: Record<AgentKind, string> = {
  terminal: "Terminal",
  claude: "Claude Code",
  codex: "Codex",
};

export function isAgentKind(v: string): v is AgentKind {
  return v === "terminal" || v === "claude" || v === "codex";
}

export function isPtyKind(kind: AgentKind): boolean {
  return kind === "terminal" || CLI_KINDS.has(kind);
}

export interface Tab {
  id: string;
  kind: AgentKind;
  title: string;
  cliSessionId?: string;
}

export type DropSide = "left" | "right" | "top" | "bottom" | "center";

export interface LeafPane {
  type: "leaf";
  id: string;
  tabs: Tab[];
  activeTab: string;
}

export interface SplitPane {
  type: "split";
  id: string;
  direction: "horizontal" | "vertical"; // horizontal = side-by-side; vertical = stacked
  ratio: number; // first child's share, 0..1
  first: PaneNode;
  second: PaneNode;
}

export type PaneNode = LeafPane | SplitPane;

export interface WorkspacePanes {
  root: PaneNode;
}

export type PanesByWs = Record<string, WorkspacePanes>;

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyLeaf(): LeafPane {
  return { type: "leaf", id: newId("lf"), tabs: [], activeTab: "" };
}
