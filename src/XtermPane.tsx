import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  createEffect,
  onCleanup,
  useContext,
  type Component,
} from "solid-js";
import {
  ThemeContext,
  TerminalFontFamilyContext,
  TerminalFontSizeContext,
  WorkspaceContext,
  findTerminalFontFamily,
} from "./themeContext";
import type { Theme } from "./themes";
import { useT } from "./i18n";
import { splitDragging } from "./panes/splitDrag";
import { clearAttention, detectAttention, setNeedsAttention } from "./panes/attention";
import { releaseTerminalHost, terminalHost } from "./terminalHost";
import {
  openTerminalSearch,
  releaseTerminalSearch,
  setTerminalSearchOps,
  useTerminalSearch,
} from "./terminalSearch";
import { isMac } from "./platform";
import "@xterm/xterm/css/xterm.css";

function xtermTheme(t: Theme) {
  return {
    background: t.panel,
    foreground: t.text,
    cursor: t.accent,
    cursorAccent: t.bg,
    selectionBackground: t.borderStrong,
    black: t.bg,
    red: t.red,
    green: t.green,
    yellow: t.yellow,
    blue: t.blue,
    magenta: t.accent,
    cyan: t.pixelBlue,
    white: t.text,
    brightBlack: t.textMuted,
    brightRed: t.red,
    brightGreen: t.green,
    brightYellow: t.amber,
    brightBlue: t.blue,
    brightMagenta: t.accent,
    brightCyan: t.pixelBlue,
    brightWhite: t.text,
  };
}

function decodeBase64(payload: string): Uint8Array {
  const bin = atob(payload);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// XtermPane owns one PTY session for the lifetime of its tab. It is rendered
// once at the App root (not inside the leaf tree) so that splitting, merging,
// or moving the tab between leaves does not unmount and respawn the PTY.
// The xterm container is a detached DOM node that is re-parented into
// whichever leaf currently hosts the tab via the [[terminalHost]] registry.
export const XtermPane: Component<{
  sessionId: string;
  visible: boolean;
  command?: string;
  cliSessionId?: string;
  /**
   * Invoked when we auto-rotate the CLI session id after a failed --resume
   * (e.g. the JSONL was deleted or another claude process holds it). The
   * parent should persist the new id back into the tab so future boots use
   * it instead of repeatedly retrying the dead one.
   */
  onCliSessionRotated?: (newCliSessionId: string) => void;
}> = (props) => {
  const themeAccessor = useContext(ThemeContext);
  const workspaceCwd = useContext(WorkspaceContext);
  const fontSizeAccessor = useContext(TerminalFontSizeContext);
  const fontFamilyAccessor = useContext(TerminalFontFamilyContext);
  const t = useT();

  const container = document.createElement("div");
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.padding = "4px 10px";
  container.style.boxSizing = "border-box";
  container.style.background = themeAccessor().panel;

  const term = new Terminal({
    fontFamily: findTerminalFontFamily(fontFamilyAccessor()).stack,
    fontSize: fontSizeAccessor(),
    lineHeight: 1.2,
    cursorBlink: true,
    cursorStyle: "bar",
    allowProposedApi: true,
    theme: xtermTheme(themeAccessor()),
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.loadAddon(new WebLinksAddon());
  const search = new SearchAddon();
  term.loadAddon(search);

  const searchEntry = useTerminalSearch(props.sessionId);

  const searchOptions = () => {
    const tm = themeAccessor();
    return {
      decorations: {
        matchBackground: tm.amber,
        matchBorder: tm.amber,
        matchOverviewRuler: tm.amber,
        activeMatchBackground: tm.accent,
        activeMatchBorder: tm.accent,
        activeMatchColorOverviewRuler: tm.accent,
      },
    };
  };

  search.onDidChangeResults(({ resultIndex, resultCount }) => {
    if (resultCount === 0) {
      searchEntry.setResults({ index: 0, count: 0 });
    } else {
      searchEntry.setResults({ index: resultIndex + 1, count: resultCount });
    }
  });

  setTerminalSearchOps(props.sessionId, {
    findNext: (q) => {
      if (!q) {
        search.clearDecorations();
        searchEntry.setResults(null);
        return false;
      }
      return search.findNext(q, searchOptions());
    },
    findPrev: (q) => {
      if (!q) {
        search.clearDecorations();
        searchEntry.setResults(null);
        return false;
      }
      return search.findPrevious(q, searchOptions());
    },
    clear: () => {
      search.clearDecorations();
      searchEntry.setResults(null);
    },
    focusTerminal: () => term.focus(),
  });

  // Capture Ctrl/Cmd+F before xterm forwards it to the PTY. Returning false
  // from attachCustomKeyEventHandler swallows the event, so the running shell
  // never sees the keystroke. Only fires while this terminal owns focus, so
  // we naturally search the right session.
  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== "keydown") return true;
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && !e.altKey && (e.key === "f" || e.key === "F")) {
      e.preventDefault();
      openTerminalSearch(props.sessionId);
      return false;
    }
    return true;
  });

  let unlistenData: UnlistenFn | null = null;
  let unlistenExit: UnlistenFn | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let scheduledOpen = false;
  let opened = false;
  let started = false;
  let disposed = false;
  let webgl: WebglAddon | null = null;

  const tryLoadWebgl = () => {
    if (disposed || webgl) return;
    try {
      const addon = new WebglAddon();
      addon.onContextLoss(() => {
        addon.dispose();
        webgl = null;
        queueMicrotask(tryLoadWebgl);
      });
      term.loadAddon(addon);
      webgl = addon;
    } catch {
      webgl = null;
    }
  };

  const doFit = () => {
    if (disposed) return;
    if (!container.isConnected) return;
    // When an ancestor has `display:none` (e.g., the inactive workspace's pane
    // tree during a project switch), the container's layout box is 0×0.
    // Refitting in that state would resize the PTY to nothing and shrink the
    // xterm canvas — producing a visible flicker when the workspace returns to
    // view. The next RO tick after the container regains a real box drives the
    // fit instead.
    if (container.offsetParent === null) return;
    if (container.clientWidth === 0 || container.clientHeight === 0) return;
    // While a divider is being dragged the RO fires for every mouse move.
    // `fit.fit()` reflows the scrollback and `pty_resize` does an IPC
    // round-trip — both are too expensive to run per-frame. A drag-end effect
    // (below) performs the single real refit when the drag ends.
    if (splitDragging()) return;
    try {
      fit.fit();
    } catch {
      return;
    }
    if (!term.cols || !term.rows) return;
    invoke("pty_resize", {
      id: props.sessionId,
      cols: term.cols,
      rows: term.rows,
    }).catch(() => {});
  };

  // Per-spawn state used by the exit handler to decide whether to auto-retry.
  // `--resume` against a session that is occupied by another claude process
  // or whose JSONL on disk was deleted/corrupted exits within a second or
  // two; we treat a quick exit after a resume attempt as "session
  // unavailable" and re-spawn with a fresh session id (the parent rotates
  // the persisted cliSessionId via onCliSessionRotated).
  let lastSpawnAt = 0;
  let lastSpawnUsedResume = false;
  let retried = false;

  // Buffer scanner — flips the per-tab "needs attention" flag when the bottom
  // of the active buffer looks like a permission prompt or y/n question.
  // Debounced so a chatty stream (many `pty://data` chunks in one frame)
  // costs one scan, not one per chunk. The scan re-evaluates the flag every
  // time, so the dot clears itself once claude/codex consumes the answer.
  let attentionScanScheduled = false;
  const scheduleAttentionScan = () => {
    if (attentionScanScheduled || disposed) return;
    attentionScanScheduled = true;
    setTimeout(() => {
      attentionScanScheduled = false;
      if (disposed || !opened) return;
      const buf = term.buffer.active;
      const tailLen = Math.min(12, buf.length);
      const lines: string[] = [];
      for (let i = buf.length - tailLen; i < buf.length; i++) {
        const line = buf.getLine(i);
        if (!line) continue;
        lines.push(line.translateToString(true));
      }
      setNeedsAttention(props.sessionId, detectAttention(lines));
    }, 250);
  };

  const spawnAttempt = async (cliSessionId: string | undefined) => {
    let args: string[] | undefined;
    if (cliSessionId && props.command) {
      args = await invoke<string[]>("claude_spawn_args", {
        sessionId: cliSessionId,
        cwd: workspaceCwd(),
      }).catch(() => undefined);
    }
    lastSpawnUsedResume = args?.[0] === "--resume";
    lastSpawnAt = Date.now();

    await invoke("pty_spawn", {
      id: props.sessionId,
      cols: term.cols || 80,
      rows: term.rows || 24,
      cwd: workspaceCwd(),
      command: props.command,
      args,
    }).catch((err) => {
      term.write(`\r\n\x1b[31m${t("spawnFailed")}: ${err}\x1b[0m\r\n`);
    });
  };

  // First-paint of a workspace's terminals: xterm canvas + WebGL context +
  // PTY spawn + Tauri event listeners. Deferred until the tab is actually
  // visible so loading N workspaces doesn't fork N shells and create N GPU
  // contexts during boot / project switch. Runs once per session — once a
  // PTY is alive we keep it alive across visibility toggles so scrollback
  // and running processes survive.
  const startOnce = async () => {
    if (started || disposed) return;
    started = true;

    unlistenData = await listen<string>(
      `pty://data/${props.sessionId}`,
      (event) => {
        term.write(decodeBase64(event.payload));
        scheduleAttentionScan();
      },
    );
    if (disposed) {
      unlistenData?.();
      return;
    }
    unlistenExit = await listen(`pty://exit/${props.sessionId}`, () => {
      const livedFor = Date.now() - lastSpawnAt;
      const canRetry =
        !retried &&
        lastSpawnUsedResume &&
        livedFor < 4000 &&
        !!props.command &&
        !!props.cliSessionId &&
        !disposed;
      if (canRetry) {
        retried = true;
        const newId = crypto.randomUUID();
        term.write(`\r\n\x1b[2m${t("resumeFailedRetrying")}\x1b[0m\r\n`);
        props.onCliSessionRotated?.(newId);
        // pty_kill is idempotent: drops the dead session out of the manager
        // map so the same tab id can be re-spawned cleanly.
        invoke("pty_kill", { id: props.sessionId })
          .catch(() => {})
          .then(() => spawnAttempt(newId));
        return;
      }
      term.write(`\r\n\x1b[2m${t("processExited")}\x1b[0m\r\n`);
    });
    if (disposed) {
      unlistenData?.();
      unlistenExit?.();
      return;
    }

    term.onData((data) => {
      invoke("pty_write", { id: props.sessionId, data }).catch(() => {});
    });

    await spawnAttempt(props.cliSessionId);
  };

  const [host] = terminalHost(props.sessionId);

  createEffect(() => {
    const h = host();
    if (!h) return;
    if (container.parentElement !== h) {
      h.appendChild(container);
    }
    // Defer the synchronous boot cost (xterm.open lays out the canvas, the
    // WebGL addon creates a GPU context — on a cold Windows WebView2 the
    // first WebGL context alone can stall the renderer ~100–300ms) until the
    // next animation frame. This lets the surrounding chrome paint first
    // instead of the whole window appearing to freeze until the terminal
    // finishes initializing.
    if (!scheduledOpen && props.visible) {
      scheduledOpen = true;
      requestAnimationFrame(() => {
        if (disposed) return;
        term.open(container);
        tryLoadWebgl();
        opened = true;
        resizeObserver = new ResizeObserver(() => doFit());
        resizeObserver.observe(container);
        void startOnce();
        queueMicrotask(doFit);
      });
      return;
    }
    if (opened) queueMicrotask(doFit);
  });

  createEffect(() => {
    const t = themeAccessor();
    term.options.theme = xtermTheme(t);
    container.style.background = t.panel;
  });

  createEffect(() => {
    const size = fontSizeAccessor();
    if (term.options.fontSize === size) return;
    term.options.fontSize = size;
    queueMicrotask(doFit);
  });

  createEffect(() => {
    const stack = findTerminalFontFamily(fontFamilyAccessor()).stack;
    if (term.options.fontFamily === stack) return;
    term.options.fontFamily = stack;
    queueMicrotask(doFit);
  });

  createEffect(() => {
    if (props.visible) {
      queueMicrotask(() => {
        doFit();
        term.focus();
      });
    }
  });

  // After a divider drag ends, run one fit to catch up with the new container
  // size. (RO callbacks during the drag short-circuited inside doFit.)
  createEffect(() => {
    if (splitDragging()) return;
    if (opened) queueMicrotask(doFit);
  });

  onCleanup(() => {
    disposed = true;
    resizeObserver?.disconnect();
    unlistenData?.();
    unlistenExit?.();
    invoke("pty_kill", { id: props.sessionId }).catch(() => {});
    webgl?.dispose();
    webgl = null;
    term.dispose();
    if (container.parentElement) {
      container.parentElement.removeChild(container);
    }
    clearAttention(props.sessionId);
    releaseTerminalHost(props.sessionId);
    setTerminalSearchOps(props.sessionId, null);
    releaseTerminalSearch(props.sessionId);
  });

  return null;
};
