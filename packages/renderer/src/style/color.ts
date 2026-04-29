/** Figma colors are 0..1 floats with optional alpha. */
export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export function colorToCss(color: FigmaColor, opacity = 1): string {
  const r = Math.round(clamp01(color.r) * 255);
  const g = Math.round(clamp01(color.g) * 255);
  const b = Math.round(clamp01(color.b) * 255);
  const a = clamp01((color.a ?? 1) * opacity);
  return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${round(a, 4)})`;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function round(v: number, digits = 3): number {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}
