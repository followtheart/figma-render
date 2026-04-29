import type { Paint, TypeStyle } from "@figma-render/core";
import { colorToCss, round } from "./color.js";

const FONT_FALLBACK = '"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif';

export function textStyleToCss(style: TypeStyle | undefined, fills?: readonly Paint[]): React.CSSProperties {
  if (!style) return {};
  const out: React.CSSProperties = {};

  if (style.fontFamily) {
    out.fontFamily = `"${style.fontFamily}", ${FONT_FALLBACK}`;
  }
  if (style.fontWeight) out.fontWeight = style.fontWeight;
  if (style.italic) out.fontStyle = "italic";
  if (style.fontSize) out.fontSize = round(style.fontSize, 3);

  // line-height: prefer px (pixels) when present, fall back to percent.
  const lhPct = (style as { lineHeightPercentFontSize?: number }).lineHeightPercentFontSize;
  const lhPx = (style as { lineHeightPx?: number }).lineHeightPx;
  const lhUnit = (style as { lineHeightUnit?: string }).lineHeightUnit;
  if (lhUnit === "PIXELS" && typeof lhPx === "number") {
    out.lineHeight = `${round(lhPx, 3)}px`;
  } else if (typeof lhPct === "number") {
    out.lineHeight = `${round(lhPct / 100, 4)}`;
  } else if (typeof lhPx === "number") {
    out.lineHeight = `${round(lhPx, 3)}px`;
  }

  if (typeof style.letterSpacing === "number" && style.letterSpacing !== 0) {
    out.letterSpacing = round(style.letterSpacing, 3);
  }

  switch (style.textAlignHorizontal) {
    case "LEFT":
      out.textAlign = "left";
      break;
    case "CENTER":
      out.textAlign = "center";
      break;
    case "RIGHT":
      out.textAlign = "right";
      break;
    case "JUSTIFIED":
      out.textAlign = "justify";
      break;
  }

  switch (style.textCase) {
    case "UPPER":
      out.textTransform = "uppercase";
      break;
    case "LOWER":
      out.textTransform = "lowercase";
      break;
    case "TITLE":
      out.textTransform = "capitalize";
      break;
    case "SMALL_CAPS":
      out.fontVariant = "small-caps";
      break;
  }

  switch (style.textDecoration) {
    case "UNDERLINE":
      out.textDecoration = "underline";
      break;
    case "STRIKETHROUGH":
      out.textDecoration = "line-through";
      break;
  }

  // Vertical alignment (within a fixed-size text frame) maps to align-items via the wrapper.
  // The TextNode component handles that, not this function.

  // Color from the first solid fill.
  const fill = fills?.find((p) => p.type === "SOLID" && p.visible !== false);
  if (fill && fill.type === "SOLID") {
    out.color = colorToCss(fill.color, fill.opacity ?? 1);
  }

  return out;
}

const VERT_ALIGN: Record<string, string> = {
  TOP: "flex-start",
  CENTER: "center",
  BOTTOM: "flex-end",
};

export function verticalAlignToCss(style: TypeStyle | undefined): React.CSSProperties {
  const v = style?.textAlignVertical;
  if (!v) return {};
  return { display: "flex", flexDirection: "column", justifyContent: VERT_ALIGN[v] ?? "flex-start" };
}
