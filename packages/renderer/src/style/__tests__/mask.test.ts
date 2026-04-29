import { describe, it, expect } from "vitest";
import { buildMaskCss, isMaskNode } from "../mask.js";

const parent = { absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 100 } };

describe("isMaskNode", () => {
  it("detects isMask flag", () => {
    expect(isMaskNode({ isMask: true } as never)).toBe(true);
    expect(isMaskNode({} as never)).toBe(false);
  });
});

describe("buildMaskCss", () => {
  it("returns null without bounding box", () => {
    expect(buildMaskCss({ id: "a", type: "RECTANGLE" } as never, {} as never)).toBeNull();
  });

  it("emits an SVG mask-image data URL for a RECTANGLE mask", () => {
    const css = buildMaskCss(
      {
        id: "m",
        type: "RECTANGLE",
        cornerRadius: 8,
        absoluteBoundingBox: { x: 10, y: 20, width: 50, height: 30 },
      } as never,
      parent as never,
    );
    expect(css).not.toBeNull();
    const url = (css as { maskImage: string }).maskImage;
    expect(url).toMatch(/^url\("data:image\/svg\+xml;utf8,/);
    const svg = decodeURIComponent(url.replace(/^url\("data:image\/svg\+xml;utf8,/, "").replace(/"\)$/, ""));
    expect(svg).toContain('width="200"');
    expect(svg).toContain('height="100"');
    expect(svg).toContain('<rect x="10" y="20" width="50" height="30" rx="8" ry="8" fill="white"/>');
  });

  it("uses fillGeometry paths for VECTOR masks", () => {
    const css = buildMaskCss(
      {
        id: "v",
        type: "VECTOR",
        absoluteBoundingBox: { x: 5, y: 5, width: 40, height: 40 },
        fillGeometry: [{ path: "M0 0 L10 10 Z", windingRule: "EVENODD" }],
      } as never,
      parent as never,
    );
    const url = (css as { maskImage: string }).maskImage;
    const svg = decodeURIComponent(url.replace(/^url\("data:image\/svg\+xml;utf8,/, "").replace(/"\)$/, ""));
    expect(svg).toContain("translate(5,5)");
    expect(svg).toContain('d="M0 0 L10 10 Z"');
    expect(svg).toContain('fill-rule="evenodd"');
  });
});
