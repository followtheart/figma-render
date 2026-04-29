import { describe, it, expect } from "vitest";
import { absolutePositionToCss } from "../layout.js";

const parent = { absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 100 } };

function node(opts: {
  x?: number;
  y?: number;
  w: number;
  h: number;
  h_constraint?: string;
  v_constraint?: string;
  rt?: number[][];
}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  return {
    size: { x: opts.w, y: opts.h },
    absoluteBoundingBox: { x, y, width: opts.w, height: opts.h },
    relativeTransform: opts.rt ?? [
      [1, 0, x],
      [0, 1, y],
    ],
    constraints: { horizontal: opts.h_constraint, vertical: opts.v_constraint },
  };
}

describe("absolutePositionToCss with constraints", () => {
  it("LEFT/TOP -> left+top with fixed width/height", () => {
    const css = absolutePositionToCss(
      node({ x: 10, y: 20, w: 50, h: 30, h_constraint: "LEFT", v_constraint: "TOP" }) as never,
      parent as never,
    );
    expect(css).toMatchObject({ position: "absolute", left: 10, top: 20, width: 50, height: 30 });
  });

  it("RIGHT/BOTTOM -> right+bottom anchored to far edge", () => {
    const css = absolutePositionToCss(
      node({ x: 130, y: 60, w: 50, h: 30, h_constraint: "RIGHT", v_constraint: "BOTTOM" }) as never,
      parent as never,
    );
    expect(css).toMatchObject({ right: 20, bottom: 10, width: 50, height: 30 });
    expect(css.left).toBeUndefined();
    expect(css.top).toBeUndefined();
  });

  it("LEFT_RIGHT/TOP_BOTTOM -> stretches with both edges", () => {
    const css = absolutePositionToCss(
      node({
        x: 10,
        y: 5,
        w: 180,
        h: 90,
        h_constraint: "LEFT_RIGHT",
        v_constraint: "TOP_BOTTOM",
      }) as never,
      parent as never,
    );
    expect(css).toMatchObject({ left: 10, right: 10, top: 5, bottom: 5 });
    expect(css.width).toBeUndefined();
    expect(css.height).toBeUndefined();
  });

  it("CENTER -> calc(50% + offset) keeps anchor on resize", () => {
    const css = absolutePositionToCss(
      node({ x: 75, y: 35, w: 50, h: 30, h_constraint: "CENTER", v_constraint: "CENTER" }) as never,
      parent as never,
    );
    // x+w/2 - pw/2 = 75+25 - 100 = 0; left = calc(50% + (0 - 25)px) = calc(50% + -25px)
    expect(css.left).toBe("calc(50% + -25px)");
    expect(css.top).toBe("calc(50% + -15px)");
    expect(css.width).toBe(50);
    expect(css.height).toBe(30);
  });

  it("SCALE -> percentage left/width", () => {
    const css = absolutePositionToCss(
      node({ x: 50, y: 25, w: 100, h: 50, h_constraint: "SCALE", v_constraint: "SCALE" }) as never,
      parent as never,
    );
    expect(css.left).toBe("25%");
    expect(css.width).toBe("50%");
    expect(css.top).toBe("25%");
    expect(css.height).toBe("50%");
  });

  it("rotated nodes fall back to matrix() and ignore constraints", () => {
    const css = absolutePositionToCss(
      {
        size: { x: 50, y: 30 },
        absoluteBoundingBox: { x: 10, y: 10, width: 50, height: 30 },
        // 90° rotation
        relativeTransform: [
          [0, -1, 40],
          [1, 0, 10],
        ],
        constraints: { horizontal: "RIGHT", vertical: "BOTTOM" },
      } as never,
      parent as never,
    );
    expect(css.transform).toContain("matrix(");
    expect(css.left).toBe(0);
    expect(css.top).toBe(0);
    expect(css.right).toBeUndefined();
  });
});
