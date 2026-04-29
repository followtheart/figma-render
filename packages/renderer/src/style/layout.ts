import { round } from "./color.js";

type AxisAlign = "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
type SizingMode = "FIXED" | "AUTO";
type LayoutAlign = "INHERIT" | "STRETCH" | "MIN" | "CENTER" | "MAX";

interface AutoLayoutNode {
  layoutMode?: "NONE" | "HORIZONTAL" | "VERTICAL";
  primaryAxisAlignItems?: AxisAlign;
  counterAxisAlignItems?: AxisAlign | "BASELINE";
  primaryAxisSizingMode?: SizingMode;
  counterAxisSizingMode?: SizingMode;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  itemSpacing?: number;
  layoutWrap?: "NO_WRAP" | "WRAP";
  counterAxisSpacing?: number;
}

interface ChildLayoutNode {
  layoutGrow?: number;
  layoutAlign?: LayoutAlign;
  layoutPositioning?: "AUTO" | "ABSOLUTE";
}

const AXIS_TO_JUSTIFY: Record<AxisAlign, string> = {
  MIN: "flex-start",
  CENTER: "center",
  MAX: "flex-end",
  SPACE_BETWEEN: "space-between",
};

const AXIS_TO_ALIGN: Record<AxisAlign | "BASELINE", string> = {
  MIN: "flex-start",
  CENTER: "center",
  MAX: "flex-end",
  SPACE_BETWEEN: "space-between",
  BASELINE: "baseline",
};

/** Auto Layout container -> flexbox CSS. Returns {} when layoutMode is NONE. */
export function autoLayoutToCss(node: AutoLayoutNode): React.CSSProperties {
  if (!node.layoutMode || node.layoutMode === "NONE") return {};
  const horizontal = node.layoutMode === "HORIZONTAL";
  const out: React.CSSProperties = {
    display: "flex",
    flexDirection: horizontal ? "row" : "column",
  };

  if (node.primaryAxisAlignItems) out.justifyContent = AXIS_TO_JUSTIFY[node.primaryAxisAlignItems];
  if (node.counterAxisAlignItems) out.alignItems = AXIS_TO_ALIGN[node.counterAxisAlignItems];

  if (node.paddingTop) out.paddingTop = round(node.paddingTop, 3);
  if (node.paddingRight) out.paddingRight = round(node.paddingRight, 3);
  if (node.paddingBottom) out.paddingBottom = round(node.paddingBottom, 3);
  if (node.paddingLeft) out.paddingLeft = round(node.paddingLeft, 3);

  if (node.itemSpacing) {
    if (node.layoutWrap === "WRAP" && node.counterAxisSpacing != null) {
      out.rowGap = horizontal ? round(node.counterAxisSpacing, 3) : round(node.itemSpacing, 3);
      out.columnGap = horizontal ? round(node.itemSpacing, 3) : round(node.counterAxisSpacing, 3);
    } else {
      out.gap = round(node.itemSpacing, 3);
    }
  }
  if (node.layoutWrap === "WRAP") out.flexWrap = "wrap";

  return out;
}

/**
 * Compute child-side flex hints. Should be merged into the child's own style
 * when the parent is Auto Layout. `parentAxis` must be the parent's layoutMode.
 */
export function autoLayoutChildToCss(
  child: ChildLayoutNode,
  parentAxis: "HORIZONTAL" | "VERTICAL",
): React.CSSProperties {
  const out: React.CSSProperties = {};
  if (child.layoutGrow && child.layoutGrow > 0) {
    out.flexGrow = child.layoutGrow;
    // Stretching along main axis -> let flex resize.
    if (parentAxis === "HORIZONTAL") out.width = "auto";
    else out.height = "auto";
  }
  if (child.layoutAlign === "STRETCH") {
    out.alignSelf = "stretch";
    if (parentAxis === "HORIZONTAL") out.height = "auto";
    else out.width = "auto";
  }
  return out;
}

interface AbsoluteBoxParent {
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number } | null;
}

interface AbsoluteBoxNode extends AbsoluteBoxParent {
  size?: { x: number; y: number };
  relativeTransform?: readonly (readonly number[])[]; // 2x3 affine
}

/**
 * Position a child inside a non-Auto-Layout parent.
 * Uses relativeTransform when present (preserves rotation), otherwise falls back
 * to deriving x/y from absoluteBoundingBox.
 */
export function absolutePositionToCss(
  node: AbsoluteBoxNode,
  parent: AbsoluteBoxParent,
): React.CSSProperties {
  const out: React.CSSProperties = { position: "absolute" };
  const size = node.size
    ? { w: node.size.x, h: node.size.y }
    : node.absoluteBoundingBox
      ? { w: node.absoluteBoundingBox.width, h: node.absoluteBoundingBox.height }
      : null;
  if (size) {
    out.width = round(size.w, 3);
    out.height = round(size.h, 3);
  }

  if (node.relativeTransform && node.relativeTransform.length === 2) {
    const m = node.relativeTransform;
    const a = m[0]?.[0] ?? 1;
    const b = m[1]?.[0] ?? 0;
    const c = m[0]?.[1] ?? 0;
    const d = m[1]?.[1] ?? 1;
    const tx = m[0]?.[2] ?? 0;
    const ty = m[1]?.[2] ?? 0;
    out.left = 0;
    out.top = 0;
    out.transformOrigin = "0 0";
    out.transform = `matrix(${round(a, 6)}, ${round(b, 6)}, ${round(c, 6)}, ${round(d, 6)}, ${round(tx, 3)}, ${round(ty, 3)})`;
    return out;
  }

  if (node.absoluteBoundingBox && parent.absoluteBoundingBox) {
    out.left = round(node.absoluteBoundingBox.x - parent.absoluteBoundingBox.x, 3);
    out.top = round(node.absoluteBoundingBox.y - parent.absoluteBoundingBox.y, 3);
  }
  return out;
}
