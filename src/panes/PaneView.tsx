import {
  createSignal,
  For,
  onCleanup,
  Show,
  type Component,
} from "solid-js";
import { rad } from "../themes";
import { useTheme } from "../ui/useTheme";
import { useT } from "../i18n";
import { TerminalMascot } from "../mascots";
import { terminalHost } from "../terminalHost";
import { AgentContent } from "../agents/AgentContent";
import { defaultTabTitle } from "../sessionTitles";
import { TabBar } from "./TabBar";
import { DropOverlay } from "./DropOverlay";
import { TerminalSearchBar } from "./TerminalSearchBar";
import type { DragInfo } from "./drag";
import { setSplitDragging } from "./splitDrag";
import { MIN_PANE_PX } from "./tree";
import {
  isPtyKind,
  newId,
  type AgentKind,
  type ChatAgentKind,
  type DropSide,
  type LeafPane,
  type PaneNode,
  type SplitPane,
  type Tab,
} from "./types";

const LeafPaneView: Component<{
  leaf: LeafPane;
  setLeaf: (patch: (leaf: LeafPane) => LeafPane) => void;
  onClose: (tabId: string) => void;
  onDrop: (targetLeafId: string, side: DropSide, info: DragInfo) => void;
}> = (props) => {
  const theme = useTheme();
  const t = useT();
  const active = (): Tab | undefined => {
    const l = props.leaf;
    return l.tabs.find((t) => t.id === l.activeTab) ?? l.tabs[0];
  };

  const handleAdd = (kind: AgentKind) => {
    const id = newId("tab");
    const newTab: Tab = {
      id,
      kind,
      title: defaultTabTitle(kind),
      cliSessionId: kind === "claude" ? crypto.randomUUID() : undefined,
    };
    props.setLeaf((leaf) => ({
      ...leaf,
      tabs: [...leaf.tabs, newTab],
      activeTab: id,
    }));
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
        onRename={(id, title) =>
          props.setLeaf((leaf) => ({
            ...leaf,
            tabs: leaf.tabs.map((t) =>
              t.id === id ? { ...t, title } : t,
            ),
          }))
        }
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
              <span>{t("newTerminalButton")}</span>
            </button>
            <div
              style={{
                "font-size": "11px",
                color: theme().textMuted,
                "font-family": "var(--mono)",
              }}
            >
              {t("dragTabHint")}
            </div>
          </div>
        </Show>
        <DropOverlay
          leafId={props.leaf.id}
          onDrop={(side, info) => props.onDrop(props.leaf.id, side, info)}
        />
        <Show when={active() && isPtyKind(active()!.kind)}>
          <TerminalSearchBar sessionId={active()!.id} />
        </Show>
      </div>
    </div>
  );
};

export const PaneTreeView: Component<{
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

const SplitView: Component<{
  split: SplitPane;
  setLeaf: (leafId: string, patch: (leaf: LeafPane) => LeafPane) => void;
  setSplit: (splitId: string, patch: (split: SplitPane) => SplitPane) => void;
  onCloseTab: (leafId: string, tabId: string) => void;
  onDrop: (targetLeafId: string, side: DropSide, info: DragInfo) => void;
}> = (props) => {
  const theme = useTheme();
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
    // Suppress xterm fit() + pty_resize for the duration of the drag — they
    // run inside the per-terminal ResizeObserver at mouse-move rate and are
    // the main source of split-drag lag. A drag-end effect on each pane
    // performs the single real refit when this flips back to false.
    setSplitDragging(true);
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
      setSplitDragging(false);
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
