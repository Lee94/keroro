import { createSignal, Show, type Component, type JSX } from "solid-js";
import { rad } from "../themes";
import { useTheme } from "../ui/useTheme";
import { computeDropSide, useDrag, type DragInfo } from "./drag";
import type { DropSide } from "./types";

const SideHighlight: Component<{ side: DropSide }> = (props) => {
  const theme = useTheme;
  const rectFor = (): JSX.CSSProperties => {
    switch (props.side) {
      case "left":
        return { left: "0", top: "0", width: "50%", height: "100%" };
      case "right":
        return { right: "0", top: "0", width: "50%", height: "100%" };
      case "top":
        return { left: "0", top: "0", width: "100%", height: "50%" };
      case "bottom":
        return { left: "0", bottom: "0", width: "100%", height: "50%" };
      case "center":
        return { inset: "12px" };
    }
  };
  return (
    <div
      style={{
        position: "absolute",
        ...rectFor(),
        background: `${theme().accent}26`,
        border: `2px solid ${theme().accent}`,
        "border-radius": props.side === "center" ? rad(theme(), 10) : "0",
        "pointer-events": "none",
        transition: "all 80ms ease-out",
      }}
    />
  );
};

export const DropOverlay: Component<{
  leafId: string;
  onDrop: (side: DropSide, info: DragInfo) => void;
}> = (props) => {
  const { drag } = useDrag();
  const [side, setSide] = createSignal<DropSide | null>(null);
  let host!: HTMLDivElement;
  return (
    <div
      ref={host!}
      class="faye-drop-overlay"
      onDragOver={(e) => {
        if (!drag()) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        const rect = host.getBoundingClientRect();
        setSide(computeDropSide(rect, e.clientX, e.clientY));
      }}
      onDragLeave={(e) => {
        const r = host.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX >= r.right ||
          e.clientY < r.top ||
          e.clientY >= r.bottom
        ) {
          setSide(null);
        }
      }}
      onDrop={(e) => {
        const info = drag();
        const s = side();
        setSide(null);
        document.body.classList.remove("faye-dragging");
        if (!info || !s) return;
        e.preventDefault();
        props.onDrop(s, info);
      }}
      style={{
        position: "absolute",
        inset: 0,
        "z-index": 50,
      }}
    >
      <Show when={side()}>
        <SideHighlight side={side()!} />
      </Show>
    </div>
  );
};
