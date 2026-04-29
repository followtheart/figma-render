/**
 * Convert a Figma desktop binary `.fig` file into our internal `FigmaBundle`
 * shape (which mirrors the Figma REST API). Backed by `openfig-core`, an
 * isomorphic reverse-engineered parser of the kiwi-encoded fig format.
 *
 * The `.fig` format is private to Figma and was reverse-engineered by the
 * OpenFig project; field coverage is therefore best-effort. This converter
 * intentionally restricts itself to the subset of properties our renderer
 * actually consumes:
 *
 *   - Hierarchy (DOCUMENT / CANVAS / FRAME / GROUP / TEXT / SHAPE / VECTOR /
 *     COMPONENT / COMPONENT_SET / INSTANCE)
 *   - Geometry: relativeTransform + absoluteBoundingBox (computed by walking
 *     parent transforms)
 *   - Auto-layout (stackMode → layoutMode + spacing/padding/alignment)
 *   - Fills (SOLID + IMAGE + linear/radial gradients), strokes, cornerRadius,
 *     opacity, blendMode, visible
 *   - Effects (drop/inner shadow, layer/background blur)
 *   - Text characters + base style (font family/size/weight, alignment)
 *   - Images: every binary in the .fig zip becomes a data: URL keyed by its
 *     hash (matching Figma's SHA-1 imageRef convention).
 *
 * Anything not in this whitelist is dropped silently. Per-character text
 * style runs and vector path geometry are not yet emitted.
 */

import { parseFig, nodeId, type FigDocument, type FigNode } from "openfig-core";
import type { FigmaBundle } from "@figma-render/core";

// REST API node type whitelist that our renderer recognises. We map fig's
// raw type strings (which use slightly different names like ROUNDED_RECTANGLE
// or SYMBOL) onto these.
const TYPE_MAP: Record<string, string> = {
  DOCUMENT: "DOCUMENT",
  CANVAS: "CANVAS",
  FRAME: "FRAME",
  GROUP: "GROUP",
  SECTION: "SECTION",
  RECTANGLE: "RECTANGLE",
  ROUNDED_RECTANGLE: "RECTANGLE",
  ELLIPSE: "ELLIPSE",
  LINE: "LINE",
  REGULAR_POLYGON: "REGULAR_POLYGON",
  STAR: "STAR",
  VECTOR: "VECTOR",
  BOOLEAN_OPERATION: "BOOLEAN_OPERATION",
  TEXT: "TEXT",
  SYMBOL: "COMPONENT",
  COMPONENT: "COMPONENT",
  SYMBOL_SET: "COMPONENT_SET",
  COMPONENT_SET: "COMPONENT_SET",
  INSTANCE: "INSTANCE",
  STICKY: "STICKY",
  SLICE: "SLICE",
};

interface ConvertedNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  opacity?: number;
  blendMode?: string;
  fills?: unknown[];
  strokes?: unknown[];
  strokeWeight?: number;
  strokeAlign?: string;
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  effects?: unknown[];
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  relativeTransform?: number[][];
  size?: { x: number; y: number };
  children?: ConvertedNode[];
  // Auto-layout
  layoutMode?: "HORIZONTAL" | "VERTICAL";
  itemSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  primaryAxisSizingMode?: string;
  counterAxisSizingMode?: string;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  // Text
  characters?: string;
  style?: Record<string, unknown>;
  // Component instance
  componentId?: string;
  // Catch-all so the renderer can still see passthrough fields if needed.
  [key: string]: unknown;
}

// 2x3 affine matrix multiply (a * b), in fig's m00..m12 layout.
type M = { m00: number; m01: number; m02: number; m10: number; m11: number; m12: number };
const IDENTITY: M = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };
function mul(a: M, b: M): M {
  return {
    m00: a.m00 * b.m00 + a.m01 * b.m10,
    m01: a.m00 * b.m01 + a.m01 * b.m11,
    m02: a.m00 * b.m02 + a.m01 * b.m12 + a.m02,
    m10: a.m10 * b.m00 + a.m11 * b.m10,
    m11: a.m10 * b.m01 + a.m11 * b.m11,
    m12: a.m10 * b.m02 + a.m11 * b.m12 + a.m12,
  };
}
function transformPoint(m: M, x: number, y: number): { x: number; y: number } {
  return { x: m.m00 * x + m.m01 * y + m.m02, y: m.m10 * x + m.m11 * y + m.m12 };
}

// Compute the axis-aligned bbox of a (w,h) rect after applying matrix `m`.
function bboxOf(m: M, w: number, h: number): { x: number; y: number; width: number; height: number } {
  const corners = [
    transformPoint(m, 0, 0),
    transformPoint(m, w, 0),
    transformPoint(m, 0, h),
    transformPoint(m, w, h),
  ];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

function bytesToHex(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += b[i]!.toString(16).padStart(2, "0");
  return s;
}

// fig stores image bytes; the renderer wants `imageRef` keys → data URLs.
function buildImageMap(images: Map<string, Uint8Array>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [filename, bytes] of images) {
    // Filenames usually follow `images/<sha1hex>` or just `<sha1hex>` after
    // strip-prefix; openfig-core already strips the `images/` prefix.
    const hash = filename.replace(/\.(png|jpe?g|webp|gif|svg)$/i, "");
    const mime = filename.match(/\.(png|jpe?g|webp|gif|svg)$/i)
      ? mimeFromExt(filename)
      : sniffMime(bytes);
    const b64 = bytesToBase64(bytes);
    out[hash] = `data:${mime};base64,${b64}`;
  }
  return out;
}

function mimeFromExt(name: string): string {
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.jpe?g$/i.test(name)) return "image/jpeg";
  if (/\.webp$/i.test(name)) return "image/webp";
  if (/\.gif$/i.test(name)) return "image/gif";
  if (/\.svg$/i.test(name)) return "image/svg+xml";
  return "application/octet-stream";
}
function sniffMime(b: Uint8Array): string {
  // Cheap magic-byte sniff so paints that reference raw blob hashes still render.
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (b.length >= 12 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return "image/png";
}
function bytesToBase64(b: Uint8Array): string {
  // Chunked btoa to avoid stack blow-ups on large blobs.
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < b.length; i += chunk) {
    s += String.fromCharCode(...b.subarray(i, i + chunk));
  }
  return btoa(s);
}

function mapType(t: string, node: FigNode): string {
  // GROUP-like FRAMEs in fig are encoded as FRAME with resizeToFit:true.
  if (t === "FRAME" && node.resizeToFit) return "GROUP";
  return TYPE_MAP[t] ?? t;
}

function imageHashOf(p: { image?: { hash?: Uint8Array | string } }): string | undefined {
  const h = p.image?.hash;
  if (!h) return undefined;
  return typeof h === "string" ? h : bytesToHex(h);
}

function convertPaint(p: Record<string, unknown>): Record<string, unknown> | null {
  const type = (p.type as string) ?? "SOLID";
  const opacity = typeof p.opacity === "number" ? p.opacity : undefined;
  const visible = p.visible !== false;
  const blendMode = p.blendMode as string | undefined;
  const base = { type, opacity, visible, blendMode };

  if (type === "SOLID") {
    const c = p.color as { r: number; g: number; b: number; a: number } | undefined;
    if (!c) return null;
    return { ...base, color: { r: c.r, g: c.g, b: c.b, a: c.a } };
  }

  if (type.startsWith("GRADIENT")) {
    // fig stores the gradient via a 2x3 transform; REST uses normalized
    // gradientHandlePositions. The transform's column vectors map (0,0)/(1,0)/(0,1)
    // in unit-space to gradient start/end/width handles in node-space (already
    // normalized to [0,1]).
    const t = p.transform as M | undefined;
    let handles: { x: number; y: number }[] | undefined;
    if (t) {
      handles = [
        transformPoint(t, 0, 0),
        transformPoint(t, 1, 0),
        transformPoint(t, 0, 1),
      ];
    }
    const stopsRaw = (p.stops as Array<{ color: { r: number; g: number; b: number; a: number }; position: number }> | undefined) ?? [];
    const gradientStops = stopsRaw.map((s) => ({ position: s.position, color: s.color }));
    return { ...base, gradientHandlePositions: handles, gradientStops };
  }

  if (type === "IMAGE") {
    const imageRef = imageHashOf(p as { image?: { hash?: Uint8Array | string } });
    const scaleMode = (p.scaleMode as string) ?? (p.imageScaleMode as string) ?? "FILL";
    return { ...base, imageRef, scaleMode };
  }

  // Unknown paint type: pass type through so the renderer can fallback.
  return { ...base };
}

function convertEffect(e: Record<string, unknown>): Record<string, unknown> {
  // fig uses FOREGROUND_BLUR for what REST calls LAYER_BLUR.
  const t = (e.type as string) === "FOREGROUND_BLUR" ? "LAYER_BLUR" : (e.type as string);
  return {
    type: t,
    color: e.color,
    offset: e.offset,
    radius: e.radius,
    spread: e.spread,
    visible: e.visible !== false,
    blendMode: e.blendMode,
    showShadowBehindNode: e.showShadowBehindNode,
  };
}

function convertTextStyle(node: FigNode): Record<string, unknown> | undefined {
  if (node.type !== "TEXT") return undefined;
  const fontFamily = node.fontName?.family;
  const fontPostScriptName = node.fontName?.postScriptName;
  const style: Record<string, unknown> = {};
  if (fontFamily) style.fontFamily = fontFamily;
  if (fontPostScriptName) style.fontPostScriptName = fontPostScriptName;
  if (typeof node.fontSize === "number") style.fontSize = node.fontSize;
  if (node.textAlignHorizontal) style.textAlignHorizontal = node.textAlignHorizontal;
  // Italic / weight detection from style name (fig stores it textually).
  const styleName = node.fontName?.style ?? "";
  if (/italic|oblique/i.test(styleName)) style.italic = true;
  const weightMatch = styleName.match(/\d{3}/);
  if (weightMatch) style.fontWeight = Number(weightMatch[0]);
  else if (/bold/i.test(styleName)) style.fontWeight = 700;
  else if (/light/i.test(styleName)) style.fontWeight = 300;
  else if (/medium/i.test(styleName)) style.fontWeight = 500;
  return Object.keys(style).length ? style : undefined;
}

function convertNode(
  doc: FigDocument,
  node: FigNode,
  worldTransform: M,
): ConvertedNode {
  const id = nodeId(node) ?? `${node.guid.sessionID}:${node.guid.localID}`;
  const localTransform: M = node.transform ?? IDENTITY;
  const nextWorld = mul(worldTransform, localTransform);

  const w = node.size?.x ?? 0;
  const h = node.size?.y ?? 0;
  const out: ConvertedNode = {
    id,
    name: node.name ?? "",
    type: mapType(node.type, node),
  };

  if (typeof node.opacity === "number") out.opacity = node.opacity;
  if (node.visible === false) out.visible = false;
  if (node.blendMode) out.blendMode = node.blendMode as string;

  // Frame-like nodes clip children by default in Figma. The fig schema flips
  // the polarity: `frameMaskDisabled === true` means "do not clip". Emit the
  // REST-style `clipsContent` so the renderer applies overflow:hidden — without
  // this, INSTANCE / FRAME contents whose sizes don't match the container
  // (e.g. master cloned into a smaller instance, or grand-children of an
  // auto-layout that sum wider than the parent) leak out visibly.
  const mappedType = mapType(node.type, node);
  const isFrameLike =
    mappedType === "FRAME" ||
    mappedType === "COMPONENT" ||
    mappedType === "INSTANCE";
  if (isFrameLike) {
    out.clipsContent = node.frameMaskDisabled !== true;
  }

  // Geometry: emit both an absolute bounding box (used by the renderer's
  // page-relative positioning) and a relativeTransform / size pair.
  if (w > 0 || h > 0) {
    out.absoluteBoundingBox = bboxOf(nextWorld, w, h);
    out.size = { x: w, y: h };
  }
  out.relativeTransform = [
    [localTransform.m00, localTransform.m01, localTransform.m02],
    [localTransform.m10, localTransform.m11, localTransform.m12],
  ];

  // Paints, strokes, effects.
  if (node.fillPaints?.length) {
    const fills = node.fillPaints
      .map((p) => convertPaint(p as unknown as Record<string, unknown>))
      .filter((p): p is Record<string, unknown> => p !== null);
    if (fills.length) out.fills = fills;
  }
  if (node.strokePaints?.length) {
    const strokes = node.strokePaints
      .map((p) => convertPaint(p as unknown as Record<string, unknown>))
      .filter((p): p is Record<string, unknown> => p !== null);
    if (strokes.length) out.strokes = strokes;
  }
  if (typeof node.strokeWeight === "number") out.strokeWeight = node.strokeWeight;
  if (node.strokeAlign) out.strokeAlign = node.strokeAlign;
  if (typeof node.cornerRadius === "number") out.cornerRadius = node.cornerRadius;
  if (Array.isArray((node as { rectangleCornerRadii?: unknown[] }).rectangleCornerRadii)) {
    out.rectangleCornerRadii = (node as { rectangleCornerRadii?: number[] }).rectangleCornerRadii;
  }
  if (node.effects?.length) out.effects = node.effects.map((e) => convertEffect(e as unknown as Record<string, unknown>));

  // Auto-layout.
  if (node.stackMode === "HORIZONTAL" || node.stackMode === "VERTICAL") {
    out.layoutMode = node.stackMode;
    const sp = (node as { stackSpacing?: number }).stackSpacing;
    if (typeof sp === "number") out.itemSpacing = sp;
    const pl = (node as { stackPaddingLeft?: number; stackPaddingRight?: number; stackPaddingTop?: number; stackPaddingBottom?: number; stackHorizontalPadding?: number; stackVerticalPadding?: number }).stackHorizontalPadding;
    const pv = (node as { stackVerticalPadding?: number }).stackVerticalPadding;
    if (typeof pl === "number") {
      out.paddingLeft = pl;
      out.paddingRight = pl;
    }
    if (typeof pv === "number") {
      out.paddingTop = pv;
      out.paddingBottom = pv;
    }
    if (node.stackPrimarySizing) out.primaryAxisSizingMode = node.stackPrimarySizing;
    if (node.stackCounterSizing) out.counterAxisSizingMode = node.stackCounterSizing;
    const align = (node as { stackPrimaryAlignItems?: string; stackCounterAlignItems?: string }).stackPrimaryAlignItems;
    if (align) out.primaryAxisAlignItems = align;
    const cAlign = (node as { stackCounterAlignItems?: string }).stackCounterAlignItems;
    if (cAlign) out.counterAxisAlignItems = cAlign;
  }

  // Per-child auto-layout sizing (fields exist on every node; only meaningful
  // when its parent is auto-layout). Mapping: `stackChildPrimaryGrow:1` means
  // "fill main axis" (REST `layoutGrow:1`); `stackChildAlignSelf:"STRETCH"`
  // means "fill cross axis" (REST `layoutAlign:"STRETCH"`).
  const childGrow = (node as { stackChildPrimaryGrow?: number }).stackChildPrimaryGrow;
  if (typeof childGrow === "number" && childGrow > 0) out.layoutGrow = childGrow;
  const childAlign = (node as { stackChildAlignSelf?: string }).stackChildAlignSelf;
  if (childAlign && childAlign !== "INHERIT" && childAlign !== "AUTO") out.layoutAlign = childAlign;

  // Text.
  if (node.type === "TEXT") {
    out.characters = node.textData?.characters ?? "";
    const style = convertTextStyle(node);
    if (style) out.style = style;
  }

  // Component / instance linkage. fig stores the master ref under various
  // field names; pull whichever is present.
  const master = (node as { symbolData?: { symbolID?: { sessionID: number; localID: number } }; componentPropRef?: unknown }).symbolData?.symbolID;
  if (master) out.componentId = `${master.sessionID}:${master.localID}`;

  // Recurse into children using the cumulative world transform.
  const children = doc.childrenMap.get(id) ?? [];
  if (children.length) {
    out.children = children.map((c) => convertNode(doc, c, nextWorld));
  }

  return out;
}

/** Parse a `.fig` byte stream and convert to a FigmaBundle. */
export function figBytesToBundle(bytes: Uint8Array, fileName: string): FigmaBundle {
  const doc = parseFig(bytes);

  // Locate the root document node. Fig encodes a DOCUMENT at the top of the
  // hierarchy whose children are CANVAS pages. Fall back to a synthesized
  // DOCUMENT wrapping any canvases we find if the structure differs.
  const docNode = doc.nodes.find((n) => n.type === "DOCUMENT");
  let documentTree: ConvertedNode;
  if (docNode) {
    documentTree = convertNode(doc, docNode, IDENTITY);
  } else {
    // Synthesize: gather CANVAS nodes as direct children of a fake DOCUMENT.
    const canvases = doc.nodes.filter((n) => n.type === "CANVAS");
    documentTree = {
      id: "0:0",
      name: fileName,
      type: "DOCUMENT",
      children: canvases.map((c) => convertNode(doc, c, IDENTITY)),
    };
  }

  const images = buildImageMap(doc.images);

  return {
    fileKey: "fig-local",
    name: (doc.meta?.name as string) ?? fileName,
    lastModified: "",
    version: String(doc.header.version),
    document: documentTree as never,
    components: {} as never,
    componentSets: {} as never,
    styles: {} as never,
    images,
    exports: {},
  };
}

/** Convenience wrapper for a browser File handle. */
export async function figFileToBundle(file: File): Promise<FigmaBundle> {
  const buf = await file.arrayBuffer();
  return figBytesToBundle(new Uint8Array(buf), file.name);
}

/** Heuristic: .fig files are ZIP archives starting with the local-file-header
 *  magic `PK\x03\x04`. Used by the loader to route binary uploads to the fig
 *  parser instead of JSON.parse. */
export function looksLikeFigBinary(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}
