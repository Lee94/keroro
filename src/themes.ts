export interface Theme {
  name: string;
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
  pixelCoral: string;
  pixelBlue: string;
  pixelGreen: string;
  // Multiplier applied to every "card / button / panel" border-radius. Themes
  // like Zed use 0 to enforce sharp corners; the default 1 keeps the original
  // pixel values.
  cornerScale: number;
}

export type ThemeName = "ember" | "forest" | "plum" | "zed";

export function rad(t: Theme, px: number): string {
  const v = px * t.cornerScale;
  return v === 0 ? "0" : `${v}px`;
}

export const THEMES: Record<ThemeName, Theme> = {
  ember: {
    name: "ember",
    bg: "#15100c",
    chrome: "#1a1410",
    panel: "#1e1813",
    panelAlt: "#241c16",
    panelDeep: "#13100c",
    border: "#2a2018",
    borderStrong: "#3a2c20",
    text: "#ece2d4",
    textDim: "#a8957f",
    textMuted: "#6d5b48",
    accent: "#ff6b4a",
    accentDim: "#c2563d",
    amber: "#d4a574",
    green: "#7ec88d",
    blue: "#7eb3e6",
    yellow: "#d9b06b",
    red: "#e76b5a",
    pixelCoral: "#ff6b4a",
    pixelBlue: "#6cb8ff",
    pixelGreen: "#7ec88d",
    cornerScale: 1,
  },
  forest: {
    name: "forest",
    bg: "#0d130f",
    chrome: "#111813",
    panel: "#141c17",
    panelAlt: "#19241d",
    panelDeep: "#0b110d",
    border: "#1f2a23",
    borderStrong: "#2c3a30",
    text: "#dde8d8",
    textDim: "#8aa590",
    textMuted: "#5a7264",
    accent: "#6dd58c",
    accentDim: "#4ba66b",
    amber: "#c4cf83",
    green: "#6dd58c",
    blue: "#7bc2c0",
    yellow: "#c4cf83",
    red: "#d97a6c",
    pixelCoral: "#d97a6c",
    pixelBlue: "#7bc2c0",
    pixelGreen: "#6dd58c",
    cornerScale: 1,
  },
  plum: {
    name: "plum",
    bg: "#120e18",
    chrome: "#17121f",
    panel: "#1c1626",
    panelAlt: "#231b2f",
    panelDeep: "#0f0b16",
    border: "#2a2036",
    borderStrong: "#3a2c4a",
    text: "#e7dbef",
    textDim: "#a08bb4",
    textMuted: "#695578",
    accent: "#b794f6",
    accentDim: "#8e6dcc",
    amber: "#d9a3d4",
    green: "#9be6c0",
    blue: "#9aaef0",
    yellow: "#e8c89c",
    red: "#e88a9e",
    pixelCoral: "#e88a9e",
    pixelBlue: "#9aaef0",
    pixelGreen: "#9be6c0",
    cornerScale: 1,
  },
  zed: {
    name: "zed",
    bg: "#fafafa",
    chrome: "#ececec",
    panel: "#f4f4f5",
    panelAlt: "#ebebec",
    panelDeep: "#e1e1e2",
    border: "#e1e1e2",
    borderStrong: "#c8c8c9",
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
    pixelCoral: "#e45649",
    pixelBlue: "#4078f2",
    pixelGreen: "#50a14f",
    cornerScale: 0,
  },
};
