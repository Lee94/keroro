import { createContext, type Accessor } from "solid-js";
import { THEMES, type Theme } from "./themes";
import type { GitStatus } from "./persistence";

export const ThemeContext = createContext<() => Theme>(() => THEMES.ember);

export const WorkspaceContext = createContext<() => string | undefined>(
  () => undefined,
);

export interface WorkspaceInfo {
  node: Accessor<string | null>;
  branch: Accessor<string | null>;
  gitStatus: Accessor<GitStatus | null>;
}

export const WorkspaceInfoContext = createContext<WorkspaceInfo>({
  node: () => null,
  branch: () => null,
  gitStatus: () => null,
});

export const InstalledClisContext = createContext<Accessor<Map<string, string>>>(
  () => new Map<string, string>(),
);

export const TERMINAL_FONT_SIZE_DEFAULT = 13;
export const TERMINAL_FONT_SIZE_MIN = 8;
export const TERMINAL_FONT_SIZE_MAX = 32;

export const TerminalFontSizeContext = createContext<Accessor<number>>(
  () => TERMINAL_FONT_SIZE_DEFAULT,
);

// ─── Terminal font family ────────────────────────────────────────────
// `stack` always ends with monospace fallbacks so the terminal stays
// readable even if the user picks a font that isn't installed locally.
const SYSTEM_FALLBACK =
  "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

export interface TerminalFontFamily {
  value: string;
  label: string;
  /** Primary font name used for availability detection. `null` for the system stack. */
  primary: string | null;
  /** Full CSS font-family stack. */
  stack: string;
}

export const TERMINAL_FONT_FAMILIES: readonly TerminalFontFamily[] = [
  {
    value: "system",
    label: "System default",
    primary: null,
    stack: `'Geist Mono', 'JetBrains Mono', ${SYSTEM_FALLBACK}`,
  },
  { value: "geist", label: "Geist Mono", primary: "Geist Mono", stack: `'Geist Mono', ${SYSTEM_FALLBACK}` },
  { value: "jetbrains", label: "JetBrains Mono", primary: "JetBrains Mono", stack: `'JetBrains Mono', ${SYSTEM_FALLBACK}` },
  { value: "fira", label: "Fira Code", primary: "Fira Code", stack: `'Fira Code', ${SYSTEM_FALLBACK}` },
  { value: "cascadia", label: "Cascadia Code", primary: "Cascadia Code", stack: `'Cascadia Code', 'Cascadia Mono', ${SYSTEM_FALLBACK}` },
  { value: "sfmono", label: "SF Mono", primary: "SF Mono", stack: `'SF Mono', ${SYSTEM_FALLBACK}` },
  { value: "menlo", label: "Menlo", primary: "Menlo", stack: `Menlo, ${SYSTEM_FALLBACK}` },
  { value: "monaco", label: "Monaco", primary: "Monaco", stack: `Monaco, ${SYSTEM_FALLBACK}` },
  { value: "consolas", label: "Consolas", primary: "Consolas", stack: `Consolas, ${SYSTEM_FALLBACK}` },
  { value: "source", label: "Source Code Pro", primary: "Source Code Pro", stack: `'Source Code Pro', ${SYSTEM_FALLBACK}` },
  { value: "hack", label: "Hack", primary: "Hack", stack: `Hack, ${SYSTEM_FALLBACK}` },
  { value: "inconsolata", label: "Inconsolata", primary: "Inconsolata", stack: `Inconsolata, ${SYSTEM_FALLBACK}` },
  { value: "plex", label: "IBM Plex Mono", primary: "IBM Plex Mono", stack: `'IBM Plex Mono', ${SYSTEM_FALLBACK}` },
  { value: "iosevka", label: "Iosevka", primary: "Iosevka", stack: `Iosevka, ${SYSTEM_FALLBACK}` },
  { value: "ubuntu", label: "Ubuntu Mono", primary: "Ubuntu Mono", stack: `'Ubuntu Mono', ${SYSTEM_FALLBACK}` },
  { value: "courier", label: "Courier New", primary: "Courier New", stack: `'Courier New', ${SYSTEM_FALLBACK}` },
] as const;

export const TERMINAL_FONT_FAMILY_DEFAULT = "system";

export const findTerminalFontFamily = (
  value: string,
): TerminalFontFamily =>
  TERMINAL_FONT_FAMILIES.find((f) => f.value === value) ??
  TERMINAL_FONT_FAMILIES[0];

export const TerminalFontFamilyContext = createContext<Accessor<string>>(
  () => TERMINAL_FONT_FAMILY_DEFAULT,
);
