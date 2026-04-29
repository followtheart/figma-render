import type { Node } from "@figma-render/core";
import { buildNodeStyle } from "../style/nodeStyle.js";
import { useRenderContext } from "../context.js";
import { NodeRenderer } from "../NodeRenderer.js";

interface FrameNodeProps {
  node: Node & { children?: readonly Node[] };
  parent: Node | null;
  isRoot?: boolean;
}

/** Renders FRAME, GROUP, SECTION, COMPONENT, COMPONENT_SET. */
export function FrameNode({ node, parent, isRoot }: FrameNodeProps) {
  const ctx = useRenderContext();
  const style = buildNodeStyle(node, {
    parent,
    isRoot,
    images: ctx.bundle.images,
  });

  const children = node.children ?? [];
  return (
    <div data-figma-id={node.id} data-figma-type={node.type} style={style}>
      {children.map((child) => (
        <NodeRenderer key={child.id} node={child} parent={node} />
      ))}
    </div>
  );
}
