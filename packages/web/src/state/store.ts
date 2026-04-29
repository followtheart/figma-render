import { create } from "zustand";
import type { FigmaBundle } from "@figma-render/core";

// Side-by-side renders the Figma PNG to the right; overlay positions it on top
// of the matching node so the user can flip opacity to spot pixel diffs.
export type CompareMode = "off" | "side" | "overlay";

interface AppState {
  bundle: FigmaBundle | null;
  pageId: string | null;
  zoom: number;
  loading: boolean;
  error: string | null;
  hoveredId: string | null;
  selectedId: string | null;
  // Last-used Figma token, kept in memory only (never persisted) so the
  // compare feature can re-hit /api/figma/export without re-prompting.
  token: string | null;
  compareMode: CompareMode;
  compareOpacity: number;
  compareScale: number;
  // Map of nodeId -> signed Figma S3 image URL returned by /api/figma/export.
  compareImages: Record<string, string>;
  compareLoading: boolean;
  compareError: string | null;
  setBundle: (b: FigmaBundle | null) => void;
  setPage: (id: string | null) => void;
  setZoom: (z: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (e: string | null) => void;
  setHovered: (id: string | null) => void;
  setSelected: (id: string | null) => void;
  setToken: (t: string | null) => void;
  setCompareMode: (m: CompareMode) => void;
  setCompareOpacity: (o: number) => void;
  setCompareScale: (s: number) => void;
  setCompareImages: (imgs: Record<string, string>) => void;
  setCompareLoading: (l: boolean) => void;
  setCompareError: (e: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  bundle: null,
  pageId: null,
  zoom: 0.5,
  loading: false,
  error: null,
  hoveredId: null,
  selectedId: null,
  token: null,
  compareMode: "off",
  compareOpacity: 0.5,
  compareScale: 2,
  compareImages: {},
  compareLoading: false,
  compareError: null,
  setBundle: (bundle) => {
    const firstPageId =
      bundle && "children" in bundle.document
        ? (bundle.document.children?.[0]?.id ?? null)
        : null;
    set({
      bundle,
      pageId: firstPageId,
      error: null,
      hoveredId: null,
      selectedId: null,
      // New file invalidates any previously fetched compare PNGs.
      compareImages: {},
      compareError: null,
    });
  },
  // Clearing hover/selection on page change avoids stale highlights pointing at nodes
  // that no longer live in the viewport.
  setPage: (pageId) => set({ pageId, hoveredId: null, selectedId: null }),
  setZoom: (zoom) => set({ zoom: Math.max(0.05, Math.min(4, zoom)) }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setHovered: (hoveredId) => set({ hoveredId }),
  setSelected: (selectedId) => set({ selectedId }),
  setToken: (token) => set({ token }),
  setCompareMode: (compareMode) => set({ compareMode }),
  setCompareOpacity: (compareOpacity) =>
    set({ compareOpacity: Math.max(0, Math.min(1, compareOpacity)) }),
  setCompareScale: (compareScale) =>
    set({ compareScale: Math.max(0.5, Math.min(4, compareScale)) }),
  setCompareImages: (compareImages) => set({ compareImages }),
  setCompareLoading: (compareLoading) => set({ compareLoading }),
  setCompareError: (compareError) => set({ compareError }),
}));
