import { describe, it, expect } from "vitest";
import { strokeToCss } from "../stroke.js";

const solidBlack = {
  type: "SOLID" as const,
  color: { r: 0, g: 0, b: 0, a: 1 },
  blendMode: "NORMAL" as const,
};

describe("strokeToCss dashPattern", () => {
  it("solid stroke: no border-image, plain solid border", () => {
    const css = strokeToCss({
      strokes: [solidBlack],
      strokeWeight: 2,
      strokeAlign: "INSIDE",
    });
    expect(css.borderStyle).toBe("solid");
    expect(css.borderImageSource).toBeUndefined();
  });

  it("dashed [6, 4] -> border-image with repeating-linear-gradient", () => {
    const css = strokeToCss({
      strokes: [solidBlack],
      strokeWeight: 2,
      strokeAlign: "INSIDE",
      strokeDashes: [6, 4],
    });
    expect(css.borderStyle).toBe("solid");
    expect(css.borderColor).toBe("transparent");
    expect(css.borderWidth).toBe(2);
    expect(css.borderImageSlice).toBe(2);
    expect(css.borderImageRepeat).toBe("round");
    const src = css.borderImageSource as string;
    expect(src).toMatch(/^repeating-linear-gradient\(to right,/);
    // [6, 4] -> dash 0..6, gap 6..10
    expect(src).toContain("rgb(0, 0, 0) 0px 6px");
    expect(src).toContain("transparent 6px 10px");
  });

  it("dashed multi-segment [4, 2, 8, 2] keeps every run", () => {
    const css = strokeToCss({
      strokes: [solidBlack],
      strokeWeight: 1,
      strokeDashes: [4, 2, 8, 2],
    });
    const src = css.borderImageSource as string;
    expect(src).toContain("rgb(0, 0, 0) 0px 4px");
    expect(src).toContain("transparent 4px 6px");
    expect(src).toContain("rgb(0, 0, 0) 6px 14px");
    expect(src).toContain("transparent 14px 16px");
  });

  it("OUTSIDE align ignores dashes (box-shadow can't dash)", () => {
    const css = strokeToCss({
      strokes: [solidBlack],
      strokeWeight: 2,
      strokeAlign: "OUTSIDE",
      strokeDashes: [6, 4],
    });
    expect(css.boxShadow).toBe("0 0 0 2px rgb(0, 0, 0)");
    expect(css.borderImageSource).toBeUndefined();
  });

  it("individualStrokeWeights + dashes -> per-side slice", () => {
    const css = strokeToCss({
      strokes: [solidBlack],
      strokeWeight: 2,
      individualStrokeWeights: { top: 2, right: 4, bottom: 2, left: 4 },
      strokeDashes: [3, 3],
    });
    expect(css.borderImageSource).toBeDefined();
    expect(css.borderImageSlice).toBe("2 4 2 4");
    expect(css.borderColor).toBe("transparent");
  });
});
