import { useMemo } from "react";
import type { FigmaBundle, Node } from "@figma-render/core";
import { indexDocument } from "@figma-render/core";
import { RenderContext, type RenderContextValue } from "./context.js";
import { NodeRenderer } from "./NodeRenderer.js";

interface FigmaRendererProps {
  bundle: FigmaBundle;
  /** Render only this page id; default: render all pages stacked. */
  pageId?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Top-level entry point. Renders one page (when `pageId` is given) or all pages
 * stacked vertically. Builds a RenderContext that descendants can read.
 */
export function FigmaRenderer({ bundle, pageId, className, style }: FigmaRendererProps) {
  const ctx = useMemo<RenderContextValue>(() => {
    const idx = indexDocument({ ...bundle } as never);
    return { bundle, nodesById: idx.byId };
  }, [bundle]);

  const pages: Node[] = useMemo(() => {
    const all = "children" in bundle.document ? (bundle.document.children ?? []) : [];
    if (!pageId) return all as Node[];
    const found = (all as Node[]).find((n) => n.id === pageId);
    return found ? [found] : [];
  }, [bundle.document, pageId]);

  return (
    <RenderContext.Provider value={ctx}>
      <div
        className={className}
        style={{ display: "flex", flexDirection: "column", gap: 32, ...style }}
      >
        {pages.map((page) => (
          <NodeRenderer key={page.id} node={page} parent={bundle.document} isRoot />
        ))}
      </div>
    </RenderContext.Provider>
  );
}
