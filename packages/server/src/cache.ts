import { LRUCache } from "lru-cache";
import type { FigmaBundle } from "@figma-render/core";

/**
 * Cache fully resolved bundles by (fileKey, version).
 * Capped at 16 files; entries expire after 10 minutes since Figma users
 * iterate quickly and stale data is more annoying than a re-fetch.
 */
export const bundleCache = new LRUCache<string, FigmaBundle>({
  max: 16,
  ttl: 1000 * 60 * 10,
});

export function bundleCacheKey(fileKey: string, version: string | undefined): string {
  return `${fileKey}@${version ?? "latest"}`;
}
