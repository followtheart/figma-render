import type { Node } from "@figma-render/core";
import { round } from "./color.js";

interface MaskCandidate {
  id: string;
  type: string;
  isMask?: boolean;
  cornerRadius?: number;
  rectangleCornerRadii?: readonly number[];
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number } | null;
  fillGeometry?: readonly { path: string; windingRule?: string }[];
}

interface ParentBox {
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number } | null;
}

/**
 * Build a CSS `mask-image` (data:image/svg+xml URL) that approximates the
 * mask-shape of `maskNode`, sized to the bounding box of `parent`.
 *
 * Returns null when we don't have enough geometry to build a meaningful mask;
 * caller should fall back to rendering the mask node as a normal sibling.
 */
export function buildMaskCss(
  maskNode: MaskCandidate,
  parent: ParentBox,
): React.CSSProperties | null {
  const pBox = parent.absoluteBoundingBox;
  const mBox = maskNode.absoluteBoundingBox;
  if (!pBox || !mBox) return null;

  const x = round(mBox.x - pBox.x, 3);
  const y = round(mBox.y - pBox.y, 3);
  const w = round(mBox.width, 3);
  const h = round(mBox.height, 3);

  let shape = "";
  if (maskNode.type === "RECTANGLE") {
    const rx = maskNode.cornerRadius ?? 0;
    shape = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ry="${rx}" fill="white"/>`;
  } else if (maskNode.type === "ELLIPSE") {
    shape = `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="white"/>`;
  } else if (maskNode.fillGeometry && maskNode.fillGeometry.length > 0) {
    const paths = maskNode.fillGeometry
      .map(
        (g) =>
          `<path d="${g.path}" fill="white" fill-rule="${g.windingRule === "EVENODD" ? "evenodd" : "nonzero"}"/>`,
      )
      .join("");
    shape = `<g transform="translate(${x},${y})">${paths}</g>`;
  } else {
    // Fallback: rectangle of the mask's bbox.
    shape = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white"/>`;
  }

  const pw = round(pBox.width, 3);
  const ph = round(pBox.height, 3);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}" viewBox="0 0 ${pw} ${ph}">${shape}</svg>`;
  const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;

  return {
    maskImage: url,
    WebkitMaskImage: url,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskSize: "100% 100%",
    WebkitMaskSize: "100% 100%",
    maskPosition: "0 0",
    WebkitMaskPosition: "0 0",
  } as React.CSSProperties;
}

/**
 * Detect whether a node is a mask layer.
 */
export function isMaskNode(node: Node): boolean {
  return (node as { isMask?: boolean }).isMask === true;
}
