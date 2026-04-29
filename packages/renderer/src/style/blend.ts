/**
 * Map Figma blendMode to CSS mix-blend-mode. Falls back to 'normal' when the
 * mode has no CSS analogue.
 */
const BLEND_MAP: Record<string, string> = {
  PASS_THROUGH: "normal",
  NORMAL: "normal",
  DARKEN: "darken",
  MULTIPLY: "multiply",
  COLOR_BURN: "color-burn",
  LIGHTEN: "lighten",
  SCREEN: "screen",
  COLOR_DODGE: "color-dodge",
  OVERLAY: "overlay",
  SOFT_LIGHT: "soft-light",
  HARD_LIGHT: "hard-light",
  DIFFERENCE: "difference",
  EXCLUSION: "exclusion",
  HUE: "hue",
  SATURATION: "saturation",
  COLOR: "color",
  LUMINOSITY: "luminosity",
};

export function blendModeToCss(mode: string | undefined): React.CSSProperties {
  if (!mode) return {};
  const css = BLEND_MAP[mode];
  if (!css || css === "normal") return {};
  return { mixBlendMode: css as React.CSSProperties["mixBlendMode"] };
}
