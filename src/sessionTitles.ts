import { createSignal } from "solid-js";
import { AGENT_LABEL, type AgentKind, type Tab } from "./panes/types";

// Auto-derived display titles for chat-agent tabs, keyed by cliSessionId.
// Populated by XtermPane on a polling cadence and consumed by TabBar via
// [[displayTabTitle]]. We deliberately don't persist this — it's cheap to
// re-derive from the on-disk JSONL on the next boot.
const [titles, setTitles] = createSignal<Record<string, string>>({});

export const getSessionTitle = (cliSessionId: string): string | undefined =>
  titles()[cliSessionId];

export const setSessionTitle = (cliSessionId: string, title: string): void => {
  setTitles((prev) => {
    if (prev[cliSessionId] === title) return prev;
    return { ...prev, [cliSessionId]: title };
  });
};

export const clearSessionTitle = (cliSessionId: string): void => {
  setTitles((prev) => {
    if (!(cliSessionId in prev)) return prev;
    const { [cliSessionId]: _, ...rest } = prev;
    return rest;
  });
};

// The literal `title` that [[PaneView.handleAdd]] assigns to a brand-new tab
// of `kind`. A tab whose title still equals this is treated as never-renamed
// and is eligible for auto-title display.
export const defaultTabTitle = (kind: AgentKind): string =>
  AGENT_LABEL[kind].toLowerCase().replace(" ", "-");

export const displayTabTitle = (tab: Tab): string => {
  if (tab.kind === "claude" && tab.cliSessionId && tab.title === defaultTabTitle(tab.kind)) {
    const auto = getSessionTitle(tab.cliSessionId);
    if (auto) return auto;
  }
  return tab.title;
};
