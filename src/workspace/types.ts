import type { ProjectRow } from "../persistence";

export type MascotKind = "orchid" | "terminal" | "cube" | "mushroom";

export type Density = "cozy" | "compact";

export interface Workspace {
  id: string;
  name: string;
  path: string;
  mascot: MascotKind;
}

export const MASCOT_CYCLE: MascotKind[] = [
  "orchid",
  "terminal",
  "cube",
  "mushroom",
];

export function isMascotKind(v: string): v is MascotKind {
  return v === "orchid" || v === "terminal" || v === "cube" || v === "mushroom";
}

export function workspaceToRow(ws: Workspace, position: number): ProjectRow {
  return {
    id: ws.id,
    name: ws.name,
    path: ws.path,
    mascot: ws.mascot,
    position,
  };
}

export function rowToWorkspace(row: ProjectRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    mascot: isMascotKind(row.mascot) ? row.mascot : "orchid",
  };
}

export function basename(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? p;
}
