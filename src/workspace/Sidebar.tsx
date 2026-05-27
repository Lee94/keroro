import {
  createSignal,
  createMemo,
  For,
  Show,
  type Accessor,
  type Component,
  type JSX,
} from "solid-js";
import { rad } from "../themes";
import { useTheme } from "../ui/useTheme";
import { Icon } from "../ui/Icon";
import { useT } from "../i18n";
import {
  CubeMascot,
  MushroomMascot,
  OrchidMascot,
  TerminalMascot,
} from "../mascots";
import { AgentMascot } from "../panes/AgentMascot";
import { needsAttentionTabs } from "../panes/attention";
import { displayTabTitle } from "../sessionTitles";
import type { Density, Workspace } from "./types";
import type { PaletteEntry } from "../CommandPalette";
import type { ProjectCommandRow } from "../persistence";
import {
  commandRunInfo,
  killProjectCommand,
  runProjectCommand,
} from "./commandRuns";
import { CommandEditorModal, type CommandDraft } from "./CommandEditorModal";
import { CommandOutputModal } from "./CommandOutputModal";
import { statusColor, statusLabelKey } from "./commandStatus";

const renderMascot = (
  kind: Workspace["mascot"],
  theme: ReturnType<typeof useTheme>,
  size = 28,
) => {
  const t = theme();
  switch (kind) {
    case "orchid":
      return <OrchidMascot size={size} outer={t.accent} inner={t.bg} />;
    case "terminal":
      return <TerminalMascot size={size} color={t.pixelGreen} />;
    case "cube":
      return <CubeMascot size={size} light={t.pixelBlue} dark={t.accentDim} />;
    case "mushroom":
      return <MushroomMascot size={size} />;
  }
};

// ─── Project header row ────────────────────────────────────────────────
// The caret is its own click target so users can expand/collapse without
// switching the active workspace. Click on the rest of the row activates the
// project AND auto-expands it (it's annoying to lose your view of children
// just because you clicked a sibling).
//
// Row height is constant regardless of active state — switching projects
// should change colors, not push neighbors around. The path lives in a
// tooltip so the row stays one line.
const ProjectRow: Component<{
  ws: Workspace;
  active: boolean;
  expanded: boolean;
  hasAttention: boolean;
  onActivate: () => void;
  onToggleExpand: () => void;
  onDelete: () => void;
}> = (props) => {
  const theme = useTheme();
  const t = useT();
  const [hover, setHover] = createSignal(false);
  const [deleteHover, setDeleteHover] = createSignal(false);

  return (
    <div
      onClick={props.onActivate}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={props.ws.path}
      style={{
        display: "flex",
        "align-items": "center",
        gap: "8px",
        padding: "6px 10px 6px 4px",
        margin: "1px 8px",
        "border-radius": rad(theme(), 8),
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
      <button
        onClick={(e) => {
          e.stopPropagation();
          props.onToggleExpand();
        }}
        title={
          props.expanded ? t("sidebarCollapseProject") : t("sidebarExpandProject")
        }
        aria-label={
          props.expanded ? t("sidebarCollapseProject") : t("sidebarExpandProject")
        }
        style={{
          background: "transparent",
          border: "none",
          padding: "4px",
          color: theme().textMuted,
          cursor: "pointer",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          transform: props.expanded ? "rotate(90deg)" : "rotate(0deg)",
          transition: "transform 120ms",
        }}
      >
        <Icon name="caret" size={10} />
      </button>
      <div
        style={{
          width: "22px",
          height: "22px",
          "flex-shrink": 0,
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
        }}
      >
        {renderMascot(props.ws.mascot, theme, 18)}
      </div>
      <div style={{ flex: 1, "min-width": 0 }}>
        <div
          style={{
            "font-size": "13px",
            "font-weight": 500,
            color: props.active ? theme().text : theme().textDim,
            "letter-spacing": "-0.01em",
            overflow: "hidden",
            "text-overflow": "ellipsis",
            "white-space": "nowrap",
          }}
        >
          {props.ws.name}
        </div>
      </div>
      <div
        style={{
          position: "relative",
          width: "20px",
          height: "20px",
          "flex-shrink": 0,
        }}
      >
        <Show when={props.hasAttention}>
          <span
            title="Terminal waiting for input"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "6px",
              height: "6px",
              "border-radius": "50%",
              background: theme().amber,
              "box-shadow": `0 0 6px ${theme().amber}80`,
              opacity: hover() ? 0 : 1,
              transition: "opacity 120ms",
              "pointer-events": "none",
            }}
          />
        </Show>
        <button
          onClick={(e) => {
            e.stopPropagation();
            props.onDelete();
          }}
          onMouseEnter={() => setDeleteHover(true)}
          onMouseLeave={() => setDeleteHover(false)}
          title={t("removeProject")}
          aria-label={t("removeProject")}
          style={{
            position: "absolute",
            inset: 0,
            background: deleteHover() ? theme().borderStrong : "transparent",
            border: "none",
            padding: 0,
            "border-radius": rad(theme(), 4),
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            color: deleteHover() ? theme().text : theme().textMuted,
            cursor: "pointer",
            opacity: hover() ? 1 : 0,
            transition: "opacity 120ms, background 90ms, color 90ms",
          }}
        >
          <Icon name="close" size={10} />
        </button>
      </div>
    </div>
  );
};

// ─── Section header ("Terminals" / "Commands") ─────────────────────────
const SectionHeader: Component<{
  label: string;
  trailing?: JSX.Element;
}> = (props) => {
  const theme = useTheme();
  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        padding: "6px 14px 4px 38px",
        "font-size": "10px",
        "font-weight": 600,
        "letter-spacing": "0.08em",
        "text-transform": "uppercase",
        color: theme().textMuted,
      }}
    >
      <span>{props.label}</span>
      {props.trailing}
    </div>
  );
};

// ─── Terminal item (renders one PTY tab from the project's pane tree) ─
const TerminalListItem: Component<{
  entry: PaletteEntry;
  active: boolean;
  hasAttention: boolean;
  onActivate: () => void;
  onClose: () => void;
}> = (props) => {
  const theme = useTheme();
  const t = useT();
  const [hover, setHover] = createSignal(false);
  const [closeHover, setCloseHover] = createSignal(false);
  return (
    <div
      onClick={props.onActivate}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        "align-items": "center",
        gap: "8px",
        padding: "5px 14px 5px 38px",
        margin: "1px 8px",
        "border-radius": rad(theme(), 6),
        cursor: "pointer",
        background: props.active
          ? theme().panel
          : hover()
            ? theme().panelAlt
            : "transparent",
        transition: "background 90ms",
      }}
    >
      <AgentMascot kind={props.entry.tab.kind} size={12} />
      <span
        style={{
          flex: 1,
          "font-size": "12px",
          color: props.active ? theme().text : theme().textDim,
          overflow: "hidden",
          "text-overflow": "ellipsis",
          "white-space": "nowrap",
          "letter-spacing": "-0.01em",
        }}
      >
        {displayTabTitle(props.entry.tab) || props.entry.tab.kind}
      </span>
      {/* Right slot: attention dot when idle-hover, close button on hover.
        * Fixed-width box so the row doesn't reflow when the icon swaps. */}
      <div
        style={{
          position: "relative",
          width: "18px",
          height: "18px",
          "flex-shrink": 0,
        }}
      >
        <Show when={props.hasAttention}>
          <span
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "6px",
              height: "6px",
              "border-radius": "50%",
              background: theme().amber,
              "box-shadow": `0 0 6px ${theme().amber}80`,
              opacity: hover() ? 0 : 1,
              transition: "opacity 120ms",
              "pointer-events": "none",
            }}
          />
        </Show>
        <button
          onClick={(e) => {
            e.stopPropagation();
            props.onClose();
          }}
          onMouseEnter={() => setCloseHover(true)}
          onMouseLeave={() => setCloseHover(false)}
          title={t("closeTerminal")}
          aria-label={t("closeTerminal")}
          style={{
            position: "absolute",
            inset: 0,
            background: closeHover() ? theme().borderStrong : "transparent",
            border: "none",
            padding: 0,
            "border-radius": rad(theme(), 4),
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            color: closeHover() ? theme().text : theme().textMuted,
            cursor: "pointer",
            opacity: hover() ? 1 : 0,
            transition: "opacity 120ms, background 90ms, color 90ms",
          }}
        >
          <Icon name="close" size={9} />
        </button>
      </div>
    </div>
  );
};

// ─── Command item ──────────────────────────────────────────────────────
// Left-click runs the command in the background (no UI shown unless the
// user opens the output modal). Right-click opens that modal. Hover exposes
// edit + delete in the same overlay slot as the workspace row's delete.
const CommandListItem: Component<{
  command: ProjectCommandRow;
  cwd: string;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = (props) => {
  const theme = useTheme();
  const t = useT();
  const [hover, setHover] = createSignal(false);
  const info = createMemo(() => commandRunInfo(props.command.id));
  const isRunning = () => info().state === "running";

  const handleClick = () => {
    if (isRunning()) {
      // Already running: tap-to-view rather than re-fire, so we don't
      // accidentally spawn dueling instances of the same dev server.
      props.onView();
      return;
    }
    void runProjectCommand(props.command, props.cwd);
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    props.onView();
  };

  const label = () =>
    props.command.title?.trim() || props.command.command;

  return (
    <div
      onClick={handleClick}
      oncontextmenu={handleContextMenu}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={
        isRunning()
          ? `${t("commandRunning")}  —  ${props.command.command}`
          : `${t("commandRun")}: ${props.command.command}  ·  ${t("commandViewOutput")}`
      }
      style={{
        display: "flex",
        "align-items": "center",
        gap: "8px",
        padding: "5px 14px 5px 38px",
        margin: "1px 8px",
        "border-radius": rad(theme(), 6),
        cursor: "pointer",
        position: "relative",
        background: hover() ? theme().panelAlt : "transparent",
        transition: "background 90ms",
      }}
    >
      <span
        aria-label={t(statusLabelKey(info().state))}
        title={t(statusLabelKey(info().state))}
        style={{
          width: "8px",
          height: "8px",
          "border-radius": "50%",
          background: statusColor(info().state, theme()),
          "box-shadow":
            info().state === "running"
              ? `0 0 6px ${statusColor(info().state, theme())}80`
              : "none",
          "flex-shrink": 0,
        }}
      />
      <span
        style={{
          flex: 1,
          "font-size": "12px",
          "font-family": props.command.title ? "var(--ui)" : "var(--mono)",
          color: theme().textDim,
          overflow: "hidden",
          "text-overflow": "ellipsis",
          "white-space": "nowrap",
          "letter-spacing": "-0.01em",
        }}
      >
        {label()}
      </span>
      <div
        style={{
          display: "flex",
          gap: "2px",
          opacity: hover() ? 1 : 0,
          transition: "opacity 120ms",
          "flex-shrink": 0,
        }}
      >
        <Show when={isRunning()}>
          <RowIconButton
            onClick={(e) => {
              e.stopPropagation();
              void killProjectCommand(props.command.id);
            }}
            label={t("commandStop")}
            // Stop button: small filled square, conveys "halt" without
            // needing a new icon in Icon.tsx.
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                background: theme().red,
                "border-radius": "1px",
                display: "inline-block",
              }}
            />
          </RowIconButton>
        </Show>
        <RowIconButton
          onClick={(e) => {
            e.stopPropagation();
            props.onEdit();
          }}
          label={t("commandEdit")}
        >
          <Icon name="settings" size={10} />
        </RowIconButton>
        <RowIconButton
          onClick={(e) => {
            e.stopPropagation();
            props.onDelete();
          }}
          label={t("commandDelete")}
        >
          <Icon name="close" size={9} />
        </RowIconButton>
      </div>
    </div>
  );
};

const RowIconButton: Component<{
  label: string;
  onClick: (e: MouseEvent) => void;
  children: JSX.Element;
}> = (props) => {
  const theme = useTheme();
  const [hover, setHover] = createSignal(false);
  return (
    <button
      onClick={props.onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={props.label}
      aria-label={props.label}
      style={{
        width: "18px",
        height: "18px",
        background: hover() ? theme().borderStrong : "transparent",
        color: hover() ? theme().text : theme().textMuted,
        border: "none",
        padding: 0,
        "border-radius": rad(theme(), 4),
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        cursor: "pointer",
        transition: "background 90ms, color 90ms",
      }}
    >
      {props.children}
    </button>
  );
};

// ─── Project group: header + (when expanded) children ─────────────────
const ProjectGroup: Component<{
  ws: Workspace;
  active: boolean;
  expanded: boolean;
  hasAttention: boolean;
  attentionTabs: ReadonlySet<string>;
  activeWsId: string;
  activeTabIds: ReadonlySet<string>;
  tabs: PaletteEntry[];
  commands: ProjectCommandRow[];
  showDivider: boolean;
  onActivateWs: () => void;
  onToggleExpand: () => void;
  onDeleteWs: () => void;
  onActivateTab: (entry: PaletteEntry) => void;
  onCloseTab: (entry: PaletteEntry) => void;
  onAddCommand: () => void;
  onAddTerminal: () => void;
  onEditCommand: (cmd: ProjectCommandRow) => void;
  onDeleteCommand: (cmd: ProjectCommandRow) => void;
  onViewCommandOutput: (cmd: ProjectCommandRow) => void;
}> = (props) => {
  const theme = useTheme();
  const t = useT();
  return (
    <div
      style={{
        "margin-bottom": "2px",
        "padding-top": props.showDivider ? "6px" : "0",
        "border-top": props.showDivider ? `1px solid ${theme().border}` : "none",
      }}
    >
      <ProjectRow
        ws={props.ws}
        active={props.active}
        expanded={props.expanded}
        hasAttention={props.hasAttention}
        onActivate={props.onActivateWs}
        onToggleExpand={props.onToggleExpand}
        onDelete={props.onDeleteWs}
      />
      <Show when={props.expanded}>
        <SectionHeader
          label={t("sidebarTerminalsSection")}
          trailing={
            <button
              onClick={(e) => {
                e.stopPropagation();
                props.onAddTerminal();
              }}
              title={t("newTerminalButton")}
              aria-label={t("newTerminalButton")}
              style={{
                background: "transparent",
                border: "none",
                padding: "2px",
                color: theme().textMuted,
                cursor: "pointer",
                display: "flex",
                "align-items": "center",
                "border-radius": rad(theme(), 4),
              }}
            >
              <Icon name="plus" size={10} />
            </button>
          }
        />
        <Show
          when={props.tabs.length > 0}
          fallback={
            <div
              style={{
                padding: "2px 14px 4px 38px",
                "font-size": "11px",
                color: theme().textMuted,
              }}
            >
              —
            </div>
          }
        >
          <For each={props.tabs}>
            {(entry) => (
              <TerminalListItem
                entry={entry}
                active={
                  props.activeWsId === entry.workspaceId &&
                  props.activeTabIds.has(entry.tab.id)
                }
                hasAttention={props.attentionTabs.has(entry.tab.id)}
                onActivate={() => props.onActivateTab(entry)}
                onClose={() => props.onCloseTab(entry)}
              />
            )}
          </For>
        </Show>
        <SectionHeader
          label={t("sidebarCommandsSection")}
          trailing={
            <button
              onClick={(e) => {
                e.stopPropagation();
                props.onAddCommand();
              }}
              title={t("commandAddTooltip")}
              aria-label={t("commandAddTooltip")}
              style={{
                background: "transparent",
                border: "none",
                padding: "2px",
                color: theme().textMuted,
                cursor: "pointer",
                display: "flex",
                "align-items": "center",
                "border-radius": rad(theme(), 4),
              }}
            >
              <Icon name="plus" size={10} />
            </button>
          }
        />
        <Show
          when={props.commands.length > 0}
          fallback={
            <div
              style={{
                padding: "2px 14px 6px 38px",
                "font-size": "11px",
                color: theme().textMuted,
              }}
            >
              {t("sidebarCommandsEmpty")}
            </div>
          }
        >
          <For each={props.commands}>
            {(cmd) => (
              <CommandListItem
                command={cmd}
                cwd={props.ws.path}
                onView={() => props.onViewCommandOutput(cmd)}
                onEdit={() => props.onEditCommand(cmd)}
                onDelete={() => props.onDeleteCommand(cmd)}
              />
            )}
          </For>
        </Show>
        <div style={{ height: "6px" }} />
      </Show>
    </div>
  );
};

// ─── Sidebar root ─────────────────────────────────────────────────────
export const Sidebar: Component<{
  workspaces: Workspace[];
  active: string;
  setActive: (id: string) => void;
  onDelete: (id: string) => void;
  density: Density;
  open: boolean;
  attentionWorkspaces: ReadonlySet<string>;
  tabEntries: Accessor<PaletteEntry[]>;
  activeTabIds: ReadonlySet<string>;
  onActivateTab: (entry: PaletteEntry) => void;
  onCloseTab: (entry: PaletteEntry) => void;
  commandsByWs: Record<string, ProjectCommandRow[]>;
  setCommandsForWs: (wsId: string, list: ProjectCommandRow[]) => void;
  expanded: ReadonlySet<string>;
  setExpanded: (next: ReadonlySet<string>) => void;
  onAddTerminal: (wsId: string) => void;
}> = (props) => {
  const theme = useTheme();
  const t = useT();
  const fullWidth = () => (props.density === "compact" ? 240 : 268);

  const [editorOpen, setEditorOpen] = createSignal(false);
  const [editorInitial, setEditorInitial] =
    createSignal<ProjectCommandRow | null>(null);
  const [editorWsId, setEditorWsId] = createSignal<string>("");

  const [outputOpen, setOutputOpen] = createSignal(false);
  const [outputCommand, setOutputCommand] = createSignal<ProjectCommandRow | null>(null);
  const [outputCwd, setOutputCwd] = createSignal<string>("");

  const tabsByWs = createMemo(() => {
    const out: Record<string, PaletteEntry[]> = {};
    for (const entry of props.tabEntries()) {
      (out[entry.workspaceId] ||= []).push(entry);
    }
    return out;
  });

  const toggleExpand = (wsId: string) => {
    const next = new Set(props.expanded);
    if (next.has(wsId)) next.delete(wsId);
    else next.add(wsId);
    props.setExpanded(next);
  };

  const ensureExpanded = (wsId: string) => {
    if (props.expanded.has(wsId)) return;
    const next = new Set(props.expanded);
    next.add(wsId);
    props.setExpanded(next);
  };

  const handleActivate = (wsId: string) => {
    props.setActive(wsId);
    ensureExpanded(wsId);
  };

  const openAddCommand = (wsId: string) => {
    setEditorWsId(wsId);
    setEditorInitial(null);
    setEditorOpen(true);
  };

  const openEditCommand = (wsId: string, cmd: ProjectCommandRow) => {
    setEditorWsId(wsId);
    setEditorInitial(cmd);
    setEditorOpen(true);
  };

  const handleDeleteCommand = (wsId: string, cmd: ProjectCommandRow) => {
    const list = props.commandsByWs[wsId] ?? [];
    props.setCommandsForWs(
      wsId,
      list.filter((c) => c.id !== cmd.id),
    );
  };

  const handleViewOutput = (ws: Workspace, cmd: ProjectCommandRow) => {
    setOutputCommand(cmd);
    setOutputCwd(ws.path);
    setOutputOpen(true);
  };

  const handleSaveCommand = (draft: CommandDraft) => {
    const wsId = editorWsId();
    if (!wsId) return;
    const existing = props.commandsByWs[wsId] ?? [];
    if (draft.id) {
      props.setCommandsForWs(
        wsId,
        existing.map((c) =>
          c.id === draft.id
            ? { ...c, title: draft.title || null, command: draft.command }
            : c,
        ),
      );
    } else {
      const id = "cmd-" + Math.random().toString(36).slice(2, 10);
      const next: ProjectCommandRow = {
        id,
        projectId: wsId,
        title: draft.title || null,
        command: draft.command,
        position: existing.length,
      };
      props.setCommandsForWs(wsId, [...existing, next]);
    }
    setEditorOpen(false);
  };

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
                {t("sidebarEmptyTitle")}
                <br />
                {t("sidebarEmptyHintPrefix")}
                <span style={{ color: theme().textDim }}>
                  {t("sidebarEmptyHintButton")}
                </span>
                {t("sidebarEmptyHintSuffix")}
              </div>
            }
          >
            <For each={props.workspaces}>
              {(ws, index) => (
                <ProjectGroup
                  ws={ws}
                  active={props.active === ws.id}
                  expanded={props.expanded.has(ws.id)}
                  hasAttention={props.attentionWorkspaces.has(ws.id)}
                  attentionTabs={needsAttentionTabs()}
                  activeWsId={props.active}
                  activeTabIds={props.activeTabIds}
                  tabs={tabsByWs()[ws.id] ?? []}
                  commands={props.commandsByWs[ws.id] ?? []}
                  showDivider={index() > 0}
                  onActivateWs={() => handleActivate(ws.id)}
                  onToggleExpand={() => toggleExpand(ws.id)}
                  onDeleteWs={() => props.onDelete(ws.id)}
                  onActivateTab={props.onActivateTab}
                  onCloseTab={props.onCloseTab}
                  onAddCommand={() => openAddCommand(ws.id)}
                  onAddTerminal={() => props.onAddTerminal(ws.id)}
                  onEditCommand={(cmd) => openEditCommand(ws.id, cmd)}
                  onDeleteCommand={(cmd) => handleDeleteCommand(ws.id, cmd)}
                  onViewCommandOutput={(cmd) => handleViewOutput(ws, cmd)}
                />
              )}
            </For>
          </Show>
        </div>
      </div>

      <CommandEditorModal
        open={editorOpen()}
        initial={editorInitial()}
        onClose={() => setEditorOpen(false)}
        onSave={handleSaveCommand}
      />
      <CommandOutputModal
        open={outputOpen()}
        command={outputCommand()}
        cwd={outputCwd()}
        onClose={() => setOutputOpen(false)}
      />
    </div>
  );
};
