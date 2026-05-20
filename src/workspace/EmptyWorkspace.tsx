import { Show, type Component } from "solid-js";
import { rad } from "../themes";
import { useTheme } from "../ui/useTheme";
import { Icon } from "../ui/Icon";
import { FayeMascot } from "../mascots";

export const EmptyWorkspace: Component<{
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
        {props.hasWorkspaces
          ? "Pick a folder from the sidebar"
          : "No folder open"}
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
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = theme().panelAlt)
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          <Icon name="plus" size={11} />
          <span>Open folder</span>
        </button>
      </Show>
    </div>
  );
};
