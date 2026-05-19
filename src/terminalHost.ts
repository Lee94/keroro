import { createSignal, type Accessor } from "solid-js";

type Entry = {
  host: Accessor<HTMLElement | null>;
  set: (el: HTMLElement | null) => void;
};

const entries = new Map<string, Entry>();

export function terminalHost(
  tabId: string,
): [Accessor<HTMLElement | null>, (el: HTMLElement | null) => void] {
  let entry = entries.get(tabId);
  if (!entry) {
    const [host, setHost] = createSignal<HTMLElement | null>(null);
    entry = { host, set: setHost };
    entries.set(tabId, entry);
  }
  return [entry.host, entry.set];
}

export function releaseTerminalHost(tabId: string) {
  entries.delete(tabId);
}
