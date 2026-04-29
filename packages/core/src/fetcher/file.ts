import type { GetFileResponse } from "../types/index.js";
import { parseFigmaJson } from "./parse.js";

/** Load and parse a Figma JSON export from disk. Node-only. */
export async function loadFromJsonFile(path: string): Promise<GetFileResponse> {
  // Use a computed module specifier so TS doesn't try to resolve "node:fs/promises"
  // when the renderer/web package type-checks (no @types/node available there).
  const fsModule = "node:fs/promises";
  const { readFile } = (await import(/* @vite-ignore */ fsModule)) as typeof import("node:fs/promises");
  const text = await readFile(path, "utf8");
  return parseFigmaJson(text);
}
