import { Match, Switch, type Component } from "solid-js";
import {
  ClaudeCodeMascot,
  CodexMascot,
  TerminalMascot,
} from "../mascots";
import { useTheme } from "../ui/useTheme";
import type { AgentKind } from "./types";

export const AgentMascot: Component<{ kind: AgentKind; size?: number }> = (
  props,
) => {
  const theme = useTheme();
  return (
    <Switch>
      <Match when={props.kind === "terminal"}>
        <TerminalMascot size={props.size ?? 14} color={theme().pixelGreen} />
      </Match>
      <Match when={props.kind === "claude"}>
        <ClaudeCodeMascot
          size={props.size ?? 14}
          primary={theme().pixelCoral}
          shadow={theme().bg}
        />
      </Match>
      <Match when={props.kind === "codex"}>
        <CodexMascot
          size={props.size ?? 14}
          primary={theme().pixelBlue}
          highlight="#bfdcff"
        />
      </Match>
    </Switch>
  );
};
