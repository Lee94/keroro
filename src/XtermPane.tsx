import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  createEffect,
  onCleanup,
  onMount,
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
import { releaseTerminalHost, terminalHost } from "./terminalHost";
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
}> = (props) => {
  const themeAccessor = useContext(ThemeContext);
  const workspaceCwd = useContext(WorkspaceContext);
  const fontSizeAccessor = useContext(TerminalFontSizeContext);
  const fontFamilyAccessor = useContext(TerminalFontFamilyContext);

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

  let unlistenData: UnlistenFn | null = null;
  let unlistenExit: UnlistenFn | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let opened = false;
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
    try {
      fit.fit();
    } catch {
      return;
    }
    invoke("pty_resize", {
      id: props.sessionId,
      cols: term.cols,
      rows: term.rows,
    }).catch(() => {});
  };

  onMount(async () => {
    unlistenData = await listen<string>(
      `pty://data/${props.sessionId}`,
      (event) => {
        term.write(decodeBase64(event.payload));
      },
    );
    unlistenExit = await listen(`pty://exit/${props.sessionId}`, () => {
      term.write("\r\n\x1b[2m[process exited]\x1b[0m\r\n");
    });

    term.onData((data) => {
      invoke("pty_write", { id: props.sessionId, data }).catch(() => {});
    });

    let args: string[] | undefined;
    if (props.cliSessionId && props.command) {
      args = await invoke<string[]>("claude_spawn_args", {
        sessionId: props.cliSessionId,
        cwd: workspaceCwd(),
      }).catch(() => undefined);
    }

    await invoke("pty_spawn", {
      id: props.sessionId,
      cols: term.cols || 80,
      rows: term.rows || 24,
      cwd: workspaceCwd(),
      command: props.command,
      args,
    }).catch((err) => {
      term.write(`\r\n\x1b[31mfailed to spawn pty: ${err}\x1b[0m\r\n`);
    });
  });

  const [host] = terminalHost(props.sessionId);

  createEffect(() => {
    const h = host();
    if (!h) return;
    if (container.parentElement !== h) {
      h.appendChild(container);
    }
    if (!opened) {
      term.open(container);
      tryLoadWebgl();
      opened = true;
      resizeObserver = new ResizeObserver(() => doFit());
      resizeObserver.observe(container);
    }
    queueMicrotask(doFit);
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
    releaseTerminalHost(props.sessionId);
  });

  return null;
};
