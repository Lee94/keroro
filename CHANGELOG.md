# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2026-05-28

### Added

- **"Open in editor" status-bar chip** — detects Zed / VS Code / Cursor
  on `PATH` and launches the current project in one click. On macOS the
  detector falls back to looking up the `.app` bundle in `/Applications`
  and `~/Applications` and launching via `/usr/bin/open -a`, so users
  who dragged the editor in and never ran "Install shell command" still
  get the chip. Backed by new `detect_editors` / `open_in_editor` Tauri
  commands and an `editor` icon.
- **Sidebar TERMINALS "+"** — trailing affordance on the section header
  appends a shell tab to the project's first leaf and activates it, so
  you no longer need to dig into the pane to open a new terminal.
- **Diff side panel resize** — drag the left edge to resize the panel;
  width persists across sessions. Hunk rows now wrap in a
  `width: max-content` track so background tints span the full scroll
  width on long lines instead of clipping at the viewport edge.

### Changed

- **Constant-height sidebar project rows** — dropped the
  active/inactive size variants so switching projects only changes
  colors, not row height. Path moved into a tooltip on every row
  (was inline on the active row only), and a divider separates project
  groups.

### Fixed

- **Dead CLI tabs degrade to a shell in place** — when a CLI child
  exits, the tab no longer becomes a useless `[process exited]` box.
  New `pty_respawn_as_shell` spawns a login shell in the same pane so
  the slot stays usable.
- **Windows background commands didn't reap** — reparented grandchildren
  held the supervisor's pipes open. Tear-down now uses
  `taskkill /F /T` so the whole tree closes and the supervisor exits
  cleanly.
- **Terminal freeze on first mount in packaged builds** — `@xterm/*`
  pinned back to `6.x-beta.220`. The beta.226 line's WebGL addon caches
  `screenElement.isConnected` and gates every render on that flag; the
  production Tauri WebView momentarily detaches the terminal container
  during first mount (re-parented through `terminalHost` into the
  active leaf), latching the flag false and freezing the pane until
  manual reload. With the pin reverted, the renderer switches back from
  the canvas addon to `WebglAddon` and the Vite alias workaround for
  the canvas addon's broken `module` field is removed.

## [0.6.1] - 2026-05-26

### Changed

- **Sync version files to released tag** — `package.json`, `Cargo.toml`,
  `tauri.conf.json`, and `Cargo.lock` had drifted to `0.4.2` while
  `v0.5.0` and `v0.6.0` shipped as tags only. Bumped to `0.6.1` and
  backfilled the CHANGELOG entries below.

## [0.6.0] - 2026-05-25

### Added

- **Git diff side panel** — clicking the dirty/clean chip in the status
  bar slides in a per-file diff view on the right. Files are listed
  collapsed (status badge + path + per-file `+/-`); clicking a row
  expands its hunks inline. Untracked files are synthesized as "new
  file" entries so they show alongside tracked modifications. External
  diff tools (`delta`, `difftastic`) are overridden so the parser always
  sees standard unified diff output. Status-bar chip totals mirror the
  panel's totals (untracked lines included).

### Performance

- **Async-first backend** — `tokio::process` for subprocess spawns and
  `tokio::join!` for independent git calls inside `git_diff` and
  `detect_git_status`. Per-file untracked synthesis fans out via
  `tokio::spawn` so a repo with many new files reads them in parallel
  instead of serially. Untracked line counts cache by `mtime + size` so
  the 5s status poll skips re-reading unchanged files. Claude
  session-title polling also moved to async fs.
- **Deferred diff parsing on the frontend** — `parseDiff` runs via
  `createDeferred` so very large diffs don't stall the main thread when
  results land. `DiffView` stays mounted (CSS-hidden) so toggling
  open/close reuses the cached file list instead of re-invoking git.

## [0.5.0] - 2026-05-25

### Added

- **8-theme overhaul** — replaces the 4 prior themes with 8
  brand-inspired palettes (OpenAI, Anthropic, Zed, GitHub × dark/light);
  default switches to `anthropic-dark`. Dedicated cyan/magenta tokens
  (xterm no longer collapses them into `accent`/`blue`). Deeper contrast
  steps (`panelAlt`, `borderStrong`) in light themes so hover/selected
  states read against chrome.
- **Compact theme picker** — select-style dropdown with a mini-swatch
  trigger and a popover swatch grid, replacing the always-expanded grid
  that wasted vertical space as the theme count grew. `RadioRow` gains
  an explicit hover state; selected uses accent border so the three
  states are visually distinct on every theme.
- **Tasks panel** — runtime CPU / memory view of running PTY sessions
  with force-kill, backed by a new `sysinfo`-powered `proc_stats`
  module.
- **Truecolor terminal output** — `COLORTERM=truecolor` exported to PTY
  children so CLIs that gate 24-bit emission on it now produce full
  RGB. ANSI bright-black routes through `textDim` so CLI dim glyphs
  (Claude Code's leading dot, git's dim path segments) stay readable.
- **1px window outline** — theme `border` outline on the outer container
  defines the edge under `decorations: false` + `transparent: true`.

### Changed

- **`ClaudeCodeMascot`** gains a separate highlight (flame) color so the
  ember critter reads as three color zones instead of a single tone.

### Internal

- **`safeWrite` localStorage helper** — `settings/storage.ts` now exposes
  `writeThemeName` / `writeLocale` / `writeSidebarOpen` /
  `writeTermFont*` so `App.tsx` no longer pokes `localStorage` directly.
- **Dead-code sweep** — drop unused exports (`clearSessionTitle`,
  `useLocale`, `CLI_KINDS`, `mixHex`, `isLightTheme`, `brighten`,
  `Theme.name`); drop unused `AddMenu.anchorBelow`, `UpdateBanner`
  button-style arg, `Sidebar.attnTabs` alias, `XtermPane` debug log.
- **Rust cleanups** — `repeat_n` over deprecated `repeat().take()` in
  `db.rs`; drop redundant `&"WAL"` / `&"ON"` refs. Tighten
  `CommandEditorModal` `Field` children type from `any` to `JSX.Element`.

## [0.4.2] - 2026-05-24

### Added

- **Sidebar terminal close button** — hover a terminal row to reveal an `×`
  affordance; previously the only way to close a session was from the in-pane
  tab strip.
- **Confirm dialog before project removal** — clicking the trash icon on a
  workspace now opens a danger-styled confirm with the project name; closes
  the loss-of-work hole on a misclick. The on-disk folder is still left
  untouched.
- **"+ new project" lives in the toolbar** — moved out of the sidebar header
  and the product mascot/wordmark were removed for a cleaner chrome.

### Fixed

- **Packaged app: terminal can't delete CJK / emoji** — Finder-launched .apps
  inherit launchd's stripped env, so `TERM`/`LANG` were absent and the shell
  processed input byte-by-byte. The PTY now injects `TERM=xterm-256color` and
  a UTF-8 locale when missing. Same root cause fixed for piped command runs
  (`exec.rs`) using `TERM=dumb` + `NO_COLOR=1` instead, since their output
  goes to a `<pre>` viewer.
- **Command output modal: garbled ANSI escapes** — pnpm/vite and friends were
  emitting color sequences (`[32m…`) into the modal. Output is now ANSI-stripped
  before display and color is suppressed at spawn time.
- **Command "Stop" didn't actually stop dev servers** — `child.kill()` was
  only killing the wrapping `zsh -l -c`; `pnpm dev` and its node grandchildren
  got reparented to launchd and kept running. The shell is now spawned in its
  own process group and `killpg(SIGTERM)` → `SIGKILL` takes down the whole
  tree.
- **`detect_node_version` failed in packaged builds** — `Command::new("node")`
  relies on PATH lookup, which is empty under launchd. Routed through
  `find_cli` so Homebrew / `~/.local/bin` paths are probed.
- **IME composition doubled letters on switch** — toggling Chinese ↔ English
  mid-composition leaked the pinyin letters through after `compositionend`
  already committed them ("ab" became "abab"). xterm key handler now drops
  `isComposing` / keyCode 229 events.
- **Sidebar terminal title diverged from tab title** — the sidebar read
  `tab.title` directly while the tab bar uses `displayTabTitle()` (which
  falls back to the auto-derived claude session title). Sidebar now uses the
  same helper.

## [0.4.1] - 2026-05-22

Rich git status in footer (ahead/behind, diff lines, dirty).

## [0.4.0] - 2026-05-22

Terminal search and in-app auto-updater.

## [0.3.0] - 2026-05-22

i18n, attention dots, claude resume rotation, boot/switch performance work.

## [0.2.2] - 2026-05-21

### Performance

- **Faster project switching on Windows** — every workspace's pane tree is now
  mounted simultaneously and toggled with `display: none/flex`, so switching
  projects no longer unmounts leaves, re-parents xterm containers, or
  triggers `ResizeObserver`-driven refits across the pane. The visible cost
  is a few extra DOM nodes; the perceived cost was the WebView2 + WebGL
  reflow burst on every click.
- **Cache `detect_node_version` / `detect_git_branch` per cwd** — node
  version is cached for the session (spawning `node.exe --version` on
  Windows is 200–500ms and the value almost never changes); git branch is
  seeded from cache on switch so the footer chip no longer flashes empty
  while the 5s poll runs.

## [0.2.1] - 2026-05-21

### Fixed

- **CI release build** — sync `pnpm-lock.yaml` with the new
  `@xterm/addon-webgl` dependency so `pnpm install --frozen-lockfile` no
  longer fails on the release runners.

### Changed

- **CI**: bump `actions/setup-node` to Node 24 (was 20) to match the version
  used locally.

## [0.2.0] - 2026-05-21

### Added

- **WebGL terminal renderer** via `@xterm/addon-webgl` for noticeably smoother
  scrolling and lower CPU on large output. Falls back to the canvas renderer
  when WebGL is unavailable; auto-reinitializes on context loss.
- **Terminal font size controls** — keyboard shortcuts (`Cmd/Ctrl` + `=` / `-`
  / `0`) and a stepper in the Tweaks panel. Range 8–32px, persisted to
  localStorage, live-applied across every terminal.
- **Terminal font family picker** — 15 curated monospace fonts plus the system
  default. Each option previews in its own font; canvas-measure detection
  grays out fonts that aren't installed locally. CSS fallback chain keeps
  things readable either way. Persisted to localStorage.
- **Rounded transparent window chrome** — Tauri `transparent: true` plus
  `border-radius: 10px` on the root for a softer look on macOS / Windows.

### Changed

- **Frontend refactor**: the ~2,900-line `App.tsx` is broken into focused
  modules under `src/chrome`, `src/workspace`, `src/panes`, `src/agents`,
  `src/settings`, and `src/ui`. `App.tsx` is now a ~630-line root composition.
- **Tighter terminal chrome**: tab bar top padding `6px → 4px`, terminal
  container padding rebalanced to symmetric `4px 10px` so top and bottom no
  longer disagree.
- **Sidebar cleanup**: removed the redundant folder-count footer.

### Removed

- Native OS window shadow (`shadow: false`) — it produced a thin dark contour
  around the transparent window on macOS. Considering a CSS-level
  `drop-shadow` replacement in a future release.

## [0.1.0] - 2025-12-XX

Initial release.

- Tauri shell with custom titlebar, traffic lights / Windows controls.
- Sidebar-driven multi-workspace layout with split panes and drag-to-rearrange tabs.
- PTY-backed terminal tabs and CLI agent tabs (Claude Code, Codex).
- Theme system (Ember / Forest / Plum / Zed Light) and density toggle.
- Per-project persistence of layout, sessions, and active project.
- CI release workflow producing macOS arm64 and Windows builds.

[0.7.0]: https://github.com/Lee94/keroro/releases/tag/v0.7.0
[0.6.1]: https://github.com/Lee94/keroro/releases/tag/v0.6.1
[0.6.0]: https://github.com/Lee94/keroro/releases/tag/v0.6.0
[0.5.0]: https://github.com/Lee94/keroro/releases/tag/v0.5.0
[0.4.2]: https://github.com/Lee94/keroro/releases/tag/v0.4.2
[0.4.1]: https://github.com/Lee94/keroro/releases/tag/v0.4.1
[0.4.0]: https://github.com/Lee94/keroro/releases/tag/v0.4.0
[0.3.0]: https://github.com/Lee94/keroro/releases/tag/v0.3.0
[0.2.2]: https://github.com/Lee94/keroro/releases/tag/v0.2.2
[0.2.1]: https://github.com/Lee94/keroro/releases/tag/v0.2.1
[0.2.0]: https://github.com/Lee94/keroro/releases/tag/v0.2.0
[0.1.0]: https://github.com/Lee94/keroro/releases/tag/v0.1.0
