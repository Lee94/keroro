import { createSignal } from "solid-js";

// Global, transient UI mode: a pane-divider is being dragged. Every visible
// XtermPane suppresses `fit()` + `pty_resize` while this is true (both are
// expensive at mouse-move rate and produce no real value until the user lets
// go), then refits once when it flips back to false.
const [splitDragging, setSplitDragging] = createSignal(false);
export { splitDragging, setSplitDragging };
