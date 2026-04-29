import type { GetFileResponse } from "../types/index.js";

export interface LoadFromJsonOptions {
  /** Permit either a raw GetFileResponse or a wrapper { file: GetFileResponse }. */
  unwrap?: boolean;
}

export function parseFigmaJson(text: string, opts: LoadFromJsonOptions = {}): GetFileResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON: ${(err as Error).message}`);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Expected an object at the top level of the Figma JSON");
  }
  let candidate = parsed as Record<string, unknown>;
  if (opts.unwrap !== false && !("document" in candidate) && "file" in candidate) {
    candidate = candidate.file as Record<string, unknown>;
  }
  if (!("document" in candidate)) {
    throw new Error('Figma JSON missing required "document" field');
  }
  return candidate as unknown as GetFileResponse;
}
