import { useEffect, useRef, useState, type WheelEvent, type MouseEvent } from "react";
import { FigmaRenderer } from "@figma-render/renderer";
import { useAppStore } from "../state/store.js";

/**
 * Pannable, zoomable viewport for the rendered Figma tree.
 * - Wheel: zoom toward cursor.
 * - Drag: pan.
 */
export function Canvas() {
  const bundle = useAppStore((s) => s.bundle);
  const pageId = useAppStore((s) => s.pageId);
  const zoom = useAppStore((s) => s.zoom);
  const setZoom = useAppStore((s) => s.setZoom);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ startX: number; startY: number; basePan: { x: number; y: number } } | null>(
    null,
  );

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
    drag.current = { startX: e.clientX, startY: e.clientY, basePan: pan };
  };
  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setPan({
      x: drag.current.basePan.x + (e.clientX - drag.current.startX),
      y: drag.current.basePan.y + (e.clientY - drag.current.startY),
    });
  };
  const onMouseUp = () => {
    drag.current = null;
  };

  return (
    <div
      style={canvasStyle}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        <FigmaRenderer bundle={bundle} pageId={pageId ?? undefined} />
      </div>
      <div style={zoomBadge}>{Math.round(zoom * 100)}% · ⌘/Ctrl+wheel to zoom · drag to pan</div>
    </div>
  );
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
