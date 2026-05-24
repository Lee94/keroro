import {
  createSignal,
  For,
  Match,
  Show,
  Switch,
  type Component,
} from "solid-js";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { rad } from "../themes";
import { useTheme } from "../ui/useTheme";
import { Icon } from "../ui/Icon";
import { useT } from "../i18n";
import { isMac, isWindows, TitlebarHeight } from "../platform";

const TrafficLights: Component = () => {
  const actions = [
    { color: "#ff5f57", action: () => getCurrentWindow().close() },
    { color: "#febc2e", action: () => getCurrentWindow().minimize() },
    { color: "#28c840", action: () => getCurrentWindow().toggleMaximize() },
  ];
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        "align-items": "center",
        padding: "0 4px",
      }}
    >
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
  const theme = useTheme();
  const [hover, setHover] = createSignal(false);
  const isClose = props.kind === "close";
  const hoverBg = () => (isClose ? "#c42b1c" : "rgba(255,255,255,0.06)");
  const activeBg = () => (isClose ? "#a52419" : "rgba(255,255,255,0.04)");
  const fg = () => (hover() && isClose ? "#ffffff" : theme().textDim);

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

export const Titlebar: Component<{
  onToggleSettings: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onAddProject: () => void;
  onToggleTasks: () => void;
  tasksOpen: boolean;
}> = (props) => {
  const theme = useTheme();
  const t = useT();
  const [sidebarHover, setSidebarHover] = createSignal(false);
  const [addProjectHover, setAddProjectHover] = createSignal(false);
  const [tweaksHover, setTweaksHover] = createSignal(false);
  const [tasksHover, setTasksHover] = createSignal(false);
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
        onMouseEnter={() => setSidebarHover(true)}
        onMouseLeave={() => setSidebarHover(false)}
        title={props.sidebarOpen ? t("hideSidebar") : t("showSidebar")}
        aria-pressed={!props.sidebarOpen}
        style={{
          background: sidebarHover()
            ? theme().borderStrong
            : props.sidebarOpen
              ? "transparent"
              : theme().panelAlt,
          border: "none",
          padding: "4px",
          color:
            props.sidebarOpen && !sidebarHover() ? theme().textDim : theme().text,
          cursor: "pointer",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          "border-radius": rad(theme(), 4),
          transition: "background 90ms, color 90ms",
        }}
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
        onMouseEnter={() => setAddProjectHover(true)}
        onMouseLeave={() => setAddProjectHover(false)}
        title={t("newProjectTooltip")}
        style={{
          background: addProjectHover() ? theme().borderStrong : "transparent",
          border: "none",
          padding: "4px 8px",
          color: addProjectHover() ? theme().text : theme().textDim,
          cursor: "pointer",
          display: "flex",
          "align-items": "center",
          gap: "6px",
          "border-radius": rad(theme(), 6),
          "font-size": "11px",
          "font-family": "var(--mono)",
          transition: "background 90ms, color 90ms",
        }}
      >
        <Icon name="plus" size={11} />
        <span>{t("newProjectLabel")}</span>
      </button>
      <div style={{ flex: 1 }} />
      <button
        onClick={props.onToggleTasks}
        onMouseEnter={() => setTasksHover(true)}
        onMouseLeave={() => setTasksHover(false)}
        title={t("tasksTooltip")}
        aria-pressed={props.tasksOpen}
        style={{
          background:
            tasksHover() || props.tasksOpen
              ? theme().borderStrong
              : "transparent",
          border: `1px solid ${theme().border}`,
          padding: "4px 8px",
          color:
            tasksHover() || props.tasksOpen ? theme().text : theme().textDim,
          cursor: "pointer",
          display: "flex",
          "align-items": "center",
          gap: "6px",
          "border-radius": rad(theme(), 6),
          "font-size": "11px",
          "font-family": "var(--mono)",
          transition: "background 90ms, color 90ms",
        }}
      >
        <Icon name="activity" size={12} />
        <span>{t("tasksLabel")}</span>
      </button>
      <button
        onClick={props.onToggleSettings}
        onMouseEnter={() => setTweaksHover(true)}
        onMouseLeave={() => setTweaksHover(false)}
        style={{
          background: tweaksHover() ? theme().borderStrong : "transparent",
          border: `1px solid ${theme().border}`,
          padding: "4px 8px",
          color: tweaksHover() ? theme().text : theme().textDim,
          cursor: "pointer",
          display: "flex",
          "align-items": "center",
          gap: "6px",
          "border-radius": rad(theme(), 6),
          "font-size": "11px",
          "font-family": "var(--mono)",
          "margin-right": isWindows ? "6px" : 0,
          transition: "background 90ms, color 90ms",
        }}
      >
        <Icon name="settings" size={12} />
        <span>{t("tweaksLabel")}</span>
      </button>
      <Show when={isWindows}>
        <WindowsControls />
      </Show>
    </div>
  );
};
