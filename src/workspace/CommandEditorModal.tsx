import { createSignal, Show, type Component, type JSX } from "solid-js";
import { rad } from "../themes";
import { useTheme } from "../ui/useTheme";
import { useT } from "../i18n";
import { Icon } from "../ui/Icon";
import type { ProjectCommandRow } from "../persistence";

export interface CommandDraft {
  id?: string;
  title: string;
  command: string;
}

export const CommandEditorModal: Component<{
  open: boolean;
  initial?: ProjectCommandRow | null;
  onClose: () => void;
  onSave: (draft: CommandDraft) => void;
}> = (props) => {
  const theme = useTheme();
  const t = useT();
  const [title, setTitle] = createSignal("");
  const [command, setCommand] = createSignal("");
  const [closeHover, setCloseHover] = createSignal(false);
  const [saveHover, setSaveHover] = createSignal(false);
  const [cancelHover, setCancelHover] = createSignal(false);

  // Reset draft state whenever the modal opens, seeded from `initial` if
  // editing. We can't rely on Solid prop reactivity to drive this because the
  // textarea owns its own state.
  let lastOpen = false;
  const syncDraft = () => {
    if (props.open && !lastOpen) {
      setTitle(props.initial?.title ?? "");
      setCommand(props.initial?.command ?? "");
    }
    lastOpen = props.open;
  };

  const canSave = () => command().trim().length > 0;

  const handleSave = () => {
    if (!canSave()) return;
    props.onSave({
      id: props.initial?.id,
      title: title().trim(),
      command: command().trim(),
    });
  };

  return (
    <Show when={(syncDraft(), props.open)}>
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
          width: "480px",
          "max-width": "92vw",
          background: theme().chrome,
          border: `1px solid ${theme().borderStrong}`,
          "border-radius": rad(theme(), 12),
          padding: "18px 20px 20px",
          "box-shadow": "0 24px 60px rgba(0,0,0,0.5)",
          "z-index": 200,
          display: "flex",
          "flex-direction": "column",
          gap: "14px",
        }}
      >
        <div
          style={{
            display: "flex",
            "justify-content": "space-between",
            "align-items": "center",
          }}
        >
          <span style={{ "font-size": "13px", "font-weight": 600, color: theme().text }}>
            {props.initial ? t("commandEditorEdit") : t("commandEditorNew")}
          </span>
          <button
            onClick={props.onClose}
            onMouseEnter={() => setCloseHover(true)}
            onMouseLeave={() => setCloseHover(false)}
            aria-label={t("commandEditorCancel")}
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

        <Field label={t("commandEditorTitleLabel")}>
          <input
            type="text"
            value={title()}
            placeholder={t("commandEditorTitlePlaceholder")}
            spellcheck={false}
            onInput={(e) => setTitle(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") props.onClose();
            }}
            style={{
              width: "100%",
              "box-sizing": "border-box",
              padding: "8px 10px",
              "font-size": "13px",
              "font-family": "var(--ui)",
              color: theme().text,
              background: theme().panelDeep,
              border: `1px solid ${theme().borderStrong}`,
              "border-radius": rad(theme(), 6),
              outline: "none",
            }}
          />
        </Field>

        <Field label={t("commandEditorShellLabel")}>
          <textarea
            value={command()}
            placeholder={t("commandEditorShellPlaceholder")}
            spellcheck={false}
            rows={4}
            onInput={(e) => setCommand(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                props.onClose();
                return;
              }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSave();
              }
            }}
            style={{
              width: "100%",
              "box-sizing": "border-box",
              padding: "8px 10px",
              "font-size": "12.5px",
              "font-family": "var(--mono)",
              color: theme().text,
              background: theme().panelDeep,
              border: `1px solid ${theme().borderStrong}`,
              "border-radius": rad(theme(), 6),
              outline: "none",
              resize: "vertical",
              "min-height": "84px",
            }}
          />
        </Field>

        <div
          style={{
            display: "flex",
            "justify-content": "flex-end",
            gap: "8px",
            "margin-top": "2px",
          }}
        >
          <button
            onClick={props.onClose}
            onMouseEnter={() => setCancelHover(true)}
            onMouseLeave={() => setCancelHover(false)}
            style={{
              padding: "7px 14px",
              "font-size": "12px",
              "font-family": "var(--ui)",
              color: theme().text,
              background: cancelHover() ? theme().panel : "transparent",
              border: `1px solid ${theme().border}`,
              "border-radius": rad(theme(), 6),
              cursor: "pointer",
              transition: "background 90ms",
            }}
          >
            {t("commandEditorCancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave()}
            onMouseEnter={() => setSaveHover(true)}
            onMouseLeave={() => setSaveHover(false)}
            style={{
              padding: "7px 14px",
              "font-size": "12px",
              "font-family": "var(--ui)",
              color: canSave() ? theme().bg : theme().textMuted,
              background: canSave()
                ? saveHover()
                  ? theme().text
                  : theme().accent
                : theme().panel,
              border: `1px solid ${canSave() ? theme().accent : theme().border}`,
              "border-radius": rad(theme(), 6),
              cursor: canSave() ? "pointer" : "not-allowed",
              transition: "background 90ms",
            }}
          >
            {t("commandEditorSave")}
          </button>
        </div>
      </div>
    </Show>
  );
};

const Field: Component<{ label: string; children: JSX.Element }> = (props) => {
  const theme = useTheme();
  return (
    <label style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
      <span
        style={{
          "font-size": "11px",
          color: theme().textMuted,
          "letter-spacing": "0.02em",
          "text-transform": "uppercase",
        }}
      >
        {props.label}
      </span>
      {props.children}
    </label>
  );
};
