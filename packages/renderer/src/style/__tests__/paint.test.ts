import { describe, it, expect } from "vitest";
import { paintsToBackground } from "../paint.js";
import { strokeToCss } from "../stroke.js";
import { effectsToCss } from "../effect.js";
import { autoLayoutToCss, autoLayoutChildToCss } from "../layout.js";
import { cornerRadiusToCss } from "../cornerRadius.js";
import { textStyleToCss } from "../text.js";

describe("paintsToBackground", () => {
  it("returns empty for no paints", () => {
    expect(paintsToBackground(undefined, { images: {} })).toEqual({});
    expect(paintsToBackground([], { images: {} })).toEqual({});
  });

  it("renders a single SOLID as backgroundColor", () => {
    const out = paintsToBackground(
      [{ type: "SOLID", color: { r: 1, g: 0, b: 0 }, blendMode: "NORMAL" } as never],
      { images: {} },
    );
    expect(out.backgroundColor).toBe("rgb(255, 0, 0)");
  });

  it("renders a linear gradient with stops", () => {
    const out = paintsToBackground(
      [
        {
          type: "GRADIENT_LINEAR",
          blendMode: "NORMAL",
          gradientHandlePositions: [
            { x: 0, y: 0 },
            { x: 0, y: 1 },
          ],
          gradientStops: [
            { color: { r: 0, g: 0, b: 0, a: 1 }, position: 0 },
            { color: { r: 1, g: 1, b: 1, a: 1 }, position: 1 },
          ],
        } as never,
      ],
      { images: {} },
    );
    expect(out.backgroundImage).toContain("linear-gradient(180deg");
    expect(out.backgroundImage).toContain("0%");
    expect(out.backgroundImage).toContain("100%");
  });

  it("uses CDN URL for IMAGE paints", () => {
    const out = paintsToBackground(
      [{ type: "IMAGE", scaleMode: "FILL", imageRef: "abc" } as never],
      { images: { abc: "https://figma.cdn/img.png" } },
    );
    expect(out.backgroundImage).toContain('url("https://figma.cdn/img.png")');
    expect(out.backgroundSize).toBe("cover");
  });
});

describe("strokeToCss", () => {
  it("renders a solid border for INSIDE alignment", () => {
    const out = strokeToCss({
      strokes: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 } } as never],
      strokeWeight: 2,
      strokeAlign: "INSIDE",
    });
    expect(out.borderStyle).toBe("solid");
    expect(out.borderWidth).toBe(2);
  });

  it("uses box-shadow for OUTSIDE alignment", () => {
    const out = strokeToCss({
      strokes: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 } } as never],
      strokeWeight: 2,
      strokeAlign: "OUTSIDE",
    });
    expect(out.boxShadow).toContain("0 0 0 2px");
  });
});

describe("effectsToCss", () => {
  it("compiles drop and inner shadows together", () => {
    const out = effectsToCss([
      {
        type: "DROP_SHADOW",
        visible: true,
        color: { r: 0, g: 0, b: 0, a: 0.5 },
        offset: { x: 0, y: 4 },
        radius: 8,
        spread: 0,
        blendMode: "NORMAL",
      } as never,
      {
        type: "INNER_SHADOW",
        visible: true,
        color: { r: 0, g: 0, b: 0, a: 0.25 },
        offset: { x: 0, y: 2 },
        radius: 4,
        spread: 0,
        blendMode: "NORMAL",
      } as never,
    ]);
    expect(out.boxShadow).toContain("0px 4px 8px");
    expect(out.boxShadow).toContain("inset");
  });

  it("maps LAYER_BLUR to filter and BACKGROUND_BLUR to backdrop-filter", () => {
    const out = effectsToCss([
      { type: "LAYER_BLUR", radius: 4, visible: true } as never,
      { type: "BACKGROUND_BLUR", radius: 8, visible: true } as never,
    ]);
    expect(out.filter).toBe("blur(4px)");
    expect(out.backdropFilter).toBe("blur(8px)");
  });
});

describe("autoLayoutToCss", () => {
  it("returns {} for layoutMode NONE", () => {
    expect(autoLayoutToCss({ layoutMode: "NONE" })).toEqual({});
  });

  it("renders a horizontal flex container with gap and padding", () => {
    const out = autoLayoutToCss({
      layoutMode: "HORIZONTAL",
      primaryAxisAlignItems: "CENTER",
      counterAxisAlignItems: "CENTER",
      paddingTop: 8,
      paddingBottom: 8,
      paddingLeft: 16,
      paddingRight: 16,
      itemSpacing: 12,
    });
    expect(out.display).toBe("flex");
    expect(out.flexDirection).toBe("row");
    expect(out.justifyContent).toBe("center");
    expect(out.alignItems).toBe("center");
    expect(out.gap).toBe(12);
    expect(out.paddingLeft).toBe(16);
  });

  it("translates STRETCH to align-self", () => {
    const out = autoLayoutChildToCss({ layoutAlign: "STRETCH" }, "HORIZONTAL");
    expect(out.alignSelf).toBe("stretch");
  });
});

describe("cornerRadiusToCss", () => {
  it("uses uniform cornerRadius", () => {
    expect(cornerRadiusToCss({ cornerRadius: 8 })).toEqual({ borderRadius: 8 });
  });
  it("uses per-corner radii when provided", () => {
    expect(cornerRadiusToCss({ rectangleCornerRadii: [1, 2, 3, 4] })).toEqual({
      borderRadius: "1px 2px 3px 4px",
    });
  });
});

describe("textStyleToCss", () => {
  it("converts font, weight, size, line-height (px), letterSpacing", () => {
    const out = textStyleToCss({
      fontFamily: "Inter",
      fontWeight: 600,
      fontSize: 14,
      lineHeightUnit: "PIXELS",
      lineHeightPx: 20,
      letterSpacing: 0.5,
      textAlignHorizontal: "CENTER",
    } as never);
    expect(out.fontFamily).toContain('"Inter"');
    expect(out.fontWeight).toBe(600);
    expect(out.fontSize).toBe(14);
    expect(out.lineHeight).toBe("20px");
    expect(out.textAlign).toBe("center");
  });
});
