import { useEffect, useRef, useState, type WheelEvent, type MouseEvent } from "react";
import { FigmaRenderer } from "@figma-render/renderer";
import { useAppStore } from "../state/store.js";

/**
 * Pannable, zoomable viewport for the rendered Figma tree.
 * - Wheel: zoom toward cursor.
 * - Drag: pan.
 * - Hover/click: highlight & select nodes via event delegation on `[data-figma-id]`.
 */
export function Canvas() {
  const bundle = useAppStore((s) => s.bundle);
  const pageId = useAppStore((s) => s.pageId);
  const zoom = useAppStore((s) => s.zoom);
  const setZoom = useAppStore((s) => s.setZoom);
  const hoveredId = useAppStore((s) => s.hoveredId);
  const selectedId = useAppStore((s) => s.selectedId);
  const setHovered = useAppStore((s) => s.setHovered);
  const setSelected = useAppStore((s) => s.setSelected);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{
    startX: number;
    startY: number;
    basePan: { x: number; y: number };
    moved: boolean;
  } | null>(null);

  // Reset pan & zoom when the page changes.
  useEffect(() => {
    setPan({ x: 32, y: 32 });
  }, [pageId, bundle?.fileKey]);

  if (!bundle) {
    return (
      <div style={emptyStyle}>
        <p>Load a Figma file to begin.</p>
      </div>
    );
  }

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return; // require modifier so page scroll still works
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.002);
    setZoom(zoom * factor);
  };

  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      basePan: pan,
      moved: false,
    };
  };
  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    // Drag-to-pan: only treat as pan after a small threshold so a click+release
    // doesn't accidentally cancel selection.
    if (drag.current) {
      const dx = e.clientX - drag.current.startX;
      const dy = e.clientY - drag.current.startY;
      if (drag.current.moved || Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        drag.current.moved = true;
        setPan({ x: drag.current.basePan.x + dx, y: drag.current.basePan.y + dy });
      }
      return;
    }
    // Hover detection: walk up to find the nearest element carrying a data-figma-id.
    const id = nearestNodeId(e.target as Element);
    if (id !== hoveredId) setHovered(id);
  };
  const onMouseLeave = () => {
    drag.current = null;
    setHovered(null);
  };
  const onMouseUp = (e: MouseEvent<HTMLDivElement>) => {
    const wasDrag = drag.current?.moved ?? false;
    drag.current = null;
    if (wasDrag) return;
    const id = nearestNodeId(e.target as Element);
    setSelected(id);
  };

  return (
    <div
      style={canvasStyle}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      <HighlightStyles hoveredId={hoveredId} selectedId={selectedId} />
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        <FigmaRenderer bundle={bundle} pageId={pageId ?? undefined} />
      </div>
      <div style={zoomBadge}>{Math.round(zoom * 100)}% · ⌘/Ctrl+wheel to zoom · drag to pan · click to select</div>
    </div>
  );
}

/**
 * Walk up the DOM from `el` to the first ancestor carrying `data-figma-id`,
 * which the renderer attaches to every node wrapper.
 */
function nearestNodeId(el: Element | null): string | null {
  if (!el) return null;
  const hit = el.closest("[data-figma-id]") as HTMLElement | null;
  return hit?.dataset.figmaId ?? null;
}

/**
 * Inject scoped CSS so hover/selection stays purely visual and never mutates
 * node styles managed by the renderer. We use CSS attribute selectors with
 * fixed-width (1px / 2px) outlines so highlight thickness doesn't compound
 * with the canvas zoom transform.
 */
function HighlightStyles({
  hoveredId,
  selectedId,
}: {
  hoveredId: string | null;
  selectedId: string | null;
}) {
  // Escape ids the same way Figma uses them: `0:1`, `123;I0;0` etc. CSS
  // attribute selectors handle these as-is via attr="value", so just JSON-quote.
  const rules: string[] = [];
  if (hoveredId && hoveredId !== selectedId) {
    rules.push(
      `[data-figma-id=${JSON.stringify(hoveredId)}]{outline:1px solid rgba(80,160,255,0.9);outline-offset:0;}`,
    );
  }
  if (selectedId) {
    rules.push(
      `[data-figma-id=${JSON.stringify(selectedId)}]{outline:2px solid rgba(80,160,255,1);outline-offset:0;}`,
    );
  }
  if (!rules.length) return null;
  return <style>{rules.join("\n")}</style>;
}

const canvasStyle: React.CSSProperties = {
  position: "relative",
  flex: 1,
  overflow: "hidden",
  background: "#1e1e1e",
  cursor: "grab",
};

const emptyStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#888",
};

const zoomBadge: React.CSSProperties = {
  position: "absolute",
  bottom: 12,
  right: 12,
  background: "rgba(0,0,0,0.6)",
  padding: "4px 8px",
  borderRadius: 4,
  fontSize: 11,
  color: "#bbb",
  pointerEvents: "none",
};
