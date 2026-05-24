import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  Show,
  type Component,
} from "solid-js";
import { rad, THEMES, type Theme, type ThemeName } from "../themes";
import { useTheme } from "../ui/useTheme";
import { Icon } from "../ui/Icon";
import {
  TERMINAL_FONT_FAMILIES,
  TERMINAL_FONT_SIZE_MAX,
  TERMINAL_FONT_SIZE_MIN,
  findTerminalFontFamily,
} from "../themeContext";
import { LOCALES, useT, type Locale } from "../i18n";
import type { Density } from "../workspace/types";
import {
  checkForUpdates,
  pendingUpdate,
  updateError,
  updateStatus,
} from "../update";

const RadioRow: Component<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}> = (props) => {
  const theme = useTheme();
  // Track hover per-option so we can give an explicit hover treatment.
  // Without this, selected vs unselected in light themes only differed
  // by a near-invisible border step.
  const [hovered, setHovered] = createSignal<string | null>(null);
  return (
    <div style={{ "margin-bottom": "12px" }}>
      <div
        style={{
          "font-size": "11px",
          color: theme().textDim,
          "margin-bottom": "6px",
          "font-family": "var(--mono)",
          "text-transform": "uppercase",
          "letter-spacing": "0.05em",
        }}
      >
        {props.label}
      </div>
      <div style={{ display: "flex", gap: "4px" }}>
        <For each={props.options}>
          {(opt) => {
            const selected = () => props.value === opt.value;
            const isHover = () => hovered() === opt.value && !selected();
            return (
              <button
                onClick={() => props.onChange(opt.value)}
                onMouseEnter={() => setHovered(opt.value)}
                onMouseLeave={() =>
                  setHovered((v) => (v === opt.value ? null : v))
                }
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  "border-radius": rad(theme(), 6),
                  "font-size": "12px",
                  cursor: "pointer",
                  background: selected()
                    ? theme().panel
                    : isHover()
                    ? theme().panelAlt
                    : "transparent",
                  // Selected uses the accent color — guaranteed to read
                  // across both light and dark themes regardless of how
                  // close `border` and `borderStrong` happen to be.
                  border: `1px solid ${
                    selected()
                      ? theme().accent
                      : isHover()
                      ? theme().borderStrong
                      : theme().border
                  }`,
                  color: selected()
                    ? theme().text
                    : isHover()
                    ? theme().text
                    : theme().textDim,
                  "font-family": "inherit",
                  transition: "background 90ms, border-color 90ms, color 90ms",
                }}
              >
                {opt.label}
              </button>
            );
          }}
        </For>
      </div>
    </div>
  );
};

// Each tile renders a miniature window painted with its own theme's colors
// so the picker is a literal preview rather than a name list. Scales to N
// themes via a 2-column grid that wraps onto more rows as we add palettes.
const ThemeSwatch: Component<{
  theme: Theme;
  label: string;
  selected: boolean;
  onSelect: () => void;
}> = (props) => {
  const ui = useTheme();
  const [hover, setHover] = createSignal(false);
  return (
    <button
      onClick={props.onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-pressed={props.selected}
      style={{
        display: "block",
        width: "100%",
        padding: "0",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        "font-family": "inherit",
        "text-align": "left",
      }}
    >
      {/* Mini "window" preview — chrome bar with dots, panel inset,
       * accent strip. All colors are pulled from the theme itself so the
       * tile literally shows what you'll get. */}
      <div
        style={{
          position: "relative",
          height: "54px",
          background: props.theme.bg,
          "border-radius": rad(ui(), 6),
          border: `${props.selected ? 2 : 1}px solid ${
            props.selected
              ? ui().accent
              : hover()
              ? ui().borderStrong
              : ui().border
          }`,
          overflow: "hidden",
          transition: "border-color 90ms",
          // Compensate for the 2px selected border so tiles don't jump
          margin: props.selected ? "0" : "1px",
          "box-sizing": "border-box",
        }}
      >
        {/* Chrome strip */}
        <div
          style={{
            height: "12px",
            background: props.theme.chrome,
            "border-bottom": `1px solid ${props.theme.border}`,
            display: "flex",
            "align-items": "center",
            gap: "3px",
            padding: "0 5px",
          }}
        >
          <span
            style={{
              width: "5px",
              height: "5px",
              "border-radius": "50%",
              background: props.theme.red,
              opacity: 0.85,
            }}
          />
          <span
            style={{
              width: "5px",
              height: "5px",
              "border-radius": "50%",
              background: props.theme.yellow,
              opacity: 0.85,
            }}
          />
          <span
            style={{
              width: "5px",
              height: "5px",
              "border-radius": "50%",
              background: props.theme.green,
              opacity: 0.85,
            }}
          />
        </div>
        {/* Panel area with an accent indicator and a couple of text bars */}
        <div
          style={{
            position: "absolute",
            top: "18px",
            left: "6px",
            right: "6px",
            bottom: "6px",
            background: props.theme.panel,
            "border-radius": rad(ui(), 3),
            border: `1px solid ${props.theme.border}`,
            padding: "4px 5px",
            display: "flex",
            "flex-direction": "column",
            "justify-content": "space-between",
          }}
        >
          <div
            style={{
              width: "40%",
              height: "3px",
              background: props.theme.accent,
              "border-radius": "1px",
            }}
          />
          <div
            style={{
              width: "70%",
              height: "2px",
              background: props.theme.textDim,
              "border-radius": "1px",
              opacity: 0.55,
            }}
          />
        </div>
        {/* Selection checkmark in the corner */}
        <Show when={props.selected}>
          <div
            style={{
              position: "absolute",
              top: "3px",
              right: "3px",
              width: "12px",
              height: "12px",
              "border-radius": "50%",
              background: ui().accent,
              color: ui().bg,
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              "font-size": "8px",
              "font-weight": 700,
              "line-height": 1,
            }}
          >
            ✓
          </div>
        </Show>
      </div>
      <div
        style={{
          "font-size": "11px",
          color: props.selected ? ui().text : ui().textDim,
          "margin-top": "5px",
          "font-weight": props.selected ? 500 : 400,
          "white-space": "nowrap",
          overflow: "hidden",
          "text-overflow": "ellipsis",
        }}
      >
        {props.label}
      </div>
    </button>
  );
};

// Tiny preview rendered inside the dropdown trigger so the collapsed
// picker still hints at what's currently selected without having to read
// the label.
const ThemeMiniSwatch: Component<{ theme: Theme }> = (props) => (
  <div
    style={{
      width: "22px",
      height: "16px",
      "border-radius": "3px",
      border: `1px solid ${props.theme.border}`,
      background: props.theme.bg,
      overflow: "hidden",
      position: "relative",
      "flex-shrink": 0,
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "5px",
        background: props.theme.chrome,
        "border-bottom": `1px solid ${props.theme.border}`,
      }}
    />
    <div
      style={{
        position: "absolute",
        bottom: "2px",
        left: "2px",
        width: "8px",
        height: "2px",
        background: props.theme.accent,
        "border-radius": "1px",
      }}
    />
  </div>
);

// Select-style dropdown: collapsed to a single row by default, expands
// into the full swatch grid on click. Scales to N themes without eating
// vertical space in the Tweaks panel.
const ThemeDropdown: Component<{
  label: string;
  value: ThemeName;
  onChange: (v: ThemeName) => void;
  options: { value: ThemeName; label: string }[];
}> = (props) => {
  const theme = useTheme();
  const [open, setOpen] = createSignal(false);
  const [hover, setHover] = createSignal(false);
  const current = () => props.options.find((o) => o.value === props.value);

  // Close on Escape while the popover is open. Stop propagation so the
  // Tweaks panel itself doesn't pick it up if/when that handler exists.
  createEffect(() => {
    if (!open()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  return (
    <div style={{ "margin-bottom": "12px", position: "relative" }}>
      <div
        style={{
          "font-size": "11px",
          color: theme().textDim,
          "margin-bottom": "6px",
          "font-family": "var(--mono)",
          "text-transform": "uppercase",
          "letter-spacing": "0.05em",
        }}
      >
        {props.label}
      </div>
      <button
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-haspopup="listbox"
        aria-expanded={open()}
        style={{
          width: "100%",
          display: "flex",
          "align-items": "center",
          gap: "8px",
          padding: "6px 8px",
          background: open()
            ? theme().panel
            : hover()
            ? theme().panelAlt
            : "transparent",
          color: theme().text,
          border: `1px solid ${
            open() || hover() ? theme().borderStrong : theme().border
          }`,
          "border-radius": rad(theme(), 6),
          "font-size": "12px",
          "font-family": "inherit",
          cursor: "pointer",
          transition: "background 90ms, border-color 90ms",
        }}
      >
        <ThemeMiniSwatch theme={THEMES[props.value]} />
        <span
          style={{
            flex: 1,
            "text-align": "left",
            "white-space": "nowrap",
            overflow: "hidden",
            "text-overflow": "ellipsis",
          }}
        >
          {current()?.label}
        </span>
        <span
          style={{
            display: "flex",
            "align-items": "center",
            color: theme().textDim,
            transform: open() ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 120ms",
          }}
        >
          <Icon name="caret" size={10} />
        </span>
      </button>
      <Show when={open()}>
        {/* Click-outside backdrop — full viewport so it captures clicks
         * anywhere outside the popover, including over the Tweaks panel
         * itself. */}
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, "z-index": 220 }}
        />
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: theme().chrome,
            border: `1px solid ${theme().borderStrong}`,
            "border-radius": rad(theme(), 8),
            padding: "10px",
            "z-index": 221,
            "max-height": "320px",
            "overflow-y": "auto",
            "box-shadow": "0 12px 32px rgba(0,0,0,0.35)",
          }}
        >
          <div
            style={{
              display: "grid",
              "grid-template-columns": "1fr 1fr",
              gap: "8px",
            }}
          >
            <For each={props.options}>
              {(opt) => (
                <ThemeSwatch
                  theme={THEMES[opt.value]}
                  label={opt.label}
                  selected={props.value === opt.value}
                  onSelect={() => {
                    props.onChange(opt.value);
                    setOpen(false);
                  }}
                />
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
};

const TerminalFontFamilyRow: Component<{
  value: string;
  setValue: (v: string) => void;
  installed: Set<string>;
}> = (props) => {
  const theme = useTheme();
  const t = useT();
  const selected = () => findTerminalFontFamily(props.value);
  const isAvailable = (value: string, primary: string | null) =>
    primary === null || props.installed.has(value);
  // The system default option's label is the only one we localize — every
  // other font name is a proper noun (Geist Mono, Fira Code, …).
  const labelFor = (value: string, label: string) =>
    value === "system" ? t("fontSystemDefault") : label;
  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        "margin-top": "12px",
        gap: "8px",
      }}
    >
      <span style={{ "font-size": "11px", color: theme().textDim }}>
        {t("terminalFontFamily")}
      </span>
      <select
        value={props.value}
        onChange={(e) => props.setValue(e.currentTarget.value)}
        style={{
          background: theme().panel,
          color: theme().text,
          border: `1px solid ${theme().borderStrong}`,
          "border-radius": rad(theme(), 6),
          padding: "4px 8px",
          "font-family": selected().stack,
          "font-size": "12px",
          cursor: "pointer",
          "max-width": "160px",
        }}
      >
        <For each={TERMINAL_FONT_FAMILIES}>
          {(f) => {
            const available = isAvailable(f.value, f.primary);
            return (
              <option value={f.value} style={{ "font-family": f.stack }}>
                {labelFor(f.value, f.label)}
                {available ? "" : `  ${t("fontNotInstalled")}`}
              </option>
            );
          }}
        </For>
      </select>
    </div>
  );
};

const TerminalFontSizeRow: Component<{
  value: number;
  setValue: (n: number) => void;
  reset: () => void;
}> = (props) => {
  const theme = useTheme();
  const t = useT();
  const atMin = () => props.value <= TERMINAL_FONT_SIZE_MIN;
  const atMax = () => props.value >= TERMINAL_FONT_SIZE_MAX;
  const btn = (disabled: boolean) => ({
    background: "transparent",
    border: `1px solid ${theme().borderStrong}`,
    color: disabled ? theme().textDim : theme().text,
    width: "24px",
    height: "24px",
    "border-radius": rad(theme(), 6),
    cursor: disabled ? "default" : "pointer",
    "font-family": "var(--mono)",
    "font-size": "12px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    opacity: disabled ? 0.4 : 1,
  });
  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        "margin-top": "12px",
        gap: "8px",
      }}
    >
      <span style={{ "font-size": "11px", color: theme().textDim }}>
        {t("terminalFont")}
      </span>
      <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
        <button
          onClick={() => !atMin() && props.setValue(props.value - 1)}
          disabled={atMin()}
          style={btn(atMin())}
          title={t("shrinkFontTooltip")}
        >
          −
        </button>
        <button
          onClick={props.reset}
          style={{
            background: "transparent",
            border: "none",
            color: theme().text,
            "font-family": "var(--mono)",
            "font-size": "12px",
            cursor: "pointer",
            "min-width": "32px",
            "text-align": "center",
            padding: "2px 4px",
          }}
          title={t("resetFontTooltip")}
        >
          {props.value}px
        </button>
        <button
          onClick={() => !atMax() && props.setValue(props.value + 1)}
          disabled={atMax()}
          style={btn(atMax())}
          title={t("enlargeFontTooltip")}
        >
          +
        </button>
      </div>
    </div>
  );
};

export const TweaksPanel: Component<{
  open: boolean;
  onClose: () => void;
  themeName: ThemeName;
  setTheme: (n: ThemeName) => void;
  density: Density;
  setDensity: (d: Density) => void;
  termFontSize: number;
  setTermFontSize: (n: number) => void;
  resetTermFontSize: () => void;
  termFontFamily: string;
  setTermFontFamily: (v: string) => void;
  installedFonts: Set<string>;
  locale: Locale;
  setLocale: (l: Locale) => void;
}> = (props) => {
  const theme = useTheme();
  const t = useT();
  const [closeHover, setCloseHover] = createSignal(false);
  return (
    <Show when={props.open}>
      {/* Backdrop: click anywhere outside the panel to dismiss. Sits just
       * below the panel so clicks on the panel itself never reach it. */}
      <div
        onClick={props.onClose}
        style={{ position: "fixed", inset: 0, "z-index": 199 }}
      />
      <div
        style={{
          position: "fixed",
          top: "60px",
          right: "32px",
          width: "280px",
          background: theme().chrome,
          border: `1px solid ${theme().borderStrong}`,
          "border-radius": rad(theme(), 12),
          padding: "16px",
          "box-shadow": "0 24px 60px rgba(0,0,0,0.5)",
          "z-index": 200,
        }}
      >
        <div
          style={{
            display: "flex",
            "justify-content": "space-between",
            "align-items": "center",
            "margin-bottom": "14px",
          }}
        >
          <span
            style={{ "font-size": "13px", "font-weight": 600, color: theme().text }}
          >
            {t("tweaksTitle")}
          </span>
          <button
            onClick={props.onClose}
            onMouseEnter={() => setCloseHover(true)}
            onMouseLeave={() => setCloseHover(false)}
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
        <RadioRow
          label={t("language")}
          value={props.locale}
          onChange={(v) => props.setLocale(v as Locale)}
          options={LOCALES.map((l) => ({ value: l.value, label: l.label }))}
        />
        <ThemeDropdown
          label={t("palette")}
          value={props.themeName}
          onChange={props.setTheme}
          options={[
            { value: "anthropic-dark", label: t("themeAnthropicDark") },
            { value: "anthropic-light", label: t("themeAnthropicLight") },
            { value: "openai-dark", label: t("themeOpenAIDark") },
            { value: "openai-light", label: t("themeOpenAILight") },
            { value: "zed-dark", label: t("themeZedDark") },
            { value: "zed-light", label: t("themeZedLight") },
            { value: "github-dark", label: t("themeGitHubDark") },
            { value: "github-light", label: t("themeGitHubLight") },
          ]}
        />
        <RadioRow
          label={t("density")}
          value={props.density}
          onChange={(v) => props.setDensity(v as Density)}
          options={[
            { value: "cozy", label: t("densityCozy") },
            { value: "compact", label: t("densityCompact") },
          ]}
        />
        <TerminalFontSizeRow
          value={props.termFontSize}
          setValue={props.setTermFontSize}
          reset={props.resetTermFontSize}
        />
        <TerminalFontFamilyRow
          value={props.termFontFamily}
          setValue={props.setTermFontFamily}
          installed={props.installedFonts}
        />
        <UpdateRow />
      </div>
    </Show>
  );
};

const UpdateRow: Component = () => {
  const theme = useTheme();
  const t = useT();
  const checking = () => updateStatus() === "checking";

  const statusText = (): string | null => {
    const s = updateStatus();
    if (s === "checking") return t("updateChecking");
    if (s === "up-to-date") return t("updateUpToDate");
    if (s === "available") {
      const p = pendingUpdate();
      return p ? `v${p.currentVersion} → v${p.version}` : null;
    }
    if (s === "error") {
      const err = updateError();
      return err ? `${t("updateErrorPrefix")} ${err}` : t("updateErrorPrefix");
    }
    return null;
  };

  return (
    <div
      style={{
        "margin-top": "16px",
        "padding-top": "12px",
        "border-top": `1px solid ${theme().border}`,
      }}
    >
      <button
        onClick={() => void checkForUpdates({ silent: false })}
        disabled={checking()}
        style={{
          width: "100%",
          padding: "6px 10px",
          background: "transparent",
          color: theme().text,
          border: `1px solid ${theme().borderStrong}`,
          "border-radius": rad(theme(), 6),
          "font-size": "12px",
          "font-family": "inherit",
          cursor: checking() ? "default" : "pointer",
          opacity: checking() ? 0.6 : 1,
        }}
      >
        {checking() ? t("updateChecking") : t("updateCheckButton")}
      </button>
      <Show when={statusText()}>
        <div
          style={{
            "margin-top": "8px",
            "font-size": "11px",
            color:
              updateStatus() === "error" ? theme().red : theme().textDim,
            "font-family": "var(--mono)",
            "line-height": 1.4,
            "word-break": "break-word",
          }}
        >
          {statusText()}
        </div>
      </Show>
    </div>
  );
};
