import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  For,
  Show,
  type Component,
  type JSX,
} from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { THEMES, rad, type ThemeName } from "./themes";
import {
  ThemeContext,
  WorkspaceContext,
  WorkspaceInfoContext,
  InstalledClisContext,
  TerminalFontFamilyContext,
  TerminalFontSizeContext,
  TERMINAL_FONT_FAMILIES,
  TERMINAL_FONT_SIZE_DEFAULT,
  type WorkspaceInfo,
} from "./themeContext";
import { FayeMascot } from "./mascots";
import { XtermPane } from "./XtermPane";
import { useTheme } from "./ui/useTheme";
import { isMac } from "./platform";
import { Titlebar } from "./chrome/Titlebar";
import { Sidebar } from "./workspace/Sidebar";
import { EmptyWorkspace } from "./workspace/EmptyWorkspace";
import {
  basename,
  MASCOT_CYCLE,
  rowToWorkspace,
  workspaceToRow,
  type Density,
  type Workspace,
} from "./workspace/types";
import { DragContext } from "./panes/drag";
import type { DragInfo } from "./panes/drag";
import { PaneTreeView } from "./panes/PaneView";
import {
  closeTabInTree,
  defaultPanes,
  loadPaneTree,
  moveTabInTree,
  paneTreeToLayout,
  saveProjectState,
  updateLeaf,
  updateSplit,
  walkLeaves,
} from "./panes/tree";
import {
  isPtyKind,
  type DropSide,
  type LeafPane,
  type PaneNode,
  type PanesByWs,
  type SplitPane,
  type Tab,
  type WorkspacePanes,
} from "./panes/types";
import { TweaksPanel } from "./settings/TweaksPanel";
import {
  SIDEBAR_OPEN_KEY,
  TERM_FONT_FAMILY_KEY,
  TERM_FONT_SIZE_KEY,
  THEME_NAME_KEY,
  clampFontSize,
  detectInstalledFont,
  readSidebarOpen,
  readTermFontFamily,
  readTermFontSize,
  readThemeName,
} from "./settings/storage";
import {
  debounce,
  deleteProject,
  getActiveProject,
  listProjects,
  replaceProjects,
  setActiveProject as dbSetActiveProject,
  upsertProject,
} from "./persistence";
import "./App.css";

const App: Component = () => {
  const [themeName, setThemeNameSignal] = createSignal<ThemeName>(readThemeName());
  const setThemeName = (n: ThemeName) => {
    setThemeNameSignal(n);
    try {
      localStorage.setItem(THEME_NAME_KEY, n);
    } catch {}
  };
  const [density, setDensity] = createSignal<Density>("cozy");
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [sidebarOpen, setSidebarOpen] = createSignal<boolean>(readSidebarOpen());
  const [termFontSize, setTermFontSizeSignal] = createSignal<number>(readTermFontSize());
  const setTermFontSize = (n: number) => {
    const next = clampFontSize(n);
    setTermFontSizeSignal(next);
    try {
      localStorage.setItem(TERM_FONT_SIZE_KEY, String(next));
    } catch {}
  };
  const bumpTermFontSize = (delta: number) =>
    setTermFontSize(termFontSize() + delta);
  const resetTermFontSize = () => setTermFontSize(TERMINAL_FONT_SIZE_DEFAULT);

  const [termFontFamily, setTermFontFamilySignal] = createSignal<string>(
    readTermFontFamily(),
  );
  const setTermFontFamily = (v: string) => {
    if (!TERMINAL_FONT_FAMILIES.some((f) => f.value === v)) return;
    setTermFontFamilySignal(v);
    try {
      localStorage.setItem(TERM_FONT_FAMILY_KEY, v);
    } catch {}
  };
  const [installedFonts, setInstalledFonts] = createSignal<Set<string>>(
    new Set(),
  );

  const toggleSidebar = () => {
    setSidebarOpen((o) => {
      const next = !o;
      try {
        localStorage.setItem(SIDEBAR_OPEN_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  const themeAccessor = () => THEMES[themeName()];

  createEffect(() => {
    const t = themeAccessor();
    const root = document.documentElement.style;
    root.setProperty("--scrollbar-radius", rad(t, 8));
    root.setProperty("--body-bg", t.bg);
    root.setProperty("--body-fg", t.text);
  });

  const [workspaces, setWorkspaces] = createSignal<Workspace[]>([]);
  const [activeWs, setActiveWs] = createSignal<string>("");
  const [panes, setPanes] = createSignal<PanesByWs>({});
  const [bootstrapped, setBootstrapped] = createSignal(false);
  const [installedClis, setInstalledClis] = createSignal<Map<string, string>>(
    new Map(),
  );

  onMount(async () => {
    try {
      const rows = await listProjects();
      const projectsList = rows.map(rowToWorkspace);
      const activeId = await getActiveProject();
      const entries = await Promise.all(
        projectsList.map(
          async (p) => [p.id, await loadPaneTree(p.id)] as const,
        ),
      );
      const panesMap: PanesByWs = {};
      for (const [id, wp] of entries) panesMap[id] = wp;
      setWorkspaces(projectsList);
      setPanes(panesMap);
      setActiveWs(activeId ?? projectsList[0]?.id ?? "");
    } catch (err) {
      console.error("bootstrap failed", err);
    } finally {
      setBootstrapped(true);
    }
  });

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod || e.altKey) return;
      if (!e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
        return;
      }
      // Terminal font size: Cmd/Ctrl + = / +  to grow, - to shrink, 0 to reset.
      // `key` is "+" when shift is held on US layouts; accept either with or without shift.
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        e.stopPropagation();
        bumpTermFontSize(1);
        return;
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        e.stopPropagation();
        bumpTermFontSize(-1);
        return;
      }
      if (e.key === "0" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        resetTermFontSize();
        return;
      }
    };
    window.addEventListener("keydown", onKey, true);
    onCleanup(() => window.removeEventListener("keydown", onKey, true));
  });

  onMount(() => {
    invoke<{ kind: string; found: boolean; path: string | null }[]>("detect_clis")
      .then((infos) => {
        const next = new Map<string, string>();
        for (const c of infos) {
          if (c.found && c.path) next.set(c.kind, c.path);
        }
        setInstalledClis(next);
      })
      .catch((err) => console.error("detect_clis failed", err));
  });

  onMount(() => {
    const scan = () => {
      const next = new Set<string>();
      for (const f of TERMINAL_FONT_FAMILIES) {
        if (f.primary && detectInstalledFont(f.primary)) next.add(f.value);
      }
      setInstalledFonts(next);
    };
    scan();
    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    if (fonts?.ready) {
      fonts.ready.then(scan).catch(() => {});
    }
  });

  const ensurePanes = (wsId: string) => {
    if (!wsId) return;
    if (!panes()[wsId]) {
      setPanes((prev) => ({ ...prev, [wsId]: defaultPanes() }));
    }
  };

  createEffect(() => {
    if (!bootstrapped()) return;
    ensurePanes(activeWs());
  });

  // ─── Persistence: debounced writes after bootstrap ─────────────────
  const debouncedSaveProjects = debounce((list: Workspace[]) => {
    replaceProjects(list.map((w, i) => workspaceToRow(w, i))).catch((e) =>
      console.error("replaceProjects failed", e),
    );
  }, 200);

  const debouncedSaveActive = debounce((id: string) => {
    dbSetActiveProject(id || null).catch((e) =>
      console.error("setActiveProject failed", e),
    );
  }, 200);

  // Track which projects we have already persisted in this session so we can
  // GC the layout+sessions for any that get removed from `workspaces()`.
  const persistedProjectIds = new Set<string>();
  const lastSavedLayout = new Map<string, string>();

  const debouncedSaveLayouts = debounce((p: PanesByWs, ids: Set<string>) => {
    for (const id of Object.keys(p)) {
      if (!ids.has(id)) continue;
      const json = JSON.stringify(paneTreeToLayout(p[id].root));
      if (lastSavedLayout.get(id) === json) continue;
      lastSavedLayout.set(id, json);
      saveProjectState(id, p[id].root).catch((e) =>
        console.error("saveProjectState failed", e),
      );
    }
  }, 200);

  createEffect(() => {
    if (!bootstrapped()) return;
    const list = workspaces();
    const ids = new Set(list.map((w) => w.id));
    // GC removed projects
    for (const old of persistedProjectIds) {
      if (!ids.has(old)) {
        deleteProject(old).catch((e) =>
          console.error("deleteProject failed", e),
        );
        lastSavedLayout.delete(old);
      }
    }
    persistedProjectIds.clear();
    for (const id of ids) persistedProjectIds.add(id);
    debouncedSaveProjects(list);
  });

  createEffect(() => {
    if (!bootstrapped()) return;
    debouncedSaveActive(activeWs());
  });

  createEffect(() => {
    if (!bootstrapped()) return;
    const p = panes();
    const ids = new Set(workspaces().map((w) => w.id));
    debouncedSaveLayouts(p, ids);
  });

  const addWorkspace = async () => {
    let picked: string | string[] | null = null;
    try {
      picked = await openDialog({ directory: true, multiple: false });
    } catch (err) {
      console.error("dialog open failed", err);
      return;
    }
    if (!picked || Array.isArray(picked)) return;
    const path = picked;
    const list = workspaces();
    const existing = list.find((w) => w.path === path);
    if (existing) {
      setActiveWs(existing.id);
      return;
    }
    const ws: Workspace = {
      id: "ws-" + Math.random().toString(36).slice(2, 8),
      name: basename(path),
      path,
      mascot: MASCOT_CYCLE[list.length % MASCOT_CYCLE.length],
    };
    // Persist project row + initial layout eagerly so the FK-bound layout/
    // session writes triggered by the reactive effects always find a parent.
    try {
      await upsertProject(workspaceToRow(ws, list.length));
      const initial = defaultPanes();
      await saveProjectState(ws.id, initial.root);
      persistedProjectIds.add(ws.id);
      lastSavedLayout.set(
        ws.id,
        JSON.stringify(paneTreeToLayout(initial.root)),
      );
      setPanes((prev) => ({ ...prev, [ws.id]: initial }));
    } catch (err) {
      console.error("create project failed", err);
      return;
    }
    setWorkspaces([...list, ws]);
    setActiveWs(ws.id);
  };

  const removeWorkspace = (id: string) => {
    const list = workspaces();
    if (!list.some((w) => w.id === id)) return;
    const filtered = list.filter((w) => w.id !== id);
    setWorkspaces(filtered);
    if (activeWs() === id) {
      setActiveWs(filtered[0]?.id ?? "");
    }
    setPanes((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const current = (): WorkspacePanes | undefined => panes()[activeWs()];
  const currentPath = (): string | undefined =>
    workspaces().find((w) => w.id === activeWs())?.path;

  // PTY-backed tabs (terminal + any CLI agent) across every workspace's pane
  // tree. Mounted at the App root so switching workspaces re-parents the
  // xterm DOM (via the terminalHost registry) instead of unmounting the
  // XtermPane and killing the PTY.
  const allPtyTabs = createMemo<Tab[]>(() => {
    const out: Tab[] = [];
    for (const wp of Object.values(panes())) {
      walkLeaves(wp.root, (leaf) => {
        for (const t of leaf.tabs) if (isPtyKind(t.kind)) out.push(t);
      });
    }
    return out;
  });

  const activeTabIds = createMemo<Set<string>>(() => {
    const s = new Set<string>();
    for (const wp of Object.values(panes())) {
      walkLeaves(wp.root, (leaf) => {
        if (leaf.activeTab) s.add(leaf.activeTab);
      });
    }
    return s;
  });

  // Per-workspace footer info — node version + git branch
  const [nodeVersion, setNodeVersion] = createSignal<string | null>(null);
  const [gitBranch, setGitBranch] = createSignal<string | null>(null);

  createEffect(() => {
    const path = currentPath();
    setNodeVersion(null);
    setGitBranch(null);
    if (!path) return;

    let alive = true;
    const refreshBranch = () => {
      invoke<string | null>("detect_git_branch", { cwd: path })
        .then((v) => alive && setGitBranch(v ?? null))
        .catch(() => alive && setGitBranch(null));
    };
    invoke<string | null>("detect_node_version", { cwd: path })
      .then((v) => alive && setNodeVersion(v ?? null))
      .catch(() => alive && setNodeVersion(null));
    refreshBranch();
    const id = setInterval(refreshBranch, 5000);
    onCleanup(() => {
      alive = false;
      clearInterval(id);
    });
  });

  const workspaceInfo: WorkspaceInfo = {
    node: nodeVersion,
    branch: gitBranch,
  };

  const setRoot = (newRoot: PaneNode) => {
    const ws = activeWs();
    if (!ws || !panes()[ws]) return;
    setPanes((prev) => ({ ...prev, [ws]: { root: newRoot } }));
  };

  const setLeafByActive = (
    leafId: string,
    patch: (leaf: LeafPane) => LeafPane,
  ) => {
    const cur = current();
    if (!cur) return;
    setRoot(updateLeaf(cur.root, leafId, patch));
  };

  const setSplitByActive = (
    splitId: string,
    patch: (split: SplitPane) => SplitPane,
  ) => {
    const cur = current();
    if (!cur) return;
    setRoot(updateSplit(cur.root, splitId, patch));
  };

  const handleCloseTab = (leafId: string, tabId: string) => {
    const cur = current();
    if (!cur) return;
    setRoot(closeTabInTree(cur.root, leafId, tabId));
  };

  const handleDrop = (
    targetLeafId: string,
    side: DropSide,
    info: DragInfo,
  ) => {
    const cur = current();
    if (!cur) return;
    setRoot(
      moveTabInTree(
        cur.root,
        info.sourceLeafId,
        info.sourceTabId,
        targetLeafId,
        side,
      ),
    );
  };

  const [dragInfo, setDragInfo] = createSignal<DragInfo | null>(null);
  const dragApi = { drag: dragInfo, setDrag: setDragInfo };

  onMount(() => {
    // Fail-safe: drop landed outside any overlay, Esc cancelled the drag,
    // window lost focus mid-drag, etc. Clear the body class so the drop
    // overlay doesn't stay pointer-events:auto and steal xterm events.
    const clear = () => {
      document.body.classList.remove("faye-dragging");
      setDragInfo(null);
    };
    window.addEventListener("dragend", clear);
    window.addEventListener("drop", clear);
    onCleanup(() => {
      window.removeEventListener("dragend", clear);
      window.removeEventListener("drop", clear);
    });
  });

  const outerStyle = (): JSX.CSSProperties => ({
    width: "100vw",
    height: "100vh",
    background: themeAccessor().bg,
    "font-family": "var(--ui)",
    "border-radius": "10px",
    overflow: "hidden",
  });

  const windowStyle = (): JSX.CSSProperties => ({
    width: "100%",
    height: "100%",
    background: themeAccessor().bg,
    overflow: "hidden",
    display: "flex",
    "flex-direction": "column",
    color: themeAccessor().text,
    "border-radius": "10px",
  });

  return (
    <ThemeContext.Provider value={themeAccessor}>
      <WorkspaceContext.Provider value={currentPath}>
      <WorkspaceInfoContext.Provider value={workspaceInfo}>
      <InstalledClisContext.Provider value={installedClis}>
      <TerminalFontSizeContext.Provider value={termFontSize}>
      <TerminalFontFamilyContext.Provider value={termFontFamily}>
      <DragContext.Provider value={dragApi}>
      <div style={outerStyle()}>
        <Show when={bootstrapped()} fallback={<Splash />}>
        <div style={windowStyle()}>
          <Titlebar
            onToggleSettings={() => setSettingsOpen((o) => !o)}
            sidebarOpen={sidebarOpen()}
            onToggleSidebar={toggleSidebar}
            onAddProject={addWorkspace}
          />
          <div style={{ flex: 1, display: "flex", "min-height": 0 }}>
            <Sidebar
              workspaces={workspaces()}
              active={activeWs()}
              setActive={setActiveWs}
              onDelete={removeWorkspace}
              density={density()}
              open={sidebarOpen()}
            />

            <Show
              when={current()}
              fallback={
                <EmptyWorkspace
                  hasWorkspaces={workspaces().length > 0}
                  onAdd={addWorkspace}
                />
              }
            >
              {(p) => (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    "min-width": 0,
                    "min-height": 0,
                  }}
                >
                  <PaneTreeView
                    node={p().root}
                    setLeaf={setLeafByActive}
                    setSplit={setSplitByActive}
                    onCloseTab={handleCloseTab}
                    onDrop={handleDrop}
                  />
                  <For each={allPtyTabs()}>
                    {(t) => (
                      <XtermPane
                        sessionId={t.id}
                        visible={activeTabIds().has(t.id)}
                        command={
                          t.kind === "terminal"
                            ? undefined
                            : installedClis().get(t.kind)
                        }
                        cliSessionId={t.cliSessionId}
                      />
                    )}
                  </For>
                </div>
              )}
            </Show>
          </div>
        </div>
        </Show>

        <TweaksPanel
          open={settingsOpen()}
          onClose={() => setSettingsOpen(false)}
          themeName={themeName()}
          setTheme={setThemeName}
          density={density()}
          setDensity={setDensity}
          termFontSize={termFontSize()}
          setTermFontSize={setTermFontSize}
          resetTermFontSize={resetTermFontSize}
          termFontFamily={termFontFamily()}
          setTermFontFamily={setTermFontFamily}
          installedFonts={installedFonts()}
        />
      </div>
      </DragContext.Provider>
      </TerminalFontFamilyContext.Provider>
      </TerminalFontSizeContext.Provider>
      </InstalledClisContext.Provider>
      </WorkspaceInfoContext.Provider>
      </WorkspaceContext.Provider>
    </ThemeContext.Provider>
  );
};

const Splash: Component = () => {
  const theme = useTheme;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        background: theme().bg,
      }}
    >
      <FayeMascot size={56} wing={theme().accent} body={theme().bg} />
    </div>
  );
};

export default App;
