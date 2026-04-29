import type { Node } from "@figma-render/core";
import { buildNodeStyle } from "../style/nodeStyle.js";
import { buildMaskCss, isMaskNode } from "../style/mask.js";
import { useRenderContext } from "../context.js";
import { NodeRenderer } from "../NodeRenderer.js";

interface FrameNodeProps {
  node: Node & { children?: readonly Node[]; layoutMode?: string };
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
      {renderChildrenWithMasks(children, node)}
    </div>
  );
}

/**
 * Walk the children list and group each `isMask` node together with the
 * subsequent siblings it masks. Each group becomes an absolutely positioned
 * wrapper carrying a CSS `mask-image` derived from the mask shape.
 *
 * Auto Layout parents fall back to plain rendering: wrapping siblings in a
 * positioned div would break the flex flow.
 */
function renderChildrenWithMasks(
  children: readonly Node[],
  parent: Node & { layoutMode?: string },
) {
  const parentIsAuto = parent.layoutMode === "HORIZONTAL" || parent.layoutMode === "VERTICAL";
  const hasMask = children.some((c) => isMaskNode(c));
  if (!hasMask || parentIsAuto) {
    return children.map((child) => <NodeRenderer key={child.id} node={child} parent={parent} />);
  }

  const out: React.ReactNode[] = [];
  let maskNode: Node | null = null;
  let buffer: Node[] = [];

  const flush = () => {
    if (!maskNode) return;
    const css = buildMaskCss(maskNode as never, parent as never);
    if (css && buffer.length > 0) {
      out.push(
        <div
          key={`mask-group-${maskNode.id}`}
          data-figma-mask-id={maskNode.id}
          style={{ position: "absolute", inset: 0, pointerEvents: "none", ...css }}
        >
          {buffer.map((c) => (
            <NodeRenderer key={c.id} node={c} parent={parent} />
          ))}
        </div>,
      );
    } else {
      // Fallback: render mask + buffered siblings inline.
      out.push(<NodeRenderer key={maskNode.id} node={maskNode} parent={parent} />);
      for (const c of buffer) {
        out.push(<NodeRenderer key={c.id} node={c} parent={parent} />);
      }
    }
    maskNode = null;
    buffer = [];
  };

  for (const child of children) {
    if (isMaskNode(child)) {
      flush();
      maskNode = child;
    } else if (maskNode) {
      buffer.push(child);
    } else {
      out.push(<NodeRenderer key={child.id} node={child} parent={parent} />);
    }
  }
  flush();
  return out;
}
