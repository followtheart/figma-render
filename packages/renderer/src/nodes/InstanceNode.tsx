import { useMemo } from "react";
import type { Node } from "@figma-render/core";
import { resolveInstance } from "@figma-render/core";
import { FrameNode } from "./FrameNode.js";
import { useRenderContext } from "../context.js";

interface InstanceNodeProps {
  node: Node;
  parent: Node | null;
}

/**
 * Render an INSTANCE.
 *
 * In a normal Figma REST API response the instance already carries its
 * resolved children (with overrides applied). But for trees that have been
 * pruned or fetched at limited depth — and for modern component-property
 * overrides that flow from the instance down to descendants — we run them
 * through `resolveInstance` first, then render via the regular Frame path.
 */
export function InstanceNode({ node, parent }: InstanceNodeProps) {
  const ctx = useRenderContext();
  const resolved = useMemo(
    () => resolveInstance(node, ctx.nodesById),
    [node, ctx.nodesById],
  );
  return <FrameNode node={resolved} parent={parent} />;
}
