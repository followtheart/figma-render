import { describe, it, expect } from "vitest";
import { parseFigmaJson } from "../fetcher/parse.js";
import { indexDocument } from "../normalize/tree.js";
import { surveyAssets } from "../normalize/assets.js";

const minimalFile = JSON.stringify({
  name: "Demo",
  lastModified: "",
  version: "1",
  document: {
    id: "0:0",
    name: "Document",
    type: "DOCUMENT",
    children: [
      {
        id: "0:1",
        name: "Page 1",
        type: "CANVAS",
        children: [
          {
            id: "1:1",
            name: "Frame",
            type: "FRAME",
            children: [
              { id: "1:2", name: "Rect", type: "RECTANGLE" },
              {
                id: "1:3",
                name: "Img",
                type: "RECTANGLE",
                fills: [{ type: "IMAGE", imageRef: "abc" }],
              },
              { id: "1:4", name: "Vector", type: "VECTOR" },
            ],
          },
        ],
      },
    ],
  },
  components: {},
  componentSets: {},
  styles: {},
});

describe("parseFigmaJson", () => {
  it("parses a wrapped { file: ... } payload", () => {
    const wrapped = JSON.stringify({ file: JSON.parse(minimalFile) });
    const out = parseFigmaJson(wrapped);
    expect(out.document.id).toBe("0:0");
  });

  it("rejects payloads without 'document'", () => {
    expect(() => parseFigmaJson("{}")).toThrow(/document/);
  });
});

describe("indexDocument", () => {
  it("indexes nodes and finds pages", () => {
    const file = parseFigmaJson(minimalFile);
    const idx = indexDocument(file);
    expect(idx.byId.size).toBeGreaterThanOrEqual(6);
    expect(idx.pages).toHaveLength(1);
    expect(idx.pages[0]?.id).toBe("0:1");
    expect(idx.parentOf.get("1:1")).toBe("0:1");
  });
});

describe("surveyAssets", () => {
  it("collects imageRefs and export candidates", () => {
    const file = parseFigmaJson(minimalFile);
    const survey = surveyAssets(file.document);
    expect(survey.imageRefs.has("abc")).toBe(true);
    expect(survey.exportCandidates.has("1:4")).toBe(true);
  });
});
