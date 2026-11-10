import type { DesignDensity, DesignLayer, DesignSchema } from "../../design-schema/types";
import type { IconKey } from "../../design-schema/render/icons";
import type { CreativeContent } from "../types";
import type { ResolvedStyle } from "../styles";
import { COPY_Z, gradientBand, pill, productStage, text, type Built } from "./layoutKit";

const CANVAS = 1080;

const ICON_ROTATION: IconKey[] = ["check", "star", "shield", "sparkles", "leaf", "truck", "heart", "tag"];

const SELLING_POINT_COUNT_BY_DENSITY: Record<DesignDensity, number> = {
  minimal: 0,
  standard: 3,
  detailed: 4,
};

/** Bottom strip reserved for the watermark mask — nothing is placed inside it. */
const BOTTOM_RESERVED = 96;

export type PosterInput = {
  content: CreativeContent;
  productImageUrl: string;
  density: DesignDensity;
  style: ResolvedStyle;
  backgroundImageUrl?: string;
  /** Whether the product photo's backdrop was successfully removed. */
  cutoutApplied: boolean;
  productAspectRatio: number;
};

export function composePosterSchema(input: PosterInput): DesignSchema {
  const { style } = input;

  const layers =
    style.layout === "spotlight"
      ? buildSpotlight(input)
      : style.layout === "editorial"
        ? buildEditorial(input)
        : buildSplit(input);

  return {
    schemaVersion: 1,
    canvas: {
      width: CANVAS,
      height: CANVAS,
      backgroundColor: style.ink,
      aspectRatioPreset: "instagram-square",
    },
    meta: {
      density: input.density,
      templateKey: `poster-${style.layout}-${input.density}-${style.moodLabel.replace(/\s+/g, "-")}`,
    },
    layers,
  };
}

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------

/**
 * Full-bleed scene plus a global tint.
 *
 * The tint matters more than it looks: a raw generated scene and a product
 * lit differently read as two unrelated images stuck together. Pulling the
 * whole canvas slightly toward one ground colour unifies them.
 */
function buildBackground(style: ResolvedStyle, backgroundImageUrl?: string): DesignLayer[] {
  if (!backgroundImageUrl) {
    return [
      {
        id: "bg",
        type: "shape",
        shape: "rect",
        fill: style.ink,
        x: 0,
        y: 0,
        width: CANVAS,
        height: CANVAS,
        zIndex: 0,
      },
      // Without a scene, a faint accent bloom keeps the ground from reading
      // as a flat colour-fill placeholder.
      {
        id: "bg-bloom",
        type: "shape",
        shape: "ellipse",
        fill: style.accent,
        opacity: 0.09,
        x: 300,
        y: 180,
        width: 720,
        height: 720,
        zIndex: 0,
      },
    ];
  }

  return [
    {
      id: "bg-image",
      type: "image",
      src: backgroundImageUrl,
      fit: "cover",
      x: 0,
      y: 0,
      width: CANVAS,
      height: CANVAS,
      zIndex: 0,
    },
    {
      id: "bg-tint",
      type: "shape",
      shape: "rect",
      fill: style.ink,
      opacity: 0.22,
      x: 0,
      y: 0,
      width: CANVAS,
      height: CANVAS,
      zIndex: 0,
    },
  ];
}

/**
 * Masks the bottom strip, where free image generators stamp a watermark.
 *
 * Dimming isn't enough for high-contrast text, so the last rows are fully
 * covered — but a bare opaque bar looks like a mistake, so it's preceded by
 * a fade that makes the whole thing read as an intentional vignette.
 */
function buildBottomFade(style: ResolvedStyle): DesignLayer[] {
  // Sits just above the scene and below every copy layer. It masks the
  // generated background, not the design — at a higher z-index it washed
  // straight over the CTA button sitting in the same strip.
  return [
    ...gradientBand({
      idPrefix: "bottom-fade",
      fill: style.ink,
      x: 0,
      y: CANVAS - 170,
      width: CANVAS,
      height: 126,
      from: 0,
      to: 1,
      direction: "vertical",
      steps: 14,
      zIndex: 1,
    }),
    {
      id: "watermark-mask",
      type: "shape",
      shape: "rect",
      fill: style.ink,
      x: 0,
      y: CANVAS - 44,
      width: CANVAS,
      height: 44,
      zIndex: 1,
    },
  ];
}

// ---------------------------------------------------------------------------
// Copy blocks
// ---------------------------------------------------------------------------

type CopyColumnOptions = {
  content: CreativeContent;
  style: ResolvedStyle;
  density: DesignDensity;
  x: number;
  width: number;
  startY: number;
  align: "left" | "center";
  headlineSize: number;
  headlineMaxLines: number;
  bodySize: number;
  maxSellingPoints: number;
  /** Hard floor the column must not grow past; selling points drop to fit. */
  bottomLimit: number;
};

/**
 * Lays out badge → headline → description → selling points → CTA as a
 * single flowed column.
 *
 * Every gap is applied to a *measured* cursor, so copy of any length
 * produces correct spacing instead of running into the block below. If the
 * column still wouldn't fit, selling points are dropped one at a time —
 * losing a bullet is always better than overprinting one.
 */
function buildCopyColumn(opts: CopyColumnOptions): Built {
  const { content, style, align, x, width } = opts;
  const centerX = x + width / 2;
  const requestedPoints = Math.min(
    SELLING_POINT_COUNT_BY_DENSITY[opts.density],
    opts.maxSellingPoints,
    content.sellingPoints.length,
  );

  for (let pointCount = requestedPoints; ; pointCount--) {
    const built = flowColumn(opts, pointCount);
    const fits = opts.startY + built.height <= opts.bottomLimit;
    if (fits || pointCount === 0) return built;
  }
}

function flowColumn(opts: CopyColumnOptions, pointCount: number): Built {
  const { content, style, align, x, width } = opts;
  const centerX = x + width / 2;
  const layers: DesignLayer[] = [];
  let cursor = opts.startY;
  let maxWidth = 0;

  const place = (built: Built, gapAfter: number) => {
    layers.push(...built.layers);
    maxWidth = Math.max(maxWidth, built.width);
    cursor += built.height + gapAfter;
  };

  if (content.badgeLabel) {
    place(
      pill({
        id: "badge-label",
        role: "badgeLabel",
        label: content.badgeLabel.toUpperCase(),
        x: align === "center" ? centerX : x,
        y: cursor,
        anchor: align === "center" ? "center" : "left",
        fill: "transparent",
        stroke: style.accent,
        textColor: style.accent,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: 2.4,
        paddingX: 22,
        maxWidth: width,
      }),
      26,
    );
  }

  place(
    text({
      id: "headline",
      role: "headline",
      content: content.headline,
      x,
      y: cursor,
      maxWidth: width,
      fontFamily: style.headlineFont,
      fontSize: opts.headlineSize,
      fontWeight: style.headlineWeight,
      color: style.textPrimary,
      textAlign: align,
      lineHeight: 1.12,
      maxLines: opts.headlineMaxLines,
      autoFit: true,
      minFontSize: Math.round(opts.headlineSize * 0.58),
    }),
    22,
  );

  if (opts.density !== "minimal" && content.description) {
    place(
      text({
        id: "description",
        role: "description",
        content: content.description,
        x,
        y: cursor,
        maxWidth: width,
        fontFamily: "Inter",
        fontSize: opts.bodySize,
        fontWeight: 400,
        color: style.textMuted,
        textAlign: align,
        lineHeight: 1.5,
        maxLines: 3,
      }),
      pointCount > 0 ? 30 : 36,
    );
  }

  if (pointCount > 0) {
    layers.push({
      id: "selling-points-divider",
      type: "shape",
      shape: "rect",
      fill: style.accent,
      opacity: 0.45,
      x: align === "center" ? Math.round(centerX - 60) : x,
      y: Math.round(cursor),
      width: align === "center" ? 120 : Math.round(width * 0.42),
      height: 2,
      zIndex: COPY_Z,
    });
    cursor += 2 + 26;

    const iconSize = 20;
    const textIndent = align === "center" ? 0 : iconSize + 14;

    for (let i = 0; i < pointCount; i++) {
      const pointText = text({
        id: `selling-point-${i}`,
        role: "sellingPoint",
        content: content.sellingPoints[i],
        x: x + textIndent,
        y: Math.round(cursor + (align === "center" ? 0 : 1)),
        maxWidth: width - textIndent,
        fontFamily: "Inter",
        fontSize: 17,
        fontWeight: 500,
        color: style.textPrimary,
        textAlign: align,
        lineHeight: 1.35,
        maxLines: 2,
      });

      if (align !== "center") {
        layers.push({
          id: `selling-point-icon-${i}`,
          type: "icon",
          iconKey: ICON_ROTATION[i % ICON_ROTATION.length],
          color: style.accent,
          x,
          y: Math.round(cursor + 2),
          width: iconSize,
          height: iconSize,
          zIndex: COPY_Z,
        });
      }

      layers.push(...pointText.layers);
      maxWidth = Math.max(maxWidth, pointText.width + textIndent);
      // A measured gap, not a fixed row pitch — a two-line bullet pushes
      // the next one down instead of printing through it.
      cursor += pointText.height + 14;
    }

    cursor += 20;
  }

  place(
    pill({
      id: "cta-label",
      role: "ctaLabel",
      label: content.ctaLabel.toUpperCase(),
      x: align === "center" ? centerX : x,
      y: cursor,
      anchor: align === "center" ? "center" : "left",
      fill: style.accent,
      textColor: style.ctaTextColor,
      fontSize: 16,
      fontWeight: 700,
      letterSpacing: 1.6,
      paddingX: 34,
      maxWidth: width,
    }),
    0,
  );

  return { layers, height: cursor - opts.startY, width: maxWidth };
}

/** Re-flows a column so its measured height is vertically centred in a band. */
function centeredColumn(opts: Omit<CopyColumnOptions, "startY">, bandTop: number, bandBottom: number): Built {
  const probe = buildCopyColumn({ ...opts, startY: bandTop });
  const slack = bandBottom - bandTop - probe.height;
  const startY = Math.round(bandTop + Math.max(0, slack) / 2);
  return buildCopyColumn({ ...opts, startY });
}

// ---------------------------------------------------------------------------
// Layout variants
// ---------------------------------------------------------------------------

/** Copy column beside the product. Best for feature-rich products. */
function buildSplit(input: PosterInput): DesignLayer[] {
  const { style, content, density, productImageUrl, cutoutApplied, backgroundImageUrl } = input;

  const column = centeredColumn(
    {
      content,
      style,
      density,
      x: 76,
      width: 448,
      align: "left",
      headlineSize: style.headlineFont === "Playfair Display" ? 58 : 52,
      headlineMaxLines: 4,
      bodySize: 20,
      maxSellingPoints: 4,
      bottomLimit: CANVAS - BOTTOM_RESERVED,
    },
    72,
    CANVAS - BOTTOM_RESERVED,
  );

  return [
    ...buildBackground(style, backgroundImageUrl),
    // Scrim only under the copy, fading out well before the product so the
    // scene stays visible around it.
    ...gradientBand({
      idPrefix: "copy-scrim",
      fill: style.ink,
      x: 0,
      y: 0,
      width: 700,
      height: CANVAS,
      from: 0.9,
      to: 0,
      direction: "horizontal",
      steps: 18,
      zIndex: 1,
    }),
    ...productStage({
      src: productImageUrl,
      centerX: 790,
      centerY: 520,
      width: 460,
      height: 580,
      accent: style.accent,
      cutoutApplied,
      aspectRatio: input.productAspectRatio,
    }),
    ...column.layers,
    ...buildBottomFade(style),
  ];
}

/** Product centre stage, copy in a band beneath. Best for beautiful objects. */
function buildSpotlight(input: PosterInput): DesignLayer[] {
  const { style, content, density, productImageUrl, cutoutApplied, backgroundImageUrl } = input;

  // The band has to start high enough that the copy column actually fits —
  // when it didn't, the graceful-degradation path silently dropped every
  // selling point and the poster came out looking empty.
  const bandTop = 480;

  const column = buildCopyColumn({
    content,
    style,
    density,
    x: 150,
    width: 780,
    align: "center",
    startY: bandTop + 34,
    headlineSize: style.headlineFont === "Playfair Display" ? 52 : 46,
    headlineMaxLines: 2,
    bodySize: 19,
    maxSellingPoints: 2,
    bottomLimit: CANVAS - BOTTOM_RESERVED,
  });

  return [
    ...buildBackground(style, backgroundImageUrl),
    ...productStage({
      src: productImageUrl,
      centerX: CANVAS / 2,
      centerY: 252,
      width: 560,
      height: 410,
      accent: style.accent,
      cutoutApplied,
      aspectRatio: input.productAspectRatio,
    }),
    // The band fades up into the scene rather than starting with an edge.
    ...gradientBand({
      idPrefix: "band-scrim",
      fill: style.ink,
      x: 0,
      y: bandTop - 130,
      width: CANVAS,
      height: 170,
      from: 0,
      to: 0.92,
      direction: "vertical",
      steps: 16,
      zIndex: 5,
    }),
    {
      id: "band-solid",
      type: "shape",
      shape: "rect",
      fill: style.ink,
      opacity: 0.92,
      x: 0,
      y: bandTop + 40,
      width: CANVAS,
      height: CANVAS - bandTop - 40,
      zIndex: 5,
    },
    ...column.layers,
    ...buildBottomFade(style),
  ];
}

/** Oversized headline, product anchored bottom-right. Best for lifestyle. */
function buildEditorial(input: PosterInput): DesignLayer[] {
  const { style, content, density, productImageUrl, cutoutApplied, backgroundImageUrl } = input;

  const column = buildCopyColumn({
    content,
    style,
    density,
    x: 76,
    width: 500,
    align: "left",
    startY: 96,
    headlineSize: style.headlineFont === "Playfair Display" ? 76 : 68,
    headlineMaxLines: 4,
    bodySize: 19,
    maxSellingPoints: 3,
    bottomLimit: CANVAS - BOTTOM_RESERVED,
  });

  return [
    ...buildBackground(style, backgroundImageUrl),
    // A broad diagonal-ish wash: strong at the top-left where the headline
    // lives, clearing the bottom-right where the product sits.
    ...gradientBand({
      idPrefix: "editorial-scrim",
      fill: style.ink,
      x: 0,
      y: 0,
      width: 760,
      height: CANVAS,
      from: 0.88,
      to: 0,
      direction: "horizontal",
      steps: 18,
      zIndex: 1,
    }),
    ...gradientBand({
      idPrefix: "editorial-top",
      fill: style.ink,
      x: 0,
      y: 0,
      width: CANVAS,
      height: 280,
      from: 0.7,
      to: 0,
      direction: "vertical",
      steps: 12,
      zIndex: 1,
    }),
    ...productStage({
      src: productImageUrl,
      centerX: 800,
      centerY: 700,
      width: 520,
      height: 520,
      accent: style.accent,
      cutoutApplied,
      aspectRatio: input.productAspectRatio,
    }),
    ...column.layers,
    ...buildBottomFade(style),
  ];
}
