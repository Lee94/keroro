export interface Theme {
  bg: string;
  chrome: string;
  panel: string;
  panelAlt: string;
  panelDeep: string;
  border: string;
  borderStrong: string;
  text: string;
  textDim: string;
  textMuted: string;
  accent: string;
  accentDim: string;
  amber: string;
  green: string;
  blue: string;
  yellow: string;
  red: string;
  // Distinct hues for the ANSI palette — without these, the terminal
  // collapses magenta into `accent` and cyan into `blue`, leaving CLIs
  // that depend on bold/bright (ls, git, claude) looking monotonous.
  cyan: string;
  magenta: string;
  pixelCoral: string;
  pixelBlue: string;
  pixelGreen: string;
  // Multiplier applied to every "card / button / panel" border-radius. Set to
  // 0 to force sharp corners; 1 keeps the original pixel values.
  cornerScale: number;
}

export type ThemeName =
  | "openai-dark"
  | "openai-light"
  | "anthropic-dark"
  | "anthropic-light"
  | "zed-dark"
  | "zed-light"
  | "github-dark"
  | "github-light";

export function rad(t: Theme, px: number): string {
  const v = px * t.cornerScale;
  return v === 0 ? "0" : `${v}px`;
}

export const THEMES: Record<ThemeName, Theme> = {
  // ─── OpenAI Dark ───────────────────────────────────────────────────
  // Pulled from ChatGPT's app shell: near-black canvas, slightly lighter
  // panels, neutral grays for text, and the iconic emerald accent.
  "openai-dark": {
    bg: "#212121",
    chrome: "#171717",
    panel: "#2f2f2f",
    panelAlt: "#3a3a3a",
    panelDeep: "#0f0f0f",
    border: "#3f3f3f",
    borderStrong: "#565656",
    text: "#ececec",
    textDim: "#b4b4b4",
    textMuted: "#8e8ea0",
    accent: "#19c37d",
    accentDim: "#10a37f",
    amber: "#f59e0b",
    green: "#19c37d",
    blue: "#60a5fa",
    yellow: "#fbbf24",
    red: "#f87171",
    cyan: "#5cd3d6",
    magenta: "#d870c3",
    pixelCoral: "#f87171",
    pixelBlue: "#60a5fa",
    pixelGreen: "#19c37d",
    cornerScale: 1,
  },

  // ─── OpenAI Light ──────────────────────────────────────────────────
  // The white-paper variant from chatgpt.com: pure white canvas, cool
  // grays, the same emerald accent toned down for contrast on white.
  "openai-light": {
    bg: "#ffffff",
    chrome: "#f7f7f8",
    panel: "#ffffff",
    panelAlt: "#ececed",
    panelDeep: "#e0e0e1",
    border: "#e5e5e5",
    borderStrong: "#b4b4b6",
    text: "#0d0d0d",
    textDim: "#5d5d5d",
    textMuted: "#8e8ea0",
    accent: "#10a37f",
    accentDim: "#0d8a6b",
    amber: "#d97706",
    green: "#10a37f",
    blue: "#3b82f6",
    yellow: "#b08000",
    red: "#ef4444",
    cyan: "#0891b2",
    magenta: "#c026d3",
    pixelCoral: "#ef4444",
    pixelBlue: "#3b82f6",
    pixelGreen: "#10a37f",
    cornerScale: 1,
  },

  // ─── Anthropic Dark ────────────────────────────────────────────────
  // Warm deep-brown canvas inspired by Claude's marketing pages,
  // cream-tinted text, and the brand "coral" accent (#cc785c) brightened
  // a touch so it still pops on a dark surface.
  "anthropic-dark": {
    bg: "#1c1916",
    chrome: "#211e1a",
    panel: "#25221e",
    panelAlt: "#2c2823",
    panelDeep: "#15120f",
    border: "#36322c",
    borderStrong: "#4a4439",
    text: "#f0ebe0",
    textDim: "#b8ad9b",
    textMuted: "#7a7064",
    accent: "#e3936f",
    accentDim: "#cc785c",
    amber: "#d4a674",
    green: "#88b08e",
    blue: "#8aa8c5",
    yellow: "#d4a674",
    red: "#e07a6b",
    cyan: "#84c4c4",
    magenta: "#d4a5e0",
    pixelCoral: "#e3936f",
    pixelBlue: "#8aa8c5",
    pixelGreen: "#88b08e",
    cornerScale: 1,
  },

  // ─── Anthropic Light ───────────────────────────────────────────────
  // Claude's signature paper-cream palette: warm ivory background,
  // espresso-toned text, coral accent. Keeps a calm, editorial feel.
  "anthropic-light": {
    bg: "#f5f4ed",
    chrome: "#ebe9dc",
    panel: "#faf9f5",
    panelAlt: "#e2dfce",
    panelDeep: "#d8d4c0",
    border: "#d6d3c4",
    borderStrong: "#9d9985",
    text: "#2d2a26",
    textDim: "#6b6356",
    textMuted: "#908774",
    accent: "#cc785c",
    accentDim: "#b35e44",
    amber: "#b8862f",
    green: "#65876a",
    blue: "#5a7d9a",
    yellow: "#b8862f",
    red: "#c44d3c",
    cyan: "#4f8a87",
    magenta: "#9c5d96",
    pixelCoral: "#cc785c",
    pixelBlue: "#5a7d9a",
    pixelGreen: "#65876a",
    cornerScale: 1,
  },

  // ─── Zed Dark ──────────────────────────────────────────────────────
  // Zed's One-Dark-derived editor palette. Cool slate canvas, soft
  // pastel syntax colors, and crisp 0-radius corners that match Zed's
  // signature sharp-edged surfaces.
  "zed-dark": {
    bg: "#1e222a",
    chrome: "#181b21",
    panel: "#21252c",
    panelAlt: "#262a32",
    panelDeep: "#15181c",
    border: "#2c313a",
    borderStrong: "#3e4451",
    text: "#d7dae0",
    textDim: "#8b94a4",
    textMuted: "#5c6370",
    accent: "#74ade8",
    accentDim: "#5688c7",
    amber: "#dec184",
    green: "#a1c181",
    blue: "#74ade8",
    yellow: "#dec184",
    red: "#d07277",
    cyan: "#56b6c2",
    magenta: "#c678dd",
    pixelCoral: "#d07277",
    pixelBlue: "#74ade8",
    pixelGreen: "#a1c181",
    cornerScale: 0,
  },

  // ─── Zed Light ─────────────────────────────────────────────────────
  // One Light palette: bright off-white canvas, warm grays, muted
  // indigo accent. Sharp corners stay true to Zed's chrome.
  "zed-light": {
    bg: "#fafafa",
    chrome: "#ececec",
    panel: "#ffffff",
    panelAlt: "#e0e0e1",
    panelDeep: "#d4d4d5",
    border: "#d8d8d9",
    borderStrong: "#a8a8aa",
    text: "#383a42",
    textDim: "#696c77",
    textMuted: "#a0a1a7",
    accent: "#5c79e3",
    accentDim: "#3f5fc7",
    amber: "#c18401",
    green: "#50a14f",
    blue: "#4078f2",
    yellow: "#c18401",
    red: "#e45649",
    cyan: "#0184bc",
    magenta: "#a626a4",
    pixelCoral: "#e45649",
    pixelBlue: "#4078f2",
    pixelGreen: "#50a14f",
    cornerScale: 0,
  },

  // ─── GitHub Dark ───────────────────────────────────────────────────
  // GitHub's "Dark default" Primer palette: near-black canvas
  // (#0d1117), slightly lighter panel (#161b22), and the unmistakable
  // accent blue (#2f81f7) used for links and primary buttons.
  "github-dark": {
    bg: "#0d1117",
    chrome: "#010409",
    panel: "#161b22",
    panelAlt: "#1c2128",
    panelDeep: "#010409",
    border: "#30363d",
    borderStrong: "#6e7681",
    text: "#e6edf3",
    textDim: "#7d8590",
    textMuted: "#484f58",
    accent: "#2f81f7",
    accentDim: "#1f6feb",
    amber: "#f0883e",
    green: "#3fb950",
    blue: "#2f81f7",
    yellow: "#d29922",
    red: "#f85149",
    cyan: "#39c5cf",
    magenta: "#db61a2",
    pixelCoral: "#f85149",
    pixelBlue: "#2f81f7",
    pixelGreen: "#3fb950",
    cornerScale: 1,
  },

  // ─── GitHub Light ──────────────────────────────────────────────────
  // GitHub "Light default": pure white canvas with the #f6f8fa subtle
  // gray for chrome/insets and the iconic GitHub blue (#0969da).
  "github-light": {
    bg: "#ffffff",
    chrome: "#f6f8fa",
    panel: "#ffffff",
    panelAlt: "#eaeef2",
    panelDeep: "#d8dee4",
    border: "#d0d7de",
    borderStrong: "#8c959f",
    text: "#1f2328",
    textDim: "#59636e",
    textMuted: "#818b98",
    accent: "#0969da",
    accentDim: "#0550ae",
    amber: "#bc4c00",
    green: "#1a7f37",
    blue: "#0969da",
    yellow: "#9a6700",
    red: "#d1242f",
    cyan: "#1b7c83",
    magenta: "#8250df",
    pixelCoral: "#d1242f",
    pixelBlue: "#0969da",
    pixelGreen: "#1a7f37",
    cornerScale: 1,
  },
};
