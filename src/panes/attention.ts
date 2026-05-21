import { createSignal } from "solid-js";

// Tab ids whose terminals are currently showing a prompt we believe is
// waiting for the user (claude/codex permission, generic y/n, inquirer-style
// menu). Drives the small yellow dot on the tab and on its workspace row.
// Module-level because the signal is global UI state; XtermPane writes,
// TabBar + Sidebar read.
const [attentionTabs, setAttentionTabs] = createSignal<ReadonlySet<string>>(
  new Set(),
);

export const needsAttentionTabs = attentionTabs;

export const setNeedsAttention = (tabId: string, on: boolean) => {
  const cur = attentionTabs();
  if (on === cur.has(tabId)) return;
  const next = new Set(cur);
  if (on) next.add(tabId);
  else next.delete(tabId);
  setAttentionTabs(next);
};

export const clearAttention = (tabId: string) => setNeedsAttention(tabId, false);

// Heuristics for "the TTY is parked at a prompt that wants a user answer".
// Conservative on purpose: two or more numbered options on the tail, or a
// classic (y/n) / [Y/n] form. False positives clear themselves on the next
// scan after the prompt scrolls off or claude consumes the answer.
const NUMBERED_CHOICE = /^[❯>•·\s]*\d+\.\s+\S/;
const YN_PROMPT = /\([yY]\/[nN]\)|\[[yY]\/[nN]\]|\([yY]es\/[nN]o\)/;

export function detectAttention(tailLines: readonly string[]): boolean {
  let numbered = 0;
  let joined = "";
  for (const raw of tailLines) {
    const line = raw.trim();
    if (!line) continue;
    if (NUMBERED_CHOICE.test(line)) numbered++;
    joined += line + "\n";
  }
  if (numbered >= 2) return true;
  if (YN_PROMPT.test(joined)) return true;
  return false;
}
