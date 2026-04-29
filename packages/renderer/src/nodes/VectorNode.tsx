import type { Node } from "@figma-render/core";
import { buildNodeStyle } from "../style/nodeStyle.js";
import { useRenderContext } from "../context.js";

interface VectorNodeProps {
  node: Node & {
    fillGeometry?: readonly { path: string; windingRule?: string }[];
    strokeGeometry?: readonly { path: string }[];
    absoluteBoundingBox?: { x: number; y: number; width: number; height: number } | null;
  };
  parent: Node | null;
}

/**
 * Renders VECTOR / BOOLEAN_OPERATION / STAR / LINE / REGULAR_POLYGON.
 * Strategy:
 *  1. If we have an exported SVG/PNG URL for this node, use an <img>.
 *  2. Else if we have fillGeometry/strokeGeometry paths, emit inline <svg>.
 *  3. Else fall back to a plain box with whatever fill we can render.
 */
export function VectorNode({ node, parent }: VectorNodeProps) {
  const ctx = useRenderContext();
  const exportedUrl = ctx.bundle.exports[node.id];
  const style = buildNodeStyle(node, { parent, images: ctx.bundle.images });

  if (exportedUrl) {
    // Stripping background is safer; the image already encodes the visual.
    delete style.backgroundColor;
    delete style.backgroundImage;
    return (
      <img
        data-figma-id={node.id}
        data-figma-type={node.type}
        src={exportedUrl}
        alt=""
        style={{ ...style, objectFit: "fill" }}
      />
    );
  }

  const bbox = node.absoluteBoundingBox;
  if (bbox && (node.fillGeometry?.length || node.strokeGeometry?.length)) {
    const w = bbox.width;
    const h = bbox.height;
    // Vector backgrounds are baked into <path>, so drop CSS background.
    delete style.backgroundColor;
    delete style.backgroundImage;
    delete style.borderRadius;
    return (
      <svg
        data-figma-id={node.id}
        data-figma-type={node.type}
        viewBox={`0 0 ${w} ${h}`}
        width={w}
        height={h}
        style={style}
        preserveAspectRatio="none"
      >
        {node.fillGeometry?.map((g, i) => (
          <path
            key={`f${i}`}
            d={g.path}
            fill="currentColor"
            fillRule={g.windingRule === "EVENODD" ? "evenodd" : "nonzero"}
          />
        ))}
        {node.strokeGeometry?.map((g, i) => (
          <path key={`s${i}`} d={g.path} fill="currentColor" />
        ))}
      </svg>
    );
  }

  return <div data-figma-id={node.id} data-figma-type={node.type} style={style} />;
}
