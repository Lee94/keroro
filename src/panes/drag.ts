import { createContext, useContext, type Accessor } from "solid-js";
import type { DropSide } from "./types";

export interface DragInfo {
  sourceLeafId: string;
  sourceTabId: string;
}

export const DragContext = createContext<{
  drag: Accessor<DragInfo | null>;
  setDrag: (d: DragInfo | null) => void;
}>({
  drag: () => null,
  setDrag: () => {},
});

export const useDrag = () => useContext(DragContext);

export const TAB_DRAG_MIME = "application/x-faye-tab";

export function computeDropSide(
  rect: DOMRect,
  clientX: number,
  clientY: number,
): DropSide {
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  // Center "no-split" region — middle 40%
  if (x > 0.3 && x < 0.7 && y > 0.3 && y < 0.7) return "center";
  const dLeft = x;
  const dRight = 1 - x;
  const dTop = y;
  const dBottom = 1 - y;
  const min = Math.min(dLeft, dRight, dTop, dBottom);
  if (min === dLeft) return "left";
  if (min === dRight) return "right";
  if (min === dTop) return "top";
  return "bottom";
}
