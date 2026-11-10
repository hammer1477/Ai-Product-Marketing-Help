import type { DesignDensity, DesignLayer, DesignSchema } from "../../design-schema/types";
import type { ResolvedStyle } from "../styles";
import { gradientBand, productStage } from "./layoutKit";
import { stackBlocks, type StackRegion } from "../blocks/stack";
import type { Block } from "../blocks/types";

const CANVAS = 1080;

/** Bottom strip reserved for the watermark mask — nothing is placed inside it. */
const BOTTOM_RESERVED = 96;

export type PosterInput = {
  blocks: Block[];
  productImageUrl: string;
  density: DesignDensity;
  style: ResolvedStyle;
  backgroundImageUrl?: string;
  /** Whether the product photo's backdrop was successfully removed. */
  cutoutApplied: boolean;
  productAspectRatio: number;
};

// A poster is now two independent decisions: an *arrangement* (where the
// product sits, and what shape the copy region is) and a *composition*
// (which blocks fill that region, chosen by the model). This file owns
// geometry only — it never knows what content it's holding, which is why
// adding a new kind of block needs no change here at all.
export function composePosterSchema(input: PosterInput): DesignSchema {
  const { style } = input;

  const build =
    style.layout === "spotlight"
      ? buildSpotlight
      : style.layout === "editorial"
        ? buildEditorial
        : buildSplit;

  const { layers, placed } = build(input);

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
      // Records the composition that was actually used, so a design you
      // liked can be traced back to the blocks that produced it.
      templateKey: `poster-${style.layout}-${placed.map((block) => block.type).join("+")}`,
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
 * Sits just above the scene and below every copy layer — it masks the
 * generated background, not the design.
 */
function buildBottomFade(style: ResolvedStyle): DesignLayer[] {
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
// Arrangements
// ---------------------------------------------------------------------------

type BuildResult = { layers: DesignLayer[]; placed: Block[] };

/** Copy column beside the product. The densest arrangement. */
function buildSplit(input: PosterInput): BuildResult {
  const { style, blocks, productImageUrl, cutoutApplied, backgroundImageUrl } = input;

  const region: StackRegion = {
    x: 76,
    width: 448,
    top: 72,
    bottom: CANVAS - BOTTOM_RESERVED,
    align: "left",
    justify: "center",
  };

  const stack = stackBlocks(blocks, region, style);

  return {
    placed: stack.placed,
    layers: [
      ...buildBackground(style, backgroundImageUrl),
      // Scrim only under the copy, fading out well before the product so
      // the scene stays visible around it.
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
      ...stack.layers,
      ...buildBottomFade(style),
    ],
  };
}

/** Product centre stage, copy in a band beneath. Best for beautiful objects. */
function buildSpotlight(input: PosterInput): BuildResult {
  const { style, blocks, productImageUrl, cutoutApplied, backgroundImageUrl } = input;

  const bandTop = 470;

  const region: StackRegion = {
    x: 140,
    width: 800,
    top: bandTop + 34,
    bottom: CANVAS - BOTTOM_RESERVED,
    align: "center",
    justify: "start",
  };

  const stack = stackBlocks(blocks, region, style);

  return {
    placed: stack.placed,
    layers: [
      ...buildBackground(style, backgroundImageUrl),
      ...productStage({
        src: productImageUrl,
        centerX: CANVAS / 2,
        centerY: 248,
        width: 560,
        height: 400,
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
      ...stack.layers,
      ...buildBottomFade(style),
    ],
  };
}

/** Oversized headline, product anchored bottom-right. Best for lifestyle. */
function buildEditorial(input: PosterInput): BuildResult {
  const { style, blocks, productImageUrl, cutoutApplied, backgroundImageUrl } = input;

  const region: StackRegion = {
    x: 76,
    width: 500,
    top: 96,
    bottom: CANVAS - BOTTOM_RESERVED,
    align: "left",
    justify: "start",
  };

  const stack = stackBlocks(blocks, region, style);

  return {
    placed: stack.placed,
    layers: [
      ...buildBackground(style, backgroundImageUrl),
      // A broad wash: strong at the top-left where the headline lives,
      // clearing the bottom-right where the product sits.
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
      ...stack.layers,
      ...buildBottomFade(style),
    ],
  };
}
