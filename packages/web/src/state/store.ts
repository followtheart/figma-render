import { create } from "zustand";
import type { FigmaBundle } from "@figma-render/core";

interface AppState {
  bundle: FigmaBundle | null;
  pageId: string | null;
  zoom: number;
  loading: boolean;
  error: string | null;
  setBundle: (b: FigmaBundle | null) => void;
  setPage: (id: string | null) => void;
  setZoom: (z: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (e: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  bundle: null,
  pageId: null,
  zoom: 0.5,
  loading: false,
  error: null,
  setBundle: (bundle) => {
    const firstPageId =
      bundle && "children" in bundle.document
        ? (bundle.document.children?.[0]?.id ?? null)
        : null;
    set({ bundle, pageId: firstPageId, error: null });
  },
  setPage: (pageId) => set({ pageId }),
  setZoom: (zoom) => set({ zoom: Math.max(0.05, Math.min(4, zoom)) }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
