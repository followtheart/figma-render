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
