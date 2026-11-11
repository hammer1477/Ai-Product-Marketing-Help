import type { DesignDensity, DesignLayer, DesignSchema } from "../../design-schema/types";
import type { ResolvedStyle } from "../styles";
import type { LayoutVariant } from "../types";
import { gradientBand, pill, productStage, text } from "./layoutKit";
import { measureTextBlock } from "../../design-schema/measureText";
import { renderBlock } from "../blocks/render";
import { stackBlocks, type StackRegion } from "../blocks/stack";
import type { Block } from "../blocks/types";

const CANVAS = 1080;

/** Bottom strip reserved for the watermark mask — nothing is placed inside it. */
const BOTTOM_RESERVED = 96;

/** Where the spotlight arrangement's copy band begins. */
const SPOTLIGHT_BAND_TOP = 575;

/**
 * The copy region each stacking arrangement offers.
 *
 * Hoisted out of the build functions so a composition can be measured
 * against every arrangement *before* one is chosen — see pickLayout.
 */
const REGIONS: Record<"split" | "spotlight" | "editorial", StackRegion> = {
  split: {
    x: 76,
    width: 448,
    top: 72,
    bottom: CANVAS - BOTTOM_RESERVED,
    align: "left",
    justify: "center",
  },
  spotlight: {
    x: 140,
    width: 800,
    top: SPOTLIGHT_BAND_TOP + 34,
    bottom: CANVAS - BOTTOM_RESERVED,
    align: "center",
    justify: "start",
  },
  editorial: {
    x: 76,
    width: 440,
    top: 96,
    bottom: CANVAS - BOTTOM_RESERVED,
    align: "left",
    justify: "start",
  },
};

/** Facts a block puts on the poster — a list contributes one per item. */
function contentScore(blocks: Block[]): number {
  return blocks.reduce((total, block) => {
    if (block.type === "divider") return total;
    if ("items" in block) return total + block.items.length;
    return total + 1;
  }, 0);
}

/** The most leader lines that fit around the product without crowding it. */
const MAX_CALLOUTS = 6;

/** Below this many facts a poster reads as empty regardless of arrangement. */
const MIN_FACTS_SHOWN = 6;

/**
 * The callouts an arrangement would draw, drawn from both list blocks.
 *
 * Specs come first because a name plus a value makes the stronger callout
 * — the eye lands on the value — with features filling any remaining
 * lines. Taking only one list would have left the callout arrangement
 * showing so much less than a stacked column that pickLayout always
 * overrode it, and it would never have been seen.
 */
function calloutItems(blocks: Block[]): Array<{ label: string; value?: string }> {
  const specs = blocks.find((block) => block.type === "specGrid");
  const features = blocks.find((block) => block.type === "featureList");

  const items: Array<{ label: string; value?: string }> = [];
  if (specs?.type === "specGrid") {
    items.push(...specs.items.map((item) => ({ label: item.label, value: item.value })));
  }
  if (features?.type === "featureList") {
    items.push(...features.items.map((item) => ({ label: item })));
  }
  return items.slice(0, MAX_CALLOUTS);
}

/** What the callout arrangement can show, which isn't a stacked column. */
function calloutPlacement(blocks: Block[]): Block[] {
  const placed: Block[] = [];

  for (const type of ["badge", "headline"] as const) {
    const block = blocks.find((candidate) => candidate.type === type);
    if (block) placed.push(block);
  }

  const items = calloutItems(blocks);
  if (items.length > 0) {
    placed.push({ type: "featureList", items: items.map((item) => item.label) });
  }

  for (const type of ["priceBlock", "cta"] as const) {
    const block = blocks.find((candidate) => candidate.type === type);
    if (block) placed.push(block);
  }

  return placed;
}

/**
 * Chooses the arrangement that actually shows the content.
 *
 * The model picks an arrangement before it knows how much its own
 * composition will need, and arrangements differ enormously in capacity —
 * the spotlight band holds roughly a third of what the split column does.
 * Picking first and then discarding whatever doesn't fit is how a poster
 * built from eight researched facts ended up displaying two.
 *
 * So the model's choice is honoured unless another arrangement would show
 * materially more. Its taste wins ties; it just can't cost the poster its
 * content.
 */
function pickLayout(blocks: Block[], style: ResolvedStyle): LayoutVariant {
  const requested = style.layout;

  const scoreFor = (layout: LayoutVariant): number =>
    contentScore(
      layout === "callout"
        ? calloutPlacement(blocks)
        : stackBlocks(blocks, REGIONS[layout], style).placed,
    );

  const requestedScore = scoreFor(requested);

  let best = requested;
  let bestScore = requestedScore;

  for (const candidate of ["split", "callout", "editorial", "spotlight"] as LayoutVariant[]) {
    const score = scoreFor(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  // The test is starvation, not maximisation. Overriding whenever another
  // arrangement shows merely *more* collapses everything into the single
  // highest-capacity one, which costs all the variety the arrangements
  // exist to provide. So the model's choice stands unless it would gut the
  // composition: fewer than a handful of facts, or barely half what the
  // content could support.
  const starvationFloor = Math.max(MIN_FACTS_SHOWN, bestScore * 0.55);
  return requestedScore < starvationFloor ? best : requested;
}

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
  const layout = pickLayout(input.blocks, input.style);
  const style: ResolvedStyle = { ...input.style, layout };
  const resolved: PosterInput = { ...input, style };

  const build =
    layout === "spotlight"
      ? buildSpotlight
      : layout === "editorial"
        ? buildEditorial
        : layout === "callout"
          ? buildCallout
          : buildSplit;

  const { layers, placed } = build(resolved);

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
      templateKey: `poster-${layout}-${placed.map((block) => block.type).join("+")}`,
      // The blocks that survived fitting — not the ones that were asked
      // for. Editing starts from what's actually on the poster, so the
      // panel can't offer a field for content that was dropped.
      composition: {
        blocks: placed,
        style,
        cutoutApplied: input.cutoutApplied,
        productAspectRatio: input.productAspectRatio,
      },
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
      steps: 20,
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

  const stack = stackBlocks(blocks, REGIONS.split, style);

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
        steps: 26,
        zIndex: 1,
      }),
      ...productStage({
        src: productImageUrl,
        // The product is what's being sold, so it gets the whole right
        // half rather than a polite inset box. `contain` means a slot
        // this generous costs nothing for an awkward aspect ratio — the
        // photo simply uses whichever dimension it can fill.
        centerX: 806,
        centerY: 520,
        width: 540,
        height: 820,
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

  const bandTop = SPOTLIGHT_BAND_TOP;
  const stack = stackBlocks(blocks, REGIONS.spotlight, style);

  return {
    placed: stack.placed,
    layers: [
      ...buildBackground(style, backgroundImageUrl),
      ...productStage({
        src: productImageUrl,
        centerX: CANVAS / 2,
        centerY: 300,
        width: 820,
        height: 540,
        accent: style.accent,
        cutoutApplied,
        aspectRatio: input.productAspectRatio,
      }),
      // The band fades up into the scene rather than starting with an edge.
      ...gradientBand({
        idPrefix: "band-scrim",
        fill: style.ink,
        x: 0,
        y: bandTop - 150,
        width: CANVAS,
        height: 190,
        from: 0,
        to: 0.92,
        direction: "vertical",
        steps: 24,
        // Behind the product, not over it. At zIndex 5 these bands drew
        // across the bottom of the photo, and a stack of constant-opacity
        // rectangles over a bright image reads as grey stripes.
        zIndex: 1,
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
        zIndex: 1,
      },
      ...stack.layers,
      ...buildBottomFade(style),
    ],
  };
}

/** Oversized headline, product anchored bottom-right. Best for lifestyle. */
function buildEditorial(input: PosterInput): BuildResult {
  const { style, blocks, productImageUrl, cutoutApplied, backgroundImageUrl } = input;

  const stack = stackBlocks(blocks, REGIONS.editorial, style);

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
        steps: 26,
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
        centerX: 810,
        centerY: 690,
        width: 540,
        height: 660,
        accent: style.accent,
        cutoutApplied,
        aspectRatio: input.productAspectRatio,
      }),
      ...stack.layers,
      ...buildBottomFade(style),
    ],
  };
}

/**
 * Product centred, with numbered leader lines pointing out to its facts.
 *
 * The one arrangement that doesn't stack its copy in a column: the product
 * is the centre of the composition and the content radiates from it, which
 * is how spec-heavy products read best. Callout text comes from whichever
 * list block the composition supplied — a specGrid gives each callout a
 * name and a value, a featureList gives it a single line.
 */
function buildCallout(input: PosterInput): BuildResult {
  const { style, blocks, productImageUrl, cutoutApplied, backgroundImageUrl } = input;

  const product = { centerX: 540, centerY: 540, width: 400, height: 520 };
  const labelWidth = 220;
  const sideMargin = 48;
  const rowYs = [360, 540, 720];
  const productLeft = product.centerX - product.width / 2;
  const productRight = product.centerX + product.width / 2;

  const layers: DesignLayer[] = [...buildBackground(style, backgroundImageUrl)];
  const placed: Block[] = [];

  // Leader lines and small numerals need a calmer ground than a poster —
  // at full strength the scene competes with what it's annotating.
  if (backgroundImageUrl) {
    layers.push({
      id: "callout-calm",
      type: "shape",
      shape: "rect",
      fill: style.ink,
      opacity: 0.62,
      x: 0,
      y: 0,
      width: CANVAS,
      height: CANVAS,
      zIndex: 1,
    });
  }

  let headlineY = 58;

  const badge = blocks.find((block) => block.type === "badge");
  if (badge?.type === "badge") {
    placed.push(badge);
    const built = pill({
      id: "badge-label",
      role: "badgeLabel",
      label: badge.text.toUpperCase(),
      x: CANVAS / 2,
      y: 46,
      anchor: "center",
      fill: "transparent",
      stroke: style.accent,
      textColor: style.accent,
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: 2.4,
      paddingX: 22,
      maxWidth: 400,
    });
    layers.push(...built.layers);
    headlineY = 46 + built.height + 20;
  }

  const headline = blocks.find((block) => block.type === "headline");
  if (headline?.type === "headline") {
    placed.push(headline);
    layers.push(
      ...text({
        id: "headline",
        role: "headline",
        content: headline.text,
        x: 90,
        y: headlineY,
        maxWidth: 900,
        fontFamily: style.headlineFont,
        fontSize: style.headlineFont === "Playfair Display" ? 48 : 42,
        fontWeight: style.headlineWeight,
        color: style.textPrimary,
        textAlign: "center",
        lineHeight: 1.14,
        maxLines: 2,
        autoFit: true,
      }).layers,
    );
  }

  layers.push(
    ...productStage({
      src: productImageUrl,
      centerX: product.centerX,
      centerY: product.centerY,
      width: product.width,
      height: product.height,
      accent: style.accent,
      cutoutApplied,
      aspectRatio: input.productAspectRatio,
      zIndex: 2,
    }),
  );

  const callouts = calloutItems(blocks);
  for (const type of ["specGrid", "featureList"] as const) {
    const block = blocks.find((candidate) => candidate.type === type);
    if (block) placed.push(block);
  }

  callouts.forEach((callout, index) => {
    const isLeft = index % 2 === 0;
    const row = Math.floor(index / 2);
    const rowY = rowYs[row] ?? rowYs[rowYs.length - 1] + (row - rowYs.length + 1) * 170;
    const anchorX = isLeft ? productLeft : productRight;
    const labelX = isLeft ? sideMargin : CANVAS - sideMargin - labelWidth;
    const align = isLeft ? "right" : "left";

    const nameSize = callout.value ? 12 : 16;
    const nameMetrics = measureTextBlock(callout.label, labelWidth, {
      fontFamily: "Inter",
      fontSize: nameSize,
      fontWeight: callout.value ? 600 : 500,
      letterSpacing: callout.value ? 1.4 : undefined,
      lineHeight: 1.3,
      maxLines: callout.value ? 1 : 3,
    });

    const valueMetrics = callout.value
      ? measureTextBlock(callout.value, labelWidth, {
          fontFamily: "Inter",
          fontSize: 20,
          fontWeight: 700,
          lineHeight: 1.25,
          maxLines: 2,
        })
      : null;

    // Centred on the leader line, so a long value grows symmetrically
    // instead of drifting into the row above.
    const totalHeight = nameMetrics.height + (valueMetrics ? 4 + valueMetrics.height : 0);
    const blockY = Math.round(rowY - totalHeight / 2);

    layers.push(
      {
        id: `callout-line-${index}`,
        type: "shape",
        shape: "rect",
        fill: style.accent,
        opacity: 0.55,
        x: isLeft ? labelX + labelWidth + 14 : productRight,
        y: rowY - 1,
        width: isLeft ? anchorX - (labelX + labelWidth + 14) : labelX - 14 - productRight,
        height: 2,
        zIndex: 6,
      },
      {
        id: `callout-dot-${index}`,
        type: "shape",
        shape: "ellipse",
        fill: style.accent,
        x: anchorX - 17,
        y: rowY - 17,
        width: 34,
        height: 34,
        zIndex: 6,
      },
      {
        id: `callout-number-${index}`,
        type: "text",
        role: "custom",
        content: String(index + 1),
        x: anchorX - 17,
        y: rowY - 11,
        width: 34,
        height: 22,
        zIndex: 7,
        fontFamily: "Inter",
        fontSize: 16,
        fontWeight: 700,
        color: style.ctaTextColor,
        textAlign: "center",
        lineHeight: 1.2,
        maxLines: 1,
      },
      ...text({
        id: `callout-label-${index}`,
        role: callout.value ? "custom" : "sellingPoint",
        content: callout.value ? callout.label.toUpperCase() : callout.label,
        x: labelX,
        y: blockY,
        maxWidth: labelWidth,
        fontFamily: "Inter",
        fontSize: nameSize,
        fontWeight: callout.value ? 600 : 500,
        color: callout.value ? style.accent : style.textPrimary,
        textAlign: align,
        letterSpacing: callout.value ? 1.4 : undefined,
        lineHeight: 1.3,
        maxLines: callout.value ? 1 : 3,
        zIndex: 6,
      }).layers,
    );

    if (callout.value && valueMetrics) {
      layers.push(
        ...text({
          id: `callout-value-${index}`,
          role: "sellingPoint",
          content: callout.value,
          x: labelX,
          y: blockY + nameMetrics.height + 4,
          maxWidth: labelWidth,
          fontFamily: "Inter",
          fontSize: 20,
          fontWeight: 700,
          color: style.textPrimary,
          textAlign: align,
          lineHeight: 1.25,
          maxLines: 2,
          zIndex: 6,
        }).layers,
      );
    }
  });

  // Price and button close the composition, centred under the product.
  let footerY = 846;

  const price = blocks.find((block) => block.type === "priceBlock");
  if (price?.type === "priceBlock") {
    placed.push(price);
    const built = renderBlock(price, {
      style,
      x: 240,
      width: 600,
      y: footerY,
      align: "center",
      key: "callout-price",
    });
    layers.push(...built.layers);
    footerY += built.height + 16;
  }

  const cta = blocks.find((block) => block.type === "cta");
  if (cta?.type === "cta") {
    placed.push(cta);
    layers.push(
      ...pill({
        id: "cta-label",
        role: "ctaLabel",
        label: cta.text.toUpperCase(),
        x: CANVAS / 2,
        y: footerY,
        anchor: "center",
        fill: style.accent,
        textColor: style.ctaTextColor,
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: 1.6,
        paddingX: 34,
        maxWidth: 560,
      }).layers,
    );
  }

  layers.push(...buildBottomFade(style));

  return { layers, placed };
}
