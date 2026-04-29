import type { Node } from "@figma-render/core";
import { buildNodeStyle } from "../style/nodeStyle.js";
import { useRenderContext } from "../context.js";

interface ShapeNodeProps {
  node: Node;
  parent: Node | null;
}

/** Renders RECTANGLE / ELLIPSE / LINE / REGULAR_POLYGON / STAR (basic shapes). */
export function ShapeNode({ node, parent }: ShapeNodeProps) {
  const ctx = useRenderContext();
  const style = buildNodeStyle(node, { parent, images: ctx.bundle.images });

  // Ellipse: force a circular border-radius regardless of cornerRadius.
  if (node.type === "ELLIPSE") {
    style.borderRadius = "50%";
  }

  return <div data-figma-id={node.id} data-figma-type={node.type} style={style} />;
}
