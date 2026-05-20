import { createSignal, For, Show, type Component } from "solid-js";
import { rad, type ThemeName } from "../themes";
import { useTheme } from "../ui/useTheme";
import { Icon } from "../ui/Icon";
import {
  TERMINAL_FONT_FAMILIES,
  TERMINAL_FONT_SIZE_MAX,
  TERMINAL_FONT_SIZE_MIN,
  findTerminalFontFamily,
} from "../themeContext";
import type { Density } from "../workspace/types";

const RadioRow: Component<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}> = (props) => {
  const theme = useTheme;
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
          {(opt) => (
            <button
              onClick={() => props.onChange(opt.value)}
              style={{
                flex: 1,
                padding: "6px 10px",
                "border-radius": rad(theme(), 6),
                "font-size": "12px",
                cursor: "pointer",
                background:
                  props.value === opt.value ? theme().panel : "transparent",
                border: `1px solid ${
                  props.value === opt.value
                    ? theme().borderStrong
                    : theme().border
                }`,
                color:
                  props.value === opt.value ? theme().text : theme().textDim,
                "font-family": "inherit",
              }}
            >
              {opt.label}
            </button>
          )}
        </For>
      </div>
    </div>
  );
};

const TerminalFontFamilyRow: Component<{
  value: string;
  setValue: (v: string) => void;
  installed: Set<string>;
}> = (props) => {
  const theme = useTheme;
  const selected = () => findTerminalFontFamily(props.value);
  const isAvailable = (value: string, primary: string | null) =>
    primary === null || props.installed.has(value);
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
        Terminal font family
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
                {f.label}
                {available ? "" : "  (not installed)"}
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
  const theme = useTheme;
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
        Terminal font
      </span>
      <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
        <button
          onClick={() => !atMin() && props.setValue(props.value - 1)}
          disabled={atMin()}
          style={btn(atMin())}
          title="Shrink (Cmd/Ctrl -)"
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
          title="Reset (Cmd/Ctrl 0)"
        >
          {props.value}px
        </button>
        <button
          onClick={() => !atMax() && props.setValue(props.value + 1)}
          disabled={atMax()}
          style={btn(atMax())}
          title="Enlarge (Cmd/Ctrl =)"
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
}> = (props) => {
  const theme = useTheme;
  const [closeHover, setCloseHover] = createSignal(false);
  return (
    <Show when={props.open}>
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
            Tweaks
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
          label="Palette"
          value={props.themeName}
          onChange={(v) => props.setTheme(v as ThemeName)}
          options={[
            { value: "ember", label: "Ember" },
            { value: "forest", label: "Forest" },
            { value: "plum", label: "Plum" },
            { value: "zed", label: "Zed Light" },
          ]}
        />
        <RadioRow
          label="Density"
          value={props.density}
          onChange={(v) => props.setDensity(v as Density)}
          options={[
            { value: "cozy", label: "Cozy" },
            { value: "compact", label: "Compact" },
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
      </div>
    </Show>
  );
};
