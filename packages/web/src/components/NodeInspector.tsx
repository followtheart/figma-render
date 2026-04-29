import { useMemo } from "react";
import { indexDocument, type Node } from "@figma-render/core";
import { useAppStore } from "../state/store.js";

/**
 * Right-side panel showing the currently selected (or hovered, when nothing
 * is selected) Figma node's key properties. Re-indexes the document each
 * render — cheap relative to the renderer cost and keeps inspection in sync
 * without coordinating with the renderer's own context.
 */
export function NodeInspector() {
  const bundle = useAppStore((s) => s.bundle);
  const selectedId = useAppStore((s) => s.selectedId);
  const hoveredId = useAppStore((s) => s.hoveredId);
  const setSelected = useAppStore((s) => s.setSelected);

  const targetId = selectedId ?? hoveredId;

  const node = useMemo<Node | null>(() => {
    if (!bundle || !targetId) return null;
    const idx = indexDocument({ ...bundle } as never);
    // Selected ids may be remapped clones from resolveInstance (e.g. "200:1;I0").
    // Try the exact id first, then strip the override suffix to fall back to
    // the master node that actually lives in the document tree.
    const direct = idx.byId.get(targetId);
    if (direct) return direct;
    const semi = targetId.indexOf(";");
    if (semi !== -1) return idx.byId.get(targetId.slice(0, semi)) ?? null;
    return null;
  }, [bundle, targetId]);

  if (!bundle) return null;

  return (
    <aside style={panelStyle}>
      <div style={headerStyle}>
        <span style={{ fontWeight: 600 }}>Inspector</span>
        {selectedId && (
          <button
            type="button"
            onClick={() => setSelected(null)}
            style={clearBtnStyle}
            title="Clear selection"
          >
            clear
          </button>
        )}
      </div>
      {!node ? (
        <p style={hintStyle}>Hover or click a node on the canvas to inspect it.</p>
      ) : (
        <NodeDetails node={node} />
      )}
    </aside>
  );
}

function NodeDetails({ node }: { node: Node }) {
  const bbox = (node as Node & { absoluteBoundingBox?: { x: number; y: number; width: number; height: number } })
    .absoluteBoundingBox;
  const fills = (node as Node & { fills?: readonly { type?: string; visible?: boolean }[] }).fills;
  const strokes = (node as Node & { strokes?: readonly { type?: string }[] }).strokes;
  const opacity = (node as Node & { opacity?: number }).opacity;
  const blendMode = (node as Node & { blendMode?: string }).blendMode;
  const cornerRadius = (node as Node & { cornerRadius?: number }).cornerRadius;
  const characters = (node as Node & { characters?: string }).characters;
  const layoutMode = (node as Node & { layoutMode?: string }).layoutMode;
  const componentId = (node as Node & { componentId?: string }).componentId;
  const visible = (node as Node & { visible?: boolean }).visible;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Row label="ID" value={node.id} mono />
      <Row label="Type" value={node.type} />
      <Row label="Name" value={(node as Node & { name?: string }).name ?? "—"} />
      {visible === false && <Row label="Visible" value="false" />}
      {bbox && (
        <Row
          label="Bounds"
          value={`${round(bbox.x)}, ${round(bbox.y)} · ${round(bbox.width)}×${round(bbox.height)}`}
        />
      )}
      {layoutMode && <Row label="Layout" value={layoutMode} />}
      {opacity !== undefined && opacity !== 1 && <Row label="Opacity" value={opacity.toFixed(2)} />}
      {blendMode && blendMode !== "PASS_THROUGH" && blendMode !== "NORMAL" && (
        <Row label="Blend" value={blendMode} />
      )}
      {cornerRadius !== undefined && <Row label="Radius" value={`${cornerRadius}px`} />}
      {fills && fills.length > 0 && (
        <Row label="Fills" value={fills.map((f) => f.type ?? "?").join(", ")} />
      )}
      {strokes && strokes.length > 0 && (
        <Row label="Strokes" value={strokes.map((s) => s.type ?? "?").join(", ")} />
      )}
      {componentId && <Row label="Master" value={componentId} mono />}
      {characters !== undefined && (
        <div>
          <div style={labelStyle}>Characters</div>
          <pre style={textBoxStyle}>{characters}</pre>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
      <div style={labelStyle}>{label}</div>
      <div
        style={{
          flex: 1,
          color: "#e6e6e6",
          fontFamily: mono ? "ui-monospace, monospace" : undefined,
          wordBreak: "break-all",
          fontSize: 12,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

const panelStyle: React.CSSProperties = {
  width: 260,
  borderLeft: "1px solid #333",
  background: "#1a1a1a",
  color: "#ddd",
  padding: 12,
  overflowY: "auto",
  fontSize: 12,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  paddingBottom: 8,
  borderBottom: "1px solid #2a2a2a",
};

const clearBtnStyle: React.CSSProperties = {
  background: "transparent",
  color: "#88a",
  border: "1px solid #333",
  borderRadius: 3,
  padding: "2px 6px",
  fontSize: 11,
  cursor: "pointer",
};

const labelStyle: React.CSSProperties = {
  width: 64,
  color: "#888",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const hintStyle: React.CSSProperties = {
  color: "#777",
  fontSize: 12,
  lineHeight: 1.5,
};

const textBoxStyle: React.CSSProperties = {
  background: "#111",
  border: "1px solid #2a2a2a",
  borderRadius: 4,
  padding: 8,
  margin: "4px 0 0",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  maxHeight: 160,
  overflowY: "auto",
  fontSize: 12,
  color: "#cfcfcf",
};
