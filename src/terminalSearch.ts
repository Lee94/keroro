import { createSignal, type Accessor } from "solid-js";

export type SearchOps = {
  findNext: (q: string) => boolean;
  findPrev: (q: string) => boolean;
  clear: () => void;
  focusTerminal: () => void;
};

export type ResultInfo = { index: number; count: number } | null;

type Entry = {
  open: Accessor<boolean>;
  setOpen: (v: boolean) => void;
  query: Accessor<string>;
  setQuery: (v: string) => void;
  results: Accessor<ResultInfo>;
  setResults: (v: ResultInfo) => void;
  ops: Accessor<SearchOps | null>;
  setOps: (ops: SearchOps | null) => void;
  // Bumped each time the user re-triggers Ctrl/Cmd+F so the search bar can
  // refocus + select its input even when it is already open.
  focusBump: Accessor<number>;
  bumpFocus: () => void;
};

const entries = new Map<string, Entry>();

function getOrCreate(tabId: string): Entry {
  let e = entries.get(tabId);
  if (!e) {
    const [open, setOpen] = createSignal(false);
    const [query, setQuery] = createSignal("");
    const [results, setResults] = createSignal<ResultInfo>(null);
    const [ops, setOps] = createSignal<SearchOps | null>(null);
    const [focusBump, setFocusBump] = createSignal(0);
    e = {
      open,
      setOpen,
      query,
      setQuery,
      results,
      setResults,
      ops,
      setOps,
      focusBump,
      bumpFocus: () => setFocusBump((n) => n + 1),
    };
    entries.set(tabId, e);
  }
  return e;
}

export function useTerminalSearch(tabId: string): Entry {
  return getOrCreate(tabId);
}

export function setTerminalSearchOps(
  tabId: string,
  ops: SearchOps | null,
): void {
  getOrCreate(tabId).setOps(ops);
}

export function openTerminalSearch(tabId: string): void {
  const e = getOrCreate(tabId);
  e.setOpen(true);
  e.bumpFocus();
}

export function closeTerminalSearch(tabId: string): void {
  const e = entries.get(tabId);
  if (!e) return;
  e.setOpen(false);
  e.ops()?.clear();
  e.setResults(null);
}

export function releaseTerminalSearch(tabId: string): void {
  entries.delete(tabId);
}
