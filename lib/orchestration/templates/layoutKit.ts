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
 * A scrim that fades from one opacity to another across its box.
 *
 * This used to stack two dozen constant-opacity rectangles, because
 * `shape` was the only fill available. Over a dark ground the steps
 * blended; over a photograph they showed as grey banding. It's now one
 * real gradient layer, which also means the vector export carries a
 * gradient definition instead of twenty-six overlapping rectangles.
 *
 * `steps` is accepted and ignored — callers tuned it to hide the banding,
 * and there is no banding left to hide.
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
      // CSS angles run anticlockwise from "up": 180deg paints downward,
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
    // A real radial gradient, where this was once nine concentric ellipses
    // whose edges stayed faintly visible as arcs no matter how low their
    // opacity went.
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

    // Contact shadow — without something anchoring it to a surface the
    // product looks like it's floating. A radial gradient gives it a soft
    // edge instead of three hard-edged ellipses stacked on each other.
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
  } else {
    // No cutout: the photo carries its own backdrop, so it's presented as
    // a photograph rather than hidden inside a frame. A thick white card
    // around a dark scene reads as a Polaroid stuck to the poster and
    // steals size from the product — the thing being sold ends up the
    // smallest element on the page. Instead the photo gets rounded corners
    // of its own and a soft drop shadow, so it sits on the scene as a
    // deliberate object at full size.
    const boxX = Math.round(opts.centerX - box.width / 2);
    const boxY = Math.round(opts.centerY - box.height / 2);

    const spread = 30;
    layers.push(
      {
        id: "product-dropshadow",
        type: "shape",
        shape: "rect",
        fill: "#000000",
        opacity: 0.3,
        borderRadius: PHOTO_RADIUS + 10,
        x: boxX - 10,
        y: boxY + 14,
        width: Math.round(box.width) + 20,
        height: Math.round(box.height) + 20,
        zIndex,
      },
      // A soft pool under the photo so the hard-edged rectangle above
      // isn't the only thing separating it from the scene.
      {
        id: "product-dropshadow-soft",
        type: "gradient",
        gradient: "radial",
        stops: [
          { color: "#000000", offset: 0, opacity: 0.34 },
          { color: "#000000", offset: 0.6, opacity: 0.14 },
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
    // Always contain: an arbitrary photo's aspect ratio rarely matches the
    // slot, and cover would crop the product (it once chopped most of a pair
    // of headphones out of frame).
    fit: "contain",
    x,
    y,
    width: opts.width,
    height: opts.height,
    // Rounding a cut-out product would slice the corners off the product
    // itself; it's only the rectangular photo that wants soft corners.
    borderRadius: opts.cutoutApplied ? 0 : PHOTO_RADIUS,
    zIndex: zIndex + 2,
  });

  return layers;
}
