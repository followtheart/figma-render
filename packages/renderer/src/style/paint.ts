import type { Paint, ColorStop } from "@figma-render/core";
import { colorToCss, round } from "./color.js";

export interface PaintContext {
  /** Map imageRef hash -> URL. */
  images: Record<string, string>;
}

interface PaintLayer {
  /** background-image (or null for SOLID layers). */
  image: string | null;
  /** background-color (only used for SOLID-only single-layer case). */
  color: string | null;
  size?: string;
  position?: string;
  repeat?: string;
}

/** Convert a Paint[] into CSS background properties. */
export function paintsToBackground(
  paints: readonly Paint[] | undefined,
  ctx: PaintContext,
): React.CSSProperties {
  if (!paints || paints.length === 0) return {};
  const visible = paints.filter((p) => p.visible !== false);
  if (visible.length === 0) return {};

  // Figma renders the FIRST paint on top; CSS multi-background renders the FIRST first too.
  // So no reordering needed.
  const layers = visible.map(toLayer).filter((l): l is PaintLayer => l !== null);
  if (layers.length === 0) return {};

  // Single solid -> just background-color (avoids painting a gradient over nothing).
  if (layers.length === 1 && layers[0]!.image === null && layers[0]!.color !== null) {
    return { backgroundColor: layers[0]!.color };
  }

  const images: string[] = [];
  const sizes: string[] = [];
  const positions: string[] = [];
  const repeats: string[] = [];
  let solidColor: string | null = null;

  for (const layer of layers) {
    if (layer.image !== null) {
      images.push(layer.image);
      sizes.push(layer.size ?? "auto");
      positions.push(layer.position ?? "0 0");
      repeats.push(layer.repeat ?? "no-repeat");
    } else if (layer.color !== null) {
      // Solid layer: model as a flat gradient stack so it composes with images above it.
      images.push(`linear-gradient(${layer.color}, ${layer.color})`);
      sizes.push("auto");
      positions.push("0 0");
      repeats.push("no-repeat");
      solidColor = layer.color; // last solid wins as fallback bg color
    }
  }

  const out: React.CSSProperties = {
    backgroundImage: images.join(", "),
    backgroundSize: sizes.join(", "),
    backgroundPosition: positions.join(", "),
    backgroundRepeat: repeats.join(", "),
  };
  if (solidColor) out.backgroundColor = solidColor;
  return out;

  function toLayer(paint: Paint): PaintLayer | null {
    const opacity = paint.opacity ?? 1;
    switch (paint.type) {
      case "SOLID":
        return { image: null, color: colorToCss(paint.color, opacity) };
      case "GRADIENT_LINEAR":
        return { image: linearGradient(paint, opacity), color: null };
      case "GRADIENT_RADIAL":
        return { image: radialGradient(paint, opacity), color: null };
      case "GRADIENT_ANGULAR":
        return { image: conicGradient(paint, opacity), color: null };
      case "GRADIENT_DIAMOND":
        // CSS has no diamond gradient; approximate with a rotated radial.
        return { image: radialGradient(paint, opacity), color: null };
      case "IMAGE":
        return imageLayer(paint, ctx);
      default:
        return null;
    }
  }
}

interface GradientPaint {
  gradientHandlePositions: { x: number; y: number }[];
  gradientStops: ColorStop[];
}

function stops(stops: readonly ColorStop[], opacity: number): string {
  return stops
    .map((s) => `${colorToCss(s.color, opacity)} ${round((s.position ?? 0) * 100, 2)}%`)
    .join(", ");
}

function linearGradient(paint: Paint & GradientPaint, opacity: number): string {
  // Figma handles[0] = start, handles[1] = end, in 0..1 unit-square coords.
  const [start, end] = paint.gradientHandlePositions;
  if (!start || !end) return "linear-gradient(to bottom, transparent, transparent)";
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  // CSS angle: 0deg = up, 90deg = right. In Figma's coords y increases downward.
  const angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return `linear-gradient(${round(angle, 2)}deg, ${stops(paint.gradientStops, opacity)})`;
}

function radialGradient(paint: Paint & GradientPaint, opacity: number): string {
  const [center, edge] = paint.gradientHandlePositions;
  if (!center || !edge) return "radial-gradient(transparent, transparent)";
  const cx = round(center.x * 100, 2);
  const cy = round(center.y * 100, 2);
  const dx = (edge.x - center.x) * 100;
  const dy = (edge.y - center.y) * 100;
  const radius = round(Math.hypot(dx, dy), 2);
  return `radial-gradient(circle ${radius}% at ${cx}% ${cy}%, ${stops(paint.gradientStops, opacity)})`;
}

function conicGradient(paint: Paint & GradientPaint, opacity: number): string {
  const [center, edge] = paint.gradientHandlePositions;
  if (!center || !edge) return "conic-gradient(transparent, transparent)";
  const cx = round(center.x * 100, 2);
  const cy = round(center.y * 100, 2);
  const angle = (Math.atan2(edge.y - center.y, edge.x - center.x) * 180) / Math.PI;
  return `conic-gradient(from ${round(angle, 2)}deg at ${cx}% ${cy}%, ${stops(paint.gradientStops, opacity)})`;
}

function imageLayer(
  paint: Paint & {
    imageRef?: string;
    scaleMode?: "FILL" | "FIT" | "TILE" | "STRETCH";
    scalingFactor?: number;
  },
  ctx: PaintContext,
): PaintLayer | null {
  const ref = paint.imageRef;
  if (!ref) return null;
  const url = ctx.images[ref];
  if (!url) return null;
  const mode = paint.scaleMode ?? "FILL";
  let size: string;
  let repeat: string;
  switch (mode) {
    case "FIT":
      size = "contain";
      repeat = "no-repeat";
      break;
    case "TILE":
      size = paint.scalingFactor ? `${round(paint.scalingFactor * 100, 2)}%` : "auto";
      repeat = "repeat";
      break;
    case "STRETCH":
      size = "100% 100%";
      repeat = "no-repeat";
      break;
    case "FILL":
    default:
      size = "cover";
      repeat = "no-repeat";
      break;
  }
  return {
    image: `url("${escapeUrl(url)}")`,
    color: null,
    size,
    position: "center",
    repeat,
  };
}

function escapeUrl(url: string): string {
  return url.replace(/"/g, '\\"');
}
