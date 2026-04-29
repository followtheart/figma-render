import type {
  GetFileResponse,
  Node,
  Paint,
  Effect,
  TypeStyle,
  LayoutConstraint,
  Transform,
  Vector,
  Rectangle,
  ColorStop,
} from "@figma/rest-api-spec";

export type {
  GetFileResponse,
  Node,
  Paint,
  Effect,
  TypeStyle,
  LayoutConstraint,
  Transform,
  Vector,
  Rectangle,
  ColorStop,
};

/** Map of imageRef hash -> CDN URL, returned by GET /v1/files/:key/images. */
export type ImageRefMap = Record<string, string>;

/** Map of node id -> exported asset URL (PNG/SVG), returned by GET /v1/images/:key. */
export type ExportedAssetMap = Record<string, string>;

/** Bundle returned to the renderer: parsed document plus resolved asset URLs. */
export interface FigmaBundle {
  fileKey: string;
  name: string;
  lastModified: string;
  version: string;
  document: GetFileResponse["document"];
  components: GetFileResponse["components"];
  componentSets: GetFileResponse["componentSets"];
  styles: GetFileResponse["styles"];
  /** image fill hash -> URL */
  images: ImageRefMap;
  /** node id -> exported SVG/PNG URL (filled lazily for vectors that can't be drawn from geometry) */
  exports: ExportedAssetMap;
}
