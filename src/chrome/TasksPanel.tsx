import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  Show,
  type Accessor,
  type Component,
} from "solid-js";
import { rad } from "../themes";
import { useTheme } from "../ui/useTheme";
import { Icon } from "../ui/Icon";
import { useT } from "../i18n";
import { AGENT_LABEL, isPtyKind } from "../panes/types";
import type { PaletteEntry } from "../CommandPalette";
import {
  ptyForceKill,
  ptySessionStats,
  type SessionStat,
} from "../persistence";

const REFRESH_MS = 1000;

function formatMemory(bytes: number): string {
  if (bytes <= 0) return "—";
  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;
  if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatCpu(percent: number): string {
  if (!Number.isFinite(percent) || percent <= 0) return "0%";
  if (percent >= 100) return `${percent.toFixed(0)}%`;
  if (percent >= 10) return `${percent.toFixed(1)}%`;
  return `${percent.toFixed(2)}%`;
}

const KillButton: Component<{
  visible: boolean;
  pending: boolean;
  onKill: () => void;
}> = (props) => {
  const theme = useTheme();
  const t = useT();
  const [hover, setHover] = createSignal(false);
  return (
    <Show when={props.visible} fallback={<span />}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          props.onKill();
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        disabled={props.pending}
        title={t("tasksKillTooltip")}
        aria-label={t("tasksKill")}
        style={{
          width: "20px",
          height: "20px",
          padding: 0,
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          margin: "0 auto",
          background: hover() ? theme().red : "transparent",
          border: `1px solid ${hover() ? theme().red : theme().border}`,
          "border-radius": rad(theme(), 4),
          color: hover() ? "#fff" : theme().textDim,
          cursor: props.pending ? "default" : "pointer",
          opacity: props.pending ? 0.4 : 1,
          transition: "background 90ms, color 90ms, border-color 90ms",
        }}
      >
        <Icon name="close" size={10} />
      </button>
    </Show>
  );
};

export const TasksPanel: Component<{
  open: boolean;
  onClose: () => void;
  entries: Accessor<PaletteEntry[]>;
}> = (props) => {
  const theme = useTheme();
  const t = useT();
  const [stats, setStats] = createSignal<Map<string, SessionStat>>(new Map());
  const [closeHover, setCloseHover] = createSignal(false);
  // Set of session ids whose force-kill request is in flight. Suppresses the
  // kill button until the next refresh tick confirms the process is gone.
  const [pendingKill, setPendingKill] = createSignal<ReadonlySet<string>>(
    new Set(),
  );

  // Poll while open. The first poll always reports 0% CPU (sysinfo needs
  // two refreshes to diff CPU times), so subsequent ticks fill in.
  let refreshNow: () => void = () => {};
  createEffect(() => {
    if (!props.open) return;
    let alive = true;
    const refresh = () => {
      ptySessionStats()
        .then((rows) => {
          if (!alive) return;
          const next = new Map<string, SessionStat>();
          for (const r of rows) next.set(r.id, r);
          setStats(next);
        })
        .catch((err) => console.error("pty_session_stats failed", err));
    };
    refreshNow = refresh;
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    onCleanup(() => {
      alive = false;
      clearInterval(id);
      refreshNow = () => {};
    });
  });

  const killSession = (sessionId: string) => {
    if (pendingKill().has(sessionId)) return;
    setPendingKill((prev) => {
      const next = new Set(prev);
      next.add(sessionId);
      return next;
    });
    ptyForceKill(sessionId)
      .catch((err) => console.error("pty_force_kill failed", err))
      .finally(() => {
        refreshNow();
        setPendingKill((prev) => {
          if (!prev.has(sessionId)) return prev;
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
      });
  };

  // Esc dismiss. Capture-phase so we beat any focused input handlers.
  createEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        props.onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    onCleanup(() => window.removeEventListener("keydown", onKey, true));
  });

  const ptyEntries = (): PaletteEntry[] =>
    props.entries().filter((entry) => isPtyKind(entry.tab.kind));

  return (
    <Show when={props.open}>
      <div
        onClick={props.onClose}
        style={{ position: "fixed", inset: 0, "z-index": 199 }}
      />
      <div
        style={{
          position: "fixed",
          top: "60px",
          right: "32px",
          width: "380px",
          "max-height": "70vh",
          display: "flex",
          "flex-direction": "column",
          background: theme().chrome,
          border: `1px solid ${theme().borderStrong}`,
          "border-radius": rad(theme(), 12),
          "box-shadow": "0 24px 60px rgba(0,0,0,0.5)",
          "z-index": 200,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            "justify-content": "space-between",
            "align-items": "center",
            padding: "14px 14px 10px 14px",
          }}
        >
          <span
            style={{
              "font-size": "13px",
              "font-weight": 600,
              color: theme().text,
            }}
          >
            {t("tasksTitle")}
          </span>
          <button
            onClick={props.onClose}
            onMouseEnter={() => setCloseHover(true)}
            onMouseLeave={() => setCloseHover(false)}
            aria-label="close"
            style={{
              background: closeHover() ? theme().panelAlt : "transparent",
              border: "none",
              padding: "4px",
              "border-radius": rad(theme(), 4),
              cursor: "pointer",
              color: closeHover() ? theme().text : theme().textDim,
              display: "flex",
              "align-items": "center",
            }}
          >
            <Icon name="close" size={12} />
          </button>
        </div>

        <Show
          when={ptyEntries().length > 0}
          fallback={
            <div
              style={{
                padding: "20px 14px 24px 14px",
                color: theme().textMuted,
                "font-size": "12px",
                "text-align": "center",
              }}
            >
              {t("tasksEmpty")}
            </div>
          }
        >
          <div
            style={{
              display: "grid",
              "grid-template-columns": "1fr 56px 76px 28px",
              gap: "8px",
              padding: "0 14px 6px 14px",
              "font-size": "10px",
              color: theme().textDim,
              "font-family": "var(--mono)",
              "text-transform": "uppercase",
              "letter-spacing": "0.05em",
            }}
          >
            <span>{t("tasksColSession")}</span>
            <span style={{ "text-align": "right" }}>{t("tasksColCpu")}</span>
            <span style={{ "text-align": "right" }}>{t("tasksColMemory")}</span>
            <span />
          </div>
          <div
            style={{
              overflow: "auto",
              padding: "0 6px 10px 6px",
              "flex-shrink": 1,
              "min-height": 0,
            }}
          >
            <For each={ptyEntries()}>
              {(entry) => {
                const stat = (): SessionStat | undefined =>
                  stats().get(entry.tab.id);
                const cpu = () => stat()?.cpuPercent ?? 0;
                const mem = () => stat()?.memoryBytes ?? 0;
                const alive = () => stat()?.alive ?? false;
                return (
                  <div
                    style={{
                      display: "grid",
                      "grid-template-columns": "1fr 56px 76px 28px",
                      gap: "8px",
                      "align-items": "center",
                      padding: "8px",
                      "border-radius": rad(theme(), 6),
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        "flex-direction": "column",
                        gap: "2px",
                        "min-width": 0,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          "align-items": "center",
                          gap: "6px",
                          "min-width": 0,
                        }}
                      >
                        <span
                          style={{
                            "font-size": "10px",
                            padding: "1px 5px",
                            "border-radius": rad(theme(), 3),
                            background: theme().panelAlt,
                            color: theme().textDim,
                            "font-family": "var(--mono)",
                            "text-transform": "uppercase",
                            "letter-spacing": "0.04em",
                            "flex-shrink": 0,
                          }}
                        >
                          {AGENT_LABEL[entry.tab.kind]}
                        </span>
                        <span
                          style={{
                            "font-size": "12px",
                            color: alive() ? theme().text : theme().textMuted,
                            "white-space": "nowrap",
                            overflow: "hidden",
                            "text-overflow": "ellipsis",
                            "min-width": 0,
                          }}
                          title={entry.tab.title}
                        >
                          {entry.tab.title}
                        </span>
                      </div>
                      <span
                        style={{
                          "font-size": "11px",
                          color: theme().textMuted,
                          "white-space": "nowrap",
                          overflow: "hidden",
                          "text-overflow": "ellipsis",
                        }}
                        title={entry.workspaceName}
                      >
                        {entry.workspaceName}
                        <Show when={!alive() && stat()}>
                          {" · "}
                          {t("tasksExited")}
                        </Show>
                      </span>
                    </div>
                    <span
                      style={{
                        "text-align": "right",
                        "font-family": "var(--mono)",
                        "font-size": "12px",
                        color: alive() ? theme().text : theme().textMuted,
                        "font-variant-numeric": "tabular-nums",
                      }}
                    >
                      {alive() ? formatCpu(cpu()) : "—"}
                    </span>
                    <span
                      style={{
                        "text-align": "right",
                        "font-family": "var(--mono)",
                        "font-size": "12px",
                        color: alive() ? theme().text : theme().textMuted,
                        "font-variant-numeric": "tabular-nums",
                      }}
                    >
                      {alive() ? formatMemory(mem()) : "—"}
                    </span>
                    <KillButton
                      visible={alive()}
                      pending={pendingKill().has(entry.tab.id)}
                      onKill={() => killSession(entry.tab.id)}
                    />
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </div>
    </Show>
  );
};
