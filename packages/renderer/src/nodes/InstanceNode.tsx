import type { Node } from "@figma-render/core";
import { FrameNode } from "./FrameNode.js";

interface InstanceNodeProps {
  node: Node & { children?: readonly Node[]; componentId?: string };
  parent: Node | null;
}

/**
 * Render an INSTANCE. Figma already serializes each instance with its resolved
 * children (incl. overrides applied) under `children`, so we can render it the
 * same way we render a FRAME. The componentId is preserved as a data attribute
 * for tooling.
 */
export function InstanceNode({ node, parent }: InstanceNodeProps) {
  return <FrameNode node={node} parent={parent} />;
}
