import { createSignal, For, Show, type Component } from "solid-js";
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
import type { Density, Workspace } from "./types";

const WorkspaceItem: Component<{
  ws: Workspace;
  active: boolean;
  hasAttention: boolean;
  onClick: () => void;
  onDelete: () => void;
}> = (props) => {
  const theme = useTheme;
  const t = useT();
  const [hover, setHover] = createSignal(false);
  const [deleteHover, setDeleteHover] = createSignal(false);
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
      {/* Attention dot + delete button share the right-side slot. The dot
        * shows by default; on hover the delete button fades in over it so the
        * row only ever exposes the most relevant affordance. */}
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

export const Sidebar: Component<{
  workspaces: Workspace[];
  active: string;
  setActive: (id: string) => void;
  onDelete: (id: string) => void;
  density: Density;
  open: boolean;
  attentionWorkspaces: ReadonlySet<string>;
}> = (props) => {
  const theme = useTheme;
  const t = useT();
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
              {(ws) => (
                <WorkspaceItem
                  ws={ws}
                  active={props.active === ws.id}
                  hasAttention={props.attentionWorkspaces.has(ws.id)}
                  onClick={() => props.setActive(ws.id)}
                  onDelete={() => props.onDelete(ws.id)}
                />
              )}
            </For>
          </Show>
        </div>
      </div>
    </div>
  );
};
