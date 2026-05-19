import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  Show,
  For,
  Switch,
  Match,
  type Accessor,
  type Component,
  type JSX,
} from "solid-js";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { THEMES, rad, type ThemeName } from "./themes";
import {
  ThemeContext,
  WorkspaceContext,
  WorkspaceInfoContext,
  InstalledClisContext,
  type WorkspaceInfo,
} from "./themeContext";
import {
  ClaudeCodeMascot,
  CodexMascot,
  CubeMascot,
  FayeMascot,
  MushroomMascot,
  OrchidMascot,
  TerminalMascot,
} from "./mascots";
import { XtermPane } from "./XtermPane";
import { terminalHost } from "./terminalHost";
import {
  debounce,
  deleteProject,
  getActiveProject,
  getLayout,
  listProjects,
  listSessions,
  replaceProjects,
  replaceSessions,
  setActiveProject as dbSetActiveProject,
  setLayout,
  upsertProject,
  type LayoutNode,
  type ProjectRow,
  type SessionRow,
} from "./persistence";
import "./App.css";

const useTheme = () => useContext(ThemeContext)();

// ─────────────────────────────────────────────────────────────
// Drag context for tab→pane drag-to-split
// ─────────────────────────────────────────────────────────────
interface DragInfo {
  sourceLeafId: string;
  sourceTabId: string;
}
const DragContext = createContext<{
  drag: Accessor<DragInfo | null>;
  setDrag: (d: DragInfo | null) => void;
}>({
  drag: () => null,
  setDrag: () => {},
});
const useDrag = () => useContext(DragContext);

const TAB_DRAG_MIME = "application/x-faye-tab";

function computeDropSide(
  rect: DOMRect,
  clientX: number,
  clientY: number,
): DropSide {
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  // Center "no-split" region — middle 40%
  if (x > 0.3 && x < 0.7 && y > 0.3 && y < 0.7) return "center";
  const dLeft = x;
  const dRight = 1 - x;
  const dTop = y;
  const dBottom = 1 - y;
  const min = Math.min(dLeft, dRight, dTop, dBottom);
  if (min === dLeft) return "left";
  if (min === dRight) return "right";
  if (min === dTop) return "top";
  return "bottom";
}

type Density = "cozy" | "compact";

// ─────────────────────────────────────────────────────────────
// Tiny icon set
// ─────────────────────────────────────────────────────────────
type IconName =
  | "close"
  | "plus"
  | "sidebar"
  | "branch"
  | "node"
  | "python"
  | "globe"
  | "dot"
  | "caret"
  | "split-h"
  | "split-v"
  | "settings";

const Icon: Component<{ name: IconName; size?: number; color?: string }> = (
  props,
) => {
  const s = () => ({
    width: `${props.size ?? 12}px`,
    height: `${props.size ?? 12}px`,
    display: "block",
    "flex-shrink": 0,
  });
  const color = () => props.color ?? "currentColor";
  return (
    <Switch>
      <Match when={props.name === "close"}>
        <svg style={s()} viewBox="0 0 12 12" fill="none" stroke={color()} stroke-width="1.4" stroke-linecap="round">
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      </Match>
      <Match when={props.name === "plus"}>
        <svg style={s()} viewBox="0 0 12 12" fill="none" stroke={color()} stroke-width="1.4" stroke-linecap="round">
          <path d="M6 2v8M2 6h8" />
        </svg>
      </Match>
      <Match when={props.name === "sidebar"}>
        <svg style={s()} viewBox="0 0 14 14" fill="none" stroke={color()} stroke-width="1.2">
          <rect x="1.5" y="2.5" width="11" height="9" rx="1.5" />
          <path d="M5.5 2.5v9" />
        </svg>
      </Match>
      <Match when={props.name === "branch"}>
        <svg style={s()} viewBox="0 0 12 12" fill="none" stroke={color()} stroke-width="1.2" stroke-linecap="round">
          <circle cx="3" cy="3" r="1.2" />
          <circle cx="3" cy="9" r="1.2" />
          <circle cx="9" cy="5" r="1.2" />
          <path d="M3 4.2v3.6M3 6c2 0 4-.5 4.8-2" />
        </svg>
      </Match>
      <Match when={props.name === "node"}>
        <svg style={s()} viewBox="0 0 12 12" fill="none" stroke={color()} stroke-width="1.2">
          <polygon points="6,1.5 10.5,4 10.5,8 6,10.5 1.5,8 1.5,4" />
        </svg>
      </Match>
      <Match when={props.name === "python"}>
        <svg style={s()} viewBox="0 0 12 12" fill="none" stroke={color()} stroke-width="1.2">
          <rect x="2" y="2" width="8" height="5" rx="1.5" />
          <rect x="2" y="5" width="8" height="5" rx="1.5" />
          <circle cx="4" cy="3.5" r=".4" fill={color()} />
          <circle cx="8" cy="8.5" r=".4" fill={color()} />
        </svg>
      </Match>
      <Match when={props.name === "globe"}>
        <svg style={s()} viewBox="0 0 12 12" fill="none" stroke={color()} stroke-width="1.1">
          <circle cx="6" cy="6" r="4.5" />
          <path d="M1.5 6h9M6 1.5c2 2 2 7 0 9M6 1.5c-2 2-2 7 0 9" />
        </svg>
      </Match>
      <Match when={props.name === "dot"}>
        <svg style={s()} viewBox="0 0 12 12">
          <circle cx="6" cy="6" r="3" fill={color()} />
        </svg>
      </Match>
      <Match when={props.name === "caret"}>
        <svg style={s()} viewBox="0 0 12 12" fill="none" stroke={color()} stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 3l4 3-4 3" />
        </svg>
      </Match>
      <Match when={props.name === "split-h"}>
        <svg style={s()} viewBox="0 0 14 14" fill="none" stroke={color()} stroke-width="1.2">
          <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" />
          <path d="M1.5 7h11" />
        </svg>
      </Match>
      <Match when={props.name === "split-v"}>
        <svg style={s()} viewBox="0 0 14 14" fill="none" stroke={color()} stroke-width="1.2">
          <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" />
          <path d="M7 1.5v11" />
        </svg>
      </Match>
      <Match when={props.name === "settings"}>
        <svg style={s()} viewBox="0 0 14 14" fill="none" stroke={color()} stroke-width="1.2" stroke-linecap="round">
          <circle cx="7" cy="7" r="2" />
          <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.8 2.8l1.4 1.4M9.8 9.8l1.4 1.4M2.8 11.2l1.4-1.4M9.8 4.2l1.4-1.4" />
        </svg>
      </Match>
    </Switch>
  );
};

// ─────────────────────────────────────────────────────────────
// Window chrome
// ─────────────────────────────────────────────────────────────
const isWindows =
  typeof navigator !== "undefined" && navigator.userAgent.includes("Windows");
const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

const TitlebarHeight = isWindows ? 36 : 38;

const TrafficLights: Component = () => {
  const actions = [
    { color: "#ff5f57", action: () => getCurrentWindow().close() },
    { color: "#febc2e", action: () => getCurrentWindow().minimize() },
    { color: "#28c840", action: () => getCurrentWindow().toggleMaximize() },
  ];
  return (
    <div style={{ display: "flex", gap: "8px", "align-items": "center", padding: "0 4px" }}>
      <For each={actions}>
        {(a) => (
          <button
            onClick={a.action}
            style={{
              width: "12px",
              height: "12px",
              "border-radius": "50%",
              background: a.color,
              border: "none",
              padding: 0,
              cursor: "pointer",
              "box-shadow": "inset 0 0 0 0.5px rgba(0,0,0,0.2)",
            }}
          />
        )}
      </For>
    </div>
  );
};

const WindowsCaptionButton: Component<{
  kind: "min" | "max" | "close";
  onClick: () => void;
}> = (props) => {
  const theme = useTheme;
  const [hover, setHover] = createSignal(false);
  const isClose = props.kind === "close";
  const hoverBg = () =>
    isClose ? "#c42b1c" : "rgba(255,255,255,0.06)";
  const activeBg = () =>
    isClose ? "#a52419" : "rgba(255,255,255,0.04)";
  const fg = () =>
    hover() && isClose ? "#ffffff" : theme().textDim;

  return (
    <button
      onClick={props.onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={props.kind}
      style={{
        width: "46px",
        height: "100%",
        background: hover() ? hoverBg() : "transparent",
        border: "none",
        padding: 0,
        cursor: "default",
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        color: fg(),
        "-webkit-app-region": "no-drag",
        transition: "background 80ms",
      }}
      onMouseDown={(e) => (e.currentTarget.style.background = activeBg())}
      onMouseUp={(e) =>
        (e.currentTarget.style.background = hover() ? hoverBg() : "transparent")
      }
    >
      <Switch>
        <Match when={props.kind === "min"}>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
          </svg>
        </Match>
        <Match when={props.kind === "max"}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect
              x="0.5"
              y="0.5"
              width="9"
              height="9"
              stroke="currentColor"
              stroke-width="1"
            />
          </svg>
        </Match>
        <Match when={props.kind === "close"}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M1 1l8 8M9 1l-8 8"
              stroke="currentColor"
              stroke-width="1"
              stroke-linecap="square"
            />
          </svg>
        </Match>
      </Switch>
    </button>
  );
};

const WindowsControls: Component = () => (
  <div
    style={{
      display: "flex",
      "align-items": "stretch",
      height: "100%",
      "-webkit-app-region": "no-drag",
    }}
  >
    <WindowsCaptionButton kind="min" onClick={() => getCurrentWindow().minimize()} />
    <WindowsCaptionButton
      kind="max"
      onClick={() => getCurrentWindow().toggleMaximize()}
    />
    <WindowsCaptionButton kind="close" onClick={() => getCurrentWindow().close()} />
  </div>
);

const Titlebar: Component<{
  onToggleSettings: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onAddProject: () => void;
}> = (props) => {
  const theme = useTheme;
  return (
    <div
      data-tauri-drag-region
      style={{
        height: `${TitlebarHeight}px`,
        display: "flex",
        "align-items": "center",
        "padding-left": isMac ? "14px" : "10px",
        "padding-right": isWindows ? 0 : "14px",
        gap: isMac ? "14px" : "8px",
        background: theme().chrome,
        "border-bottom": `1px solid ${theme().border}`,
        "flex-shrink": 0,
      }}
    >
      <Show when={isMac}>
        <TrafficLights />
      </Show>
      <button
        onClick={props.onToggleSidebar}
        title={props.sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        aria-pressed={!props.sidebarOpen}
        style={{
          background: props.sidebarOpen ? "transparent" : theme().panelAlt,
          border: "none",
          padding: "4px",
          color: props.sidebarOpen ? theme().textDim : theme().text,
          cursor: "pointer",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          "border-radius": rad(theme(), 4),
          transition: "background 90ms, color 90ms",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = theme().panelAlt)}
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = props.sidebarOpen
            ? "transparent"
            : theme().panelAlt)
        }
      >
        <Icon name="sidebar" size={15} />
      </button>
      <div
        style={{
          width: "1px",
          height: "16px",
          background: theme().border,
          "margin-left": "2px",
          "margin-right": "2px",
        }}
      />
      <button
        onClick={props.onAddProject}
        title="New project"
        style={{
          background: "transparent",
          border: "none",
          padding: "4px 8px",
          color: theme().textDim,
          cursor: "pointer",
          display: "flex",
          "align-items": "center",
          gap: "6px",
          "border-radius": rad(theme(), 6),
          "font-size": "11px",
          "font-family": "var(--mono)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = theme().panelAlt;
          e.currentTarget.style.color = theme().text;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = theme().textDim;
        }}
      >
        <Icon name="plus" size={11} />
        <span>new project</span>
      </button>
      <div style={{ flex: 1 }} />
      <button
        onClick={props.onToggleSettings}
        style={{
          background: "transparent",
          border: `1px solid ${theme().border}`,
          padding: "4px 8px",
          color: theme().textDim,
          cursor: "pointer",
          display: "flex",
          "align-items": "center",
          gap: "6px",
          "border-radius": rad(theme(), 6),
          "font-size": "11px",
          "font-family": "var(--mono)",
          "margin-right": isWindows ? "6px" : 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = theme().panelAlt;
          e.currentTarget.style.color = theme().text;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = theme().textDim;
        }}
      >
        <Icon name="settings" size={12} />
        <span>tweaks</span>
      </button>
      <Show when={isWindows}>
        <WindowsControls />
      </Show>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────
type MascotKind = "orchid" | "terminal" | "cube" | "mushroom";

interface Workspace {
  id: string;
  name: string;
  path: string;
  mascot: MascotKind;
}

const MASCOT_CYCLE: MascotKind[] = ["orchid", "terminal", "cube", "mushroom"];

function isMascotKind(v: string): v is MascotKind {
  return v === "orchid" || v === "terminal" || v === "cube" || v === "mushroom";
}

function isAgentKind(v: string): v is AgentKind {
  return v === "terminal" || v === "claude" || v === "codex";
}

function workspaceToRow(ws: Workspace, position: number): ProjectRow {
  return {
    id: ws.id,
    name: ws.name,
    path: ws.path,
    mascot: ws.mascot,
    position,
  };
}

function rowToWorkspace(row: ProjectRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    mascot: isMascotKind(row.mascot) ? row.mascot : "orchid",
  };
}

function basename(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? p;
}

const WorkspaceItem: Component<{
  ws: Workspace;
  active: boolean;
  onClick: () => void;
}> = (props) => {
  const theme = useTheme;
  const [hover, setHover] = createSignal(false);
  const renderMascot = () => {
    const t = theme();
    switch (props.ws.mascot) {
      case "orchid":
        return <OrchidMascot size={32} outer={t.accent} inner={t.bg} />;
      case "terminal":
        return <TerminalMascot size={32} color={t.pixelGreen} />;
      case "cube":
        return <CubeMascot size={32} light={t.pixelBlue} dark={t.accentDim} />;
      case "mushroom":
        return <MushroomMascot size={32} />;
    }
  };
  return (
    <div
      onClick={props.onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        "align-items": "center",
        gap: "12px",
        padding: "10px 12px",
        margin: "2px 8px",
        "border-radius": rad(theme(), 10),
        cursor: "pointer",
        position: "relative",
        background: props.active
          ? theme().panelAlt
          : hover()
            ? theme().panel
            : "transparent",
        border: props.active
          ? `1px solid ${theme().borderStrong}`
          : "1px solid transparent",
        transition: "background 90ms",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "34px",
          height: "34px",
          "flex-shrink": 0,
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
        }}
      >
        {renderMascot()}
      </div>
      <div style={{ flex: 1, "min-width": 0 }}>
        <div
          style={{
            "font-size": "13px",
            "font-weight": 500,
            color: theme().text,
            "letter-spacing": "-0.01em",
            "margin-bottom": "1px",
            overflow: "hidden",
            "text-overflow": "ellipsis",
            "white-space": "nowrap",
          }}
        >
          {props.ws.name}
        </div>
        <div
          style={{
            "font-size": "10.5px",
            color: theme().textMuted,
            "font-family": "var(--mono)",
            overflow: "hidden",
            "text-overflow": "ellipsis",
            "white-space": "nowrap",
          }}
        >
          {props.ws.path}
        </div>
      </div>
    </div>
  );
};

const Sidebar: Component<{
  workspaces: Workspace[];
  active: string;
  setActive: (id: string) => void;
  density: Density;
  open: boolean;
}> = (props) => {
  const theme = useTheme;
  const fullWidth = () => (props.density === "compact" ? 220 : 248);
  return (
    <div
      aria-hidden={!props.open}
      style={{
        width: `${props.open ? fullWidth() : 0}px`,
        background: theme().chrome,
        "border-right": props.open ? `1px solid ${theme().border}` : "none",
        "flex-shrink": 0,
        overflow: "hidden",
        transition: "width 180ms ease, border-color 180ms ease",
      }}
    >
      <div
        style={{
          width: `${fullWidth()}px`,
          height: "100%",
          display: "flex",
          "flex-direction": "column",
        }}
      >
      <div style={{ flex: 1, overflow: "auto", padding: "10px 0 4px" }}>
        <Show
          when={props.workspaces.length > 0}
          fallback={
            <div
              style={{
                padding: "32px 18px",
                "font-size": "12px",
                color: theme().textMuted,
                "line-height": 1.5,
                "text-align": "center",
              }}
            >
              No folders yet.
              <br />
              Use <span style={{ color: theme().textDim }}>+ new project</span> in the toolbar.
            </div>
          }
        >
          <For each={props.workspaces}>
            {(ws) => (
              <WorkspaceItem
                ws={ws}
                active={props.active === ws.id}
                onClick={() => props.setActive(ws.id)}
              />
            )}
          </For>
        </Show>
      </div>
      <div
        style={{
          padding: "10px 18px",
          "border-top": `1px solid ${theme().border}`,
          "font-family": "var(--mono)",
          "font-size": "10.5px",
          color: theme().amber,
          display: "flex",
          "align-items": "center",
          gap: "6px",
        }}
      >
        <span style={{ color: theme().textMuted }}>↺</span>
        <span>
          {props.workspaces.length} folder{props.workspaces.length === 1 ? "" : "s"}
        </span>
      </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────
type AgentKind = "terminal" | "claude" | "codex";

const CLI_REGISTRY = [
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

function isPtyKind(kind: AgentKind): boolean {
  return kind === "terminal" || CLI_KINDS.has(kind);
}

interface Tab {
  id: string;
  kind: AgentKind;
  title: string;
  cliSessionId?: string;
}

type DropSide = "left" | "right" | "top" | "bottom" | "center";

interface LeafPane {
  type: "leaf";
  id: string;
  tabs: Tab[];
  activeTab: string;
}

interface SplitPane {
  type: "split";
  id: string;
  direction: "horizontal" | "vertical"; // horizontal = side-by-side; vertical = stacked
  ratio: number; // first child's share, 0..1
  first: PaneNode;
  second: PaneNode;
}

type PaneNode = LeafPane | SplitPane;

interface WorkspacePanes {
  root: PaneNode;
}

type PanesByWs = Record<string, WorkspacePanes>;

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyLeaf(): LeafPane {
  return { type: "leaf", id: newId("lf"), tabs: [], activeTab: "" };
}

function paneTreeToLayout(node: PaneNode): LayoutNode {
  if (node.type === "leaf") {
    return {
      type: "leaf",
      id: node.id,
      tabIds: node.tabs.map((t) => t.id),
      activeTabId: node.activeTab,
    };
  }
  return {
    type: "split",
    id: node.id,
    direction: node.direction,
    ratio: node.ratio,
    first: paneTreeToLayout(node.first),
    second: paneTreeToLayout(node.second),
  };
}

function layoutToPaneTree(
  node: LayoutNode,
  sessions: Map<string, SessionRow>,
): PaneNode {
  if (node.type === "leaf") {
    const tabs: Tab[] = [];
    for (const id of node.tabIds) {
      const s = sessions.get(id);
      if (!s) continue;
      const kind = isAgentKind(s.kind) ? s.kind : "terminal";
      tabs.push({
        id: s.id,
        kind,
        title: s.title,
        cliSessionId: s.cliSessionId ?? undefined,
      });
    }
    let activeTab = node.activeTabId;
    if (!tabs.some((t) => t.id === activeTab)) activeTab = tabs[0]?.id ?? "";
    return { type: "leaf", id: node.id, tabs, activeTab };
  }
  return {
    type: "split",
    id: node.id,
    direction: node.direction,
    ratio: node.ratio,
    first: layoutToPaneTree(node.first, sessions),
    second: layoutToPaneTree(node.second, sessions),
  };
}

async function loadPaneTree(projectId: string): Promise<WorkspacePanes> {
  const [sessions, layoutJson] = await Promise.all([
    listSessions(projectId),
    getLayout(projectId),
  ]);
  if (!layoutJson) return defaultPanes();
  try {
    const layout = JSON.parse(layoutJson) as LayoutNode;
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));
    let root = layoutToPaneTree(layout, sessionMap);
    const pruned = pruneEmpty(root);
    root = pruned ?? defaultPanes().root;
    return { root };
  } catch {
    return defaultPanes();
  }
}

async function saveProjectState(
  projectId: string,
  root: PaneNode,
): Promise<void> {
  const tabs: Tab[] = [];
  walkLeaves(root, (leaf) => {
    for (const t of leaf.tabs) tabs.push(t);
  });
  const sessions: SessionRow[] = tabs.map((t) => ({
    id: t.id,
    projectId,
    kind: t.kind,
    title: t.title,
    cliSessionId: t.cliSessionId ?? null,
  }));
  // Sessions first so the layout never references a missing row.
  await replaceSessions(projectId, sessions);
  await setLayout(projectId, JSON.stringify(paneTreeToLayout(root)));
}

function defaultPanes(): WorkspacePanes {
  const tabId = newId("t");
  return {
    root: {
      type: "leaf",
      id: newId("lf"),
      tabs: [{ id: tabId, kind: "terminal", title: "terminal" }],
      activeTab: tabId,
    },
  };
}

// ─── Tree helpers ───────────────────────────────────────────────────
function mapLeaves(
  node: PaneNode,
  fn: (leaf: LeafPane) => PaneNode,
): PaneNode {
  if (node.type === "leaf") return fn(node);
  const first = mapLeaves(node.first, fn);
  const second = mapLeaves(node.second, fn);
  if (first === node.first && second === node.second) return node;
  return { ...node, first, second };
}

function findLeaf(node: PaneNode, id: string): LeafPane | null {
  if (node.type === "leaf") return node.id === id ? node : null;
  return findLeaf(node.first, id) ?? findLeaf(node.second, id);
}

function walkLeaves(node: PaneNode, fn: (leaf: LeafPane) => void): void {
  if (node.type === "leaf") {
    fn(node);
    return;
  }
  walkLeaves(node.first, fn);
  walkLeaves(node.second, fn);
}

function updateSplit(
  node: PaneNode,
  splitId: string,
  patch: (split: SplitPane) => SplitPane,
): PaneNode {
  if (node.type === "leaf") return node;
  if (node.id === splitId) return patch(node);
  const first = updateSplit(node.first, splitId, patch);
  const second = updateSplit(node.second, splitId, patch);
  if (first === node.first && second === node.second) return node;
  return { ...node, first, second };
}

function pruneEmpty(node: PaneNode): PaneNode | null {
  if (node.type === "leaf") return node.tabs.length === 0 ? null : node;
  const first = pruneEmpty(node.first);
  const second = pruneEmpty(node.second);
  if (!first && !second) return null;
  if (!first) return second;
  if (!second) return first;
  if (first === node.first && second === node.second) return node;
  return { ...node, first, second };
}

function updateLeaf(
  root: PaneNode,
  leafId: string,
  patch: (leaf: LeafPane) => LeafPane,
): PaneNode {
  return mapLeaves(root, (leaf) => (leaf.id === leafId ? patch(leaf) : leaf));
}

function splitLeafIntoNew(
  root: PaneNode,
  targetLeafId: string,
  side: Exclude<DropSide, "center">,
  newLeaf: LeafPane,
): PaneNode {
  return mapLeaves(root, (leaf) => {
    if (leaf.id !== targetLeafId) return leaf;
    const direction =
      side === "left" || side === "right" ? "horizontal" : "vertical";
    const newFirst = side === "left" || side === "top";
    return {
      type: "split",
      id: newId("sp"),
      direction,
      ratio: 0.5,
      first: newFirst ? newLeaf : leaf,
      second: newFirst ? leaf : newLeaf,
    } satisfies SplitPane;
  });
}

function moveTabInTree(
  root: PaneNode,
  sourceLeafId: string,
  tabId: string,
  targetLeafId: string,
  side: DropSide,
): PaneNode {
  const sourceLeaf = findLeaf(root, sourceLeafId);
  if (!sourceLeaf) return root;
  const tab = sourceLeaf.tabs.find((t) => t.id === tabId);
  if (!tab) return root;

  // No-op cases
  if (side === "center" && sourceLeafId === targetLeafId) return root;
  if (side !== "center" && sourceLeafId === targetLeafId && sourceLeaf.tabs.length <= 1) {
    return root;
  }

  // 1. Remove tab from source leaf
  let next = updateLeaf(root, sourceLeafId, (leaf) => {
    const tabs = leaf.tabs.filter((t) => t.id !== tabId);
    const activeTab =
      leaf.activeTab === tabId ? (tabs[0]?.id ?? "") : leaf.activeTab;
    return { ...leaf, tabs, activeTab };
  });

  if (side === "center") {
    // Append into target leaf and activate
    next = updateLeaf(next, targetLeafId, (leaf) => ({
      ...leaf,
      tabs: [...leaf.tabs, tab],
      activeTab: tab.id,
    }));
  } else {
    // Wrap target leaf in a new split with a fresh leaf for the moved tab
    const fresh: LeafPane = {
      type: "leaf",
      id: newId("lf"),
      tabs: [tab],
      activeTab: tab.id,
    };
    next = splitLeafIntoNew(next, targetLeafId, side, fresh);
  }

  return pruneEmpty(next) ?? emptyLeaf();
}

function closeTabInTree(
  root: PaneNode,
  leafId: string,
  tabId: string,
): PaneNode {
  const next = updateLeaf(root, leafId, (leaf) => {
    const idx = leaf.tabs.findIndex((t) => t.id === tabId);
    const tabs = leaf.tabs.filter((t) => t.id !== tabId);
    let activeTab = leaf.activeTab;
    if (activeTab === tabId) {
      const fallback = tabs[Math.max(0, idx - 1)];
      activeTab = fallback?.id ?? "";
    }
    return { ...leaf, tabs, activeTab };
  });
  return pruneEmpty(next) ?? emptyLeaf();
}

const AGENT_LABEL: Record<AgentKind, string> = {
  terminal: "Terminal",
  claude: "Claude Code",
  codex: "Codex",
};

const AgentMascot: Component<{ kind: AgentKind; size?: number }> = (props) => {
  const theme = useTheme;
  return (
    <Switch>
      <Match when={props.kind === "terminal"}>
        <TerminalMascot size={props.size ?? 14} color={theme().pixelGreen} />
      </Match>
      <Match when={props.kind === "claude"}>
        <ClaudeCodeMascot size={props.size ?? 14} primary={theme().pixelCoral} shadow={theme().bg} />
      </Match>
      <Match when={props.kind === "codex"}>
        <CodexMascot size={props.size ?? 14} primary={theme().pixelBlue} highlight="#bfdcff" />
      </Match>
    </Switch>
  );
};

const TabItem: Component<{
  tab: Tab;
  leafId: string;
  active: boolean;
  onClick: () => void;
  onClose: (() => void) | null;
}> = (props) => {
  const theme = useTheme;
  const { setDrag } = useDrag();
  const [hover, setHover] = createSignal(false);
  const [closeHover, setCloseHover] = createSignal(false);
  return (
    <div
      onClick={props.onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      draggable={true}
      onDragStart={(e) => {
        // Synchronously enable pointer-events on drop overlays — must happen
        // before the browser fires the first dragover, so Solid's reactive
        // style updates aren't fast enough.
        document.body.classList.add("faye-dragging");
        e.dataTransfer?.setData(TAB_DRAG_MIME, props.tab.id);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
        setDrag({ sourceLeafId: props.leafId, sourceTabId: props.tab.id });
      }}
      onDragEnd={() => {
        document.body.classList.remove("faye-dragging");
        setDrag(null);
      }}
      style={{
        display: "flex",
        "align-items": "center",
        gap: "8px",
        height: "30px",
        padding: "0 8px 0 10px",
        "border-radius": rad(theme(), 8),
        background: props.active
          ? theme().panel
          : hover()
            ? theme().panelAlt
            : "transparent",
        border: `1px solid ${props.active ? theme().borderStrong : "transparent"}`,
        cursor: "pointer",
        position: "relative",
        transition: "background 90ms",
      }}
    >
      <AgentMascot kind={props.tab.kind} size={14} />
      <span
        style={{
          "font-size": "12px",
          color: props.active ? theme().text : theme().textDim,
          "letter-spacing": "-0.01em",
          "white-space": "nowrap",
        }}
      >
        {props.tab.title}
      </span>
      <Show when={props.onClose}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            props.onClose && props.onClose();
          }}
          onMouseEnter={() => setCloseHover(true)}
          onMouseLeave={() => setCloseHover(false)}
          style={{
            background: closeHover() ? theme().borderStrong : "transparent",
            border: "none",
            padding: 0,
            "margin-left": "2px",
            width: "16px",
            height: "16px",
            "border-radius": rad(theme(), 4),
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            color: theme().textMuted,
            cursor: "pointer",
            opacity: hover() || props.active ? 1 : 0,
            transition: "opacity 120ms",
          }}
        >
          <Icon name="close" size={9} />
        </button>
      </Show>
    </div>
  );
};

const AddMenu: Component<{
  open: boolean;
  onPick: (kind: AgentKind) => void;
  onClose: () => void;
  anchorBelow?: boolean;
}> = (props) => {
  const theme = useTheme;
  const installedClis = useContext(InstalledClisContext);
  const items = (): { kind: AgentKind; label: string }[] => [
    { kind: "terminal", label: "Terminal" },
    ...CLI_REGISTRY
      .filter((c) => installedClis().has(c.kind))
      .map(({ kind, label }) => ({ kind, label })),
  ];
  const below = () => props.anchorBelow ?? true;
  return (
    <Show when={props.open}>
      <div
        onClick={props.onClose}
        style={{ position: "fixed", inset: 0, "z-index": 100 }}
      />
      <div
        style={{
          position: "absolute",
          top: below() ? "calc(100% + 4px)" : "auto",
          bottom: below() ? "auto" : "calc(100% + 4px)",
          left: 0,
          "min-width": "200px",
          "z-index": 101,
          background: theme().panelAlt,
          border: `1px solid ${theme().borderStrong}`,
          "border-radius": rad(theme(), 10),
          padding: "6px",
          "box-shadow": `0 14px 40px rgba(0,0,0,0.6), 0 0 0 0.5px ${theme().borderStrong}`,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: below() ? "-5px" : "auto",
            bottom: below() ? "auto" : "-5px",
            left: "16px",
            width: "8px",
            height: "8px",
            transform: "rotate(45deg)",
            background: theme().panelAlt,
            "border-top": below() ? `1px solid ${theme().borderStrong}` : "none",
            "border-left": below() ? `1px solid ${theme().borderStrong}` : "none",
            "border-bottom": below() ? "none" : `1px solid ${theme().borderStrong}`,
            "border-right": below() ? "none" : `1px solid ${theme().borderStrong}`,
          }}
        />
        <For each={items()}>
          {(it) => (
            <div
              onClick={() => {
                props.onPick(it.kind);
                props.onClose();
              }}
              style={{
                display: "flex",
                "align-items": "center",
                gap: "10px",
                padding: "7px 10px",
                "border-radius": rad(theme(), 6),
                cursor: "pointer",
                color: theme().text,
                "font-size": "13px",
                "letter-spacing": "-0.01em",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = theme().panel)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <AgentMascot kind={it.kind} size={18} />
              <span>{it.label}</span>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
};

const TabBar: Component<{
  leafId: string;
  tabs: Tab[];
  activeId: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: (kind: AgentKind) => void;
  addAnchorBelow?: boolean;
}> = (props) => {
  const theme = useTheme;
  const [menuOpen, setMenuOpen] = createSignal(false);
  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        gap: "4px",
        padding: "6px 8px 0",
        background: theme().chrome,
        "border-bottom": `1px solid ${theme().border}`,
        "flex-shrink": 0,
        position: "relative",
      }}
    >
      <For each={props.tabs}>
        {(t) => (
          <TabItem
            tab={t}
            leafId={props.leafId}
            active={t.id === props.activeId}
            onClick={() => props.onActivate(t.id)}
            onClose={() => props.onClose(t.id)}
          />
        )}
      </For>
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            width: "26px",
            height: "26px",
            "border-radius": rad(theme(), 6),
            "margin-top": "2px",
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            color: theme().textMuted,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = theme().panelAlt;
            e.currentTarget.style.color = theme().text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = theme().textMuted;
          }}
        >
          <Icon name="plus" size={12} />
        </button>
        <AddMenu
          open={menuOpen()}
          onPick={props.onAdd}
          onClose={() => setMenuOpen(false)}
          anchorBelow={props.addAnchorBelow}
        />
      </div>
      <div style={{ flex: 1 }} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Footer chips
// ─────────────────────────────────────────────────────────────
interface ChipDef {
  icon: IconName;
  label: string;
  color?: string;
}

const Chip: Component<ChipDef> = (props) => {
  const theme = useTheme;
  return (
    <div
      style={{
        display: "inline-flex",
        "align-items": "center",
        gap: "6px",
        padding: "4px 10px 4px 9px",
        height: "24px",
        background: theme().panelAlt,
        border: `1px solid ${theme().border}`,
        "border-radius": rad(theme(), 7),
        "font-size": "11.5px",
        color: theme().textDim,
        "font-family": "var(--mono)",
        "letter-spacing": "-0.01em",
      }}
    >
      <Icon name={props.icon} size={11} color={props.color || theme().textMuted} />
      <span>{props.label}</span>
    </div>
  );
};

const PaneFooter: Component<{ chips: ChipDef[] }> = (props) => {
  const theme = useTheme;
  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        gap: "6px",
        padding: "8px 10px",
        "border-top": `1px solid ${theme().border}`,
        background: theme().chrome,
        "flex-shrink": 0,
        "justify-content": "flex-end",
      }}
    >
      <For each={props.chips}>{(c) => <Chip {...c} />}</For>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Agent content
// ─────────────────────────────────────────────────────────────
const AgentHeader: Component<{ kind: AgentKind }> = (props) => {
  const theme = useTheme;
  const info = () => {
    const t = theme();
    switch (props.kind) {
      case "claude":
        return {
          title: "Claude Code",
          version: "v2.3.41",
          model: "Opus 4.7 (1M context) with xhigh eff…",
          plan: "Claude Max",
          path: "~/Github/orchid-cli",
          mascot: <ClaudeCodeMascot size={56} primary={t.pixelCoral} shadow={t.bg} />,
        };
      case "codex":
        return {
          title: "Codex CLI",
          version: "v0.18.2",
          model: "gpt-5.1 high reasoning, web search on",
          plan: "Pro tier",
          path: "~/Github/orchid-cli",
          mascot: <CodexMascot size={56} primary={t.pixelBlue} />,
        };
      case "terminal":
        return {
          title: "Shell",
          version: "/bin/zsh 5.9",
          model: "iTerm2 compat • ANSI 256",
          plan: "",
          path: "~/Github/orchid-cli",
          mascot: <TerminalMascot size={56} color={t.pixelGreen} />,
        };
    }
  };
  return (
    <div
      style={{
        padding: "18px 22px 12px",
        display: "flex",
        gap: "16px",
        "align-items": "flex-start",
      }}
    >
      {info().mascot}
      <div
        style={{
          flex: 1,
          "font-family": "var(--mono)",
          "font-size": "12.5px",
          "line-height": 1.55,
          color: theme().textDim,
        }}
      >
        <div>
          <span style={{ color: theme().text, "font-weight": 600 }}>{info().title}</span>{" "}
          <span style={{ color: theme().textMuted }}>{info().version}</span>
        </div>
        <div>{info().model}</div>
        <Show when={info().plan}>
          <div>{info().plan}</div>
        </Show>
        <div style={{ color: theme().textMuted }}>{info().path}</div>
      </div>
    </div>
  );
};

const ClaudeChat: Component = () => {
  const theme = useTheme;
  return (
    <div style={{ padding: "4px 22px 16px", "font-family": "var(--mono)", "font-size": "13px", "line-height": 1.65 }}>
      <div style={{ display: "flex", gap: "10px", "margin-top": "18px" }}>
        <span style={{ color: theme().accent }}>›</span>
        <span style={{ color: theme().text }}>refactor the streaming parser to use async iterators</span>
      </div>

      <div style={{ display: "flex", gap: "10px", "margin-top": "18px" }}>
        <span style={{ color: theme().green, "margin-top": "5px" }}>●</span>
        <div style={{ color: theme().text, flex: 1 }}>
          I'll convert <span style={{ color: theme().accent }}>parser.ts</span> from a push-based callback API to an
          async iterator. This lets callers use <span style={{ color: theme().accent }}>for await...of</span> and
          drop the manual buffer juggling.
        </div>
      </div>

      <div style={{ "margin-top": "12px", "margin-left": "22px", color: theme().textMuted, "font-size": "12px" }}>
        Reading <span style={{ color: theme().amber }}>src/streaming/parser.ts</span> (412 lines)
      </div>
      <div style={{ "margin-top": "4px", "margin-left": "22px", color: theme().textMuted, "font-size": "12px" }}>
        Editing <span style={{ color: theme().amber }}>src/streaming/parser.ts</span> — 3 hunks
      </div>

      <div
        style={{
          "margin-top": "14px",
          "margin-left": "22px",
          padding: "10px 14px",
          background: theme().panelDeep,
          border: `1px solid ${theme().border}`,
          "border-radius": rad(theme(), 8),
          "font-size": "12px",
        }}
      >
        <div style={{ color: theme().green }}>{"+ export async function* parseStream(input: ReadableStream) {"}</div>
        <div style={{ color: theme().green }}>+   const reader = input.getReader();</div>
        <div style={{ color: theme().green }}>+   let buffer = '';</div>
        <div style={{ color: theme().green }}>{"+   while (true) {"}</div>
        <div style={{ color: theme().green }}>{"+     const { done, value } = await reader.read();"}</div>
        <div style={{ color: theme().green }}>+     if (done) break;</div>
        <div style={{ color: theme().green }}>+     yield* parseChunk(buffer + value);</div>
        <div style={{ color: theme().green }}>{"+   }"}</div>
        <div style={{ color: theme().green }}>{"+ }"}</div>
      </div>

      <div style={{ "margin-top": "14px", color: theme().textMuted, "font-size": "12px" }}>
        <span style={{ color: theme().accent }}>*</span> Distilling for 6s · 1,847 tokens
      </div>

      <div style={{ margin: "20px 0 14px", "border-top": `1px solid ${theme().border}` }} />

      <div style={{ display: "flex", gap: "10px", "align-items": "center" }}>
        <span style={{ color: theme().accent }}>›</span>
        <span style={{ color: theme().textMuted }}>run the tests</span>
        <span
          class="caret"
          style={{
            display: "inline-block",
            width: "7px",
            height: "14px",
            background: theme().accent,
            "margin-left": "1px",
          }}
        />
      </div>

      <div
        style={{
          "margin-top": "16px",
          "font-size": "11px",
          color: theme().textMuted,
          display: "flex",
          gap: "6px",
          "flex-wrap": "wrap",
        }}
      >
        <span style={{ color: theme().amber }}>orchid-cli</span>
        <span>(main)</span>
        <span>Opus 4.7 (1M context)</span>
        <span>[ctx: 96.3k · 8% ]</span>
      </div>
    </div>
  );
};

const CodexChat: Component = () => {
  const theme = useTheme;
  return (
    <div style={{ padding: "4px 22px 16px", "font-family": "var(--mono)", "font-size": "13px", "line-height": 1.65 }}>
      <div style={{ display: "flex", gap: "10px", "margin-top": "18px" }}>
        <span style={{ color: theme().blue }}>›</span>
        <span style={{ color: theme().text }}>why is router.test flaky on CI?</span>
      </div>

      <div style={{ display: "flex", gap: "10px", "margin-top": "16px" }}>
        <span style={{ color: theme().blue, "margin-top": "5px" }}>◆</span>
        <div style={{ color: theme().text, flex: 1 }}>
          Looking at <span style={{ color: theme().blue }}>router.test.ts</span> — the timeouts are tight (50ms)
          and CI runners have higher event-loop jitter than your M2. Three options:
        </div>
      </div>

      <div style={{ "margin-left": "22px", "margin-top": "10px", color: theme().textDim }}>
        <div>1. Bump per-test timeout to 200ms</div>
        <div>
          2. Mock <span style={{ color: theme().blue }}>setTimeout</span> with fake timers
        </div>
        <div>
          3. Run with <span style={{ color: theme().blue }}>--maxWorkers=1</span> on CI only
        </div>
      </div>

      <div style={{ "margin-top": "14px", "margin-left": "22px", color: theme().textMuted, "font-size": "12px" }}>
        ↳ I'd lean toward option 2 — deterministic and keeps CI fast.
      </div>

      <div style={{ margin: "20px 0 14px", "border-top": `1px solid ${theme().border}` }} />

      <div style={{ display: "flex", gap: "10px", "align-items": "center" }}>
        <span style={{ color: theme().blue }}>›</span>
        <span
          class="caret"
          style={{
            display: "inline-block",
            width: "7px",
            height: "14px",
            background: theme().blue,
          }}
        />
      </div>

      <div
        style={{
          "margin-top": "16px",
          "font-size": "11px",
          color: theme().textMuted,
          display: "flex",
          gap: "6px",
          "flex-wrap": "wrap",
        }}
      >
        <span style={{ color: theme().blue }}>orchid-cli</span>
        <span>(main)</span>
        <span>gpt-5.1 · high</span>
        <span>[ctx: 41.2k · 3% ]</span>
      </div>
    </div>
  );
};

type ChatAgentKind = Exclude<AgentKind, "terminal">;

const AgentContent: Component<{ kind: ChatAgentKind }> = (props) => {
  const theme = useTheme;
  return (
    <div style={{ flex: 1, overflow: "auto", background: theme().panel }}>
      <AgentHeader kind={props.kind} />
      <Switch>
        <Match when={props.kind === "claude"}>
          <ClaudeChat />
        </Match>
        <Match when={props.kind === "codex"}>
          <CodexChat />
        </Match>
      </Switch>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Drop overlay — highlights the quadrant a tab will land in
// ─────────────────────────────────────────────────────────────
const SideHighlight: Component<{ side: DropSide }> = (props) => {
  const theme = useTheme;
  const rectFor = (): JSX.CSSProperties => {
    switch (props.side) {
      case "left":
        return { left: "0", top: "0", width: "50%", height: "100%" };
      case "right":
        return { right: "0", top: "0", width: "50%", height: "100%" };
      case "top":
        return { left: "0", top: "0", width: "100%", height: "50%" };
      case "bottom":
        return { left: "0", bottom: "0", width: "100%", height: "50%" };
      case "center":
        return { inset: "12px" };
    }
  };
  return (
    <div
      style={{
        position: "absolute",
        ...rectFor(),
        background: `${theme().accent}26`,
        border: `2px solid ${theme().accent}`,
        "border-radius": props.side === "center" ? rad(theme(), 10) : "0",
        "pointer-events": "none",
        transition: "all 80ms ease-out",
      }}
    />
  );
};

const DropOverlay: Component<{
  leafId: string;
  onDrop: (side: DropSide, info: DragInfo) => void;
}> = (props) => {
  const { drag } = useDrag();
  const [side, setSide] = createSignal<DropSide | null>(null);
  let host!: HTMLDivElement;
  return (
    <div
      ref={host!}
      class="faye-drop-overlay"
      onDragOver={(e) => {
        if (!drag()) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        const rect = host.getBoundingClientRect();
        setSide(computeDropSide(rect, e.clientX, e.clientY));
      }}
      onDragLeave={(e) => {
        const r = host.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX >= r.right ||
          e.clientY < r.top ||
          e.clientY >= r.bottom
        ) {
          setSide(null);
        }
      }}
      onDrop={(e) => {
        const info = drag();
        const s = side();
        setSide(null);
        document.body.classList.remove("faye-dragging");
        if (!info || !s) return;
        e.preventDefault();
        props.onDrop(s, info);
      }}
      style={{
        position: "absolute",
        inset: 0,
        "z-index": 50,
      }}
    >
      <Show when={side()}>
        <SideHighlight side={side()!} />
      </Show>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Leaf pane — one tab strip + content area
// ─────────────────────────────────────────────────────────────
const LeafPaneView: Component<{
  leaf: LeafPane;
  setLeaf: (patch: (leaf: LeafPane) => LeafPane) => void;
  onClose: (tabId: string) => void;
  onDrop: (targetLeafId: string, side: DropSide, info: DragInfo) => void;
}> = (props) => {
  const theme = useTheme;
  const info = useContext(WorkspaceInfoContext);
  const active = (): Tab | undefined => {
    const l = props.leaf;
    return l.tabs.find((t) => t.id === l.activeTab) ?? l.tabs[0];
  };

  const handleAdd = (kind: AgentKind) => {
    const id = newId("tab");
    const newTab: Tab = {
      id,
      kind,
      title: AGENT_LABEL[kind].toLowerCase().replace(" ", "-"),
      cliSessionId: kind === "claude" ? crypto.randomUUID() : undefined,
    };
    props.setLeaf((leaf) => ({
      ...leaf,
      tabs: [...leaf.tabs, newTab],
      activeTab: id,
    }));
  };

  const chips = (): ChipDef[] => {
    const t = theme();
    const a = active();
    if (!a) return [];
    const out: ChipDef[] = [];
    if (a.kind === "terminal") {
      const ver = info.node();
      if (ver) out.push({ icon: "node", label: ver, color: t.green });
    }
    const branch = info.branch();
    if (branch) out.push({ icon: "branch", label: branch, color: t.amber });
    return out;
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        "flex-direction": "column",
        background: theme().panel,
        "min-height": 0,
        "min-width": 0,
        overflow: "hidden",
      }}
    >
      <TabBar
        leafId={props.leaf.id}
        tabs={props.leaf.tabs}
        activeId={props.leaf.activeTab}
        onActivate={(id) =>
          props.setLeaf((leaf) => ({ ...leaf, activeTab: id }))
        }
        onClose={(id) => props.onClose(id)}
        onAdd={handleAdd}
      />
      <div
        style={{
          flex: 1,
          position: "relative",
          "min-height": 0,
          overflow: "hidden",
          background: theme().panel,
        }}
      >
        <For each={props.leaf.tabs.filter((t) => isPtyKind(t.kind))}>
          {(t) => {
            const [, setHost] = terminalHost(t.id);
            return (
              <div
                ref={(el) => {
                  setHost(el);
                  onCleanup(() => {
                    const [cur] = terminalHost(t.id);
                    if (cur() === el) setHost(null);
                  });
                }}
                style={{
                  position: "absolute",
                  inset: 0,
                  visibility: active()?.id === t.id ? "visible" : "hidden",
                }}
              />
            );
          }}
        </For>
        <Show when={active() && !isPtyKind(active()!.kind)}>
          <div style={{ position: "absolute", inset: 0, overflow: "auto" }}>
            <AgentContent kind={active()!.kind as ChatAgentKind} />
          </div>
        </Show>
        <Show when={!active()}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              "flex-direction": "column",
              "align-items": "center",
              "justify-content": "center",
              gap: "14px",
            }}
          >
            <button
              onClick={() => handleAdd("terminal")}
              style={{
                display: "inline-flex",
                "align-items": "center",
                gap: "10px",
                padding: "10px 16px",
                background: theme().panelAlt,
                border: `1px solid ${theme().borderStrong}`,
                "border-radius": rad(theme(), 10),
                color: theme().text,
                cursor: "pointer",
                "font-size": "13px",
                "font-family": "var(--ui)",
                "letter-spacing": "-0.01em",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = theme().panel;
                e.currentTarget.style.borderColor = theme().accent;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = theme().panelAlt;
                e.currentTarget.style.borderColor = theme().borderStrong;
              }}
            >
              <TerminalMascot size={20} color={theme().pixelGreen} />
              <span>New terminal</span>
            </button>
            <div
              style={{
                "font-size": "11px",
                color: theme().textMuted,
                "font-family": "var(--mono)",
              }}
            >
              or drag a tab here from another pane
            </div>
          </div>
        </Show>
        <DropOverlay
          leafId={props.leaf.id}
          onDrop={(side, info) => props.onDrop(props.leaf.id, side, info)}
        />
      </div>
      <PaneFooter chips={chips()} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Split view + recursive tree renderer
// ─────────────────────────────────────────────────────────────
const PaneTreeView: Component<{
  node: PaneNode;
  setLeaf: (leafId: string, patch: (leaf: LeafPane) => LeafPane) => void;
  setSplit: (splitId: string, patch: (split: SplitPane) => SplitPane) => void;
  onCloseTab: (leafId: string, tabId: string) => void;
  onDrop: (targetLeafId: string, side: DropSide, info: DragInfo) => void;
}> = (props) => {
  // Read-through accessors that survive momentary undefined/mis-typed states
  // during tree replacement — avoid crashes without remounting children.
  const leafNode = (): LeafPane | null =>
    props.node?.type === "leaf" ? (props.node as LeafPane) : null;
  const splitNode = (): SplitPane | null =>
    props.node?.type === "split" ? (props.node as SplitPane) : null;

  return (
    <>
      <Show when={leafNode()}>
        <LeafPaneView
          leaf={leafNode()!}
          setLeaf={(patch) => {
            const l = leafNode();
            if (l) props.setLeaf(l.id, patch);
          }}
          onClose={(tabId) => {
            const l = leafNode();
            if (l) props.onCloseTab(l.id, tabId);
          }}
          onDrop={props.onDrop}
        />
      </Show>
      <Show when={splitNode()}>
        <SplitView
          split={splitNode()!}
          setLeaf={props.setLeaf}
          setSplit={props.setSplit}
          onCloseTab={props.onCloseTab}
          onDrop={props.onDrop}
        />
      </Show>
    </>
  );
};

// Minimum size (px) preserved on each side of a divider when resizing.
const MIN_PANE_PX = 120;

const SplitView: Component<{
  split: SplitPane;
  setLeaf: (leafId: string, patch: (leaf: LeafPane) => LeafPane) => void;
  setSplit: (splitId: string, patch: (split: SplitPane) => SplitPane) => void;
  onCloseTab: (leafId: string, tabId: string) => void;
  onDrop: (targetLeafId: string, side: DropSide, info: DragInfo) => void;
}> = (props) => {
  const theme = useTheme;
  const isRow = () => props.split.direction === "horizontal";
  let containerRef!: HTMLDivElement;
  const [dragging, setDragging] = createSignal(false);

  const onDividerDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const row = isRow();
    const rect = containerRef.getBoundingClientRect();
    const total = row ? rect.width : rect.height;
    const start = row ? rect.left : rect.top;
    if (total <= 0) return;

    setDragging(true);
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = row ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";

    const minRatio = Math.min(0.5, MIN_PANE_PX / total);
    const maxRatio = 1 - minRatio;
    const splitId = props.split.id;

    const onMove = (ev: MouseEvent) => {
      const pos = row ? ev.clientX : ev.clientY;
      let ratio = (pos - start) / total;
      if (ratio < minRatio) ratio = minRatio;
      else if (ratio > maxRatio) ratio = maxRatio;
      props.setSplit(splitId, (s) => ({ ...s, ratio }));
    };
    const onUp = () => {
      setDragging(false);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onDividerDblClick = () => {
    props.setSplit(props.split.id, (s) => ({ ...s, ratio: 0.5 }));
  };

  return (
    <div
      ref={containerRef!}
      style={{
        flex: 1,
        display: "flex",
        "flex-direction": isRow() ? "row" : "column",
        "min-width": 0,
        "min-height": 0,
      }}
    >
      <div
        style={{
          display: "flex",
          flex: `${props.split.ratio} 1 0`,
          "min-width": 0,
          "min-height": 0,
        }}
      >
        <PaneTreeView
          node={props.split.first}
          setLeaf={props.setLeaf}
          setSplit={props.setSplit}
          onCloseTab={props.onCloseTab}
          onDrop={props.onDrop}
        />
      </div>
      <div
        onMouseDown={onDividerDown}
        onDblClick={onDividerDblClick}
        style={{
          [isRow() ? "width" : "height"]: "1px",
          background: dragging() ? theme().accent : theme().border,
          "flex-shrink": 0,
          position: "relative",
          cursor: isRow() ? "col-resize" : "row-resize",
          "z-index": 5,
          transition: dragging() ? "none" : "background 120ms ease",
        }}
      >
        <div
          style={{
            position: "absolute",
            [isRow() ? "left" : "top"]: "-3px",
            [isRow() ? "right" : "bottom"]: "-3px",
            [isRow() ? "top" : "left"]: 0,
            [isRow() ? "bottom" : "right"]: 0,
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          flex: `${1 - props.split.ratio} 1 0`,
          "min-width": 0,
          "min-height": 0,
        }}
      >
        <PaneTreeView
          node={props.split.second}
          setLeaf={props.setLeaf}
          setSplit={props.setSplit}
          onCloseTab={props.onCloseTab}
          onDrop={props.onDrop}
        />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Tweaks panel (in-app settings)
// ─────────────────────────────────────────────────────────────
const RadioRow: Component<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}> = (props) => {
  const theme = useTheme;
  return (
    <div style={{ "margin-bottom": "12px" }}>
      <div
        style={{
          "font-size": "11px",
          color: theme().textDim,
          "margin-bottom": "6px",
          "font-family": "var(--mono)",
          "text-transform": "uppercase",
          "letter-spacing": "0.05em",
        }}
      >
        {props.label}
      </div>
      <div style={{ display: "flex", gap: "4px" }}>
        <For each={props.options}>
          {(opt) => (
            <button
              onClick={() => props.onChange(opt.value)}
              style={{
                flex: 1,
                padding: "6px 10px",
                "border-radius": rad(theme(), 6),
                "font-size": "12px",
                cursor: "pointer",
                background:
                  props.value === opt.value ? theme().panel : "transparent",
                border: `1px solid ${
                  props.value === opt.value ? theme().borderStrong : theme().border
                }`,
                color: props.value === opt.value ? theme().text : theme().textDim,
                "font-family": "inherit",
              }}
            >
              {opt.label}
            </button>
          )}
        </For>
      </div>
    </div>
  );
};

const TweaksPanel: Component<{
  open: boolean;
  onClose: () => void;
  themeName: ThemeName;
  setTheme: (n: ThemeName) => void;
  density: Density;
  setDensity: (d: Density) => void;
}> = (props) => {
  const theme = useTheme;
  return (
    <Show when={props.open}>
      <div
        style={{
          position: "fixed",
          top: "60px",
          right: "32px",
          width: "280px",
          background: theme().chrome,
          border: `1px solid ${theme().borderStrong}`,
          "border-radius": rad(theme(), 12),
          padding: "16px",
          "box-shadow": "0 24px 60px rgba(0,0,0,0.5)",
          "z-index": 200,
        }}
      >
        <div
          style={{
            display: "flex",
            "justify-content": "space-between",
            "align-items": "center",
            "margin-bottom": "14px",
          }}
        >
          <span style={{ "font-size": "13px", "font-weight": 600, color: theme().text }}>Tweaks</span>
          <button
            onClick={props.onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: theme().textDim,
              padding: "4px",
              display: "flex",
              "align-items": "center",
              "border-radius": rad(theme(), 4),
            }}
          >
            <Icon name="close" size={11} />
          </button>
        </div>
        <RadioRow
          label="Palette"
          value={props.themeName}
          onChange={(v) => props.setTheme(v as ThemeName)}
          options={[
            { value: "ember", label: "Ember" },
            { value: "forest", label: "Forest" },
            { value: "plum", label: "Plum" },
            { value: "zed", label: "Zed Light" },
          ]}
        />
        <RadioRow
          label="Density"
          value={props.density}
          onChange={(v) => props.setDensity(v as Density)}
          options={[
            { value: "cozy", label: "Cozy" },
            { value: "compact", label: "Compact" },
          ]}
        />
      </div>
    </Show>
  );
};

// ─────────────────────────────────────────────────────────────
// Empty state — no workspace selected
// ─────────────────────────────────────────────────────────────
const EmptyWorkspace: Component<{
  hasWorkspaces: boolean;
  onAdd: () => void;
}> = (props) => {
  const theme = useTheme;
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        "flex-direction": "column",
        "align-items": "center",
        "justify-content": "center",
        gap: "16px",
        background: theme().panelDeep,
        color: theme().textDim,
      }}
    >
      <FayeMascot size={48} wing={theme().accent} body={theme().bg} />
      <div
        style={{
          "font-size": "14px",
          color: theme().text,
          "letter-spacing": "-0.01em",
        }}
      >
        {props.hasWorkspaces ? "Pick a folder from the sidebar" : "No folder open"}
      </div>
      <Show when={!props.hasWorkspaces}>
        <button
          onClick={props.onAdd}
          style={{
            background: "transparent",
            border: `1px solid ${theme().borderStrong}`,
            color: theme().text,
            padding: "8px 16px",
            "border-radius": rad(theme(), 8),
            cursor: "pointer",
            "font-size": "12px",
            "font-family": "var(--mono)",
            display: "flex",
            "align-items": "center",
            gap: "6px",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = theme().panelAlt)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <Icon name="plus" size={11} />
          <span>Open folder</span>
        </button>
      </Show>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────
const SIDEBAR_OPEN_KEY = "faye:sidebarOpen";
const THEME_NAME_KEY = "faye:themeName";

const readSidebarOpen = (): boolean => {
  try {
    const v = localStorage.getItem(SIDEBAR_OPEN_KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
};

const readThemeName = (): ThemeName => {
  try {
    const v = localStorage.getItem(THEME_NAME_KEY);
    if (v && v in THEMES) return v as ThemeName;
  } catch {}
  return "ember";
};

const App: Component = () => {
  const [themeName, setThemeNameSignal] = createSignal<ThemeName>(readThemeName());
  const setThemeName = (n: ThemeName) => {
    setThemeNameSignal(n);
    try {
      localStorage.setItem(THEME_NAME_KEY, n);
    } catch {}
  };
  const [density, setDensity] = createSignal<Density>("cozy");
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [sidebarOpen, setSidebarOpen] = createSignal<boolean>(readSidebarOpen());

  const toggleSidebar = () => {
    setSidebarOpen((o) => {
      const next = !o;
      try {
        localStorage.setItem(SIDEBAR_OPEN_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  const themeAccessor = () => THEMES[themeName()];

  createEffect(() => {
    const t = themeAccessor();
    const root = document.documentElement.style;
    root.setProperty("--scrollbar-radius", rad(t, 8));
    root.setProperty("--body-bg", t.bg);
    root.setProperty("--body-fg", t.text);
  });

  const [workspaces, setWorkspaces] = createSignal<Workspace[]>([]);
  const [activeWs, setActiveWs] = createSignal<string>("");
  const [panes, setPanes] = createSignal<PanesByWs>({});
  const [bootstrapped, setBootstrapped] = createSignal(false);
  const [installedClis, setInstalledClis] = createSignal<Map<string, string>>(
    new Map(),
  );

  onMount(async () => {
    try {
      const rows = await listProjects();
      const projectsList = rows.map(rowToWorkspace);
      const activeId = await getActiveProject();
      const entries = await Promise.all(
        projectsList.map(
          async (p) => [p.id, await loadPaneTree(p.id)] as const,
        ),
      );
      const panesMap: PanesByWs = {};
      for (const [id, wp] of entries) panesMap[id] = wp;
      setWorkspaces(projectsList);
      setPanes(panesMap);
      setActiveWs(activeId ?? projectsList[0]?.id ?? "");
    } catch (err) {
      console.error("bootstrap failed", err);
    } finally {
      setBootstrapped(true);
    }
  });

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  onMount(() => {
    invoke<{ kind: string; found: boolean; path: string | null }[]>("detect_clis")
      .then((infos) => {
        const next = new Map<string, string>();
        for (const c of infos) {
          if (c.found && c.path) next.set(c.kind, c.path);
        }
        setInstalledClis(next);
      })
      .catch((err) => console.error("detect_clis failed", err));
  });

  const ensurePanes = (wsId: string) => {
    if (!wsId) return;
    if (!panes()[wsId]) {
      setPanes((prev) => ({ ...prev, [wsId]: defaultPanes() }));
    }
  };

  createEffect(() => {
    if (!bootstrapped()) return;
    ensurePanes(activeWs());
  });

  // ─── Persistence: debounced writes after bootstrap ─────────────────
  const debouncedSaveProjects = debounce((list: Workspace[]) => {
    replaceProjects(list.map((w, i) => workspaceToRow(w, i))).catch((e) =>
      console.error("replaceProjects failed", e),
    );
  }, 200);

  const debouncedSaveActive = debounce((id: string) => {
    dbSetActiveProject(id || null).catch((e) =>
      console.error("setActiveProject failed", e),
    );
  }, 200);

  // Track which projects we have already persisted in this session so we can
  // GC the layout+sessions for any that get removed from `workspaces()`.
  const persistedProjectIds = new Set<string>();
  const lastSavedLayout = new Map<string, string>();

  const debouncedSaveLayouts = debounce((p: PanesByWs, ids: Set<string>) => {
    for (const id of Object.keys(p)) {
      if (!ids.has(id)) continue;
      const json = JSON.stringify(paneTreeToLayout(p[id].root));
      if (lastSavedLayout.get(id) === json) continue;
      lastSavedLayout.set(id, json);
      saveProjectState(id, p[id].root).catch((e) =>
        console.error("saveProjectState failed", e),
      );
    }
  }, 200);

  createEffect(() => {
    if (!bootstrapped()) return;
    const list = workspaces();
    const ids = new Set(list.map((w) => w.id));
    // GC removed projects
    for (const old of persistedProjectIds) {
      if (!ids.has(old)) {
        deleteProject(old).catch((e) =>
          console.error("deleteProject failed", e),
        );
        lastSavedLayout.delete(old);
      }
    }
    persistedProjectIds.clear();
    for (const id of ids) persistedProjectIds.add(id);
    debouncedSaveProjects(list);
  });

  createEffect(() => {
    if (!bootstrapped()) return;
    debouncedSaveActive(activeWs());
  });

  createEffect(() => {
    if (!bootstrapped()) return;
    const p = panes();
    const ids = new Set(workspaces().map((w) => w.id));
    debouncedSaveLayouts(p, ids);
  });

  const addWorkspace = async () => {
    let picked: string | string[] | null = null;
    try {
      picked = await openDialog({ directory: true, multiple: false });
    } catch (err) {
      console.error("dialog open failed", err);
      return;
    }
    if (!picked || Array.isArray(picked)) return;
    const path = picked;
    const list = workspaces();
    const existing = list.find((w) => w.path === path);
    if (existing) {
      setActiveWs(existing.id);
      return;
    }
    const ws: Workspace = {
      id: "ws-" + Math.random().toString(36).slice(2, 8),
      name: basename(path),
      path,
      mascot: MASCOT_CYCLE[list.length % MASCOT_CYCLE.length],
    };
    // Persist project row + initial layout eagerly so the FK-bound layout/
    // session writes triggered by the reactive effects always find a parent.
    try {
      await upsertProject(workspaceToRow(ws, list.length));
      const initial = defaultPanes();
      await saveProjectState(ws.id, initial.root);
      persistedProjectIds.add(ws.id);
      lastSavedLayout.set(
        ws.id,
        JSON.stringify(paneTreeToLayout(initial.root)),
      );
      setPanes((prev) => ({ ...prev, [ws.id]: initial }));
    } catch (err) {
      console.error("create project failed", err);
      return;
    }
    setWorkspaces([...list, ws]);
    setActiveWs(ws.id);
  };

  const current = (): WorkspacePanes | undefined => panes()[activeWs()];
  const currentPath = (): string | undefined =>
    workspaces().find((w) => w.id === activeWs())?.path;

  // PTY-backed tabs (terminal + any CLI agent) across every workspace's pane
  // tree. Mounted at the App root so switching workspaces re-parents the
  // xterm DOM (via the terminalHost registry) instead of unmounting the
  // XtermPane and killing the PTY.
  const allPtyTabs = createMemo<Tab[]>(() => {
    const out: Tab[] = [];
    for (const wp of Object.values(panes())) {
      walkLeaves(wp.root, (leaf) => {
        for (const t of leaf.tabs) if (isPtyKind(t.kind)) out.push(t);
      });
    }
    return out;
  });

  const activeTabIds = createMemo<Set<string>>(() => {
    const s = new Set<string>();
    for (const wp of Object.values(panes())) {
      walkLeaves(wp.root, (leaf) => {
        if (leaf.activeTab) s.add(leaf.activeTab);
      });
    }
    return s;
  });

  // Per-workspace footer info — node version + git branch
  const [nodeVersion, setNodeVersion] = createSignal<string | null>(null);
  const [gitBranch, setGitBranch] = createSignal<string | null>(null);

  createEffect(() => {
    const path = currentPath();
    setNodeVersion(null);
    setGitBranch(null);
    if (!path) return;

    let alive = true;
    const refreshBranch = () => {
      invoke<string | null>("detect_git_branch", { cwd: path })
        .then((v) => alive && setGitBranch(v ?? null))
        .catch(() => alive && setGitBranch(null));
    };
    invoke<string | null>("detect_node_version", { cwd: path })
      .then((v) => alive && setNodeVersion(v ?? null))
      .catch(() => alive && setNodeVersion(null));
    refreshBranch();
    const id = setInterval(refreshBranch, 5000);
    onCleanup(() => {
      alive = false;
      clearInterval(id);
    });
  });

  const workspaceInfo: WorkspaceInfo = {
    node: nodeVersion,
    branch: gitBranch,
  };

  const setRoot = (newRoot: PaneNode) => {
    const ws = activeWs();
    if (!ws || !panes()[ws]) return;
    setPanes((prev) => ({ ...prev, [ws]: { root: newRoot } }));
  };

  const setLeafByActive = (
    leafId: string,
    patch: (leaf: LeafPane) => LeafPane,
  ) => {
    const cur = current();
    if (!cur) return;
    setRoot(updateLeaf(cur.root, leafId, patch));
  };

  const setSplitByActive = (
    splitId: string,
    patch: (split: SplitPane) => SplitPane,
  ) => {
    const cur = current();
    if (!cur) return;
    setRoot(updateSplit(cur.root, splitId, patch));
  };

  const handleCloseTab = (leafId: string, tabId: string) => {
    const cur = current();
    if (!cur) return;
    setRoot(closeTabInTree(cur.root, leafId, tabId));
  };

  const handleDrop = (
    targetLeafId: string,
    side: DropSide,
    info: DragInfo,
  ) => {
    const cur = current();
    if (!cur) return;
    setRoot(
      moveTabInTree(
        cur.root,
        info.sourceLeafId,
        info.sourceTabId,
        targetLeafId,
        side,
      ),
    );
  };

  const [dragInfo, setDragInfo] = createSignal<DragInfo | null>(null);
  const dragApi = { drag: dragInfo, setDrag: setDragInfo };

  onMount(() => {
    // Fail-safe: drop landed outside any overlay, Esc cancelled the drag,
    // window lost focus mid-drag, etc. Clear the body class so the drop
    // overlay doesn't stay pointer-events:auto and steal xterm events.
    const clear = () => {
      document.body.classList.remove("faye-dragging");
      setDragInfo(null);
    };
    window.addEventListener("dragend", clear);
    window.addEventListener("drop", clear);
    onCleanup(() => {
      window.removeEventListener("dragend", clear);
      window.removeEventListener("drop", clear);
    });
  });

  const outerStyle = (): JSX.CSSProperties => ({
    width: "100vw",
    height: "100vh",
    background: themeAccessor().bg,
    "font-family": "var(--ui)",
  });

  const windowStyle = (): JSX.CSSProperties => ({
    width: "100%",
    height: "100%",
    background: themeAccessor().bg,
    overflow: "hidden",
    display: "flex",
    "flex-direction": "column",
    color: themeAccessor().text,
  });

  return (
    <ThemeContext.Provider value={themeAccessor}>
      <WorkspaceContext.Provider value={currentPath}>
      <WorkspaceInfoContext.Provider value={workspaceInfo}>
      <InstalledClisContext.Provider value={installedClis}>
      <DragContext.Provider value={dragApi}>
      <div style={outerStyle()}>
        <Show when={bootstrapped()} fallback={<Splash />}>
        <div style={windowStyle()}>
          <Titlebar
            onToggleSettings={() => setSettingsOpen((o) => !o)}
            sidebarOpen={sidebarOpen()}
            onToggleSidebar={toggleSidebar}
            onAddProject={addWorkspace}
          />
          <div style={{ flex: 1, display: "flex", "min-height": 0 }}>
            <Sidebar
              workspaces={workspaces()}
              active={activeWs()}
              setActive={setActiveWs}
              density={density()}
              open={sidebarOpen()}
            />

            <Show
              when={current()}
              fallback={
                <EmptyWorkspace
                  hasWorkspaces={workspaces().length > 0}
                  onAdd={addWorkspace}
                />
              }
            >
              {(p) => (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    "min-width": 0,
                    "min-height": 0,
                  }}
                >
                  <PaneTreeView
                    node={p().root}
                    setLeaf={setLeafByActive}
                    setSplit={setSplitByActive}
                    onCloseTab={handleCloseTab}
                    onDrop={handleDrop}
                  />
                  <For each={allPtyTabs()}>
                    {(t) => (
                      <XtermPane
                        sessionId={t.id}
                        visible={activeTabIds().has(t.id)}
                        command={
                          t.kind === "terminal"
                            ? undefined
                            : installedClis().get(t.kind)
                        }
                        cliSessionId={t.cliSessionId}
                      />
                    )}
                  </For>
                </div>
              )}
            </Show>
          </div>
        </div>
        </Show>

        <TweaksPanel
          open={settingsOpen()}
          onClose={() => setSettingsOpen(false)}
          themeName={themeName()}
          setTheme={setThemeName}
          density={density()}
          setDensity={setDensity}
        />
      </div>
      </DragContext.Provider>
      </InstalledClisContext.Provider>
      </WorkspaceInfoContext.Provider>
      </WorkspaceContext.Provider>
    </ThemeContext.Provider>
  );
};

const Splash: Component = () => {
  const theme = useTheme;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        background: theme().bg,
      }}
    >
      <FayeMascot size={56} wing={theme().accent} body={theme().bg} />
    </div>
  );
};

export default App;
