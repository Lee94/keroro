import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
  type Accessor,
  type Component,
} from "solid-js";
import { rad } from "./themes";
import { useTheme } from "./ui/useTheme";
import { useT } from "./i18n";
import { AgentMascot } from "./panes/AgentMascot";
import { displayTabTitle } from "./sessionTitles";
import type { Tab } from "./panes/types";

export interface PaletteEntry {
  tab: Tab;
  leafId: string;
  workspaceId: string;
  workspaceName: string;
}

export const CommandPalette: Component<{
  open: boolean;
  onClose: () => void;
  entries: Accessor<PaletteEntry[]>;
  onPick: (entry: PaletteEntry) => void;
}> = (props) => {
  const theme = useTheme();
  const t = useT();
  const [query, setQuery] = createSignal("");
  const [index, setIndex] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  const filtered = createMemo<PaletteEntry[]>(() => {
    const q = query().trim().toLowerCase();
    const all = props.entries();
    if (!q) return all;
    return all.filter((e) => {
      const title = displayTabTitle(e.tab).toLowerCase();
      const ws = e.workspaceName.toLowerCase();
      return title.includes(q) || ws.includes(q);
    });
  });

  // Reset query + selection whenever the palette opens, then focus the input.
  createEffect(() => {
    if (!props.open) return;
    setQuery("");
    setIndex(0);
    queueMicrotask(() => inputRef?.focus());
  });

  // Keep the selected index inside the filtered list's bounds as it shrinks
  // (e.g. user types more characters and matches drop off).
  createEffect(() => {
    const max = filtered().length - 1;
    if (index() > max) setIndex(Math.max(0, max));
  });

  // Scroll the active row into view on selection change.
  createEffect(() => {
    const i = index();
    if (!listRef) return;
    const row = listRef.querySelector<HTMLElement>(`[data-palette-row="${i}"]`);
    row?.scrollIntoView({ block: "nearest" });
  });

  const move = (delta: number) => {
    const len = filtered().length;
    if (len === 0) return;
    setIndex((i) => (i + delta + len) % len);
  };

  const activate = (i: number) => {
    const e = filtered()[i];
    if (!e) return;
    props.onPick(e);
    props.onClose();
  };

  return (
    <Show when={props.open}>
      {/* Backdrop — click anywhere outside the panel dismisses. */}
      <div
        onClick={props.onClose}
        style={{ position: "fixed", inset: 0, "z-index": 299 }}
      />
      <div
        style={{
          position: "fixed",
          top: "80px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(560px, 90vw)",
          "max-height": "60vh",
          display: "flex",
          "flex-direction": "column",
          background: theme().chrome,
          border: `1px solid ${theme().borderStrong}`,
          "border-radius": rad(theme(), 12),
          "box-shadow": "0 24px 60px rgba(0,0,0,0.5)",
          "z-index": 300,
          overflow: "hidden",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={query()}
          placeholder={t("commandPalettePlaceholder")}
          spellcheck={false}
          onInput={(e) => {
            setQuery(e.currentTarget.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              move(1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              move(-1);
            } else if (e.key === "Enter") {
              e.preventDefault();
              activate(index());
            } else if (e.key === "Escape") {
              e.preventDefault();
              props.onClose();
            }
          }}
          style={{
            background: "transparent",
            color: theme().text,
            border: "none",
            "border-bottom": `1px solid ${theme().border}`,
            outline: "none",
            padding: "12px 16px",
            "font-size": "14px",
            "font-family": "var(--ui)",
            "letter-spacing": "-0.01em",
          }}
        />
        <div
          ref={listRef}
          style={{
            "overflow-y": "auto",
            "max-height": "calc(60vh - 49px)",
            padding: "4px",
          }}
        >
          <Show
            when={filtered().length > 0}
            fallback={
              <div
                style={{
                  padding: "20px 16px",
                  color: theme().textDim,
                  "font-size": "12px",
                  "text-align": "center",
                  "font-family": "var(--mono)",
                }}
              >
                {props.entries().length === 0
                  ? t("commandPaletteNoTabs")
                  : t("commandPaletteEmpty")}
              </div>
            }
          >
            <For each={filtered()}>
              {(entry, i) => {
                const selected = () => i() === index();
                return (
                  <div
                    data-palette-row={i()}
                    onMouseEnter={() => setIndex(i())}
                    onClick={() => activate(i())}
                    style={{
                      display: "flex",
                      "align-items": "center",
                      gap: "10px",
                      padding: "8px 12px",
                      "border-radius": rad(theme(), 6),
                      cursor: "pointer",
                      background: selected() ? theme().panelAlt : "transparent",
                    }}
                  >
                    <AgentMascot kind={entry.tab.kind} size={16} />
                    <span
                      style={{
                        flex: 1,
                        "min-width": 0,
                        color: theme().text,
                        "font-size": "13px",
                        "letter-spacing": "-0.01em",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                        "white-space": "nowrap",
                      }}
                    >
                      {displayTabTitle(entry.tab)}
                    </span>
                    <span
                      style={{
                        color: theme().textDim,
                        "font-size": "11px",
                        "font-family": "var(--mono)",
                        "flex-shrink": 0,
                        "margin-left": "8px",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                        "white-space": "nowrap",
                        "max-width": "45%",
                      }}
                    >
                      {entry.workspaceName}
                    </span>
                  </div>
                );
              }}
            </For>
          </Show>
        </div>
      </div>
    </Show>
  );
};
