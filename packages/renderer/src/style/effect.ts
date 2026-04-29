import type { Effect } from "@figma-render/core";
import { colorToCss, round } from "./color.js";

/**
 * Convert Figma effects into CSS. Returns separate buckets so callers can
 * decide where to apply each (filter on the wrapper, box-shadow on the box).
 */
export interface EffectStyles {
  boxShadow?: string;
  filter?: string;
  backdropFilter?: string;
}

export function effectsToCss(effects: readonly Effect[] | undefined): EffectStyles {
  if (!effects?.length) return {};
  const shadows: string[] = [];
  const filters: string[] = [];
  const backdrop: string[] = [];

  for (const eff of effects) {
    if (eff.visible === false) continue;
    switch (eff.type) {
      case "DROP_SHADOW": {
        const c = colorToCss(eff.color);
        shadows.push(
          `${round(eff.offset.x, 2)}px ${round(eff.offset.y, 2)}px ${round(eff.radius, 2)}px ${round(eff.spread ?? 0, 2)}px ${c}`,
        );
        break;
      }
      case "INNER_SHADOW": {
        const c = colorToCss(eff.color);
        shadows.push(
          `inset ${round(eff.offset.x, 2)}px ${round(eff.offset.y, 2)}px ${round(eff.radius, 2)}px ${round(eff.spread ?? 0, 2)}px ${c}`,
        );
        break;
      }
      case "LAYER_BLUR":
        filters.push(`blur(${round(eff.radius, 2)}px)`);
        break;
      case "BACKGROUND_BLUR":
        backdrop.push(`blur(${round(eff.radius, 2)}px)`);
        break;
    }
  }

  const out: EffectStyles = {};
  if (shadows.length) out.boxShadow = shadows.join(", ");
  if (filters.length) out.filter = filters.join(" ");
  if (backdrop.length) out.backdropFilter = backdrop.join(" ");
  return out;
}
