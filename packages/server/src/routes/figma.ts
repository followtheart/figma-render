import { Router } from "express";
import { z } from "zod";
import {
  exportNodes,
  FigmaApiError,
  getFile,
  getImageFills,
  indexDocument,
  surveyAssets,
  type FigmaBundle,
} from "@figma-render/core";
import { bundleCache, bundleCacheKey } from "../cache.js";

const loadSchema = z.object({
  fileKey: z.string().min(1),
  token: z.string().min(1),
  version: z.string().optional(),
  /** Pre-export vectors as SVGs in the same request. */
  prefetchVectors: z.boolean().optional().default(true),
});

const exportSchema = z.object({
  fileKey: z.string().min(1),
  token: z.string().min(1),
  ids: z.array(z.string().min(1)).min(1).max(500),
  format: z.enum(["png", "jpg", "svg", "pdf"]).optional(),
  scale: z.number().positive().max(4).optional(),
});

export const figmaRouter: Router = Router();

figmaRouter.post("/load", async (req, res) => {
  const parsed = loadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { fileKey, token, version, prefetchVectors } = parsed.data;
  const cacheKey = bundleCacheKey(fileKey, version);
  const cached = bundleCache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    const file = await getFile(fileKey, { token, version, geometry: "paths" });
    const images = await getImageFills(fileKey, { token });

    let exportsMap: Record<string, string> = {};
    if (prefetchVectors) {
      const survey = surveyAssets(file.document);
      const ids = [...survey.exportCandidates];
      if (ids.length) {
        // Chunk to keep the URL short.
        const CHUNK = 100;
        for (let i = 0; i < ids.length; i += CHUNK) {
          const chunk = ids.slice(i, i + CHUNK);
          const result = await exportNodes(fileKey, { token, ids: chunk, format: "svg" });
          exportsMap = { ...exportsMap, ...result };
        }
      }
    }

    // Touch the index so we surface tree-corruption errors here, not in the renderer.
    indexDocument(file);

    const bundle: FigmaBundle = {
      fileKey,
      name: file.name,
      lastModified: file.lastModified,
      version: file.version,
      document: file.document,
      components: file.components,
      componentSets: file.componentSets,
      styles: file.styles,
      images,
      exports: exportsMap,
    };
    bundleCache.set(cacheKey, bundle);
    res.json(bundle);
  } catch (err) {
    if (err instanceof FigmaApiError) {
      res.status(err.status === 401 || err.status === 403 ? err.status : 502).json({
        error: { message: err.message, status: err.status },
      });
      return;
    }
    res.status(500).json({ error: { message: (err as Error).message } });
  }
});

figmaRouter.post("/export", async (req, res) => {
  const parsed = exportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { fileKey, token, ids, format, scale } = parsed.data;
  try {
    const exportsMap = await exportNodes(fileKey, { token, ids, format, scale });
    res.json({ exports: exportsMap });
  } catch (err) {
    if (err instanceof FigmaApiError) {
      res.status(502).json({ error: { message: err.message, status: err.status } });
      return;
    }
    res.status(500).json({ error: { message: (err as Error).message } });
  }
});
