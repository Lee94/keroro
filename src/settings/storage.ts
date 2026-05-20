import { THEMES, type ThemeName } from "../themes";
import {
  TERMINAL_FONT_FAMILIES,
  TERMINAL_FONT_FAMILY_DEFAULT,
  TERMINAL_FONT_SIZE_DEFAULT,
  TERMINAL_FONT_SIZE_MAX,
  TERMINAL_FONT_SIZE_MIN,
} from "../themeContext";

export const SIDEBAR_OPEN_KEY = "faye:sidebarOpen";
export const THEME_NAME_KEY = "faye:themeName";
export const TERM_FONT_SIZE_KEY = "faye:termFontSize";
export const TERM_FONT_FAMILY_KEY = "faye:termFontFamily";

export const clampFontSize = (n: number): number => {
  if (!Number.isFinite(n)) return TERMINAL_FONT_SIZE_DEFAULT;
  return Math.min(
    TERMINAL_FONT_SIZE_MAX,
    Math.max(TERMINAL_FONT_SIZE_MIN, Math.round(n)),
  );
};

export const readTermFontSize = (): number => {
  try {
    const v = localStorage.getItem(TERM_FONT_SIZE_KEY);
    if (v !== null) return clampFontSize(parseInt(v, 10));
  } catch {}
  return TERMINAL_FONT_SIZE_DEFAULT;
};

export const readTermFontFamily = (): string => {
  try {
    const v = localStorage.getItem(TERM_FONT_FAMILY_KEY);
    if (v && TERMINAL_FONT_FAMILIES.some((f) => f.value === v)) return v;
  } catch {}
  return TERMINAL_FONT_FAMILY_DEFAULT;
};

// Canvas-measure based detection: a font is "installed" when its rendered
// width differs from the generic monospace fallback for the same string.
// Not perfect (fonts with identical metrics will read as missing) but
// reliable enough to gray out unavailable options in the picker.
export const detectInstalledFont = (family: string): boolean => {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    const sample = "mwwwwwwwwwwwwwwwwwiiiiiiiiiiiiiiiiii";
    const size = "72px";
    ctx.font = `${size} monospace`;
    const baseline = ctx.measureText(sample).width;
    ctx.font = `${size} "${family}", monospace`;
    return ctx.measureText(sample).width !== baseline;
  } catch {
    return false;
  }
};

export const readSidebarOpen = (): boolean => {
  try {
    const v = localStorage.getItem(SIDEBAR_OPEN_KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
};

export const readThemeName = (): ThemeName => {
  try {
    const v = localStorage.getItem(THEME_NAME_KEY);
    if (v && v in THEMES) return v as ThemeName;
  } catch {}
  return "ember";
};
