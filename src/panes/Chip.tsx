import { For, type Component } from "solid-js";
import { rad } from "../themes";
import { useTheme } from "../ui/useTheme";
import { Icon, type IconName } from "../ui/Icon";

export interface ChipDef {
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
      <Icon
        name={props.icon}
        size={11}
        color={props.color || theme().textMuted}
      />
      <span>{props.label}</span>
    </div>
  );
};

export const PaneFooter: Component<{ chips: ChipDef[] }> = (props) => {
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
