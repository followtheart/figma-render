import { createContext, useContext } from "react";
import type { FigmaBundle, Node } from "@figma-render/core";

export interface RenderContextValue {
  bundle: FigmaBundle;
  /** All nodes by id, including INSTANCE main components from another file (subset). */
  nodesById: Map<string, Node>;
  /** Parent id of each node; used by `resolveInstance` to find COMPONENT_SETs for VARIANT props. */
  parentOf: Map<string, string | null>;
}

export const RenderContext = createContext<RenderContextValue | null>(null);

export function useRenderContext(): RenderContextValue {
  const ctx = useContext(RenderContext);
  if (!ctx) throw new Error("RenderContext is missing. Wrap your tree in <FigmaRenderer>.");
  return ctx;
}
