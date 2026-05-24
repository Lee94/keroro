import { createSignal, Show, type Component } from "solid-js";
import { rad } from "../themes";
import { useTheme } from "./useTheme";

export const ConfirmDialog: Component<{
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = (props) => {
  const theme = useTheme();
  const [confirmHover, setConfirmHover] = createSignal(false);
  const [cancelHover, setCancelHover] = createSignal(false);

  const confirmBg = () => {
    if (props.danger) return confirmHover() ? theme().red : theme().panel;
    return confirmHover() ? theme().text : theme().accent;
  };
  const confirmFg = () => {
    if (props.danger) return confirmHover() ? theme().bg : theme().red;
    return theme().bg;
  };
  const confirmBorder = () =>
    props.danger ? theme().red : theme().accent;

  return (
    <Show when={props.open}>
      <div
        onClick={props.onCancel}
        style={{
          position: "fixed",
          inset: 0,
          "z-index": 299,
          background: "rgba(0,0,0,0.32)",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "420px",
          "max-width": "92vw",
          background: theme().chrome,
          border: `1px solid ${theme().borderStrong}`,
          "border-radius": rad(theme(), 12),
          "box-shadow": "0 24px 60px rgba(0,0,0,0.5)",
          "z-index": 300,
          display: "flex",
          "flex-direction": "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px 12px",
            display: "flex",
            "flex-direction": "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              "font-size": "13px",
              "font-weight": 600,
              color: theme().text,
              "letter-spacing": "-0.01em",
            }}
          >
            {props.title}
          </div>
          <Show when={props.body}>
            <div
              style={{
                "font-size": "12px",
                color: theme().textDim,
                "line-height": 1.5,
                "white-space": "pre-wrap",
                "word-break": "break-word",
              }}
            >
              {props.body}
            </div>
          </Show>
        </div>
        <div
          style={{
            padding: "10px 16px 14px",
            display: "flex",
            "justify-content": "flex-end",
            gap: "8px",
          }}
        >
          <button
            onClick={props.onCancel}
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
              transition: "background 90ms, color 90ms",
            }}
          >
            {props.cancelLabel}
          </button>
          <button
            onClick={props.onConfirm}
            onMouseEnter={() => setConfirmHover(true)}
            onMouseLeave={() => setConfirmHover(false)}
            style={{
              padding: "7px 14px",
              "font-size": "12px",
              "font-family": "var(--ui)",
              color: confirmFg(),
              background: confirmBg(),
              border: `1px solid ${confirmBorder()}`,
              "border-radius": rad(theme(), 6),
              cursor: "pointer",
              transition: "background 90ms, color 90ms",
            }}
          >
            {props.confirmLabel}
          </button>
        </div>
      </div>
    </Show>
  );
};
