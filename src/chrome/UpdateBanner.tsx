import { Show, type Component } from "solid-js";
import { rad } from "../themes";
import { useTheme } from "../ui/useTheme";
import { useT } from "../i18n";
import { Icon } from "../ui/Icon";
import {
  dismissUpdateBanner,
  installPendingUpdate,
  pendingUpdate,
  updateBannerDismissed,
  updateProgress,
  updateStatus,
} from "../update";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const UpdateBanner: Component = () => {
  const theme = useTheme();
  const t = useT();

  const visible = (): boolean => {
    if (updateBannerDismissed()) return false;
    const s = updateStatus();
    return (
      (s === "available" || s === "downloading" || s === "ready") &&
      !!pendingUpdate()
    );
  };

  const progressLabel = (): string => {
    const p = updateProgress();
    if (p.total) {
      return `${formatBytes(p.done)} / ${formatBytes(p.total)}`;
    }
    return formatBytes(p.done);
  };

  const progressRatio = (): number => {
    const p = updateProgress();
    if (!p.total || p.total <= 0) return 0;
    return Math.min(1, p.done / p.total);
  };

  return (
    <Show when={visible()}>
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "10px",
          padding: "6px 12px",
          background: theme().panelAlt,
          "border-bottom": `1px solid ${theme().border}`,
          "flex-shrink": 0,
          "font-family": "var(--ui)",
          "font-size": "12px",
          color: theme().text,
          "letter-spacing": "-0.01em",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: "6px",
            height: "6px",
            "border-radius": "50%",
            background: theme().accent,
            "box-shadow": `0 0 6px ${theme().accent}80`,
            "flex-shrink": 0,
          }}
        />
        <Show
          when={updateStatus() === "available"}
          fallback={
            <Show
              when={updateStatus() === "ready"}
              fallback={
                <span style={{ color: theme().textDim }}>
                  {t("updateDownloading")} {progressLabel()}
                  <Show when={updateProgress().total}>
                    {" · "}
                    {Math.round(progressRatio() * 100)}%
                  </Show>
                </span>
              }
            >
              <span style={{ color: theme().textDim }}>
                {t("updateReady")}
              </span>
            </Show>
          }
        >
          <span>
            {t("updateAvailableLabel")}
            <span style={{ color: theme().textDim }}>
              {" "}
              v{pendingUpdate()?.currentVersion} →{" "}
            </span>
            <span style={{ color: theme().accent, "font-weight": 600 }}>
              v{pendingUpdate()?.version}
            </span>
          </span>
        </Show>
        <div style={{ flex: 1 }} />
        <Show when={updateStatus() === "available"}>
          <button
            onClick={() => void installPendingUpdate()}
            style={buttonStyle("primary")}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            {t("updateInstall")}
          </button>
          <button
            onClick={dismissUpdateBanner}
            title={t("updateLater")}
            style={iconButtonStyle()}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = theme().panel)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <Icon name="close" size={11} />
          </button>
        </Show>
      </div>
    </Show>
  );
};

function buttonStyle(_kind: "primary"): Record<string, string> {
  const theme = useTheme();
  return {
    background: theme().accent,
    color: theme().bg,
    border: "none",
    "border-radius": rad(theme(), 6),
    padding: "4px 10px",
    "font-size": "12px",
    "font-family": "var(--ui)",
    "letter-spacing": "-0.01em",
    "font-weight": "600",
    cursor: "pointer",
    transition: "opacity 120ms",
  };
}

function iconButtonStyle(): Record<string, string> {
  const theme = useTheme();
  return {
    background: "transparent",
    color: theme().textMuted,
    border: "none",
    "border-radius": rad(theme(), 6),
    padding: "0",
    width: "22px",
    height: "22px",
    display: "inline-flex",
    "align-items": "center",
    "justify-content": "center",
    cursor: "pointer",
    transition: "background 120ms",
  };
}
