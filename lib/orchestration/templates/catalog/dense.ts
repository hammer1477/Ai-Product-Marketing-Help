import type { BlockType } from "../../blocks/types";
import { mix } from "../../color";
import { C, bloom, dotGrid, pick, rect, region, seatedSlot, stack, stage } from "../kit";
import { order } from "./scene";
import type { TemplateDef } from "./types";

// Designs built to carry a lot. Most templates are posters first and fit
// what they can; these are information-first — wide columns, two-column
// spec panels and full-height copy — for sellers who want every spec,
// feature and reassurance on the ad.

const INTRO: BlockType[] = ["badge", "headline", "subheadline", "description"];

/** Splits the detail blocks between two columns so neither is left empty. */
function columns(present: Set<BlockType>): { left: BlockType[]; right: BlockType[] } {
  const hasSpecs = present.has("specGrid") || present.has("statRow");
  const left: BlockType[] = hasSpecs ? ["statRow", "specGrid"] : ["featureList"];
  const right = (["featureList", "rating", "trustStrip", "cta"] as BlockType[]).filter((t) => !left.includes(t));
  return { left, right };
}

export const specSheet: TemplateDef = {
  id: "spec-sheet",
  name: "Spec Sheet",
  blurb: "Product and headline up top, a two-column panel of specs and features below. Holds the most facts.",
  tags: ["specs", "tech", "home", "auto", "wellness"],
  scheme: "light",
  typography: { headline: "Inter", weight: 800, tracking: -1, lineHeight: 1.04, scale: 0.82, body: "Inter" },
  cta: "pill",
  usesScene: false,
  build(ctx) {
    const { p, blocks } = ctx;
    const present = new Set(blocks.map((b) => b.type));
    const { left, right } = columns(present);

    const head = stack(ctx, region(578, 446, 56, 508, "left", "center"), pick(blocks, [...INTRO, "priceBlock"]), { key: "h" });
    const colA = stack(ctx, region(72, 432, 604, 1016), pick(blocks, left), { key: "a" });
    const colB = stack(ctx, region(576, 432, 604, 1016), pick(blocks, right), { key: "b" });

    return {
      placed: order(blocks, [...head.placed, ...colA.placed, ...colB.placed]),
      layers: [
        rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
        bloom("hero-glow", 290, 300, 620, 520, p.accent, 0.16, 0),
        ...stage(ctx, seatedSlot(ctx, 290, 520, 500, 470)),
        rect("sheet", 32, 556, 1016, 492, p.surface, { radius: 28, z: 1 }),
        rect("sheet-rule", 540, 604, 1, 412, p.line, { z: 2 }),
        ...head.layers,
        ...colA.layers,
        ...colB.layers,
      ],
    };
  },
};

export const factBoard: TemplateDef = {
  id: "fact-board",
  name: "Fact Board",
  blurb: "A tall, wide column of everything worth knowing beside the product. Dark and premium.",
  tags: ["specs", "tech", "luxury", "auto"],
  scheme: "dark",
  typography: { headline: "Space Grotesk", weight: 700, tracking: -1, lineHeight: 1.04, scale: 0.86, body: "Inter" },
  cta: "rect",
  usesScene: false,
  build(ctx) {
    const { p, blocks } = ctx;
    const copy = stack(ctx, region(64, 540, 64, C - 64, "left", "center"), blocks, { key: "c" });
    return {
      placed: order(blocks, copy.placed),
      layers: [
        rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
        dotGrid("bg-dots", 0, 0, C, C, p.text, { gap: 30, r: 1.1, opacity: 0.09, z: 0 }),
        rect("product-panel", 640, 0, 440, C, mix(p.ground, p.accent, 0.1), { z: 0 }),
        bloom("product-glow", 860, 540, 620, 780, p.accent, 0.22, 1),
        rect("panel-rule", 640, 0, 2, C, p.accent, { opacity: 0.5, z: 1 }),
        ...stage(ctx, { cx: 860, cy: 540, w: 400, h: 860 }),
        ...copy.layers,
      ],
    };
  },
};

export const catalogPage: TemplateDef = {
  id: "catalog-page",
  name: "Catalog Page",
  blurb: "Full-width headline, product with a column of specs beside it, price and button along the foot.",
  tags: ["specs", "home", "food", "kids", "fashion", "promo"],
  scheme: "pastel",
  typography: { headline: "Bricolage Grotesque", weight: 800, tracking: -1, lineHeight: 1.0, scale: 0.86, body: "DM Sans" },
  cta: "pill",
  usesScene: false,
  build(ctx) {
    const { p, blocks } = ctx;
    const head = stack(ctx, region(64, 952, 56, 300, "left", "center"), pick(blocks, INTRO), { key: "h" });
    const side = stack(ctx, region(588, 428, 330, 828), pick(blocks, ["statRow", "specGrid", "featureList", "rating"]), { key: "s" });
    const price = stack(ctx, region(80, 440, 872, 1020, "left", "center"), pick(blocks, ["priceBlock"]), { key: "p" });
    const close = stack(ctx, region(560, 440, 872, 1020, "left", "center"), pick(blocks, ["trustStrip", "cta"]), { key: "f" });
    return {
      placed: order(blocks, [...head.placed, ...side.placed, ...price.placed, ...close.placed]),
      layers: [
        rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
        rect("product-card", 48, 320, 508, 520, p.surface, { radius: 32, z: 1 }),
        ...stage(ctx, seatedSlot(ctx, 302, 815, 470, 470)),
        rect("foot", 48, 860, 984, 172, mix(p.surface, p.accent, 0.12), { radius: 28, z: 1 }),
        ...head.layers,
        ...side.layers,
        ...price.layers,
        ...close.layers,
      ],
    };
  },
};
