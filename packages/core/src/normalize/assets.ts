import type { Node, Paint } from "../types/index.js";

export interface AssetSurvey {
  /** Distinct image fill hashes referenced anywhere in the tree. */
  imageRefs: Set<string>;
  /** Node ids that should be exported as SVG/PNG when geometry isn't usable. */
  exportCandidates: Set<string>;
}

const EXPORT_TYPES = new Set(["VECTOR", "BOOLEAN_OPERATION", "STAR", "LINE", "REGULAR_POLYGON"]);

function collectFromPaints(paints: readonly Paint[] | undefined, refs: Set<string>): void {
  if (!paints) return;
  for (const p of paints) {
    if (p.type === "IMAGE" && p.imageRef) refs.add(p.imageRef);
  }
}

/**
 * Walk a node subtree once to collect:
 *  - every imageRef hash that needs URL resolution,
 *  - every node likely to need a /v1/images export (vectors, boolean ops, complex shapes).
 *
 * Has no side effects on the tree itself.
 */
export function surveyAssets(root: Node): AssetSurvey {
  const imageRefs = new Set<string>();
  const exportCandidates = new Set<string>();

  const visit = (node: Node): void => {
    if ("fills" in node) collectFromPaints(node.fills as Paint[] | undefined, imageRefs);
    if ("strokes" in node) collectFromPaints(node.strokes as Paint[] | undefined, imageRefs);
    if ("background" in node) collectFromPaints(node.background as Paint[] | undefined, imageRefs);

    if (EXPORT_TYPES.has(node.type)) {
      const hasGeometry =
        ("fillGeometry" in node && Array.isArray((node as { fillGeometry?: unknown[] }).fillGeometry)) ||
        ("strokeGeometry" in node && Array.isArray((node as { strokeGeometry?: unknown[] }).strokeGeometry));
      if (!hasGeometry) exportCandidates.add(node.id);
    }

    const children = "children" in node ? node.children : undefined;
    if (children) for (const c of children) visit(c);
  };

  visit(root);
  return { imageRefs, exportCandidates };
}
