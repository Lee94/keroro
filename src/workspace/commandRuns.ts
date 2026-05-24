import { createSignal } from "solid-js";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  fetchCommandOutput,
  killCommandBg,
  runCommandBg,
  type CommandRunState,
  type CommandSnapshot,
  type CommandStatusEvent,
  type ProjectCommandRow,
} from "../persistence";

export interface CommandRunInfo {
  state: CommandRunState;
  exitCode: number | null;
  startedAt: number | null;
  finishedAt: number | null;
}

const IDLE: CommandRunInfo = {
  state: "idle",
  exitCode: null,
  startedAt: null,
  finishedAt: null,
};

// Module-level signal: keroro is a single-window app, so one global run-state
// map is simpler than threading per-component subscriptions. Mirrors the
// pattern in src/panes/attention.ts.
const [runs, setRuns] = createSignal<ReadonlyMap<string, CommandRunInfo>>(
  new Map(),
);

export const commandRuns = runs;

export function commandRunInfo(commandId: string): CommandRunInfo {
  return runs().get(commandId) ?? IDLE;
}

function setRunInfo(commandId: string, info: CommandRunInfo) {
  const next = new Map(runs());
  next.set(commandId, info);
  setRuns(next);
}

let unlistenStatus: UnlistenFn | null = null;
let starting: Promise<void> | null = null;

export function startCommandRunListener(): Promise<void> {
  if (unlistenStatus) return Promise.resolve();
  if (starting) return starting;
  starting = (async () => {
    unlistenStatus = await listen<CommandStatusEvent>(
      "command://status",
      (event) => {
        const e = event.payload;
        setRunInfo(e.commandId, {
          state: e.state,
          exitCode: e.exitCode,
          startedAt: e.startedAt,
          finishedAt: e.finishedAt,
        });
      },
    );
  })();
  return starting;
}

export async function runProjectCommand(
  cmd: ProjectCommandRow,
  cwd: string,
): Promise<void> {
  // Optimistic local update so the status dot flips to amber before the
  // backend emits its first event (typically <50ms but still observable).
  setRunInfo(cmd.id, {
    state: "running",
    exitCode: null,
    startedAt: Math.floor(Date.now() / 1000),
    finishedAt: null,
  });
  try {
    await runCommandBg(cmd.id, cmd.command, cwd);
  } catch (err) {
    console.error("command_run failed", err);
    setRunInfo(cmd.id, {
      state: "failed",
      exitCode: null,
      startedAt: null,
      finishedAt: Math.floor(Date.now() / 1000),
    });
  }
}

export async function killProjectCommand(commandId: string): Promise<void> {
  try {
    await killCommandBg(commandId);
  } catch (err) {
    console.error("command_kill failed", err);
  }
}

export async function getCommandSnapshot(
  commandId: string,
): Promise<CommandSnapshot> {
  return fetchCommandOutput(commandId);
}
