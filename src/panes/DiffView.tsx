import {
  createDeferred,
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
  type Component,
  type JSX,
} from "solid-js";
import { rad } from "../themes";
import { useTheme } from "../ui/useTheme";
import { Icon } from "../ui/Icon";
import { gitDiff } from "../persistence";
import {
  DIFF_PANEL_WIDTH_MIN,
  readDiffPanelWidth,
  writeDiffPanelWidth,
} from "../settings/storage";

type LineKind = "add" | "del" | "hunk" | "file" | "meta" | "context";

interface DiffLine {
  text: string;
  kind: LineKind;
}

type FileStatus = "modified" | "added" | "deleted" | "renamed" | "binary";

interface DiffFile {
  /** Display path — `b/` side for adds/modifies/renames, `a/` side for deletes. */
  path: string;
  /** Original path for renames; null otherwise. */
  oldPath: string | null;
  status: FileStatus;
  adds: number;
  dels: number;
  /** Body of this file's section: the lines between this `diff --git` header
   *  and the next. The header itself is excluded so the expanded view starts
   *  with `index/---/+++/@@…` and the actual hunks. */
  body: DiffLine[];
}

function classifyLine(line: string): LineKind {
  if (line.startsWith("diff --git ")) return "file";
  if (line.startsWith("index ")) return "meta";
  if (line.startsWith("--- ") || line.startsWith("+++ ")) return "file";
  if (line.startsWith("@@")) return "hunk";
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "del";
  if (
    line.startsWith("\\") ||
    line.startsWith("new file") ||
    line.startsWith("deleted file") ||
    line.startsWith("similarity") ||
    line.startsWith("rename") ||
    line.startsWith("Binary")
  )
    return "meta";
  return "context";
}

// Extract the `b/<path>` side from a `diff --git a/<x> b/<y>` header. We
// search from the right for ` b/` so paths containing spaces or even an
// embedded ` b/` substring still parse correctly.
function extractPathsFromHeader(header: string): { a: string; b: string } | null {
  const prefix = "diff --git a/";
  if (!header.startsWith(prefix)) return null;
  const rest = header.slice(prefix.length);
  const sep = rest.lastIndexOf(" b/");
  if (sep === -1) return null;
  return {
    a: rest.slice(0, sep),
    b: rest.slice(sep + 3),
  };
}

function parseDiff(raw: string): DiffFile[] {
  if (!raw) return [];
  // Normalise line endings up-front so the rest of the parser only handles \n.
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  // Drop the trailing empty element from a terminating \n.
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  const files: DiffFile[] = [];
  let current: DiffFile | null = null;

  for (const text of lines) {
    if (text.startsWith("diff --git ")) {
      if (current) files.push(current);
      const paths = extractPathsFromHeader(text);
      const a = paths?.a ?? "";
      const b = paths?.b ?? a;
      current = {
        path: b || a || "?",
        oldPath: null,
        status: "modified",
        adds: 0,
        dels: 0,
        body: [],
      };
      continue;
    }
    if (!current) continue;

    // Refine status / paths from indicator lines that appear before the hunks.
    if (text.startsWith("new file mode")) current.status = "added";
    else if (text.startsWith("deleted file mode")) {
      current.status = "deleted";
      // For deletes, the `b/` side is /dev/null — prefer the `a/` path for display.
      // We already stored `b` which equals `a` from the header, so nothing to change.
    } else if (text.startsWith("rename from ")) {
      current.status = "renamed";
      current.oldPath = text.slice("rename from ".length);
    } else if (text.startsWith("rename to ")) {
      current.path = text.slice("rename to ".length);
    } else if (text.startsWith("Binary files ")) {
      current.status = "binary";
    }

    const kind = classifyLine(text);
    // Don't double-count `+++ ` / `--- ` file marker lines as additions/deletions.
    if (kind === "add" && !text.startsWith("+++")) current.adds++;
    else if (kind === "del" && !text.startsWith("---")) current.dels++;

    current.body.push({ text, kind });
  }
  if (current) files.push(current);
  return files;
}

export const DiffView: Component<{
  cwd: string | null;
  open: boolean;
  onClose: () => void;
}> = (props) => {
  const theme = useTheme();
  const [raw, setRaw] = createSignal<string>("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [reloadTick, setReloadTick] = createSignal(0);
  const [expanded, setExpanded] = createSignal<ReadonlySet<string>>(new Set());
  const [width, setWidth] = createSignal<number>(readDiffPanelWidth());
  const [resizing, setResizing] = createSignal(false);

  // Drag the left edge to resize. We compute the new width from the mouse's
  // distance from the right edge of the viewport — the panel is anchored to
  // the right, so `innerWidth - clientX` is its natural width. Clamped against
  // the same min/max the container's CSS used to enforce statically.
  const onResizeDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setResizing(true);
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const maxWidth = () => Math.max(DIFF_PANEL_WIDTH_MIN, window.innerWidth * 0.8);

    const onMove = (ev: MouseEvent) => {
      const next = window.innerWidth - ev.clientX;
      const clamped = Math.min(maxWidth(), Math.max(DIFF_PANEL_WIDTH_MIN, next));
      setWidth(clamped);
    };
    const onUp = () => {
      setResizing(false);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      writeDiffPanelWidth(width());
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const toggleFile = (path: string) => {
    const next = new Set(expanded());
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setExpanded(next);
  };

  // Track the (cwd, tick) we last successfully fetched so closing+reopening
  // the panel reuses the cached diff instead of hitting `git diff` again.
  // git invocations on Windows incur an AV/process-spawn tax that dominates
  // user-perceived latency, so eliminating the redundant fetch makes the
  // toggle feel instant.
  let seq = 0;
  let lastFetchedCwd: string | null = null;
  let lastFetchedTick = -1;

  createEffect(() => {
    // Track these reactively so the effect re-fires when they change.
    const cwd = props.cwd;
    const open = props.open;
    const tick = reloadTick();
    if (!open) return;
    if (!cwd) {
      setRaw("");
      setError(null);
      setLoading(false);
      lastFetchedCwd = null;
      lastFetchedTick = tick;
      return;
    }
    if (cwd === lastFetchedCwd && tick === lastFetchedTick) return;
    const mySeq = ++seq;
    setLoading(true);
    setError(null);
    gitDiff(cwd)
      .then((text) => {
        if (mySeq !== seq) return;
        setRaw(text);
        setLoading(false);
        lastFetchedCwd = cwd;
        lastFetchedTick = tick;
      })
      .catch((e) => {
        if (mySeq !== seq) return;
        setError(String(e));
        setLoading(false);
        // Don't cache on error — next open should retry.
      });
  });

  // When the cwd changes the previous expansion state is meaningless (paths
  // belong to a different project). Reset so the new project always starts
  // collapsed.
  createEffect(() => {
    void props.cwd;
    setExpanded(new Set());
  });

  // Run parseDiff against a deferred view of `raw` so very large diffs
  // (hundreds of KB / tens of thousands of lines) don't stall the JS main
  // thread when the backend response lands. createDeferred schedules the
  // update during idle time; for normal-sized diffs it's effectively
  // immediate, but for huge diffs the panel shows its loading state briefly
  // longer rather than blocking input handling for hundreds of ms.
  const deferredRaw = createDeferred(raw, { timeoutMs: 50 });
  const files = createMemo(() => parseDiff(deferredRaw()));

  const totals = createMemo(() => {
    let adds = 0;
    let dels = 0;
    for (const f of files()) {
      adds += f.adds;
      dels += f.dels;
    }
    return { adds, dels, count: files().length };
  });

  const lineColor = (kind: LineKind): string => {
    const t = theme();
    switch (kind) {
      case "add":
        return t.green;
      case "del":
        return t.red;
      case "hunk":
        return t.blue;
      case "file":
        return t.amber;
      case "meta":
        return t.textMuted;
      default:
        return t.textDim;
    }
  };

  const lineBg = (kind: LineKind): string | undefined => {
    if (kind === "add") return "rgba(35,134,54,0.10)";
    if (kind === "del") return "rgba(248,81,73,0.10)";
    if (kind === "hunk") return "rgba(56,139,253,0.08)";
    return undefined;
  };

  const statusBadge = (s: FileStatus): { label: string; color: string } => {
    const t = theme();
    switch (s) {
      case "added":
        return { label: "A", color: t.green };
      case "deleted":
        return { label: "D", color: t.red };
      case "renamed":
        return { label: "R", color: t.blue };
      case "binary":
        return { label: "B", color: t.textMuted };
      default:
        return { label: "M", color: t.yellow };
    }
  };

  const containerStyle = (): JSX.CSSProperties => ({
    position: "relative",
    width: `${width()}px`,
    "min-width": `${DIFF_PANEL_WIDTH_MIN}px`,
    // Hide instead of unmounting so closing the panel preserves the loaded
    // diff state — reopening shows the cached file list immediately.
    display: props.open ? "flex" : "none",
    "flex-direction": "column",
    background: theme().panelDeep,
    "border-left": `1px solid ${theme().border}`,
    "flex-shrink": 0,
  });

  const headerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "6px 8px 6px 10px",
    "border-bottom": `1px solid ${theme().border}`,
    background: theme().chrome,
    "flex-shrink": 0,
    "font-family": "var(--ui)",
    "font-size": "11.5px",
    color: theme().textDim,
  });

  const iconBtnStyle = (): JSX.CSSProperties => ({
    display: "inline-flex",
    "align-items": "center",
    "justify-content": "center",
    width: "22px",
    height: "22px",
    background: "transparent",
    border: "1px solid transparent",
    "border-radius": rad(theme(), 5),
    cursor: "pointer",
    color: theme().textDim,
    transition: "background 100ms",
  });

  return (
    <div style={containerStyle()}>
      {/* Left-edge drag handle. The visible 1px border lives on the panel
        * itself; this strip is a 6px-wide invisible hit target overlapping the
        * border so the cursor flips well before the user has to pixel-hunt
        * the border. While dragging, the strip highlights with the accent
        * colour so the user gets feedback the gesture took. */}
      <div
        onMouseDown={onResizeDown}
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "-3px",
          width: "6px",
          cursor: "col-resize",
          "z-index": 10,
          background: resizing() ? theme().accent : "transparent",
          transition: resizing() ? "none" : "background 120ms ease",
        }}
      />
      <div style={headerStyle()}>
        <span style={{ "font-weight": 600, color: theme().text }}>Git Diff</span>
        <Show when={totals().count > 0}>
          <span style={{ color: theme().textMuted }}>
            {totals().count} file{totals().count === 1 ? "" : "s"}
          </span>
          <span style={{ color: theme().green }}>+{totals().adds}</span>
          <span style={{ color: theme().red }}>-{totals().dels}</span>
        </Show>
        <Show when={loading()}>
          <span style={{ color: theme().textMuted }}>加载中…</span>
        </Show>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          title="刷新"
          onClick={() => setReloadTick((n) => n + 1)}
          style={iconBtnStyle()}
          onMouseEnter={(e) => (e.currentTarget.style.background = theme().panel)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <Icon name="branch" size={11} color={theme().textDim} />
        </button>
        <button
          type="button"
          title="关闭"
          onClick={props.onClose}
          style={iconBtnStyle()}
          onMouseEnter={(e) => (e.currentTarget.style.background = theme().panel)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <Icon name="close" size={11} color={theme().textDim} />
        </button>
      </div>
      <div
        style={{
          flex: 1,
          "min-height": 0,
          overflow: "auto",
          "font-family": "var(--ui)",
          "font-size": "12px",
        }}
      >
        <Show when={error()}>
          <div
            style={{
              padding: "10px 14px",
              color: theme().red,
              "font-family": "var(--mono)",
              "white-space": "pre-wrap",
              "word-break": "break-word",
            }}
          >
            {error()}
          </div>
        </Show>
        <Show when={!error() && !loading() && files().length === 0}>
          <div
            style={{
              padding: "16px 14px",
              color: theme().textMuted,
            }}
          >
            没有未提交的更改
          </div>
        </Show>
        <For each={files()}>
          {(file) => {
            const isOpen = () => expanded().has(file.path);
            const badge = () => statusBadge(file.status);
            const [hover, setHover] = createSignal(false);
            return (
              <div
                style={{
                  "border-bottom": `1px solid ${theme().border}`,
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleFile(file.path)}
                  onMouseEnter={() => setHover(true)}
                  onMouseLeave={() => setHover(false)}
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "8px",
                    width: "100%",
                    padding: "7px 10px",
                    background: isOpen()
                      ? theme().panel
                      : hover()
                        ? theme().panelAlt
                        : "transparent",
                    border: "none",
                    "border-bottom": isOpen()
                      ? `1px solid ${theme().border}`
                      : "none",
                    cursor: "pointer",
                    color: theme().text,
                    "font-family": "var(--ui)",
                    "font-size": "12.5px",
                    "text-align": "left",
                    transition: "background 100ms",
                  }}
                >
                  <span
                    style={{
                      transform: isOpen() ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 120ms",
                      display: "inline-flex",
                      "align-items": "center",
                    }}
                  >
                    <Icon name="caret" size={9} color={theme().textMuted} />
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      "align-items": "center",
                      "justify-content": "center",
                      width: "16px",
                      height: "16px",
                      "border-radius": rad(theme(), 4),
                      background: `${badge().color}22`,
                      color: badge().color,
                      "font-family": "var(--mono)",
                      "font-size": "10.5px",
                      "font-weight": 600,
                      "flex-shrink": 0,
                    }}
                  >
                    {badge().label}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      "font-family": "var(--mono)",
                      "font-size": "12px",
                      "white-space": "nowrap",
                      overflow: "hidden",
                      "text-overflow": "ellipsis",
                      direction: "rtl",
                      "text-align": "left",
                    }}
                    title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
                  >
                    {file.path}
                  </span>
                  <Show when={file.adds > 0}>
                    <span
                      style={{
                        color: theme().green,
                        "font-family": "var(--mono)",
                        "font-size": "11.5px",
                      }}
                    >
                      +{file.adds}
                    </span>
                  </Show>
                  <Show when={file.dels > 0}>
                    <span
                      style={{
                        color: theme().red,
                        "font-family": "var(--mono)",
                        "font-size": "11.5px",
                      }}
                    >
                      -{file.dels}
                    </span>
                  </Show>
                </button>
                <Show when={isOpen()}>
                  <div
                    style={{
                      background: theme().panelDeep,
                      "font-family": "var(--mono)",
                      "font-size": "12px",
                      "line-height": "1.55",
                      padding: "4px 0",
                      "max-height": "60vh",
                      overflow: "auto",
                    }}
                  >
                    {/* Inner track sized to the widest row but at least the
                      * viewport width, so each row's tinted background extends
                      * across the full scrollable area instead of cutting off
                      * at the viewport's right edge when the user scrolls
                      * horizontally past long lines. */}
                    <div
                      style={{
                        width: "max-content",
                        "min-width": "100%",
                      }}
                    >
                      <For each={file.body}>
                        {(l) => (
                          <div
                            style={{
                              padding: "0 12px",
                              color: lineColor(l.kind),
                              background: lineBg(l.kind),
                              "white-space": "pre",
                              "font-weight":
                                l.kind === "file" || l.kind === "hunk" ? 600 : 400,
                            }}
                          >
                            {l.text || " "}
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};
