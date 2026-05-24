import {
  createSignal,
  For,
  Show,
  useContext,
  type Component,
} from "solid-js";
import { rad } from "../themes";
import { useTheme } from "../ui/useTheme";
import { Icon } from "../ui/Icon";
import { useT } from "../i18n";
import { InstalledClisContext } from "../themeContext";
import { AgentMascot } from "./AgentMascot";
import { needsAttentionTabs } from "./attention";
import { TAB_DRAG_MIME, useDrag } from "./drag";
import { displayTabTitle } from "../sessionTitles";
import { CLI_REGISTRY, type AgentKind, type Tab } from "./types";

const TabItem: Component<{
  tab: Tab;
  leafId: string;
  active: boolean;
  onClick: () => void;
  onClose: (() => void) | null;
  onRename: (title: string) => void;
}> = (props) => {
  const theme = useTheme();
  const { setDrag } = useDrag();
  const [hover, setHover] = createSignal(false);
  const [closeHover, setCloseHover] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal("");
  let editRef: HTMLInputElement | undefined;

  const beginEdit = () => {
    // Seed the editor with what's actually visible (the auto-title for
    // chat-agent tabs), so committing without changes is a no-op instead
    // of stomping the auto-title onto the persisted `title`.
    setDraft(displayTabTitle(props.tab));
    setEditing(true);
    queueMicrotask(() => {
      editRef?.focus();
      editRef?.select();
    });
  };

  const commit = () => {
    if (!editing()) return;
    const next = draft().trim();
    setEditing(false);
    if (!next) return;
    if (next === displayTabTitle(props.tab)) return;
    props.onRename(next);
  };

  const cancel = () => {
    setEditing(false);
  };

  return (
    <div
      onClick={() => {
        if (editing()) return;
        props.onClick();
      }}
      onDblClick={(e) => {
        e.stopPropagation();
        if (!editing()) beginEdit();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      draggable={!editing()}
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
      <Show
        when={editing()}
        fallback={
          <span
            style={{
              "font-size": "12px",
              color: props.active ? theme().text : theme().textDim,
              "letter-spacing": "-0.01em",
              "white-space": "nowrap",
            }}
          >
            {displayTabTitle(props.tab)}
          </span>
        }
      >
        <input
          ref={editRef}
          type="text"
          value={draft()}
          spellcheck={false}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onDblClick={(e) => e.stopPropagation()}
          onInput={(e) => setDraft(e.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          style={{
            "font-size": "12px",
            color: theme().text,
            background: theme().panelDeep,
            border: `1px solid ${theme().borderStrong}`,
            "border-radius": rad(theme(), 4),
            padding: "1px 4px",
            outline: "none",
            "letter-spacing": "-0.01em",
            "font-family": "var(--ui)",
            width: `${Math.max(60, draft().length * 7 + 16)}px`,
            "max-width": "240px",
          }}
        />
      </Show>
      <Show when={needsAttentionTabs().has(props.tab.id)}>
        <span
          title="Waiting for input"
          style={{
            width: "6px",
            height: "6px",
            "border-radius": "50%",
            background: theme().amber,
            "flex-shrink": 0,
            "box-shadow": `0 0 6px ${theme().amber}80`,
          }}
        />
      </Show>
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
  const theme = useTheme();
  const t = useT();
  const installedClis = useContext(InstalledClisContext);
  const items = (): { kind: AgentKind; label: string }[] => [
    { kind: "terminal", label: t("addMenuTerminal") },
    ...CLI_REGISTRY.filter((c) => installedClis().has(c.kind)).map(
      ({ kind, label }) => ({ kind, label }),
    ),
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
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = theme().borderStrong)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
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

export const TabBar: Component<{
  leafId: string;
  tabs: Tab[];
  activeId: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: (kind: AgentKind) => void;
  onRename: (id: string, title: string) => void;
  addAnchorBelow?: boolean;
}> = (props) => {
  const theme = useTheme();
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [addHover, setAddHover] = createSignal(false);
  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        gap: "4px",
        padding: "4px 8px",
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
            onRename={(title) => props.onRename(t.id, title)}
          />
        )}
      </For>
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          onMouseEnter={() => setAddHover(true)}
          onMouseLeave={() => setAddHover(false)}
          style={{
            background: addHover() ? theme().borderStrong : "transparent",
            border: "none",
            cursor: "pointer",
            width: "26px",
            height: "26px",
            "border-radius": rad(theme(), 6),
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            color: addHover() ? theme().text : theme().textMuted,
            transition: "background 90ms, color 90ms",
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
