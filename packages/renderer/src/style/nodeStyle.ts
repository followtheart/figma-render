import type { Node } from "@figma-render/core";
import { paintsToBackground, type PaintContext } from "./paint.js";
import { strokeToCss } from "./stroke.js";
import { effectsToCss } from "./effect.js";
import { autoLayoutToCss, autoLayoutChildToCss, absolutePositionToCss } from "./layout.js";
import { cornerRadiusToCss } from "./cornerRadius.js";
import { blendModeToCss } from "./blend.js";
import { round } from "./color.js";

export interface NodeStyleContext extends PaintContext {
  parent?: Node | null;
  /** True if this node is the page (CANVAS) or the document root. */
  isRoot?: boolean;
}

interface NodeWithLayout {
  visible?: boolean;
  opacity?: number;
  blendMode?: string;
  fills?: unknown;
  strokes?: unknown;
  strokeWeight?: number;
  individualStrokeWeights?: unknown;
  strokeAlign?: unknown;
  strokeDashes?: unknown;
  cornerRadius?: number;
  rectangleCornerRadii?: unknown;
  effects?: unknown;
  layoutMode?: unknown;
  primaryAxisAlignItems?: unknown;
  counterAxisAlignItems?: unknown;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  itemSpacing?: number;
  layoutWrap?: unknown;
  counterAxisSpacing?: number;
  layoutGrow?: number;
  layoutAlign?: unknown;
  layoutPositioning?: unknown;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number } | null;
  size?: { x: number; y: number };
  relativeTransform?: readonly (readonly number[])[];
  clipsContent?: boolean;
  isMask?: boolean;
}

/**
 * Build the full CSS for a node — paints, strokes, corners, effects, layout,
 * blend mode, transform/positioning, mask. The node-specific components are
 * thin wrappers around this.
 */
export function buildNodeStyle(node: Node, ctx: NodeStyleContext): React.CSSProperties {
  const n = node as unknown as NodeWithLayout;
  const style: React.CSSProperties = {};

  if (n.visible === false) style.display = "none";
  if (typeof n.opacity === "number" && n.opacity < 1) style.opacity = round(n.opacity, 4);

  Object.assign(style, blendModeToCss(n.blendMode as string | undefined));
  Object.assign(style, paintsToBackground(n.fills as never, ctx));
  Object.assign(style, strokeToCss(n as never));
  Object.assign(style, cornerRadiusToCss(n as never));

  const eff = effectsToCss(n.effects as never);
  if (eff.boxShadow) style.boxShadow = eff.boxShadow;
  if (eff.filter) style.filter = eff.filter;
  if (eff.backdropFilter) style.backdropFilter = eff.backdropFilter;

  Object.assign(style, autoLayoutToCss(n as never));

  // Position relative to parent.
  const parent = ctx.parent as unknown as NodeWithLayout | null | undefined;
  const parentIsAuto = parent?.layoutMode === "HORIZONTAL" || parent?.layoutMode === "VERTICAL";
  const isAbsolute = n.layoutPositioning === "ABSOLUTE";

  if (ctx.isRoot) {
    // Root page: relative; size from bounding box if available.
    style.position = "relative";
    if (n.absoluteBoundingBox) {
      style.width = round(n.absoluteBoundingBox.width, 3);
      style.height = round(n.absoluteBoundingBox.height, 3);
    }
  } else if (parentIsAuto && !isAbsolute) {
    // Flex child: leave positioning to parent flex.
    style.position = "relative";

    // Width/height from the design-time snapshot.
    const childW = n.size?.x ?? n.absoluteBoundingBox?.width;
    const childH = n.size?.y ?? n.absoluteBoundingBox?.height;

    // Geometric fallback for FILL: the .fig binary schema does not expose a
    // stable "fill container" signal in the type definitions we have access
    // to. As a heuristic, when a child's declared main-axis size is >= the
    // parent's available content-box on that axis, treat it as FILL — drop
    // the explicit size and let flex grow do the work. This catches the very
    // common case of an INSTANCE master designed at e.g. 400 px placed inside
    // a 343 px parent, where the author meant "fill the container" but the
    // sizing flag was lost in conversion.
    let mainAxisFills = false;
    let crossAxisFills = false;
    const parentSize = parent.size ?? parent.absoluteBoundingBox;
    if (parentSize) {
      const padX = (parent.paddingLeft ?? 0) + (parent.paddingRight ?? 0);
      const padY = (parent.paddingTop ?? 0) + (parent.paddingBottom ?? 0);
      const availX =
        ((parentSize as { x?: number; width?: number }).x ??
          (parentSize as { width?: number }).width ??
          0) - padX;
      const availY =
        ((parentSize as { y?: number; height?: number }).y ??
          (parentSize as { height?: number }).height ??
          0) - padY;
      const eps = 0.5;
      if (parent.layoutMode === "HORIZONTAL") {
        if (childW != null && availX > 0 && childW >= availX - eps) mainAxisFills = true;
        if (childH != null && availY > 0 && childH >= availY - eps) crossAxisFills = true;
      } else {
        if (childH != null && availY > 0 && childH >= availY - eps) mainAxisFills = true;
        if (childW != null && availX > 0 && childW >= availX - eps) crossAxisFills = true;
      }
    }

    if (childW != null && !(mainAxisFills && parent.layoutMode === "HORIZONTAL") &&
        !(crossAxisFills && parent.layoutMode === "VERTICAL")) {
      style.width = round(childW, 3);
    }
    if (childH != null && !(mainAxisFills && parent.layoutMode === "VERTICAL") &&
        !(crossAxisFills && parent.layoutMode === "HORIZONTAL")) {
      style.height = round(childH, 3);
    }

    // Flex-shrink unlock: default `min-width:auto` resolves to content min size
    // and blocks shrinking. Cap with `max-*:100%` for the cases where the
    // explicit size still applies but is larger than the live parent box.
    if (parent.layoutMode === "HORIZONTAL") {
      style.minWidth = 0;
      style.maxWidth = "100%";
    } else {
      style.minHeight = 0;
      style.maxHeight = "100%";
    }

    if (mainAxisFills) {
      style.flexGrow = 1;
      style.flexBasis = 0;
    }
    if (crossAxisFills) {
      style.alignSelf = "stretch";
    }

    Object.assign(
      style,
      autoLayoutChildToCss(n as never, parent.layoutMode as "HORIZONTAL" | "VERTICAL"),
    );
  } else {
    Object.assign(style, absolutePositionToCss(n as never, (parent ?? {}) as never));
  }

  if (n.clipsContent) style.overflow = "hidden";
  // box-sizing: border-box keeps inside-strokes and padding inside the bbox.
  style.boxSizing = "border-box";

  return style;
}
