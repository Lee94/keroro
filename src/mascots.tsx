import type { Component } from "solid-js";
import { For } from "solid-js";

interface PixelArtProps {
  art: string;
  palette: Record<string, string>;
  size?: number;
  render?: number;
  title?: string;
}

export const PixelArt: Component<PixelArtProps> = (props) => {
  const size = () => props.size ?? 14;
  const render = () => props.render ?? 22;
  const rows = () => props.art.replace(/^\n/, "").replace(/\n$/, "").split("\n");

  const cells = () => {
    const out: { x: number; y: number; fill: string }[] = [];
    rows().forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const fill = props.palette[ch];
        if (fill) out.push({ x, y, fill });
      });
    });
    return out;
  };

  return (
    <svg
      width={render()}
      height={render()}
      viewBox={`0 0 ${size()} ${size()}`}
      shape-rendering="crispEdges"
      style={{ display: "block", "image-rendering": "pixelated" }}
      aria-label={props.title}
    >
      <For each={cells()}>
        {(c) => <rect x={c.x} y={c.y} width="1" height="1" fill={c.fill} />}
      </For>
    </svg>
  );
};

// ─── Terminal: a green chevron inside a CRT box ──────────
const TERMINAL_ART = `
..............
..XXXXXXXXXXX.
..X.........X.
..X.X.......X.
..X.XX......X.
..X.XXX.....X.
..X.XXXX....X.
..X.XXX.....X.
..X.XX......X.
..X.X.......X.
..X.XXXXXXX.X.
..X.........X.
..XXXXXXXXXXX.
..............
`;
export const TerminalMascot: Component<{ size?: number; color?: string }> = (
  props,
) => (
  <PixelArt
    art={TERMINAL_ART}
    palette={{ X: props.color ?? "#6fc28b" }}
    render={props.size ?? 22}
    title="Terminal"
  />
);

// ─── Claude Code: chunky coral ember critter ─────────
const EMBER_ART = `
......AA......
....AAAA......
....AA........
...BBBBBB.....
..BBBBBBBBB...
.BBBBBBBBBBB..
.BBCBBBBCBB..B
.BBBBBBBBBBB.B
.BBBBBBBBBBBB.
.BBBBBBBBBBBB.
.BBBBBBBBBBB..
..BBBBBBBBB...
..BB.BBB.BB...
..B...B...B...
`;
export const ClaudeCodeMascot: Component<{
  size?: number;
  primary?: string;
  /** Flame/highlight pixels on top of the ember. Distinct from `primary`
   * so the critter reads as three color zones (flame, body, eyes)
   * instead of a single-tone blob — keeps it visually interesting on
   * the muted palettes where the body and panel hues sit close. */
  highlight?: string;
  shadow?: string;
}> = (props) => (
  <PixelArt
    art={EMBER_ART}
    palette={{
      A: props.highlight ?? "#ffb86b",
      B: props.primary ?? "#ff6b4a",
      C: props.shadow ?? "#1a0e0a",
    }}
    render={props.size ?? 22}
    title="Claude Code"
  />
);

// ─── Codex: blue geometric crystal ─────────
const CODEX_ART = `
......AA......
.....AAAA.....
....AABBBB....
...AABBBBBB...
..AABBBBBBBB..
.AABBBBBBBBBB.
AABBBBBBBBBBBB
.BBBBBBBBBBBB.
..BBBBBBBBBB..
...BBBBBBBB...
....BBBBBB....
.....BBBB.....
......BB......
..............
`;
export const CodexMascot: Component<{
  size?: number;
  primary?: string;
  highlight?: string;
}> = (props) => (
  <PixelArt
    art={CODEX_ART}
    palette={{
      A: props.highlight ?? "#bfdcff",
      B: props.primary ?? "#6cb8ff",
    }}
    render={props.size ?? 22}
    title="Codex"
  />
);

// ─── Faye brand: pixel-art moth ─────────────
const FAYE_ART = `
..............
.AA........AA.
.AAAA....AAAA.
.AAAAAA.AAAAA.
.AAAAAA.AAAAA.
..AAAAA.AAAA..
...AAA.B.AAA..
....AABBBAA...
....AAABAAA...
...AAAABAAAA..
..AAAAA.AAAAA.
.AAAAAA.AAAAA.
.AAAA....AAAA.
.AA........AA.
`;
export const FayeMascot: Component<{
  size?: number;
  wing?: string;
  body?: string;
}> = (props) => (
  <PixelArt
    art={FAYE_ART}
    palette={{ A: props.wing ?? "#ff6b4a", B: props.body ?? "#3a1d12" }}
    render={props.size ?? 22}
    title="Faye"
  />
);

// ─── Workspace icons ────────
const ORCHID_ART = `
.....AAAA.....
...AABBBBAA...
..ABBBBBBBBA..
.ABBBBCCBBBBA.
.ABBBCCCCBBBA.
ABBBCCCCCCBBBA
ABBBCCCCCCBBBA
ABBBCCCCCCBBBA
.ABBBCCCCBBBA.
.ABBBBCCBBBBA.
..ABBBBBBBBA..
...AABBBBAA...
.....AAAA.....
..............
`;
export const OrchidMascot: Component<{
  size?: number;
  outer?: string;
  inner?: string;
}> = (props) => (
  <PixelArt
    art={ORCHID_ART}
    palette={{
      A: props.outer ?? "#d97757",
      B: props.outer ?? "#d97757",
      C: props.inner ?? "#fbe9d7",
    }}
    render={props.size ?? 22}
    title="orchid"
  />
);

const MUSHROOM_ART = `
....AAAAAA....
..AABBBBBBAA..
.ABBCCBBCCBBA.
.ABBCCBBCCBBA.
.ABBBBBBBBBBA.
.ABBBBBBBBBBA.
..AABBBBBBAA..
....DDDDDD....
....DEEEED....
....DEEEED....
....DEEEED....
....DEEEED....
....DDDDDD....
..............
`;
export const MushroomMascot: Component<{ size?: number }> = (props) => (
  <PixelArt
    art={MUSHROOM_ART}
    palette={{
      A: "#9bc972",
      B: "#9bc972",
      C: "#f4e6c8",
      D: "#3a2f24",
      E: "#6b5642",
    }}
    render={props.size ?? 22}
    title="mushroom"
  />
);

const CUBE_ART = `
......AA......
....AABBAA....
..AABBBBBBAA..
.ABBBBBBBBBBA.
.ACBBBBBBBBCA.
.ACCBBBBBBCCA.
.ACCCBBBBCCCA.
.ACCCCBBCCCCA.
.ACCCCCBCCCCA.
.ACCCCCCCCCCA.
.ACCCCCCCCCCA.
..ACCCCCCCCA..
....ACCCCA....
......AA......
`;
export const CubeMascot: Component<{
  size?: number;
  light?: string;
  dark?: string;
}> = (props) => (
  <PixelArt
    art={CUBE_ART}
    palette={{
      A: props.dark ?? "#3d6896",
      B: props.light ?? "#7aa7d9",
      C: props.dark ?? "#3d6896",
    }}
    render={props.size ?? 22}
    title="cube"
  />
);
