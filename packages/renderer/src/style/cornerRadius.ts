import { round } from "./color.js";

interface CornerNode {
  cornerRadius?: number;
  rectangleCornerRadii?: readonly [number, number, number, number];
}

export function cornerRadiusToCss(node: CornerNode): React.CSSProperties {
  if (node.rectangleCornerRadii) {
    const [tl, tr, br, bl] = node.rectangleCornerRadii;
    return {
      borderRadius: `${round(tl, 3)}px ${round(tr, 3)}px ${round(br, 3)}px ${round(bl, 3)}px`,
    };
  }
  if (node.cornerRadius) return { borderRadius: round(node.cornerRadius, 3) };
  return {};
}
