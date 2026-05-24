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
import { getSessionTitle, setSessionTitle } from "./sessionTitles";
import { claudeSessionTitle, claudeUnlockSession } from "./persistence";
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
   * cwd of the workspace that owns this tab. Passed explicitly because
   * [[WorkspaceContext]] always returns the currently *active* workspace's
   * path — that's wrong for tabs whose workspace isn't the active one
   * (e.g. background polling of [[claude_session_title]]).
   */
  cwd?: string;
  /**
   * Invoked when we auto-rotate the CLI session id after a failed --resume
   * (e.g. the JSONL was deleted or another claude process holds it). The
   * parent should persist the new id back into the tab so future boots use
   * it instead of repeatedly retrying the dead one.
   */
  onCliSessionRotated?: (newCliSessionId: string) => void;
}> = (props) => {
  const themeAccessor = useContext(ThemeContext);
  const activeWorkspaceCwd = useContext(WorkspaceContext);
  const tabCwd = (): string | undefined => props.cwd ?? activeWorkspaceCwd();
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
    // Swallow IME-composing keydowns. Chrome/WebKit stamp every keydown that
    // happens while a composition is active with `isComposing=true` and
    // `keyCode=229` ("processed by IME"). xterm.js doesn't filter these
    // consistently — and when the user toggles IME mid-composition the
    // pending letters leak through right after `compositionend` already
    // committed the same characters, doubling the input ("ab" → "abab").
    // The `compositionend` path is what actually writes to the PTY, so it's
    // safe to drop these here.
    if (e.isComposing || e.keyCode === 229) return false;
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

  // Per-spawn state used by the exit handler / live data scanner to decide
  // whether to auto-rotate the cliSessionId and respawn.
  //
  // Two failure modes we recover from:
  //  1. `--resume` against a JSONL that's been deleted/corrupted, OR against
  //     a session another claude process still owns. Claude exits within a
  //     second or two of spawn; the exit handler detects the quick exit and
  //     rotates.
  //  2. `Error: Session ID <uuid> is already in use.` printed by claude when
  //     its own session registry still holds the id. This mode can leave
  //     claude sitting at a non-interactive prompt WITHOUT exiting — so we
  //     scan the live data stream for the phrase and force a rotation as
  //     soon as we see it, rather than waiting for an exit that never comes.
  //
  // `rotating` guards against the exit handler also firing (and printing
  // "[process exited]") while we're mid-respawn after a live-stream catch.
  // `lastRotationAt` throttles rotations so a CLI that immediately re-hits
  // the error on the fresh id doesn't put us in a hot loop, while still
  // letting later occurrences during the same tab lifetime recover.
  let lastSpawnAt = 0;
  let lastSpawnUsedResume = false;
  let rotating = false;
  let lastRotationAt = 0;
  const ROTATION_THROTTLE_MS = 8000;

  const tailLooksLikeSessionInUse = () => {
    const buf = term.buffer.active;
    const tailLen = Math.min(40, buf.length);
    // Join the tail into one string so a wrapped error line (e.g. the
    // 73-char `Error: Session ID <uuid> is already in use.` split across
    // two visual rows in a narrow pane) still matches.
    let joined = "";
    for (let i = buf.length - tailLen; i < buf.length; i++) {
      const line = buf.getLine(i);
      if (!line) continue;
      joined += line.translateToString(true);
    }
    return joined.includes("Session ID") && joined.includes("already in use");
  };

  // Two-step recovery:
  //  1. Try to unlock the existing cliSessionId by GC'ing stale entries in
  //     ~/.claude/sessions. If that works, we can respawn with the SAME id
  //     and keep the user's conversation history.
  //  2. If unlock returns false (no stale entry to remove, or the
  //     registered pid is still alive), rotate to a fresh UUID. History is
  //     lost but the tab becomes usable.
  const rotateAndRespawn = () => {
    if (rotating || disposed) return;
    if (!props.command || !props.cliSessionId) return;
    const now = Date.now();
    if (now - lastRotationAt < ROTATION_THROTTLE_MS) return;
    lastRotationAt = now;
    rotating = true;
    const originalId = props.cliSessionId;
    invoke("pty_kill", { id: props.sessionId })
      .catch(() => {})
      .then(async () => {
        await new Promise((resolve) => setTimeout(resolve, 600));
        let nextId = originalId;
        let keepingHistory = false;
        try {
          if (await claudeUnlockSession(originalId)) {
            keepingHistory = true;
          }
        } catch {
          // ignore — fall through to rotation
        }
        if (!keepingHistory) {
          nextId = crypto.randomUUID();
          props.onCliSessionRotated?.(nextId);
        }
        term.write(
          keepingHistory
            ? `\r\n\x1b[2m${t("sessionUnlockedResuming")}\x1b[0m\r\n`
            : `\r\n\x1b[2m${t("resumeFailedRetrying")}\x1b[0m\r\n`,
        );
        await spawnAttempt(nextId);
        rotating = false;
      });
  };

  // Buffer scanner — flips the per-tab "needs attention" flag when the bottom
  // of the active buffer looks like a permission prompt or y/n question, and
  // catches the `Session ID … already in use` failure mode that doesn't exit.
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
      if (tailLooksLikeSessionInUse()) {
        console.debug(
          "[XtermPane]",
          props.sessionId,
          "saw 'Session ID … already in use' in live buffer; rotating=",
          rotating,
          "throttled=",
          Date.now() - lastRotationAt < ROTATION_THROTTLE_MS,
        );
        rotateAndRespawn();
      }
    }, 250);
  };

  const spawnAttempt = async (cliSessionId: string | undefined) => {
    const cwd = tabCwd();
    let args: string[] | undefined;
    if (cliSessionId && props.command) {
      args = await invoke<string[]>("claude_spawn_args", {
        sessionId: cliSessionId,
        cwd,
      }).catch(() => undefined);
    }
    lastSpawnUsedResume = args?.[0] === "--resume";
    lastSpawnAt = Date.now();

    await invoke("pty_spawn", {
      id: props.sessionId,
      cols: term.cols || 80,
      rows: term.rows || 24,
      cwd,
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
      // We caused this exit by force-killing for a rotation; the respawn is
      // in flight and will write its own retry message.
      if (rotating) return;
      const livedFor = Date.now() - lastSpawnAt;
      const sawInUse = tailLooksLikeSessionInUse();
      const canRetry =
        !!props.command &&
        !!props.cliSessionId &&
        !disposed &&
        // The "already in use" phrase is a definitive signal, so we trust
        // it irrespective of how long claude lived. The 4s gate is only
        // there to distinguish a quick `--resume` failure from a normal
        // long-lived session the user just exited.
        (sawInUse || (lastSpawnUsedResume && livedFor < 4000));
      if (canRetry) {
        rotateAndRespawn();
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

  // Poll the claude session JSONL for the first user prompt so the tab can
  // auto-title itself. Re-keys on cliSessionId so a rotation (after a stale
  // `--resume`) restarts polling against the fresh id. The first user
  // message is immutable for a given session, so we stop polling once we
  // get a hit instead of running forever.
  createEffect(() => {
    const cliId = props.cliSessionId;
    if (!cliId || !props.command) return;
    if (getSessionTitle(cliId)) return;
    let stopped = false;
    const tick = () => {
      if (stopped || disposed) return;
      void claudeSessionTitle(cliId, tabCwd())
        .then((title) => {
          if (stopped || disposed) return;
          if (title) {
            setSessionTitle(cliId, title);
            stopped = true;
            clearInterval(handle);
          }
        })
        .catch(() => {});
    };
    const handle = setInterval(tick, 5000);
    tick();
    onCleanup(() => {
      stopped = true;
      clearInterval(handle);
    });
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
