export type LayerBase = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex: number;
  opacity?: number;
  locked?: boolean;
};

export type TextLayerRole =
  | "headline"
  | "productName"
  | "description"
  | "sellingPoint"
  | "ctaLabel"
  | "badgeLabel"
  | "custom";

export type TextLayer = LayerBase & {
  type: "text";
  content: string;
  role: TextLayerRole;
  fontFamily: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700 | 800;
  color: string;
  textAlign: "left" | "center" | "right";
  lineHeight?: number;
  maxLines?: number;
  letterSpacing?: number;
};

export type ImageLayer = LayerBase & {
  type: "image";
  src: string;
  fit: "cover" | "contain";
  borderRadius?: number;
};

export type IconLayer = LayerBase & {
  type: "icon";
  iconKey: string;
  color: string;
};

export type ShapeLayer = LayerBase & {
  type: "shape";
  shape: "rect" | "ellipse" | "badge";
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
};

export type DesignLayer = TextLayer | ImageLayer | IconLayer | ShapeLayer;

export type DesignDensity = "minimal" | "standard" | "detailed";

export type DesignSchema = {
  schemaVersion: 1;
  canvas: {
    width: number;
    height: number;
    backgroundColor: string;
    aspectRatioPreset?: string;
  };
  layers: DesignLayer[];
  meta: {
    density: DesignDensity;
    templateKey?: string;
  };
};

export function isTextLayer(layer: DesignLayer): layer is TextLayer {
  return layer.type === "text";
}

export function isImageLayer(layer: DesignLayer): layer is ImageLayer {
  return layer.type === "image";
}

export function isIconLayer(layer: DesignLayer): layer is IconLayer {
  return layer.type === "icon";
}

export function isShapeLayer(layer: DesignLayer): layer is ShapeLayer {
  return layer.type === "shape";
}
