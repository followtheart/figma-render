import type { Paint } from "@figma-render/core";
import { colorToCss, round } from "./color.js";

interface StrokeNode {
  strokes?: readonly Paint[];
  strokeWeight?: number;
  individualStrokeWeights?: { top: number; right: number; bottom: number; left: number };
  strokeAlign?: "INSIDE" | "OUTSIDE" | "CENTER";
  strokeDashes?: readonly number[];
}

/**
 * Convert Figma strokes to CSS border / outline / box-shadow.
 *
 * - INSIDE  -> border (sits inside the bounding box)
 * - OUTSIDE -> box-shadow with 0 blur, positive spread
 * - CENTER  -> border (closest CSS approximation)
 *
 * Dashed strokes are mapped to `border-style: dashed`. Per-side stroke weights
 * fall back to per-side borders.
 */
export function strokeToCss(node: StrokeNode): React.CSSProperties {
  const strokes = node.strokes?.filter((p) => p.visible !== false);
  if (!strokes || strokes.length === 0) return {};

  const first = strokes.find((p) => p.type === "SOLID");
  if (!first || first.type !== "SOLID") return {};
  const color = colorToCss(first.color, first.opacity ?? 1);

  const align = node.strokeAlign ?? "INSIDE";
  const dashed = node.strokeDashes && node.strokeDashes.length > 0;
  const baseStyle: "solid" | "dashed" = dashed ? "dashed" : "solid";

  if (align === "OUTSIDE") {
    const w = node.strokeWeight ?? 1;
    return { boxShadow: `0 0 0 ${round(w, 3)}px ${color}` };
  }

  const ind = node.individualStrokeWeights;
  if (ind && (ind.top !== ind.right || ind.right !== ind.bottom || ind.bottom !== ind.left)) {
    const out: React.CSSProperties = { borderStyle: baseStyle, borderColor: color };
    if (ind.top) out.borderTopWidth = round(ind.top, 3);
    if (ind.right) out.borderRightWidth = round(ind.right, 3);
    if (ind.bottom) out.borderBottomWidth = round(ind.bottom, 3);
    if (ind.left) out.borderLeftWidth = round(ind.left, 3);
    return out;
  }

  const w = node.strokeWeight ?? ind?.top ?? 1;
  return {
    borderStyle: baseStyle,
    borderColor: color,
    borderWidth: round(w, 3),
  };
}
