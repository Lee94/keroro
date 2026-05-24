import {
  getLayout,
  replaceSessions,
  setLayout,
  listSessions,
  type LayoutNode,
  type SessionRow,
} from "../persistence";
import {
  emptyLeaf,
  isAgentKind,
  newId,
  type DropSide,
  type LeafPane,
  type PaneNode,
  type SplitPane,
  type Tab,
  type WorkspacePanes,
} from "./types";

export const MIN_PANE_PX = 120;

export function paneTreeToLayout(node: PaneNode): LayoutNode {
  if (node.type === "leaf") {
    return {
      type: "leaf",
      id: node.id,
      tabIds: node.tabs.map((t) => t.id),
      activeTabId: node.activeTab,
    };
  }
  return {
    type: "split",
    id: node.id,
    direction: node.direction,
    ratio: node.ratio,
    first: paneTreeToLayout(node.first),
    second: paneTreeToLayout(node.second),
  };
}

export function layoutToPaneTree(
  node: LayoutNode,
  sessions: Map<string, SessionRow>,
): PaneNode {
  if (node.type === "leaf") {
    const tabs: Tab[] = [];
    for (const id of node.tabIds) {
      const s = sessions.get(id);
      if (!s) continue;
      const kind = isAgentKind(s.kind) ? s.kind : "terminal";
      tabs.push({
        id: s.id,
        kind,
        title: s.title,
        cliSessionId: s.cliSessionId ?? undefined,
      });
    }
    let activeTab = node.activeTabId;
    if (!tabs.some((t) => t.id === activeTab)) activeTab = tabs[0]?.id ?? "";
    return { type: "leaf", id: node.id, tabs, activeTab };
  }
  return {
    type: "split",
    id: node.id,
    direction: node.direction,
    ratio: node.ratio,
    first: layoutToPaneTree(node.first, sessions),
    second: layoutToPaneTree(node.second, sessions),
  };
}

export function defaultPanes(): WorkspacePanes {
  const tabId = newId("t");
  return {
    root: {
      type: "leaf",
      id: newId("lf"),
      tabs: [{ id: tabId, kind: "terminal", title: "terminal" }],
      activeTab: tabId,
    },
  };
}

export async function loadPaneTree(projectId: string): Promise<WorkspacePanes> {
  const [sessions, layoutJson] = await Promise.all([
    listSessions(projectId),
    getLayout(projectId),
  ]);
  if (!layoutJson) return defaultPanes();
  try {
    const layout = JSON.parse(layoutJson) as LayoutNode;
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));
    let root = layoutToPaneTree(layout, sessionMap);
    const pruned = pruneEmpty(root);
    root = pruned ?? defaultPanes().root;
    return { root };
  } catch {
    return defaultPanes();
  }
}

export async function saveProjectState(
  projectId: string,
  root: PaneNode,
): Promise<void> {
  const tabs: Tab[] = [];
  walkLeaves(root, (leaf) => {
    for (const t of leaf.tabs) tabs.push(t);
  });
  const sessions: SessionRow[] = tabs.map((t) => ({
    id: t.id,
    projectId,
    kind: t.kind,
    title: t.title,
    cliSessionId: t.cliSessionId ?? null,
  }));
  // Sessions first so the layout never references a missing row.
  await replaceSessions(projectId, sessions);
  await setLayout(projectId, JSON.stringify(paneTreeToLayout(root)));
}

export function mapLeaves(
  node: PaneNode,
  fn: (leaf: LeafPane) => PaneNode,
): PaneNode {
  if (node.type === "leaf") return fn(node);
  const first = mapLeaves(node.first, fn);
  const second = mapLeaves(node.second, fn);
  if (first === node.first && second === node.second) return node;
  return { ...node, first, second };
}

function findLeaf(node: PaneNode, id: string): LeafPane | null {
  if (node.type === "leaf") return node.id === id ? node : null;
  return findLeaf(node.first, id) ?? findLeaf(node.second, id);
}

export function walkLeaves(node: PaneNode, fn: (leaf: LeafPane) => void): void {
  if (node.type === "leaf") {
    fn(node);
    return;
  }
  walkLeaves(node.first, fn);
  walkLeaves(node.second, fn);
}

export function updateSplit(
  node: PaneNode,
  splitId: string,
  patch: (split: SplitPane) => SplitPane,
): PaneNode {
  if (node.type === "leaf") return node;
  if (node.id === splitId) return patch(node);
  const first = updateSplit(node.first, splitId, patch);
  const second = updateSplit(node.second, splitId, patch);
  if (first === node.first && second === node.second) return node;
  return { ...node, first, second };
}

export function pruneEmpty(node: PaneNode): PaneNode | null {
  if (node.type === "leaf") return node.tabs.length === 0 ? null : node;
  const first = pruneEmpty(node.first);
  const second = pruneEmpty(node.second);
  if (!first && !second) return null;
  if (!first) return second;
  if (!second) return first;
  if (first === node.first && second === node.second) return node;
  return { ...node, first, second };
}

export function updateLeaf(
  root: PaneNode,
  leafId: string,
  patch: (leaf: LeafPane) => LeafPane,
): PaneNode {
  return mapLeaves(root, (leaf) => (leaf.id === leafId ? patch(leaf) : leaf));
}

function splitLeafIntoNew(
  root: PaneNode,
  targetLeafId: string,
  side: Exclude<DropSide, "center">,
  newLeaf: LeafPane,
): PaneNode {
  return mapLeaves(root, (leaf) => {
    if (leaf.id !== targetLeafId) return leaf;
    const direction =
      side === "left" || side === "right" ? "horizontal" : "vertical";
    const newFirst = side === "left" || side === "top";
    return {
      type: "split",
      id: newId("sp"),
      direction,
      ratio: 0.5,
      first: newFirst ? newLeaf : leaf,
      second: newFirst ? leaf : newLeaf,
    } satisfies SplitPane;
  });
}

export function moveTabInTree(
  root: PaneNode,
  sourceLeafId: string,
  tabId: string,
  targetLeafId: string,
  side: DropSide,
): PaneNode {
  const sourceLeaf = findLeaf(root, sourceLeafId);
  if (!sourceLeaf) return root;
  const tab = sourceLeaf.tabs.find((t) => t.id === tabId);
  if (!tab) return root;

  // No-op cases
  if (side === "center" && sourceLeafId === targetLeafId) return root;
  if (side !== "center" && sourceLeafId === targetLeafId && sourceLeaf.tabs.length <= 1) {
    return root;
  }

  // 1. Remove tab from source leaf
  let next = updateLeaf(root, sourceLeafId, (leaf) => {
    const tabs = leaf.tabs.filter((t) => t.id !== tabId);
    const activeTab =
      leaf.activeTab === tabId ? (tabs[0]?.id ?? "") : leaf.activeTab;
    return { ...leaf, tabs, activeTab };
  });

  if (side === "center") {
    // Append into target leaf and activate
    next = updateLeaf(next, targetLeafId, (leaf) => ({
      ...leaf,
      tabs: [...leaf.tabs, tab],
      activeTab: tab.id,
    }));
  } else {
    // Wrap target leaf in a new split with a fresh leaf for the moved tab
    const fresh: LeafPane = {
      type: "leaf",
      id: newId("lf"),
      tabs: [tab],
      activeTab: tab.id,
    };
    next = splitLeafIntoNew(next, targetLeafId, side, fresh);
  }

  return pruneEmpty(next) ?? emptyLeaf();
}

export function closeTabInTree(
  root: PaneNode,
  leafId: string,
  tabId: string,
): PaneNode {
  const next = updateLeaf(root, leafId, (leaf) => {
    const idx = leaf.tabs.findIndex((t) => t.id === tabId);
    const tabs = leaf.tabs.filter((t) => t.id !== tabId);
    let activeTab = leaf.activeTab;
    if (activeTab === tabId) {
      const fallback = tabs[Math.max(0, idx - 1)];
      activeTab = fallback?.id ?? "";
    }
    return { ...leaf, tabs, activeTab };
  });
  return pruneEmpty(next) ?? emptyLeaf();
}
