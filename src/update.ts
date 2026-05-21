import { createSignal } from "solid-js";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "ready"
  | "error";

export type PendingUpdate = {
  version: string;
  currentVersion: string;
  date?: string;
  body?: string;
};

const [status, setStatus] = createSignal<UpdateStatus>("idle");
const [pending, setPending] = createSignal<PendingUpdate | null>(null);
const [progress, setProgress] = createSignal<{ done: number; total: number | null }>({
  done: 0,
  total: null,
});
const [errorMsg, setErrorMsg] = createSignal<string | null>(null);
const [bannerDismissed, setBannerDismissed] = createSignal(false);

let currentUpdate: Update | null = null;
let booted = false;

export const updateStatus = status;
export const pendingUpdate = pending;
export const updateProgress = progress;
export const updateError = errorMsg;
export const updateBannerDismissed = bannerDismissed;

export function dismissUpdateBanner(): void {
  setBannerDismissed(true);
}

// The Tauri updater throws when the app is run from a dev shell or when the
// signing pubkey is the placeholder. We swallow those so the UI never surfaces
// "Update check failed" during local development — only real release builds
// hitting a live endpoint will see actionable errors.
function isExpectedDevError(err: unknown): boolean {
  const msg = String(err ?? "").toLowerCase();
  return (
    msg.includes("public key") ||
    msg.includes("pubkey") ||
    msg.includes("endpoint") ||
    msg.includes("network") ||
    msg.includes("dns") ||
    msg.includes("connect")
  );
}

export async function checkForUpdates(opts: { silent?: boolean } = {}): Promise<void> {
  const silent = opts.silent ?? false;
  setErrorMsg(null);
  setStatus("checking");
  try {
    const update = await check();
    if (!update) {
      currentUpdate = null;
      setPending(null);
      setStatus("up-to-date");
      return;
    }
    currentUpdate = update;
    setPending({
      version: update.version,
      currentVersion: update.currentVersion,
      date: update.date ?? undefined,
      body: update.body ?? undefined,
    });
    setBannerDismissed(false);
    setStatus("available");
  } catch (err) {
    if (silent && isExpectedDevError(err)) {
      setStatus("idle");
      return;
    }
    setErrorMsg(String(err));
    setStatus("error");
  }
}

export async function installPendingUpdate(): Promise<void> {
  const update = currentUpdate;
  if (!update) return;
  setErrorMsg(null);
  setStatus("downloading");
  setProgress({ done: 0, total: null });
  try {
    let downloaded = 0;
    let total: number | null = null;
    await update.downloadAndInstall((event) => {
      if (event.event === "Started") {
        total = event.data.contentLength ?? null;
        setProgress({ done: 0, total });
      } else if (event.event === "Progress") {
        downloaded += event.data.chunkLength;
        setProgress({ done: downloaded, total });
      } else if (event.event === "Finished") {
        setProgress({ done: downloaded, total });
      }
    });
    setStatus("ready");
    // On Windows + NSIS "passive" installMode the installer takes over and
    // restarts the app itself, so relaunch() is mostly a no-op there. On
    // macOS the .app is swapped in place and we must trigger relaunch
    // ourselves.
    await relaunch();
  } catch (err) {
    setErrorMsg(String(err));
    setStatus("error");
  }
}

// Boot check — runs once per app launch from App.onMount.
export function bootUpdateCheck(): void {
  if (booted) return;
  booted = true;
  // Defer a few seconds so the cold-boot path (DB load, layout restore, PTY
  // spawn) isn't competing with a network round-trip + signature verify.
  setTimeout(() => {
    void checkForUpdates({ silent: true });
  }, 4000);
}
