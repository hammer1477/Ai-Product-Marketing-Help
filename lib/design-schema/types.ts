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

export type GradientStop = {
  color: string;
  /** Position along the gradient, 0 to 1. */
  offset: number;
  /** 0 to 1. Separate from `color` so palettes stay plain hex. */
  opacity?: number;
};

/**
 * A real gradient fill.
 *
 * Scrims and glows were previously faked with stacks of two dozen
 * constant-opacity rectangles, because that's all `shape` could express.
 * Over a dark ground the steps blended; over a photograph they showed as
 * banding — grey stripes across the bottom of a product shot. Satori
 * renders CSS gradients natively and they survive into the SVG export as
 * real gradient definitions, so one layer replaces the whole stack and the
 * banding has nowhere to come from.
 */
export type GradientLayer = LayerBase & {
  type: "gradient";
  gradient: "linear" | "radial";
  /** CSS degrees for linear gradients: 0 = upward, 90 = rightward. */
  angle?: number;
  stops: GradientStop[];
};

export type DesignLayer = TextLayer | ImageLayer | IconLayer | ShapeLayer | GradientLayer;

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
    /**
     * The composition this schema was built from — the block list and the
     * resolved style, so the design can be re-laid-out rather than only
     * patched in place.
     *
     * Deliberately untyped here: the concrete type lives in
     * lib/orchestration/composition.ts, and importing it would make
     * design-schema depend on orchestration when the dependency runs the
     * other way. Read it through `readComposition()`, which validates.
     */
    composition?: unknown;
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

export function isGradientLayer(layer: DesignLayer): layer is GradientLayer {
  return layer.type === "gradient";
}
