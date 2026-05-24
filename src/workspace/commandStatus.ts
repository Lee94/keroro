import type { Theme } from "../themes";
import type { DictKey } from "../i18n";
import type { CommandRunState } from "../persistence";

export function statusColor(state: CommandRunState, theme: Theme): string {
  switch (state) {
    case "running":
      return theme.amber;
    case "success":
      return theme.pixelGreen;
    case "failed":
      return theme.red;
    case "killed":
      return theme.textMuted;
    case "idle":
    default:
      return theme.border;
  }
}

export function statusLabelKey(state: CommandRunState): DictKey {
  switch (state) {
    case "running":
      return "commandStatusRunning";
    case "success":
      return "commandStatusSuccess";
    case "failed":
      return "commandStatusFailed";
    case "killed":
      return "commandStatusKilled";
    case "idle":
    default:
      return "commandStatusIdle";
  }
}
