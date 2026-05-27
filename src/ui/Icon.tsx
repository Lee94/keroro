import { Match, Switch, type Component } from "solid-js";

export type IconName =
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
  | "settings"
  | "activity"
  | "editor";

export const Icon: Component<{
  name: IconName;
  size?: number;
  color?: string;
}> = (props) => {
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
      <Match when={props.name === "activity"}>
        <svg style={s()} viewBox="0 0 14 14" fill="none" stroke={color()} stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 7h2.5l1.5-4 3 8 1.5-4H13" />
        </svg>
      </Match>
      <Match when={props.name === "editor"}>
        <svg style={s()} viewBox="0 0 14 14" fill="none" stroke={color()} stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6.5 2.5H2.5v9h9v-4" />
          <path d="M8.5 2.5h3v3" />
          <path d="M11.5 2.5L6.5 7.5" />
        </svg>
      </Match>
    </Switch>
  );
};
