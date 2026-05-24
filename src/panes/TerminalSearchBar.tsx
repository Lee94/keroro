import {
  createEffect,
  Show,
  type Component,
  type JSX,
} from "solid-js";
import { rad } from "../themes";
import { useTheme } from "../ui/useTheme";
import { useT } from "../i18n";
import { Icon } from "../ui/Icon";
import {
  closeTerminalSearch,
  useTerminalSearch,
} from "../terminalSearch";

export const TerminalSearchBar: Component<{ sessionId: string }> = (props) => {
  const theme = useTheme();
  const t = useT();
  const entry = () => useTerminalSearch(props.sessionId);
  let inputRef!: HTMLInputElement;

  const runSearch = (direction: "next" | "prev"): void => {
    const e = entry();
    const ops = e.ops();
    const q = e.query();
    if (!ops) return;
    if (!q) {
      ops.clear();
      return;
    }
    if (direction === "next") ops.findNext(q);
    else ops.findPrev(q);
  };

  const close = (): void => {
    const e = entry();
    const ops = e.ops();
    closeTerminalSearch(props.sessionId);
    ops?.focusTerminal();
  };

  // Refocus + select-all on every open / re-trigger. Reading focusBump inside
  // a createEffect subscribes us to subsequent Ctrl/Cmd+F bumps while the bar
  // is already open.
  createEffect(() => {
    const e = entry();
    e.focusBump();
    if (!e.open()) return;
    queueMicrotask(() => {
      inputRef?.focus();
      inputRef?.select();
    });
  });

  const onKey: JSX.EventHandler<HTMLInputElement, KeyboardEvent> = (ev) => {
    if (ev.key === "Escape") {
      ev.preventDefault();
      ev.stopPropagation();
      close();
      return;
    }
    if (ev.key === "Enter") {
      ev.preventDefault();
      ev.stopPropagation();
      runSearch(ev.shiftKey ? "prev" : "next");
    }
  };

  const onInput: JSX.EventHandler<HTMLInputElement, InputEvent> = (ev) => {
    const value = ev.currentTarget.value;
    const e = entry();
    e.setQuery(value);
    const ops = e.ops();
    if (!ops) return;
    if (!value) {
      ops.clear();
      return;
    }
    ops.findNext(value);
  };

  const countLabel = (): string => {
    const r = entry().results();
    if (!r) return "";
    if (r.count === 0) return t("searchNoMatches");
    return `${r.index}/${r.count}`;
  };

  const countColor = (): string => {
    const r = entry().results();
    if (!r || r.count === 0) return theme().textMuted;
    return theme().textDim;
  };

  return (
    <Show when={entry().open()}>
      <div
        style={{
          position: "absolute",
          top: "8px",
          right: "10px",
          "z-index": 20,
          display: "flex",
          "align-items": "center",
          gap: "6px",
          padding: "4px 6px",
          background: theme().panelAlt,
          border: `1px solid ${theme().borderStrong}`,
          "border-radius": rad(theme(), 8),
          "box-shadow": "0 4px 12px rgba(0,0,0,0.25)",
          "font-family": "var(--ui)",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={entry().query()}
          placeholder={t("searchPlaceholder")}
          spellcheck={false}
          onInput={onInput}
          onKeyDown={onKey}
          style={{
            width: "180px",
            padding: "4px 6px",
            background: theme().panel,
            border: `1px solid ${theme().border}`,
            "border-radius": rad(theme(), 6),
            color: theme().text,
            outline: "none",
            "font-size": "12px",
            "font-family": "var(--mono)",
          }}
        />
        <span
          style={{
            "min-width": "44px",
            "text-align": "center",
            "font-size": "11px",
            "font-family": "var(--mono)",
            color: countColor(),
            "user-select": "none",
          }}
        >
          {countLabel()}
        </span>
        <SearchButton title={t("searchPrev")} onClick={() => runSearch("prev")}>
          <span style={{ display: "inline-block", transform: "rotate(-90deg)" }}>
            <Icon name="caret" size={12} />
          </span>
        </SearchButton>
        <SearchButton title={t("searchNext")} onClick={() => runSearch("next")}>
          <span style={{ display: "inline-block", transform: "rotate(90deg)" }}>
            <Icon name="caret" size={12} />
          </span>
        </SearchButton>
        <SearchButton title={t("searchClose")} onClick={close}>
          <Icon name="close" size={12} />
        </SearchButton>
      </div>
    </Show>
  );
};

const SearchButton: Component<{
  title: string;
  onClick: () => void;
  children: JSX.Element;
}> = (props) => {
  const theme = useTheme();
  return (
    <button
      type="button"
      title={props.title}
      onClick={props.onClick}
      onMouseDown={(e) => e.preventDefault()}
      style={{
        display: "inline-flex",
        "align-items": "center",
        "justify-content": "center",
        width: "22px",
        height: "22px",
        background: "transparent",
        border: `1px solid transparent`,
        "border-radius": rad(theme(), 6),
        color: theme().textDim,
        cursor: "pointer",
        padding: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = theme().panel;
        e.currentTarget.style.borderColor = theme().border;
        e.currentTarget.style.color = theme().text;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.borderColor = "transparent";
        e.currentTarget.style.color = theme().textDim;
      }}
    >
      {props.children}
    </button>
  );
};
