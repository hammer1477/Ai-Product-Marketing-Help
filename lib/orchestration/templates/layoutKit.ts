import type { DesignLayer, TextLayer } from "../../design-schema/types";
import { fitText, measureTextBlock, measureTextWidth } from "../../design-schema/measureText";

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
//   5    band scrims that must sit over the product
//   8+   copy — always on top of everything
export const COPY_Z = 8;

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
  fontFamily: "Inter" | "Playfair Display";
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700 | 800;
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

  let fontSize = opts.fontSize;
  let metrics;

  if (opts.autoFit) {
    const fitted = fitText(opts.content, opts.maxWidth, maxLines, {
      fontFamily: opts.fontFamily,
      fontSize: opts.fontSize,
      fontWeight: opts.fontWeight,
      letterSpacing: opts.letterSpacing,
      lineHeight,
      minFontSize: opts.minFontSize,
    });
    fontSize = fitted.fontSize;
    metrics = fitted.metrics;
  } else {
    metrics = measureTextBlock(opts.content, opts.maxWidth, {
      fontFamily: opts.fontFamily,
      fontSize,
      fontWeight: opts.fontWeight,
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
    fontFamily: opts.fontFamily,
    fontSize,
    fontWeight: opts.fontWeight,
    color: opts.color,
    textAlign: opts.textAlign ?? "left",
    lineHeight,
    maxLines,
    letterSpacing: opts.letterSpacing,
  };

  return { layers: [layer], height: metrics.height, width: metrics.width };
}

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
};

/**
 * A pill sized to its label rather than to a fixed width.
 *
 * Fixed-width pills are why a CTA like "BUY NOW FOR 3000 EGP" rendered as a
 * cramped, overflowing smear — 200px was fine for "SHOP NOW" and nothing
 * else. Measuring first means any label length produces a correctly
 * proportioned button.
 */
export function pill(opts: PillOptions): Built {
  const paddingX = opts.paddingX ?? 30;
  const maxWidth = opts.maxWidth ?? 520;
  const maxTextWidth = maxWidth - paddingX * 2;

  let fontSize = opts.fontSize;
  let textWidth = measureTextWidth(opts.label, {
    fontFamily: "Inter",
    fontSize,
    fontWeight: opts.fontWeight,
    letterSpacing: opts.letterSpacing,
  });

  // Long labels shrink rather than overflow the pill.
  while (textWidth > maxTextWidth && fontSize > 11) {
    fontSize -= 1;
    textWidth = measureTextWidth(opts.label, {
      fontFamily: "Inter",
      fontSize,
      fontWeight: opts.fontWeight,
      letterSpacing: opts.letterSpacing,
    });
  }

  const width = Math.ceil(Math.min(textWidth + paddingX * 2, maxWidth));
  const height = Math.round(fontSize * 3.4);
  const x = opts.anchor === "center" ? Math.round(opts.x - width / 2) : opts.x;
  const zIndex = opts.zIndex ?? COPY_Z;

  // Satori lays a text block out from its top edge, so centring the label
  // means offsetting by half the leftover space, not by half the pill.
  const textHeight = fontSize * 1.2;
  const textY = Math.round(opts.y + (height - textHeight) / 2);

  return {
    layers: [
      {
        id: `${opts.id}-pill`,
        type: "shape",
        shape: "badge",
        fill: opts.fill,
        stroke: opts.stroke,
        strokeWidth: opts.stroke ? 1 : undefined,
        x,
        y: opts.y,
        width,
        height,
        zIndex,
      },
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
        fontFamily: "Inter",
        fontSize,
        fontWeight: opts.fontWeight,
        color: opts.textColor,
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
 * Fakes a linear gradient with stacked constant-opacity bands.
 *
 * Satori has no gradient support, and a single hard-edged scrim rectangle
 * reads as a pasted-on box — the exact "design is two pieces" complaint.
 * Enough bands and the eye stops resolving the steps as edges.
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
  const steps = opts.steps ?? 12;
  const zIndex = opts.zIndex ?? 1;
  const layers: DesignLayer[] = [];

  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    const opacity = opts.from + (opts.to - opts.from) * t;
    if (opacity <= 0.004) continue;

    if (opts.direction === "vertical") {
      const bandHeight = Math.ceil(opts.height / steps) + 1;
      layers.push({
        id: `${opts.idPrefix}-${i}`,
        type: "shape",
        shape: "rect",
        fill: opts.fill,
        opacity: Number(opacity.toFixed(3)),
        x: opts.x,
        y: Math.round(opts.y + (opts.height / steps) * i),
        width: opts.width,
        height: bandHeight,
        zIndex,
      });
    } else {
      const bandWidth = Math.ceil(opts.width / steps) + 1;
      layers.push({
        id: `${opts.idPrefix}-${i}`,
        type: "shape",
        shape: "rect",
        fill: opts.fill,
        opacity: Number(opacity.toFixed(3)),
        x: Math.round(opts.x + (opts.width / steps) * i),
        y: opts.y,
        width: bandWidth,
        height: opts.height,
        zIndex,
      });
    }
  }

  return layers;
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
};

/**
 * Where a `contain`-fitted image actually lands inside its slot.
 *
 * The slot is just a bounding box; a wide product in a tall slot occupies
 * only a band across the middle of it. Lighting the slot instead of the
 * product is what left the contact shadow stranded at the bottom edge with
 * the product hovering above it.
 */
function containedBox(slotWidth: number, slotHeight: number, aspectRatio?: number) {
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
 * When the backdrop couldn't be cut away, the photo still has its own white
 * rectangle, so the glow is skipped (it would just light up a box) and the
 * photo gets a rounded card instead — a deliberate frame beats an accidental
 * one.
 */
export function productStage(opts: ProductStageOptions): DesignLayer[] {
  const zIndex = opts.zIndex ?? 2;
  const layers: DesignLayer[] = [];
  const x = Math.round(opts.centerX - opts.width / 2);
  const y = Math.round(opts.centerY - opts.height / 2);

  // Glow and shadow follow the product's real footprint, not the slot.
  const box = containedBox(opts.width, opts.height, opts.aspectRatio);
  const productBottom = opts.centerY + box.height / 2;

  if (opts.cutoutApplied) {
    // Concentric low-opacity ellipses approximate a radial glow, which
    // Satori can't render directly. Many faint rings rather than a few
    // stronger ones — at high opacity each ring's edge stays visible as a
    // hard arc, which looks like a bug rather than light.
    const GLOW_RINGS = 9;
    for (let i = 0; i < GLOW_RINGS; i++) {
      const scale = 1.4 - (i / (GLOW_RINGS - 1)) * 0.85;
      const gw = Math.round(box.width * scale * 1.15);
      const gh = Math.round(box.height * scale * 1.15);
      layers.push({
        id: `product-glow-${i}`,
        type: "shape",
        shape: "ellipse",
        fill: opts.accent,
        opacity: 0.032,
        x: Math.round(opts.centerX - gw / 2),
        y: Math.round(opts.centerY - gh / 2),
        width: gw,
        height: gh,
        zIndex,
      });
    }

    // Contact shadow — without something anchoring it to a surface the
    // product looks like it's floating.
    const shadowSteps = [
      { w: 0.72, h: 46, opacity: 0.16 },
      { w: 0.54, h: 32, opacity: 0.24 },
      { w: 0.36, h: 20, opacity: 0.3 },
    ];

    for (const [i, step] of shadowSteps.entries()) {
      const sw = Math.round(box.width * step.w);
      layers.push({
        id: `product-shadow-${i}`,
        type: "shape",
        shape: "ellipse",
        fill: "#000000",
        opacity: step.opacity,
        x: Math.round(opts.centerX - sw / 2),
        y: Math.round(productBottom - step.h / 2),
        width: sw,
        height: step.h,
        zIndex: zIndex + 1,
      });
    }
  } else {
    // No cutout: the photo still carries its own backdrop, so frame it
    // deliberately instead of letting a stray rectangle float in the scene.
    layers.push({
      id: "product-card",
      type: "shape",
      shape: "rect",
      fill: "#fbfbf9",
      borderRadius: 24,
      x: Math.round(opts.centerX - box.width / 2) - 24,
      y: Math.round(opts.centerY - box.height / 2) - 24,
      width: Math.round(box.width) + 48,
      height: Math.round(box.height) + 48,
      zIndex,
    });
  }

  layers.push({
    id: "product-photo",
    type: "image",
    src: opts.src,
    // Always contain: an arbitrary photo's aspect ratio rarely matches the
    // slot, and cover would crop the product (it once chopped most of a pair
    // of headphones out of frame).
    fit: "contain",
    x,
    y,
    width: opts.width,
    height: opts.height,
    zIndex: zIndex + 2,
  });

  return layers;
}
