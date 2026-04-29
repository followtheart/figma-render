import type { FigmaBundle } from "@figma-render/core";
import { figBytesToBundle, looksLikeFigBinary } from "./figConverter.js";

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

/** Build a FigmaBundle from a user-provided JSON file (no API access).
 *  Accepts both `.json` and `.figma` extensions — the latter being a common
 *  convention for files saved from the Figma REST API. The Figma desktop
 *  app's binary `.fig` format is NOT supported (it is proprietary and
 *  unrelated to the REST API JSON shape). */
export async function loadFromLocalFile(file: File): Promise<FigmaBundle> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);

  // .fig is a ZIP archive — sniff the magic bytes regardless of extension and
  // route to the binary parser.
  if (looksLikeFigBinary(bytes)) {
    try {
      return figBytesToBundle(bytes, file.name);
    } catch (err) {
      throw new Error(
        `Failed to parse ${file.name} as a Figma .fig file: ${(err as Error).message}`,
      );
    }
  }

  // Otherwise treat as JSON (.json / .figma — Figma REST API response).
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(
      `${file.name} is not a recognized format. Expected a Figma REST API JSON response (.json/.figma) or a desktop .fig binary.`,
    );
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      `${file.name} is not a JSON document. Expected a Figma REST API JSON response (.json/.figma) or a desktop .fig binary (ZIP).`,
    );
  }
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
