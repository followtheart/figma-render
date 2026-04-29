import type { FigmaBundle } from "@figma-render/core";

interface ApiError {
  error: { message?: string; status?: number };
}

export async function loadFromApi(
  fileKey: string,
  token: string,
): Promise<FigmaBundle> {
  const res = await fetch("/api/figma/load", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileKey, token }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Partial<ApiError>;
    throw new Error(data.error?.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as FigmaBundle;
}

/**
 * Request PNG renders of `ids` from the Figma `/v1/images` API via our server proxy.
 * Returns a `nodeId -> signed S3 URL` map. Image URLs expire (~30 min) and are
 * fetched directly by the browser without auth.
 */
export async function exportPng(
  fileKey: string,
  token: string,
  ids: string[],
  scale = 2,
): Promise<Record<string, string>> {
  const res = await fetch("/api/figma/export", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileKey, token, ids, format: "png", scale }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Partial<ApiError>;
    throw new Error(data.error?.message ?? `HTTP ${res.status}`);
  }
  const json = (await res.json()) as { exports: Record<string, string> };
  return json.exports;
}

/** Build a FigmaBundle from a user-provided JSON file (no API access). */
export async function loadFromLocalFile(file: File): Promise<FigmaBundle> {
  const text = await file.text();
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const root = ("document" in parsed ? parsed : (parsed.file as Record<string, unknown>)) ?? {};
  if (!root || !("document" in root)) throw new Error("Missing 'document' field in JSON");
  return {
    fileKey: (root.fileKey as string) ?? "local",
    name: (root.name as string) ?? file.name,
    lastModified: (root.lastModified as string) ?? "",
    version: (root.version as string) ?? "",
    document: root.document as never,
    components: (root.components as never) ?? {},
    componentSets: (root.componentSets as never) ?? {},
    styles: (root.styles as never) ?? {},
    images: (root.images as Record<string, string>) ?? {},
    exports: (root.exports as Record<string, string>) ?? {},
  };
}
