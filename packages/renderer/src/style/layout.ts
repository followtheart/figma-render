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
  constraints?: { horizontal?: string; vertical?: string };
}

/** Returns true when the relativeTransform is a pure translation (no rotation/skew/flip). */
function isAxisAligned(m: readonly (readonly number[])[] | undefined): boolean {
  if (!m || m.length < 2) return true;
  const a = m[0]?.[0] ?? 1;
  const b = m[1]?.[0] ?? 0;
  const c = m[0]?.[1] ?? 0;
  const d = m[1]?.[1] ?? 1;
  const eps = 1e-4;
  return Math.abs(b) < eps && Math.abs(c) < eps && Math.abs(a - 1) < eps && Math.abs(d - 1) < eps;
}

/**
 * Translate a Figma `constraints` pair into CSS positioning so the child
 * preserves its anchor when the parent resizes.
 *
 *   horizontal: LEFT  -> left: x;        width: w;
 *               RIGHT -> right: pw-(x+w); width: w;
 *               LEFT_RIGHT -> left + right (stretch);
 *               CENTER -> calc(50% + offset); width: w;
 *               SCALE  -> left%, width%;
 *   vertical analogous (TOP / BOTTOM / TOP_BOTTOM / CENTER / SCALE).
 */
function constraintsToPositionCss(
  node: AbsoluteBoxNode,
  parent: AbsoluteBoxParent,
): React.CSSProperties | null {
  const cs = node.constraints;
  if (!cs) return null;
  const pBox = parent.absoluteBoundingBox;
  if (!pBox) return null;
  const w = node.size?.x ?? node.absoluteBoundingBox?.width;
  const h = node.size?.y ?? node.absoluteBoundingBox?.height;
  if (w == null || h == null) return null;

  // Local x,y of node's top-left within parent's coordinate space.
  let x: number;
  let y: number;
  if (node.relativeTransform && node.relativeTransform.length >= 2) {
    x = node.relativeTransform[0]?.[2] ?? 0;
    y = node.relativeTransform[1]?.[2] ?? 0;
  } else if (node.absoluteBoundingBox) {
    x = node.absoluteBoundingBox.x - pBox.x;
    y = node.absoluteBoundingBox.y - pBox.y;
  } else {
    return null;
  }

  const pw = pBox.width;
  const ph = pBox.height;
  const out: React.CSSProperties = { position: "absolute" };

  switch (cs.horizontal) {
    case "RIGHT":
      out.right = round(pw - (x + w), 3);
      out.width = round(w, 3);
      break;
    case "LEFT_RIGHT":
      out.left = round(x, 3);
      out.right = round(pw - (x + w), 3);
      break;
    case "CENTER": {
      // Distance from parent center to child's left edge.
      const centerOffset = x + w / 2 - pw / 2;
      out.left = `calc(50% + ${round(centerOffset - w / 2, 3)}px)`;
      out.width = round(w, 3);
      break;
    }
    case "SCALE":
      out.left = pw > 0 ? `${round((x / pw) * 100, 4)}%` : 0;
      out.width = pw > 0 ? `${round((w / pw) * 100, 4)}%` : round(w, 3);
      break;
    case "LEFT":
    default:
      out.left = round(x, 3);
      out.width = round(w, 3);
      break;
  }

  switch (cs.vertical) {
    case "BOTTOM":
      out.bottom = round(ph - (y + h), 3);
      out.height = round(h, 3);
      break;
    case "TOP_BOTTOM":
      out.top = round(y, 3);
      out.bottom = round(ph - (y + h), 3);
      break;
    case "CENTER": {
      const centerOffset = y + h / 2 - ph / 2;
      out.top = `calc(50% + ${round(centerOffset - h / 2, 3)}px)`;
      out.height = round(h, 3);
      break;
    }
    case "SCALE":
      out.top = ph > 0 ? `${round((y / ph) * 100, 4)}%` : 0;
      out.height = ph > 0 ? `${round((h / ph) * 100, 4)}%` : round(h, 3);
      break;
    case "TOP":
    default:
      out.top = round(y, 3);
      out.height = round(h, 3);
      break;
  }

  return out;
}

/**
 * Position a child inside a non-Auto-Layout parent.
 *
 * Strategy:
 *   1. If the child's `relativeTransform` is axis-aligned (no rotation/skew/flip)
 *      and we have parent + child bounding boxes, translate Figma `constraints`
 *      into CSS top/right/bottom/left so the anchor is preserved when the
 *      parent resizes.
 *   2. Otherwise (rotated or no constraints info) fall back to a CSS
 *      `matrix()` derived from `relativeTransform`.
 *   3. Final fallback: difference of `absoluteBoundingBox` for plain x/y.
 */
export function absolutePositionToCss(
  node: AbsoluteBoxNode,
  parent: AbsoluteBoxParent,
): React.CSSProperties {
  // Prefer constraints when geometry is axis-aligned — preserves anchors.
  if (isAxisAligned(node.relativeTransform)) {
    const cs = constraintsToPositionCss(node, parent);
    if (cs) return cs;
  }

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
