import type { Node, TypeStyle } from "@figma-render/core";
import { buildNodeStyle } from "../style/nodeStyle.js";
import { textStyleToCss, verticalAlignToCss } from "../style/text.js";
import { useRenderContext } from "../context.js";

interface TextNodeProps {
  node: Node & {
    characters?: string;
    style?: TypeStyle;
    fills?: readonly unknown[];
    characterStyleOverrides?: readonly number[];
    styleOverrideTable?: Record<string, TypeStyle>;
    lineIndentations?: readonly number[];
    lineTypes?: readonly string[];
  };
  parent: Node | null;
}

interface TextRun {
  text: string;
  styleId: number;
}

/**
 * Group consecutive characters with the same styleOverride id into runs so we
 * emit one <span> per run instead of per character.
 */
function groupRuns(text: string, overrides: readonly number[] | undefined): TextRun[] {
  if (!overrides || overrides.length === 0) return [{ text, styleId: 0 }];
  const runs: TextRun[] = [];
  let current: TextRun | null = null;
  for (let i = 0; i < text.length; i++) {
    const id = overrides[i] ?? 0;
    const ch = text[i] ?? "";
    if (current && current.styleId === id) {
      current.text += ch;
    } else {
      current = { text: ch, styleId: id };
      runs.push(current);
    }
  }
  return runs;
}

export function TextNode({ node, parent }: TextNodeProps) {
  const ctx = useRenderContext();
  const baseStyle = buildNodeStyle(node, { parent, images: ctx.bundle.images });
  const baseText = textStyleToCss(node.style, node.fills as never);
  const vertical = verticalAlignToCss(node.style);

  // Strip background that isn't intended for text (Figma TEXT.fills carries the *text* color,
  // not a background color); we already passed it into textStyleToCss for `color`.
  delete baseStyle.backgroundColor;
  delete baseStyle.backgroundImage;
  delete baseStyle.backgroundSize;
  delete baseStyle.backgroundPosition;
  delete baseStyle.backgroundRepeat;

  const merged: React.CSSProperties = {
    ...baseStyle,
    ...vertical,
    ...baseText,
    whiteSpace: "pre-wrap",
    wordBreak: node.style?.textAutoResize === "WIDTH_AND_HEIGHT" ? "keep-all" : "break-word",
  };

  const text = node.characters ?? "";
  const runs = groupRuns(text, node.characterStyleOverrides);
  const overrides = node.styleOverrideTable ?? {};

  return (
    <div data-figma-id={node.id} data-figma-type="TEXT" style={merged}>
      {runs.map((run, idx) => {
        if (run.styleId === 0) {
          return <span key={idx}>{run.text}</span>;
        }
        const override = overrides[String(run.styleId)];
        const runStyle = textStyleToCss({ ...node.style, ...(override ?? {}) } as TypeStyle);
        return (
          <span key={idx} style={runStyle}>
            {run.text}
          </span>
        );
      })}
    </div>
  );
}
