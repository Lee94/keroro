import { THEMES, type ThemeName } from "../themes";
import {
  TERMINAL_FONT_FAMILIES,
  TERMINAL_FONT_FAMILY_DEFAULT,
  TERMINAL_FONT_SIZE_DEFAULT,
  TERMINAL_FONT_SIZE_MAX,
  TERMINAL_FONT_SIZE_MIN,
} from "../themeContext";
import { detectDefaultLocale, type Locale } from "../i18n";

const SIDEBAR_OPEN_KEY = "faye:sidebarOpen";
const SIDEBAR_EXPANDED_KEY = "faye:sidebarExpanded";
const THEME_NAME_KEY = "faye:themeName";
const TERM_FONT_SIZE_KEY = "faye:termFontSize";
const TERM_FONT_FAMILY_KEY = "faye:termFontFamily";
const LOCALE_KEY = "faye:locale";
const DIFF_PANEL_WIDTH_KEY = "faye:diffPanelWidth";

export const DIFF_PANEL_WIDTH_MIN = 320;
export const DIFF_PANEL_WIDTH_DEFAULT = 520;

// Swallow QuotaExceeded / private-mode / disabled-storage failures: nothing
// here is load-bearing enough to crash the app for, the next boot just falls
// back to the defaults.
const safeWrite = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};

export const writeThemeName = (n: string): void => safeWrite(THEME_NAME_KEY, n);
export const writeLocale = (l: string): void => safeWrite(LOCALE_KEY, l);
export const writeSidebarOpen = (open: boolean): void =>
  safeWrite(SIDEBAR_OPEN_KEY, open ? "1" : "0");
export const writeTermFontSize = (n: number): void =>
  safeWrite(TERM_FONT_SIZE_KEY, String(n));
export const writeTermFontFamily = (v: string): void =>
  safeWrite(TERM_FONT_FAMILY_KEY, v);

export const readLocale = (): Locale => {
  try {
    const v = localStorage.getItem(LOCALE_KEY);
    if (v === "en" || v === "zh") return v;
  } catch {}
  return detectDefaultLocale();
};

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

export const readSidebarExpanded = (): Set<string> => {
  try {
    const v = localStorage.getItem(SIDEBAR_EXPANDED_KEY);
    if (!v) return new Set();
    const parsed = JSON.parse(v);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((s): s is string => typeof s === "string"));
    }
  } catch {}
  return new Set();
};

export const writeSidebarExpanded = (ids: ReadonlySet<string>): void =>
  safeWrite(SIDEBAR_EXPANDED_KEY, JSON.stringify([...ids]));

export const readDiffPanelWidth = (): number => {
  try {
    const v = localStorage.getItem(DIFF_PANEL_WIDTH_KEY);
    if (v !== null) {
      const n = parseInt(v, 10);
      if (Number.isFinite(n) && n >= DIFF_PANEL_WIDTH_MIN) return n;
    }
  } catch {}
  return DIFF_PANEL_WIDTH_DEFAULT;
};

export const writeDiffPanelWidth = (n: number): void =>
  safeWrite(DIFF_PANEL_WIDTH_KEY, String(Math.round(n)));

export const readThemeName = (): ThemeName => {
  try {
    const v = localStorage.getItem(THEME_NAME_KEY);
    if (v && v in THEMES) return v as ThemeName;
  } catch {}
  return "anthropic-dark";
};
