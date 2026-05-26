import {
  createSignal,
  For,
  Show,
  useContext,
  type Component,
} from "solid-js";
import { rad } from "../themes";
import { useTheme } from "../ui/useTheme";
import { Icon, type IconName } from "../ui/Icon";
import { WorkspaceInfoContext } from "../themeContext";
import {
  checkoutGitBranch,
  listGitBranches,
  type GitBranchInfo,
} from "../persistence";

interface ChipSpec {
  icon: IconName;
  label: string;
  color?: string;
}

const StaticChip: Component<ChipSpec> = (props) => {
  const theme = useTheme();
  return (
    <div
      style={{
        display: "inline-flex",
        "align-items": "center",
        gap: "6px",
        padding: "4px 10px 4px 9px",
        height: "24px",
        background: theme().panelAlt,
        border: `1px solid ${theme().border}`,
        "border-radius": rad(theme(), 7),
        "font-size": "11.5px",
        color: theme().textDim,
        "font-family": "var(--mono)",
        "letter-spacing": "-0.01em",
      }}
    >
      <Icon
        name={props.icon}
        size={11}
        color={props.color || theme().textMuted}
      />
      <span>{props.label}</span>
    </div>
  );
};

// Branch chip is a button-styled clone of the chip — same dimensions, but
// hover/active borders signal that it opens the branch menu.
const BranchChip: Component<{
  label: string;
  open: boolean;
  onToggle: () => void;
}> = (props) => {
  const theme = useTheme();
  const [hover, setHover] = createSignal(false);
  return (
    <button
      type="button"
      onClick={props.onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        "align-items": "center",
        gap: "6px",
        padding: "4px 10px 4px 9px",
        height: "24px",
        background: props.open ? theme().panel : theme().panelAlt,
        border: `1px solid ${
          props.open || hover() ? theme().accent : theme().border
        }`,
        "border-radius": rad(theme(), 7),
        "font-size": "11.5px",
        color: theme().textDim,
        "font-family": "var(--mono)",
        "letter-spacing": "-0.01em",
        cursor: "pointer",
        transition: "border-color 120ms",
      }}
    >
      <Icon name="branch" size={11} color={theme().amber} />
      <span>{props.label}</span>
      <Icon
        name="caret"
        size={9}
        color={theme().textMuted}
      />
    </button>
  );
};

// Same visual as StaticChip but rendered as a button — clicking toggles the
// right-side diff drawer. Used for the dirty/clean chip so the user can open
// the diff view directly from the existing git-status indicator.
const GitStatusChip: Component<ChipSpec & {
  open: boolean;
  onToggle: () => void;
}> = (props) => {
  const theme = useTheme();
  const [hover, setHover] = createSignal(false);
  return (
    <button
      type="button"
      onClick={props.onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="查看 git diff"
      style={{
        display: "inline-flex",
        "align-items": "center",
        gap: "6px",
        padding: "4px 10px 4px 9px",
        height: "24px",
        background: props.open ? theme().panel : theme().panelAlt,
        border: `1px solid ${
          props.open || hover() ? theme().accent : theme().border
        }`,
        "border-radius": rad(theme(), 7),
        "font-size": "11.5px",
        color: theme().textDim,
        "font-family": "var(--mono)",
        "letter-spacing": "-0.01em",
        cursor: "pointer",
        transition: "border-color 120ms",
      }}
    >
      <Icon
        name={props.icon}
        size={11}
        color={props.color || theme().textMuted}
      />
      <span>{props.label}</span>
    </button>
  );
};

const BranchMenu: Component<{
  cwd: string;
  current: string | null;
  onClose: () => void;
  onCheckedOut: () => void;
}> = (props) => {
  const theme = useTheme();
  const [data, setData] = createSignal<GitBranchInfo | null>(null);
  const [loadError, setLoadError] = createSignal<string | null>(null);
  const [checkoutError, setCheckoutError] = createSignal<string | null>(null);
  const [pending, setPending] = createSignal<string | null>(null);
  const [filter, setFilter] = createSignal("");

  listGitBranches(props.cwd)
    .then((info) => setData(info))
    .catch((e) => setLoadError(String(e)));

  const filtered = (): string[] => {
    const info = data();
    if (!info) return [];
    const q = filter().trim().toLowerCase();
    if (!q) return info.locals;
    return info.locals.filter((b) => b.toLowerCase().includes(q));
  };

  const handlePick = (branch: string) => {
    if (pending()) return;
    if (branch === props.current) {
      props.onClose();
      return;
    }
    setCheckoutError(null);
    setPending(branch);
    checkoutGitBranch(props.cwd, branch)
      .then(() => {
        props.onCheckedOut();
        props.onClose();
      })
      .catch((e) => {
        setCheckoutError(String(e));
        setPending(null);
      });
  };

  return (
    <>
      {/* Click-outside catcher; matches AddMenu's pattern in TabBar. */}
      <div
        onClick={props.onClose}
        style={{ position: "fixed", inset: 0, "z-index": 100 }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "calc(100% + 6px)",
          right: 0,
          "min-width": "240px",
          "max-width": "360px",
          "z-index": 101,
          background: theme().panelAlt,
          border: `1px solid ${theme().borderStrong}`,
          "border-radius": rad(theme(), 10),
          padding: "6px",
          "box-shadow": `0 14px 40px rgba(0,0,0,0.6), 0 0 0 0.5px ${theme().borderStrong}`,
          display: "flex",
          "flex-direction": "column",
          gap: "4px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="text"
          placeholder="筛选分支…"
          value={filter()}
          onInput={(e) => setFilter(e.currentTarget.value)}
          style={{
            background: theme().panel,
            border: `1px solid ${theme().border}`,
            "border-radius": rad(theme(), 6),
            padding: "6px 8px",
            "font-size": "12px",
            "font-family": "var(--mono)",
            color: theme().text,
            outline: "none",
          }}
        />
        <div
          style={{
            "max-height": "260px",
            "overflow-y": "auto",
            display: "flex",
            "flex-direction": "column",
          }}
        >
          <Show when={loadError()}>
            <div
              style={{
                padding: "8px 10px",
                "font-size": "12px",
                color: theme().red,
                "font-family": "var(--mono)",
                "white-space": "pre-wrap",
              }}
            >
              {loadError()}
            </div>
          </Show>
          <Show when={!loadError() && !data()}>
            <div
              style={{
                padding: "8px 10px",
                "font-size": "12px",
                color: theme().textMuted,
                "font-family": "var(--mono)",
              }}
            >
              加载分支…
            </div>
          </Show>
          <Show when={data() && filtered().length === 0 && !loadError()}>
            <div
              style={{
                padding: "8px 10px",
                "font-size": "12px",
                color: theme().textMuted,
                "font-family": "var(--mono)",
              }}
            >
              {filter().trim() ? "没有匹配的分支" : "没有本地分支"}
            </div>
          </Show>
          <For each={filtered()}>
            {(branch) => {
              const isCurrent = () => branch === props.current;
              const isPending = () => pending() === branch;
              const [hover, setHover] = createSignal(false);
              return (
                <div
                  onClick={() => handlePick(branch)}
                  onMouseEnter={() => setHover(true)}
                  onMouseLeave={() => setHover(false)}
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "8px",
                    padding: "6px 8px",
                    "border-radius": rad(theme(), 6),
                    cursor: pending() ? "wait" : "pointer",
                    background: hover() ? theme().panel : "transparent",
                    color: theme().text,
                    "font-size": "12.5px",
                    "font-family": "var(--mono)",
                    opacity: pending() && !isPending() ? 0.5 : 1,
                  }}
                >
                  <Icon
                    name="dot"
                    size={9}
                    color={
                      isCurrent() ? theme().accent : "transparent"
                    }
                  />
                  <span
                    style={{
                      flex: 1,
                      "white-space": "nowrap",
                      overflow: "hidden",
                      "text-overflow": "ellipsis",
                      "font-weight": isCurrent() ? 600 : 400,
                    }}
                  >
                    {branch}
                  </span>
                  <Show when={isPending()}>
                    <span
                      style={{
                        "font-size": "10.5px",
                        color: theme().textMuted,
                      }}
                    >
                      切换中…
                    </span>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
        <Show when={checkoutError()}>
          <div
            style={{
              "border-top": `1px solid ${theme().border}`,
              "margin-top": "4px",
              padding: "6px 8px 2px",
              "font-size": "11.5px",
              color: theme().red,
              "font-family": "var(--mono)",
              "white-space": "pre-wrap",
              "word-break": "break-word",
            }}
          >
            {checkoutError()}
          </div>
        </Show>
      </div>
    </>
  );
};

export const ProjectStatusBar: Component<{
  diffOpen: boolean;
  onToggleDiff: () => void;
}> = (props) => {
  const theme = useTheme();
  const info = useContext(WorkspaceInfoContext);
  const [menuOpen, setMenuOpen] = createSignal(false);

  const branchLabel = (): string | null => {
    const git = info.gitStatus();
    return git?.branch ?? info.branch();
  };

  const leadingChips = (): ChipSpec[] => {
    const t = theme();
    const out: ChipSpec[] = [];
    const ver = info.node();
    if (ver) out.push({ icon: "node", label: ver, color: t.green });
    return out;
  };

  // Static chips that appear ahead of the (clickable) git-status chip.
  // Sync state stays static because it's branch-level metadata, not something
  // the diff panel can drill into.
  const syncChip = (): ChipSpec | null => {
    const t = theme();
    const git = info.gitStatus();
    if (!git) return null;
    const parts = [
      git.ahead > 0 ? `↑${git.ahead}` : null,
      git.behind > 0 ? `↓${git.behind}` : null,
    ].filter(Boolean);
    if (parts.length === 0) return null;
    return { icon: "branch", label: parts.join(" "), color: t.blue };
  };

  // The clickable dirty/clean chip — opens the diff drawer.
  const statusChip = (): ChipSpec | null => {
    const t = theme();
    const git = info.gitStatus();
    if (!git) return null;
    if (git.dirty) {
      const changedLines = [
        git.additions > 0 ? `+${git.additions}` : null,
        git.deletions > 0 ? `-${git.deletions}` : null,
      ].filter(Boolean);
      return {
        icon: "dot",
        label: changedLines.length > 0 ? changedLines.join(" ") : "dirty",
        color: t.yellow,
      };
    }
    return { icon: "dot", label: "clean", color: t.green };
  };

  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        gap: "6px",
        padding: "8px 10px",
        "border-top": `1px solid ${theme().border}`,
        background: theme().chrome,
        "flex-shrink": 0,
        "justify-content": "flex-end",
        position: "relative",
      }}
    >
      <For each={leadingChips()}>{(c) => <StaticChip {...c} />}</For>
      <Show when={branchLabel() && info.cwd()}>
        <div style={{ position: "relative" }}>
          <BranchChip
            label={branchLabel()!}
            open={menuOpen()}
            onToggle={() => setMenuOpen((o) => !o)}
          />
          <Show when={menuOpen()}>
            <BranchMenu
              cwd={info.cwd()!}
              current={branchLabel()}
              onClose={() => setMenuOpen(false)}
              onCheckedOut={() => info.refreshGit()}
            />
          </Show>
        </div>
      </Show>
      <Show when={syncChip()}>
        {(chip) => <StaticChip {...chip()} />}
      </Show>
      <Show when={info.cwd() && statusChip()}>
        {(chip) => (
          <GitStatusChip
            {...chip()}
            open={props.diffOpen}
            onToggle={props.onToggleDiff}
          />
        )}
      </Show>
    </div>
  );
};
