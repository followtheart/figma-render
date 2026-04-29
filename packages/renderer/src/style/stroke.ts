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
 * Build a `border-image` source from a Figma `strokeDashes` array.
 *
 * `strokeDashes` is an alternating run-length sequence: `[dash, gap, dash, gap, ...]`.
 * We translate it into a `repeating-linear-gradient` (horizontal) that border-image
 * uses to paint each edge.
 *
 * Limitation (CSS): border-image takes a single 2D source and slices it for each
 * side. A horizontal gradient yields the correct dash pattern on top/bottom edges
 * but degenerates to a solid line on the left/right edges (because those slices
 * are taken from one column of the gradient). Customising vertical edges
 * differently would require an SVG overlay element, which is out of scope here.
 */
function buildDashedBorderImage(
  strokeDashes: readonly number[],
  color: string,
): string | null {
  let pos = 0;
  const stops: string[] = [];
  let isDash = true;
  for (const segRaw of strokeDashes) {
    const seg = Number(segRaw);
    if (!Number.isFinite(seg) || seg <= 0) {
      isDash = !isDash;
      continue;
    }
    const next = pos + seg;
    const a = round(pos, 3);
    const b = round(next, 3);
    stops.push(isDash ? `${color} ${a}px ${b}px` : `transparent ${a}px ${b}px`);
    pos = next;
    isDash = !isDash;
  }
  if (stops.length === 0) return null;
  return `repeating-linear-gradient(to right, ${stops.join(", ")})`;
}

/**
 * Convert Figma strokes to CSS border / outline / box-shadow.
 *
 * - INSIDE  -> border (sits inside the bounding box)
 * - OUTSIDE -> box-shadow with 0 blur, positive spread
 * - CENTER  -> border (closest CSS approximation)
 *
 * Dashed strokes:
 *  - When `strokeDashes` is provided, generate a `border-image` from a
 *    `repeating-linear-gradient` that mirrors the Figma `[dash, gap, ...]`
 *    pattern. Falls back to `border-style: dashed` when the array is unusable
 *    or when the stroke is rendered as a box-shadow (OUTSIDE align).
 *  - Per-side stroke weights fall back to per-side borders.
 */
export function strokeToCss(node: StrokeNode): React.CSSProperties {
  const strokes = node.strokes?.filter((p) => p.visible !== false);
  if (!strokes || strokes.length === 0) return {};

  const first = strokes.find((p) => p.type === "SOLID");
  if (!first || first.type !== "SOLID") return {};
  const color = colorToCss(first.color, first.opacity ?? 1);

  const align = node.strokeAlign ?? "INSIDE";
  const hasDashes = !!(node.strokeDashes && node.strokeDashes.length > 0);
  const baseStyle: "solid" | "dashed" = hasDashes ? "dashed" : "solid";

  if (align === "OUTSIDE") {
    // box-shadow can't render dashed; keep solid fallback for OUTSIDE strokes.
    const w = node.strokeWeight ?? 1;
    return { boxShadow: `0 0 0 ${round(w, 3)}px ${color}` };
  }

  const dashImage = hasDashes ? buildDashedBorderImage(node.strokeDashes!, color) : null;

  const ind = node.individualStrokeWeights;
  if (ind && (ind.top !== ind.right || ind.right !== ind.bottom || ind.bottom !== ind.left)) {
    const out: React.CSSProperties = { borderStyle: baseStyle, borderColor: color };
    if (ind.top) out.borderTopWidth = round(ind.top, 3);
    if (ind.right) out.borderRightWidth = round(ind.right, 3);
    if (ind.bottom) out.borderBottomWidth = round(ind.bottom, 3);
    if (ind.left) out.borderLeftWidth = round(ind.left, 3);
    if (dashImage) {
      // Use the asymmetric border widths as the slice anchors.
      out.borderStyle = "solid";
      out.borderColor = "transparent";
      out.borderImageSource = dashImage;
      const slice = `${round(ind.top, 3)} ${round(ind.right, 3)} ${round(ind.bottom, 3)} ${round(ind.left, 3)}`;
      out.borderImageSlice = slice;
      out.borderImageRepeat = "round";
    }
    return out;
  }

  const w = node.strokeWeight ?? ind?.top ?? 1;
  const out: React.CSSProperties = {
    borderStyle: baseStyle,
    borderColor: color,
    borderWidth: round(w, 3),
  };
  if (dashImage) {
    out.borderStyle = "solid";
    out.borderColor = "transparent";
    out.borderImageSource = dashImage;
    out.borderImageSlice = round(w, 3);
    out.borderImageRepeat = "round";
  }
  return out;
}

