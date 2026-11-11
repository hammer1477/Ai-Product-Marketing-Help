import type { DesignLayer, TextLayer } from "../../design-schema/types";
import { fitText, measureTextBlock, measureTextWidth } from "../../design-schema/measureText";
import { resolveFontFile, type FontFamily } from "../../design-schema/fontRegistry";

// Shared building blocks for poster layouts.
//
// The rule every helper here exists to enforce: a block's height is
// *measured*, never assumed. Templates used to hardcode `y` for each layer,
// which worked only while the copy happened to be the expected length —
// the moment the model wrote five lines where four were budgeted, blocks
// printed straight over each other. Each helper returns the height it
// actually occupies so callers can advance a cursor instead of guessing.

// Stacking contract shared by every template:
//   0-1  background scene, scrims, watermark mask
//   2-4  product stage (glow, shadow, photo)
//   5-7  decoration that must sit over the product
//   8+   copy — always on top of everything
export const COPY_Z = 8;

/** Corner rounding applied to an uncut product photo. */
const PHOTO_RADIUS = 20;

export type Built = {
  layers: DesignLayer[];
  /** Vertical space this block occupies, measured. */
  height: number;
  /** Horizontal space actually used — for auto-sizing containers. */
  width: number;
};

export type TextOptions = {
  id: string;
  role: TextLayer["role"];
  content: string;
  x: number;
  y: number;
  maxWidth: number;
  fontFamily: FontFamily;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700 | 800;
  italic?: boolean;
  /** Uppercases the copy *before* measuring, so wrapping stays honest. */
  uppercase?: boolean;
  rotation?: number;
  opacity?: number;
  color: string;
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  maxLines?: number;
  letterSpacing?: number;
  zIndex?: number;
  /** When set, font size shrinks until the copy fits within `maxLines`. */
  autoFit?: boolean;
  minFontSize?: number;
};

export function text(opts: TextOptions): Built {
  const lineHeight = opts.lineHeight ?? 1.2;
  const maxLines = opts.maxLines ?? 6;
  const source = opts.uppercase ? opts.content.toUpperCase() : opts.content;

  // Snap to the face that will actually be drawn — see resolveFontFile.
  const face = resolveFontFile(opts.fontFamily, opts.fontWeight, opts.italic ? "italic" : "normal");

  let fontSize = opts.fontSize;
  let metrics;

  if (opts.autoFit) {
    const fitted = fitText(source, opts.maxWidth, maxLines, {
      fontFamily: face.family,
      fontSize: opts.fontSize,
      fontWeight: face.weight,
      fontStyle: face.style,
      letterSpacing: opts.letterSpacing,
      lineHeight,
      minFontSize: opts.minFontSize,
    });
    fontSize = fitted.fontSize;
    metrics = fitted.metrics;
  } else {
    metrics = measureTextBlock(source, opts.maxWidth, {
      fontFamily: face.family,
      fontSize,
      fontWeight: face.weight,
      fontStyle: face.style,
      letterSpacing: opts.letterSpacing,
      lineHeight,
      maxLines,
    });
  }

  // The renderer re-wraps from `content`, so hand it the already-trimmed
  // line set joined back together. Otherwise a block capped at maxLines
  // would still draw its full text and overflow the measured height.
  const content = metrics.lines.join(" ");

  const layer: TextLayer = {
    id: opts.id,
    type: "text",
    role: opts.role,
    content,
    x: opts.x,
    y: opts.y,
    width: opts.maxWidth,
    height: metrics.height,
    zIndex: opts.zIndex ?? COPY_Z,
    rotation: opts.rotation,
    opacity: opts.opacity,
    fontFamily: face.family,
    fontSize,
    fontWeight: face.weight,
    fontStyle: face.style === "italic" ? "italic" : undefined,
    color: opts.color,
    textAlign: opts.textAlign ?? "left",
    lineHeight,
    maxLines,
    letterSpacing: opts.letterSpacing,
  };

  return { layers: [layer], height: metrics.height, width: metrics.width };
}

export type ButtonVariant = "pill" | "rect" | "brutal" | "outline" | "underline";

export type PillOptions = {
  id: string;
  role: TextLayer["role"];
  label: string;
  x: number;
  y: number;
  fill: string;
  textColor: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700 | 800;
  letterSpacing?: number;
  paddingX?: number;
  stroke?: string;
  /** Max width before the label is shrunk to fit. */
  maxWidth?: number;
  /** "left" anchors at x; "center" centres the pill on x. */
  anchor?: "left" | "center";
  zIndex?: number;
  fontFamily?: FontFamily;
  /**
   * pill = rounded capsule. rect = squared button. brutal = squared with a
   * thick border and a hard offset shadow. outline = stroked capsule.
   * underline = bare label over a rule, for editorial layouts.
   */
  variant?: ButtonVariant;
  /** Border/shadow/label colour for brutal, outline and underline. */
  edge?: string;
};

/**
 * A button sized to its label rather than to a fixed width.
 *
 * Fixed-width pills are why a CTA like "BUY NOW FOR 3000 EGP" rendered as a
 * cramped, overflowing smear — 200px was fine for "SHOP NOW" and nothing
 * else. Measuring first means any label length produces a correctly
 * proportioned button.
 */
export function pill(opts: PillOptions): Built {
  const variant = opts.variant ?? "pill";
  const paddingX = variant === "underline" ? 0 : (opts.paddingX ?? 30);
  const maxWidth = opts.maxWidth ?? 520;
  const maxTextWidth = maxWidth - paddingX * 2;
  const face = resolveFontFile(opts.fontFamily ?? "Inter", opts.fontWeight);
  const measureOpts = (fontSize: number) => ({
    fontFamily: face.family,
    fontSize,
    fontWeight: face.weight,
    letterSpacing: opts.letterSpacing,
  });

  let fontSize = opts.fontSize;
  let textWidth = measureTextWidth(opts.label, measureOpts(fontSize));

  // Long labels shrink rather than overflow the button.
  while (textWidth > maxTextWidth && fontSize > 11) {
    fontSize -= 1;
    textWidth = measureTextWidth(opts.label, measureOpts(fontSize));
  }

  const width = Math.ceil(Math.min(textWidth + paddingX * 2, maxWidth));
  const height = variant === "underline" ? Math.round(fontSize * 2) : Math.round(fontSize * 3.4);
  const x = opts.anchor === "center" ? Math.round(opts.x - width / 2) : opts.x;
  const zIndex = opts.zIndex ?? COPY_Z;
  const edge = opts.edge ?? opts.textColor;

  // Satori lays a text block out from its top edge, so centring the label
  // means offsetting by half the leftover space, not by half the button.
  const textHeight = fontSize * 1.2;
  const textY = variant === "underline" ? opts.y : Math.round(opts.y + (height - textHeight) / 2);

  const container: DesignLayer[] = [];
  const box = { x, y: opts.y, width, height, zIndex };

  if (variant === "pill" || variant === "outline") {
    container.push({
      id: `${opts.id}-pill`,
      type: "shape",
      shape: "badge",
      fill: variant === "outline" ? "transparent" : opts.fill,
      stroke: variant === "outline" ? edge : opts.stroke,
      strokeWidth: variant === "outline" ? 2 : opts.stroke ? 1 : undefined,
      ...box,
    });
  } else if (variant === "rect") {
    container.push({
      id: `${opts.id}-pill`,
      type: "shape",
      shape: "rect",
      fill: opts.fill,
      stroke: opts.stroke,
      strokeWidth: opts.stroke ? 1 : undefined,
      borderRadius: 4,
      ...box,
    });
  } else if (variant === "brutal") {
    container.push(
      { id: `${opts.id}-shadow`, type: "shape", shape: "rect", fill: edge, ...box, x: x + 6, y: opts.y + 6 },
      { id: `${opts.id}-pill`, type: "shape", shape: "rect", fill: opts.fill, stroke: edge, strokeWidth: 3, ...box },
    );
  } else {
    container.push({
      id: `${opts.id}-rule`,
      type: "shape",
      shape: "rect",
      fill: edge,
      x,
      y: Math.round(opts.y + textHeight + 8),
      width,
      height: 3,
      zIndex,
    });
  }

  return {
    layers: [
      ...container,
      {
        id: opts.id,
        type: "text",
        role: opts.role,
        content: opts.label,
        x,
        y: textY,
        width,
        height: Math.ceil(textHeight),
        zIndex: zIndex + 1,
        fontFamily: face.family,
        fontSize,
        fontWeight: face.weight,
        color: variant === "underline" || variant === "outline" ? edge : opts.textColor,
        textAlign: "center",
        lineHeight: 1.2,
        maxLines: 1,
        letterSpacing: opts.letterSpacing,
      },
    ],
    height,
    width,
  };
}

/**
 * A scrim that fades from one opacity to another across its box — one real
 * gradient layer (stacked rectangles showed as banding over photographs).
 * `steps` is accepted and ignored for older callers.
 */
export function gradientBand(opts: {
  idPrefix: string;
  fill: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Opacity at the start edge. */
  from: number;
  /** Opacity at the end edge. */
  to: number;
  direction: "vertical" | "horizontal";
  steps?: number;
  zIndex?: number;
}): DesignLayer[] {
  return [
    {
      id: `${opts.idPrefix}-gradient`,
      type: "gradient",
      gradient: "linear",
      // CSS angles run clockwise from "up": 180deg paints downward,
      // 90deg paints rightward — matching `from` at the top/left edge.
      angle: opts.direction === "vertical" ? 180 : 90,
      stops: [
        { color: opts.fill, offset: 0, opacity: opts.from },
        { color: opts.fill, offset: 1, opacity: opts.to },
      ],
      x: opts.x,
      y: opts.y,
      width: opts.width,
      height: opts.height,
      zIndex: opts.zIndex ?? 1,
    },
  ];
}

export type ProductStageOptions = {
  src: string;
  /** Centre of the slot. */
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  accent: string;
  /** Glow and contact shadow are only correct behind a cut-out product. */
  cutoutApplied: boolean;
  /** Intrinsic aspect ratio (w/h) of the image, for locating it in the slot. */
  aspectRatio?: number;
  zIndex?: number;
  /** Accent halo behind a cut-out product. Off for flat graphic templates. */
  glow?: boolean;
  /** Contact shadow under a cut-out product. */
  shadow?: boolean;
  rotation?: number;
  /** Corner radius for an uncut photo. */
  photoRadius?: number;
};

/**
 * Where a `contain`-fitted image actually lands inside its slot.
 *
 * The slot is just a bounding box; a wide product in a tall slot occupies
 * only a band across the middle of it. Lighting the slot instead of the
 * product is what left the contact shadow stranded at the bottom edge with
 * the product hovering above it.
 */
export function containedBox(slotWidth: number, slotHeight: number, aspectRatio?: number) {
  if (!aspectRatio || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return { width: slotWidth, height: slotHeight };
  }
  const slotRatio = slotWidth / slotHeight;
  return aspectRatio > slotRatio
    ? { width: slotWidth, height: slotWidth / aspectRatio }
    : { width: slotHeight * aspectRatio, height: slotHeight };
}

/**
 * Places the product with a halo and a contact shadow so it reads as
 * standing *in* the scene rather than pasted on top of it.
 *
 * When the backdrop couldn't be cut away, the photo still has its own
 * rectangle, so the glow is skipped (it would just light up a box) and the
 * photo is presented as a deliberate rounded photograph with a soft shadow.
 */
export function productStage(opts: ProductStageOptions): DesignLayer[] {
  const zIndex = opts.zIndex ?? 2;
  const layers: DesignLayer[] = [];
  const x = Math.round(opts.centerX - opts.width / 2);
  const y = Math.round(opts.centerY - opts.height / 2);
  const photoRadius = opts.photoRadius ?? PHOTO_RADIUS;

  // Glow and shadow follow the product's real footprint, not the slot.
  const box = containedBox(opts.width, opts.height, opts.aspectRatio);
  const productBottom = opts.centerY + box.height / 2;

  if (opts.cutoutApplied) {
    if (opts.glow !== false) {
      const glowWidth = Math.round(box.width * 1.7);
      const glowHeight = Math.round(box.height * 1.7);
      layers.push({
        id: "product-glow",
        type: "gradient",
        gradient: "radial",
        stops: [
          { color: opts.accent, offset: 0, opacity: 0.17 },
          { color: opts.accent, offset: 0.45, opacity: 0.08 },
          { color: opts.accent, offset: 1, opacity: 0 },
        ],
        x: Math.round(opts.centerX - glowWidth / 2),
        y: Math.round(opts.centerY - glowHeight / 2),
        width: glowWidth,
        height: glowHeight,
        zIndex,
      });
    }

    // Contact shadow — without something anchoring it to a surface the
    // product looks like it's floating.
    if (opts.shadow !== false) {
      const shadowWidth = Math.round(box.width * 0.78);
      const shadowHeight = 58;
      layers.push({
        id: "product-shadow",
        type: "gradient",
        gradient: "radial",
        stops: [
          { color: "#000000", offset: 0, opacity: 0.42 },
          { color: "#000000", offset: 0.55, opacity: 0.18 },
          { color: "#000000", offset: 1, opacity: 0 },
        ],
        x: Math.round(opts.centerX - shadowWidth / 2),
        y: Math.round(productBottom - shadowHeight / 2),
        width: shadowWidth,
        height: shadowHeight,
        zIndex: zIndex + 1,
      });
    }
  } else if (!opts.rotation) {
    const boxX = Math.round(opts.centerX - box.width / 2);
    const boxY = Math.round(opts.centerY - box.height / 2);
    const spread = 30;
    layers.push(
      {
        id: "product-dropshadow",
        type: "shape",
        shape: "rect",
        fill: "#000000",
        opacity: 0.28,
        borderRadius: photoRadius + 10,
        x: boxX - 10,
        y: boxY + 14,
        width: Math.round(box.width) + 20,
        height: Math.round(box.height) + 20,
        zIndex,
      },
      {
        id: "product-dropshadow-soft",
        type: "gradient",
        gradient: "radial",
        stops: [
          { color: "#000000", offset: 0, opacity: 0.3 },
          { color: "#000000", offset: 0.6, opacity: 0.12 },
          { color: "#000000", offset: 1, opacity: 0 },
        ],
        x: boxX - spread,
        y: boxY - spread + 26,
        width: Math.round(box.width) + spread * 2,
        height: Math.round(box.height) + spread * 2,
        zIndex,
      },
    );
  }

  layers.push({
    id: "product-photo",
    type: "image",
    src: opts.src,
    // Always contain: cover would crop the product itself.
    fit: "contain",
    x,
    y,
    width: opts.width,
    height: opts.height,
    // Rounding a cut-out product would slice the corners off the product
    // itself; it's only the rectangular photo that wants soft corners.
    borderRadius: opts.cutoutApplied ? 0 : photoRadius,
    rotation: opts.rotation,
    zIndex: zIndex + 2,
  });

  return layers;
}
