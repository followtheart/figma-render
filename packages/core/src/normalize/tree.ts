import type { GetFileResponse, Node } from "../types/index.js";

export interface NodeIndex {
  /** All nodes keyed by id (canvas pages, frames, etc.). */
  byId: Map<string, Node>;
  /** Direct parent lookup. The document node has no parent. */
  parentOf: Map<string, string | null>;
  /** Top-level pages (CANVAS nodes). */
  pages: Node[];
}

function isCanvas(n: Node): n is Node & { type: "CANVAS" } {
  return n.type === "CANVAS";
}

/**
 * Walk the document tree once and build flat lookup maps.
 * Cheap enough to recompute whenever a new file is loaded.
 */
export function indexDocument(file: GetFileResponse): NodeIndex {
  const byId = new Map<string, Node>();
  const parentOf = new Map<string, string | null>();
  const pages: Node[] = [];

  const visit = (node: Node, parentId: string | null): void => {
    byId.set(node.id, node);
    parentOf.set(node.id, parentId);
    if (parentId === file.document.id && isCanvas(node)) pages.push(node);
    const children = "children" in node ? node.children : undefined;
    if (children) for (const child of children) visit(child, node.id);
  };

  visit(file.document, null);
  return { byId, parentOf, pages };
}

/** Find a page by id, or null if it's not a CANVAS or doesn't exist. */
export function getPage(index: NodeIndex, pageId: string): Node | null {
  const node = index.byId.get(pageId);
  return node && isCanvas(node) ? node : null;
}
