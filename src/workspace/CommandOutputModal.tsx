import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  Show,
  type Component,
} from "solid-js";
import { rad } from "../themes";
import { useTheme } from "../ui/useTheme";
import { useT } from "../i18n";
import { Icon } from "../ui/Icon";
import {
  getCommandSnapshot,
  killProjectCommand,
  runProjectCommand,
  commandRunInfo,
} from "./commandRuns";
import type { CommandSnapshot, ProjectCommandRow } from "../persistence";
import { statusColor, statusLabelKey } from "./commandStatus";

export const CommandOutputModal: Component<{
  open: boolean;
  command: ProjectCommandRow | null;
  cwd: string;
  onClose: () => void;
}> = (props) => {
  const theme = useTheme();
  const t = useT();
  const [snapshot, setSnapshot] = createSignal<CommandSnapshot | null>(null);
  const [closeHover, setCloseHover] = createSignal(false);
  const liveInfo = createMemo(() =>
    props.command ? commandRunInfo(props.command.id) : null,
  );

  let outputRef: HTMLPreElement | undefined;

  const refresh = async () => {
    const cmd = props.command;
    if (!cmd) return;
    try {
      const snap = await getCommandSnapshot(cmd.id);
      setSnapshot(snap);
      // Auto-scroll to bottom when new output arrives — matches the
      // expectation that the latest line is the interesting one.
      queueMicrotask(() => {
        if (outputRef) outputRef.scrollTop = outputRef.scrollHeight;
      });
    } catch (err) {
      console.error("fetch command output failed", err);
    }
  };

  // Fetch on open + whenever the live state flips (running→done, etc.).
  // The status signal mutates on every Tauri event from exec.rs, which lets
  // us pull fresh output without a polling interval.
  createEffect(() => {
    if (!props.open || !props.command) return;
    void refresh();
    const info = liveInfo();
    if (!info) return;
    // Touch fields so this effect re-runs on each event.
    void info.state;
    void info.finishedAt;
  });

  // While the command is running, also poll output every second — the
  // backend currently only emits status on terminal transitions, so without
  // a poll the viewer would show nothing until exit.
  createEffect(() => {
    if (!props.open || !props.command) return;
    const info = liveInfo();
    if (!info || info.state !== "running") return;
    const id = setInterval(() => void refresh(), 1000);
    onCleanup(() => clearInterval(id));
  });

  const state = () => snapshot()?.state ?? liveInfo()?.state ?? "idle";
  const elapsedText = () => {
    const snap = snapshot();
    const info = liveInfo();
    const started = snap?.startedAt ?? info?.startedAt ?? null;
    const finished = snap?.finishedAt ?? info?.finishedAt ?? null;
    if (!started) return "";
    const end = finished ?? Math.floor(Date.now() / 1000);
    const secs = Math.max(0, end - started);
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m${s.toString().padStart(2, "0")}s`;
  };

  const exitText = () => {
    const snap = snapshot();
    const info = liveInfo();
    const code = snap?.exitCode ?? info?.exitCode ?? null;
    if (code === null || code === undefined) return null;
    return `${t("commandExitCodePrefix")} ${code}`;
  };

  const handleRun = () => {
    const cmd = props.command;
    if (!cmd) return;
    void runProjectCommand(cmd, props.cwd);
  };

  const handleStop = () => {
    const cmd = props.command;
    if (!cmd) return;
    void killProjectCommand(cmd.id);
  };

  return (
    <Show when={props.open && props.command}>
      <div
        onClick={props.onClose}
        style={{ position: "fixed", inset: 0, "z-index": 199, background: "rgba(0,0,0,0.32)" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "720px",
          "max-width": "94vw",
          "max-height": "78vh",
          background: theme().chrome,
          border: `1px solid ${theme().borderStrong}`,
          "border-radius": rad(theme(), 12),
          "box-shadow": "0 24px 60px rgba(0,0,0,0.5)",
          "z-index": 200,
          display: "flex",
          "flex-direction": "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 18px 10px",
            "border-bottom": `1px solid ${theme().border}`,
            display: "flex",
            "flex-direction": "column",
            gap: "6px",
          }}
        >
          <div
            style={{
              display: "flex",
              "justify-content": "space-between",
              "align-items": "center",
              gap: "12px",
            }}
          >
            <span
              style={{
                "font-size": "13px",
                "font-weight": 600,
                color: theme().text,
                "letter-spacing": "-0.01em",
              }}
            >
              {props.command?.title || props.command?.command || t("commandOutputTitle")}
            </span>
            <button
              onClick={props.onClose}
              onMouseEnter={() => setCloseHover(true)}
              onMouseLeave={() => setCloseHover(false)}
              aria-label="Close"
              style={{
                background: closeHover() ? theme().borderStrong : "transparent",
                border: "none",
                cursor: "pointer",
                color: closeHover() ? theme().text : theme().textDim,
                padding: "4px",
                display: "flex",
                "align-items": "center",
                "border-radius": rad(theme(), 4),
                transition: "background 90ms, color 90ms",
              }}
            >
              <Icon name="close" size={11} />
            </button>
          </div>
          <div
            style={{
              "font-size": "11.5px",
              "font-family": "var(--mono)",
              color: theme().textDim,
              overflow: "hidden",
              "text-overflow": "ellipsis",
              "white-space": "nowrap",
            }}
          >
            {props.command?.command}
          </div>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "10px",
              "font-size": "11.5px",
              color: theme().textMuted,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                "align-items": "center",
                gap: "6px",
                color: statusColor(state(), theme()),
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  "border-radius": "50%",
                  background: statusColor(state(), theme()),
                  "box-shadow":
                    state() === "running"
                      ? `0 0 6px ${statusColor(state(), theme())}80`
                      : "none",
                }}
              />
              {t(statusLabelKey(state()))}
            </span>
            <Show when={exitText()}>
              <span style={{ "font-family": "var(--mono)" }}>{exitText()}</span>
            </Show>
            <Show when={elapsedText()}>
              <span style={{ "font-family": "var(--mono)" }}>{elapsedText()}</span>
            </Show>
            <span
              style={{
                "margin-left": "auto",
                "font-family": "var(--mono)",
                overflow: "hidden",
                "text-overflow": "ellipsis",
                "white-space": "nowrap",
                "max-width": "60%",
              }}
              title={props.cwd}
            >
              {props.cwd}
            </span>
          </div>
        </div>

        <pre
          ref={outputRef}
          style={{
            flex: 1,
            margin: 0,
            padding: "12px 18px",
            "font-size": "12px",
            "font-family": "var(--mono)",
            color: theme().text,
            background: theme().panelDeep,
            overflow: "auto",
            "white-space": "pre-wrap",
            "word-break": "break-word",
            "min-height": "240px",
          }}
        >
          {snapshot()?.output || t("commandNoOutput")}
        </pre>

        <div
          style={{
            padding: "12px 18px",
            "border-top": `1px solid ${theme().border}`,
            display: "flex",
            "justify-content": "flex-end",
            gap: "8px",
          }}
        >
          <Show
            when={state() === "running"}
            fallback={
              <FooterButton
                label={
                  state() === "idle" ? t("commandRun") : t("commandRerun")
                }
                primary
                onClick={handleRun}
              />
            }
          >
            <FooterButton label={t("commandStop")} danger onClick={handleStop} />
          </Show>
          <FooterButton label="Close" onClick={props.onClose} />
        </div>
      </div>
    </Show>
  );
};

const FooterButton: Component<{
  label: string;
  primary?: boolean;
  danger?: boolean;
  onClick: () => void;
}> = (props) => {
  const theme = useTheme();
  const [hover, setHover] = createSignal(false);
  const bg = () => {
    if (props.danger) return hover() ? theme().red : theme().panel;
    if (props.primary) return hover() ? theme().text : theme().accent;
    return hover() ? theme().panel : "transparent";
  };
  const fg = () => {
    if (props.danger) return hover() ? theme().bg : theme().red;
    if (props.primary) return theme().bg;
    return theme().text;
  };
  const borderColor = () => {
    if (props.danger) return theme().red;
    if (props.primary) return theme().accent;
    return theme().border;
  };
  return (
    <button
      onClick={props.onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "7px 14px",
        "font-size": "12px",
        "font-family": "var(--ui)",
        color: fg(),
        background: bg(),
        border: `1px solid ${borderColor()}`,
        "border-radius": rad(theme(), 6),
        cursor: "pointer",
        transition: "background 90ms, color 90ms",
      }}
    >
      {props.label}
    </button>
  );
};
