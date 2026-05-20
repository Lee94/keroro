# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.2.0]: https://github.com/Lee94/keroro/releases/tag/v0.2.0
[0.1.0]: https://github.com/Lee94/keroro/releases/tag/v0.1.0
