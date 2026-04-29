import type { GetFileResponse, ImageRefMap, ExportedAssetMap } from "../types/index.js";

const FIGMA_API = "https://api.figma.com";

export class FigmaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    message: string,
  ) {
    super(`Figma API ${status} ${url}: ${message}`);
    this.name = "FigmaApiError";
  }
}

interface RequestInit {
  token: string;
  signal?: AbortSignal;
}

async function figmaFetch<T>(path: string, { token, signal }: RequestInit): Promise<T> {
  const url = `${FIGMA_API}${path}`;
  const res = await fetch(url, {
    headers: { "X-Figma-Token": token },
    signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new FigmaApiError(res.status, url, body || res.statusText);
  }
  return (await res.json()) as T;
}

export interface GetFileOptions extends RequestInit {
  /** Optional list of node IDs to scope the response. */
  ids?: string[];
  /** Vector geometry detail level. Required to render vectors without falling back to image export. */
  geometry?: "paths";
  depth?: number;
  version?: string;
  branchData?: boolean;
}

export async function getFile(fileKey: string, opts: GetFileOptions): Promise<GetFileResponse> {
  const params = new URLSearchParams();
  if (opts.ids?.length) params.set("ids", opts.ids.join(","));
  if (opts.geometry) params.set("geometry", opts.geometry);
  if (opts.depth) params.set("depth", String(opts.depth));
  if (opts.version) params.set("version", opts.version);
  if (opts.branchData) params.set("branch_data", "true");
  const qs = params.toString();
  return figmaFetch<GetFileResponse>(
    `/v1/files/${encodeURIComponent(fileKey)}${qs ? `?${qs}` : ""}`,
    opts,
  );
}

interface ImageFillsResponse {
  error: boolean;
  status: number;
  meta: { images: ImageRefMap };
}

export async function getImageFills(
  fileKey: string,
  opts: RequestInit,
): Promise<ImageRefMap> {
  const res = await figmaFetch<ImageFillsResponse>(
    `/v1/files/${encodeURIComponent(fileKey)}/images`,
    opts,
  );
  return res.meta.images;
}

export interface ExportOptions extends RequestInit {
  ids: string[];
  format?: "png" | "jpg" | "svg" | "pdf";
  scale?: number;
  svgIncludeId?: boolean;
  svgSimplifyStroke?: boolean;
}

interface ExportResponse {
  err: string | null;
  images: ExportedAssetMap;
}

export async function exportNodes(
  fileKey: string,
  opts: ExportOptions,
): Promise<ExportedAssetMap> {
  if (!opts.ids.length) return {};
  const params = new URLSearchParams();
  params.set("ids", opts.ids.join(","));
  if (opts.format) params.set("format", opts.format);
  if (opts.scale != null) params.set("scale", String(opts.scale));
  if (opts.svgIncludeId) params.set("svg_include_id", "true");
  if (opts.svgSimplifyStroke === false) params.set("svg_simplify_stroke", "false");
  const res = await figmaFetch<ExportResponse>(
    `/v1/images/${encodeURIComponent(fileKey)}?${params.toString()}`,
    opts,
  );
  if (res.err) throw new FigmaApiError(500, "/v1/images", res.err);
  // Figma returns null for missing nodes; strip them.
  const out: ExportedAssetMap = {};
  for (const [id, url] of Object.entries(res.images)) {
    if (url) out[id] = url;
  }
  return out;
}
