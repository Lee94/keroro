import { Match, Show, Switch, type Component } from "solid-js";
import { rad } from "../themes";
import { useTheme } from "../ui/useTheme";
import {
  ClaudeCodeMascot,
  CodexMascot,
  TerminalMascot,
} from "../mascots";
import type { AgentKind, ChatAgentKind } from "../panes/types";

const AgentHeader: Component<{ kind: AgentKind }> = (props) => {
  const theme = useTheme();
  const info = () => {
    const t = theme();
    switch (props.kind) {
      case "claude":
        return {
          title: "Claude Code",
          version: "v2.3.41",
          model: "Opus 4.7 (1M context) with xhigh eff…",
          plan: "Claude Max",
          path: "~/Github/orchid-cli",
          mascot: (
            <ClaudeCodeMascot size={56} primary={t.pixelCoral} shadow={t.bg} />
          ),
        };
      case "codex":
        return {
          title: "Codex CLI",
          version: "v0.18.2",
          model: "gpt-5.1 high reasoning, web search on",
          plan: "Pro tier",
          path: "~/Github/orchid-cli",
          mascot: <CodexMascot size={56} primary={t.pixelBlue} />,
        };
      case "terminal":
        return {
          title: "Shell",
          version: "/bin/zsh 5.9",
          model: "iTerm2 compat • ANSI 256",
          plan: "",
          path: "~/Github/orchid-cli",
          mascot: <TerminalMascot size={56} color={t.pixelGreen} />,
        };
    }
  };
  return (
    <div
      style={{
        padding: "18px 22px 12px",
        display: "flex",
        gap: "16px",
        "align-items": "flex-start",
      }}
    >
      {info().mascot}
      <div
        style={{
          flex: 1,
          "font-family": "var(--mono)",
          "font-size": "12.5px",
          "line-height": 1.55,
          color: theme().textDim,
        }}
      >
        <div>
          <span style={{ color: theme().text, "font-weight": 600 }}>
            {info().title}
          </span>{" "}
          <span style={{ color: theme().textMuted }}>{info().version}</span>
        </div>
        <div>{info().model}</div>
        <Show when={info().plan}>
          <div>{info().plan}</div>
        </Show>
        <div style={{ color: theme().textMuted }}>{info().path}</div>
      </div>
    </div>
  );
};

const ClaudeChat: Component = () => {
  const theme = useTheme();
  return (
    <div
      style={{
        padding: "4px 22px 16px",
        "font-family": "var(--mono)",
        "font-size": "13px",
        "line-height": 1.65,
      }}
    >
      <div style={{ display: "flex", gap: "10px", "margin-top": "18px" }}>
        <span style={{ color: theme().accent }}>›</span>
        <span style={{ color: theme().text }}>
          refactor the streaming parser to use async iterators
        </span>
      </div>

      <div style={{ display: "flex", gap: "10px", "margin-top": "18px" }}>
        <span style={{ color: theme().green, "margin-top": "5px" }}>●</span>
        <div style={{ color: theme().text, flex: 1 }}>
          I'll convert{" "}
          <span style={{ color: theme().accent }}>parser.ts</span> from a
          push-based callback API to an async iterator. This lets callers use{" "}
          <span style={{ color: theme().accent }}>for await...of</span> and drop
          the manual buffer juggling.
        </div>
      </div>

      <div
        style={{
          "margin-top": "12px",
          "margin-left": "22px",
          color: theme().textMuted,
          "font-size": "12px",
        }}
      >
        Reading{" "}
        <span style={{ color: theme().amber }}>src/streaming/parser.ts</span>{" "}
        (412 lines)
      </div>
      <div
        style={{
          "margin-top": "4px",
          "margin-left": "22px",
          color: theme().textMuted,
          "font-size": "12px",
        }}
      >
        Editing{" "}
        <span style={{ color: theme().amber }}>src/streaming/parser.ts</span> —
        3 hunks
      </div>

      <div
        style={{
          "margin-top": "14px",
          "margin-left": "22px",
          padding: "10px 14px",
          background: theme().panelDeep,
          border: `1px solid ${theme().border}`,
          "border-radius": rad(theme(), 8),
          "font-size": "12px",
        }}
      >
        <div style={{ color: theme().green }}>
          {"+ export async function* parseStream(input: ReadableStream) {"}
        </div>
        <div style={{ color: theme().green }}>
          + const reader = input.getReader();
        </div>
        <div style={{ color: theme().green }}>+ let buffer = '';</div>
        <div style={{ color: theme().green }}>{"+ while (true) {"}</div>
        <div style={{ color: theme().green }}>
          {"+ const { done, value } = await reader.read();"}
        </div>
        <div style={{ color: theme().green }}>+ if (done) break;</div>
        <div style={{ color: theme().green }}>
          + yield* parseChunk(buffer + value);
        </div>
        <div style={{ color: theme().green }}>{"+ }"}</div>
        <div style={{ color: theme().green }}>{"+ }"}</div>
      </div>

      <div
        style={{
          "margin-top": "14px",
          color: theme().textMuted,
          "font-size": "12px",
        }}
      >
        <span style={{ color: theme().accent }}>*</span> Distilling for 6s ·
        1,847 tokens
      </div>

      <div
        style={{
          margin: "20px 0 14px",
          "border-top": `1px solid ${theme().border}`,
        }}
      />

      <div style={{ display: "flex", gap: "10px", "align-items": "center" }}>
        <span style={{ color: theme().accent }}>›</span>
        <span style={{ color: theme().textMuted }}>run the tests</span>
        <span
          class="caret"
          style={{
            display: "inline-block",
            width: "7px",
            height: "14px",
            background: theme().accent,
            "margin-left": "1px",
          }}
        />
      </div>

      <div
        style={{
          "margin-top": "16px",
          "font-size": "11px",
          color: theme().textMuted,
          display: "flex",
          gap: "6px",
          "flex-wrap": "wrap",
        }}
      >
        <span style={{ color: theme().amber }}>orchid-cli</span>
        <span>(main)</span>
        <span>Opus 4.7 (1M context)</span>
        <span>[ctx: 96.3k · 8% ]</span>
      </div>
    </div>
  );
};

const CodexChat: Component = () => {
  const theme = useTheme();
  return (
    <div
      style={{
        padding: "4px 22px 16px",
        "font-family": "var(--mono)",
        "font-size": "13px",
        "line-height": 1.65,
      }}
    >
      <div style={{ display: "flex", gap: "10px", "margin-top": "18px" }}>
        <span style={{ color: theme().blue }}>›</span>
        <span style={{ color: theme().text }}>
          why is router.test flaky on CI?
        </span>
      </div>

      <div style={{ display: "flex", gap: "10px", "margin-top": "16px" }}>
        <span style={{ color: theme().blue, "margin-top": "5px" }}>◆</span>
        <div style={{ color: theme().text, flex: 1 }}>
          Looking at{" "}
          <span style={{ color: theme().blue }}>router.test.ts</span> — the
          timeouts are tight (50ms) and CI runners have higher event-loop
          jitter than your M2. Three options:
        </div>
      </div>

      <div
        style={{
          "margin-left": "22px",
          "margin-top": "10px",
          color: theme().textDim,
        }}
      >
        <div>1. Bump per-test timeout to 200ms</div>
        <div>
          2. Mock <span style={{ color: theme().blue }}>setTimeout</span> with
          fake timers
        </div>
        <div>
          3. Run with{" "}
          <span style={{ color: theme().blue }}>--maxWorkers=1</span> on CI
          only
        </div>
      </div>

      <div
        style={{
          "margin-top": "14px",
          "margin-left": "22px",
          color: theme().textMuted,
          "font-size": "12px",
        }}
      >
        ↳ I'd lean toward option 2 — deterministic and keeps CI fast.
      </div>

      <div
        style={{
          margin: "20px 0 14px",
          "border-top": `1px solid ${theme().border}`,
        }}
      />

      <div style={{ display: "flex", gap: "10px", "align-items": "center" }}>
        <span style={{ color: theme().blue }}>›</span>
        <span
          class="caret"
          style={{
            display: "inline-block",
            width: "7px",
            height: "14px",
            background: theme().blue,
          }}
        />
      </div>

      <div
        style={{
          "margin-top": "16px",
          "font-size": "11px",
          color: theme().textMuted,
          display: "flex",
          gap: "6px",
          "flex-wrap": "wrap",
        }}
      >
        <span style={{ color: theme().blue }}>orchid-cli</span>
        <span>(main)</span>
        <span>gpt-5.1 · high</span>
        <span>[ctx: 41.2k · 3% ]</span>
      </div>
    </div>
  );
};

export const AgentContent: Component<{ kind: ChatAgentKind }> = (props) => {
  const theme = useTheme();
  return (
    <div style={{ flex: 1, overflow: "auto", background: theme().panel }}>
      <AgentHeader kind={props.kind} />
      <Switch>
        <Match when={props.kind === "claude"}>
          <ClaudeChat />
        </Match>
        <Match when={props.kind === "codex"}>
          <CodexChat />
        </Match>
      </Switch>
    </div>
  );
};
