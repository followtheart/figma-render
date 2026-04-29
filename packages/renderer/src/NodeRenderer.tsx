import type { Node } from "@figma-render/core";
import { FrameNode } from "./nodes/FrameNode.js";
import { ShapeNode } from "./nodes/ShapeNode.js";
import { TextNode } from "./nodes/TextNode.js";
import { VectorNode } from "./nodes/VectorNode.js";
import { InstanceNode } from "./nodes/InstanceNode.js";

interface NodeRendererProps {
  node: Node;
  parent: Node | null;
  isRoot?: boolean;
}

/** Dispatch a single Figma node to the right renderer based on type. */
export function NodeRenderer({ node, parent, isRoot }: NodeRendererProps) {
  switch (node.type) {
    case "DOCUMENT":
      // The document container; render its children (CANVAS pages) as roots.
      return (
        <>
          {"children" in node &&
            node.children?.map((c) => <NodeRenderer key={c.id} node={c} parent={node} isRoot />)}
        </>
      );
    case "CANVAS":
    case "FRAME":
    case "GROUP":
    case "SECTION":
    case "COMPONENT":
    case "COMPONENT_SET":
      return (
        <FrameNode
          node={node as Node & { children?: readonly Node[] }}
          parent={parent}
          isRoot={isRoot}
        />
      );
    case "INSTANCE":
      return <InstanceNode node={node as never} parent={parent} />;
    case "TEXT":
      return <TextNode node={node as never} parent={parent} />;
    case "VECTOR":
    case "BOOLEAN_OPERATION":
    case "STAR":
    case "LINE":
    case "REGULAR_POLYGON":
      return <VectorNode node={node as never} parent={parent} />;
    case "RECTANGLE":
    case "ELLIPSE":
      return <ShapeNode node={node} parent={parent} />;
    case "SLICE":
      return null;
    default:
      // Unknown / FigJam types — render a minimal placeholder using the same style pipeline.
      return <ShapeNode node={node} parent={parent} />;
  }
}
