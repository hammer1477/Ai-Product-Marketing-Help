import type { DesignLayer } from "../../../design-schema/types";
import { isDark, mix, onColor, shiftHue } from "../../color";
import { ctaButton, renderBlock } from "../../blocks/render";
import type { Block } from "../../blocks/types";
import {
  C,
  bloom,
  circle,
  ellipse,
  find,
  giant,
  label,
  omit,
  pick,
  rect,
  region,
  seatedSlot,
  sparkle,
  stack,
  stage,
  styleOn,
  svg,
  type TemplateCtx,
} from "../kit";
import { splitSticker, stickerLayers } from "./graphic";
import { order } from "./scene";
import type { TemplateDef } from "./types";

// Product-first designs. In every one of these the product is the largest
// thing on the canvas — roughly half of it or more — and the copy is kept
// to what sells: headline, price, button. They exist because the product
// photo is what stops the scroll; everything else supports it.

function body(ctx: TemplateCtx) {
  return ctx.s.bodyFont ?? "Inter";
}

/** Price on the left, button on the right, along one baseline. */
function priceAndCta(ctx: TemplateCtx, y: number, o: { left: number; right: number; style?: typeof ctx.s }): { layers: DesignLayer[]; placed: Block[] } {
  const style = o.style ?? ctx.s;
  const layers: DesignLayer[] = [];
  const placed: Block[] = [];
  const price = find(ctx.blocks, "priceBlock");
  if (price) {
    placed.push(price);
    layers.push(...renderBlock(price, { style, x: o.left, width: 440, y, align: "left", key: "row-price" }).layers);
  }
  const cta = find(ctx.blocks, "cta");
  if (cta) {
    placed.push(cta);
    const built = ctaButton(cta.text, style, { id: "cta-label", x: 0, y, anchor: "left", maxWidth: 420 });
    // Right-align the button by measuring it first.
    const shift = o.right - built.width;
    layers.push(...built.layers.map((l) => ({ ...l, x: l.x + shift })));
  }
  return { layers, placed };
}

export const heroStage: TemplateDef = {
  id: "hero-stage",
  name: "Hero Stage",
  blurb: "The product enormous and centred under a spotlight; headline above, price and button below.",
  tags: ["food", "beauty", "fashion", "promo", "minimal", "home"],
  scheme: "dark",
  typography: { headline: "Bricolage Grotesque", weight: 800, tracking: -1, scale: 0.9, lineHeight: 1.0, body: "DM Sans" },
  cta: "pill",
  usesScene: false,
  build(ctx) {
    const { p, blocks } = ctx;
    const top = stack(ctx, region(90, 900, 52, 230, "center", "start"), pick(blocks, ["badge", "headline"]), { key: "t" });
    const row = priceAndCta(ctx, 930, { left: 64, right: C - 64 });
    return {
      placed: order(blocks, [...top.placed, ...row.placed]),
      layers: [
        rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
        bloom("spot", 540, 520, 1200, 900, p.accent, 0.3, 0),
        ellipse("floor", 140, 800, 800, 110, mix(p.ground, "#ffffff", 0.08), { z: 1 }),
        ...stage(ctx, seatedSlot(ctx, 540, 850, 940, 620)),
        rect("foot-rule", 64, 900, C - 128, 1, p.line, { z: 8 }),
        ...top.layers,
        ...row.layers,
      ],
    };
  },
};

export const diagonalSplit: TemplateDef = {
  id: "diagonal-split",
  name: "Diagonal Split",
  blurb: "A bold diagonal cut of colour, the product big across the seam.",
  tags: ["bold", "promo", "fashion", "food", "kids", "auto"],
  scheme: "vivid",
  typography: { headline: "Archivo Black", weight: 400, uppercase: true, scale: 0.82, lineHeight: 1.0, tracking: -0.5, body: "Space Grotesk" },
  cta: "rect",
  usesScene: false,
  build(ctx) {
    const { p, blocks } = ctx;
    const dark = isDark(p.ground) ? mix(p.ground, "#000000", 0.35) : "#0b0b0d";
    const onDark = onColor(dark);
    const { rest, used } = splitSticker(blocks);
    const copy = stack(ctx, region(64, 520, 64, 560, "left", "start"), pick(rest, ["badge", "headline", "subheadline", "description"]), { key: "c" });
    const darkStyle = styleOn(ctx, dark, { text: onDark, accent: p.ground, onAccent: onColor(p.ground) });
    const foot = stack(ctx, region(64, 420, 820, C - 48, "left", "start"), pick(rest, ["cta"]), { key: "f", style: darkStyle });
    return {
      placed: order(blocks, [...copy.placed, ...foot.placed, ...used]),
      layers: [
        rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
        // The cut: a huge dark slab rotated across the lower-right.
        rect("slab", -200, 640, 1600, 900, dark, { rotation: -18, z: 1 }),
        rect("slab-edge", -200, 616, 1600, 14, p.accent2, { rotation: -18, z: 1 }),
        bloom("slab-glow", 720, 660, 900, 700, p.ground, 0.25, 1),
        ...stage(ctx, { cx: 700, cy: 600, w: 700, h: 640 }, { glow: false }),
        ...stickerLayers(ctx, 940, 150, 100, p.accent2, onColor(p.accent2), -10),
        ...copy.layers,
        ...foot.layers,
      ],
    };
  },
};

export const circleFrame: TemplateDef = {
  id: "circle-frame",
  name: "Circle Frame",
  blurb: "One giant colour disc holding the product, headline and price beneath.",
  tags: ["food", "beauty", "kids", "home", "wellness", "minimal"],
  scheme: "light",
  typography: { headline: "DM Serif Display", weight: 400, scale: 1.0, lineHeight: 1.02, body: "DM Sans" },
  cta: "pill",
  usesScene: false,
  build(ctx) {
    const { p, blocks } = ctx;
    const disc = mix(p.accent, p.ground, 0.25);
    const placed: Block[] = [];
    const layers: DesignLayer[] = [
      rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
      circle("disc-ring", 540, 430, 392, "transparent", { stroke: p.accent, strokeWidth: 2, opacity: 0.4, z: 1 }),
      circle("disc", 540, 430, 360, disc, { z: 1 }),
      circle("disc-shine", 430, 300, 140, "#ffffff", { opacity: 0.12, z: 1 }),
      ...stage(ctx, { cx: 540, cy: 440, w: 860, h: 600 }, { glow: false }),
      sparkle("spark-1", 160, 170, 34, p.accent, 6),
      sparkle("spark-2", 930, 640, 26, p.accent, 6),
    ];
    const badge = find(blocks, "badge");
    if (badge) {
      placed.push(badge);
      layers.push(...label("top-badge", badge.text, 56, 52, 420, { font: body(ctx), size: 14, weight: 700, tracking: 3, uppercase: true, color: p.text, z: 8, role: "badgeLabel" }).layers);
    }
    const foot = stack(ctx, region(110, 860, 820, C - 40, "center", "start"), pick(blocks, ["headline", "priceBlock", "cta"]), { key: "f" });
    placed.push(...foot.placed);
    layers.push(...foot.layers);
    return { layers, placed: order(blocks, placed) };
  },
};

export const priceTag: TemplateDef = {
  id: "price-tag",
  name: "Price Tag",
  blurb: "Product big on the left, a hanging price tag and the pitch on the right.",
  tags: ["promo", "food", "fashion", "home", "kids"],
  scheme: "pastel",
  typography: { headline: "Bricolage Grotesque", weight: 800, tracking: -1, scale: 0.86, lineHeight: 1.0, body: "DM Sans" },
  cta: "pill",
  usesScene: false,
  build(ctx) {
    const { p, blocks } = ctx;
    const price = find(blocks, "priceBlock");
    const tag = { x: 640, y: 96, w: 380, h: 250 };
    const layers: DesignLayer[] = [
      rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
      rect("product-bed", 0, 0, 600, C, mix(p.accent, p.ground, 0.72), { z: 0 }),
      bloom("bed-glow", 300, 540, 700, 800, "#ffffff", 0.4, 0),
      ...stage(ctx, { cx: 316, cy: 540, w: 560, h: 900 }),
    ];
    const placed: Block[] = [];
    let copyTop = 96;
    if (price) {
      placed.push(price);
      const tagFill = p.accent;
      const ink = onColor(tagFill);
      layers.push(
        // The string the tag hangs from.
        svg("tag-string", 140, 96, `<path d="M4 4 C 50 60, 90 70, 136 92" fill="none" stroke="${p.text}" stroke-width="3" stroke-linecap="round"/>`, { x: tag.x - 100, y: tag.y - 70, z: 3 }),
        rect("tag", tag.x, tag.y, tag.w, tag.h, tagFill, { radius: 26, rotation: 4, z: 3 }),
        circle("tag-hole", tag.x + 38, tag.y + 40, 13, p.ground, { z: 4 }),
        ...giant("tag-price", price.value, tag.x + 40, tag.y + 70, tag.w - 80, { font: ctx.s.headlineFont, weight: ctx.s.headlineWeight, max: 110, min: 36, align: "center", color: ink, rotation: 4, z: 5 }).layers,
        ...(price.compareAt
          ? label("tag-was", `was ${price.compareAt}`, tag.x + 40, tag.y + 186, tag.w - 80, { font: body(ctx), size: 22, weight: 600, align: "center", color: ink, opacity: 0.75, rotation: 4, z: 5 }).layers
          : []),
      );
      copyTop = tag.y + tag.h + 56;
    }
    const copy = stack(ctx, region(648, 380, copyTop, C - 56, "left", price ? "start" : "center"), omit(blocks, ["priceBlock"]), { key: "c" });
    placed.push(...copy.placed);
    layers.push(...copy.layers);
    return { layers, placed: order(blocks, placed) };
  },
};

export const freshPop: TemplateDef = {
  id: "fresh-pop",
  name: "Fresh Pop",
  blurb: "A soft colour blob behind a huge product, friendly rounded copy below.",
  tags: ["food", "kids", "wellness", "beauty", "home"],
  scheme: "pastel",
  typography: { headline: "Unbounded", weight: 700, scale: 0.62, lineHeight: 1.1, body: "DM Sans" },
  cta: "pill",
  usesScene: false,
  build(ctx) {
    const { p, blocks } = ctx;
    const blobFill = mix(p.accent, p.ground, 0.35);
    const blob = svg(
      "blob",
      960,
      700,
      `<path d="M480 20 C 700 0, 930 140, 940 340 C 950 540, 760 690, 500 680 C 250 670, 30 580, 20 360 C 10 160, 260 40, 480 20 Z" fill="${blobFill}"/>`,
      { x: 60, y: 60, z: 1 },
    );
    const blob2 = svg("blob-2", 300, 240, `<path d="M150 10 C 250 10, 290 90, 280 140 C 270 210, 180 235, 120 225 C 40 210, 10 150, 20 100 C 30 40, 80 10, 150 10 Z" fill="${p.accent2}"/>`, { x: 820, y: 40, z: 1, opacity: 0.35 });
    const foot = stack(ctx, region(100, 880, 790, C - 40, "center", "start"), pick(blocks, ["headline", "priceBlock", "cta"]), { key: "f" });
    const placed = [...foot.placed];
    const layers: DesignLayer[] = [
      rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
      blob,
      blob2,
      ...stage(ctx, { cx: 540, cy: 410, w: 900, h: 640 }, { glow: false }),
      sparkle("spark-1", 120, 120, 30, p.accent, 6),
      sparkle("spark-2", 980, 700, 24, p.accent, 6),
      circle("dot-1", 90, 640, 10, p.accent2, { z: 6 }),
      ...foot.layers,
    ];
    const badge = find(blocks, "badge");
    if (badge) {
      placed.push(badge);
      layers.push(...label("top-badge", badge.text, 56, 40, 400, { font: body(ctx), size: 14, weight: 700, tracking: 3, uppercase: true, color: p.text, z: 8, role: "badgeLabel" }).layers);
    }
    return { layers, placed: order(blocks, placed) };
  },
};

export const posterStack: TemplateDef = {
  id: "poster-stack",
  name: "Poster Stack",
  blurb: "A wall of headline across the top, the product filling the lower half.",
  tags: ["bold", "promo", "fashion", "food", "auto"],
  scheme: "dark",
  typography: { headline: "Anton", weight: 400, uppercase: true, scale: 1.25, lineHeight: 0.95, body: "Inter" },
  cta: "pill",
  usesScene: false,
  build(ctx) {
    const { p, blocks } = ctx;
    const { rest, used } = splitSticker(blocks);
    const head = stack(ctx, region(56, 968, 52, 360, "left", "start"), pick(rest, ["badge", "headline"]), { key: "h" });
    const foot = stack(ctx, region(56, 520, 930, C - 32, "left", "start"), pick(rest, ["cta"]), { key: "f" });
    return {
      placed: order(blocks, [...head.placed, ...foot.placed, ...used]),
      layers: [
        rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
        bloom("floor-glow", 540, 760, 1200, 700, p.accent, 0.32, 0),
        rect("band", 0, 380, C, 6, p.accent, { z: 1 }),
        ...stage(ctx, { cx: 540, cy: 650, w: 960, h: 500 }),
        ...stickerLayers(ctx, 930, 470, 92, p.accent, onColor(p.accent), 12),
        ...head.layers,
        ...foot.layers,
      ],
    };
  },
};

export const glowRing: TemplateDef = {
  id: "glow-ring",
  name: "Glow Ring",
  blurb: "A neon ring of light around a big product, copy in a clean column.",
  tags: ["tech", "beauty", "luxury", "wellness", "auto"],
  scheme: "dark",
  typography: { headline: "Syne", weight: 800, uppercase: true, scale: 0.72, lineHeight: 1.04, body: "Inter" },
  cta: "pill",
  usesScene: false,
  build(ctx) {
    const { p } = ctx;
    const ring = shiftHue(p.accent, 0, { s: 0.9, l: 0.6 });
    const copy = stack(ctx, region(64, 400, 72, C - 64, "left", "center"));
    return {
      placed: copy.placed,
      layers: [
        rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
        bloom("ring-glow", 740, 540, 900, 900, ring, 0.3, 0),
        circle("ring-outer", 740, 540, 330, "transparent", { stroke: ring, strokeWidth: 18, opacity: 0.25, z: 1 }),
        circle("ring", 740, 540, 330, "transparent", { stroke: ring, strokeWidth: 4, z: 1 }),
        circle("ring-inner", 740, 540, 300, mix(p.ground, ring, 0.08), { z: 1 }),
        ...stage(ctx, { cx: 740, cy: 540, w: 600, h: 700 }),
        ...copy.layers,
      ],
    };
  },
};
