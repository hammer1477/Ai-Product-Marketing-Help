import type { DesignLayer } from "../../../design-schema/types";
import { ensureContrast, isDark, mix, onColor, saturation, shiftHue } from "../../color";
import { ctaButton } from "../../blocks/render";
import type { Block, BlockType } from "../../blocks/types";
import {
  C,
  arrow,
  barcode,
  bloom,
  brackets,
  circle,
  dotGrid,
  ellipse,
  find,
  giant,
  label,
  omit,
  pick,
  rect,
  region,
  repeatWord,
  seatedSlot,
  sparkle,
  squiggle,
  stack,
  stage,
  starburst,
  styleOn,
  svg,
  zigzag,
  type TemplateCtx,
} from "../kit";
import { buildCallout } from "./callout";
import { order } from "./scene";
import type { TemplateDef } from "./types";

// Graphic templates: no photograph behind the product, the design itself
// is the backdrop. These are where most of the stylistic range lives —
// type-led, brutalist, Swiss, glass, retro, collage.

function body(ctx: TemplateCtx) {
  return ctx.s.bodyFont ?? "Inter";
}

/** A sticker carrying the price, else the badge — or nothing. */
function stickerText(blocks: Block[]): { text: string; type: BlockType } | null {
  const price = find(blocks, "priceBlock");
  if (price) return { text: price.value, type: "priceBlock" };
  const badge = find(blocks, "badge");
  if (badge) return { text: badge.text, type: "badge" };
  return null;
}

/** Takes the sticker's block out of the stack so it isn't drawn twice. */
function splitSticker(blocks: Block[]): { rest: Block[]; used: Block[] } {
  const sticker = stickerText(blocks);
  if (!sticker) return { rest: blocks, used: [] };
  return { rest: omit(blocks, [sticker.type]), used: pick(blocks, [sticker.type]) };
}

function stickerLayers(ctx: TemplateCtx, cx: number, cy: number, r: number, fill: string, ink: string, rotation: number): DesignLayer[] {
  const sticker = stickerText(ctx.blocks);
  if (!sticker) return [];
  const textW = r * 1.3;
  return [
    starburst("sticker", cx, cy, r, fill, { rotation, z: 6 }),
    ...label("sticker-text", sticker.text, cx - textW / 2, cy - r * 0.32, textW, {
      font: ctx.s.headlineFont,
      weight: ctx.s.headlineWeight,
      size: Math.round(r * 0.42),
      autoFit: true,
      minSize: 14,
      maxLines: 2,
      lineHeight: 1,
      align: "center",
      uppercase: true,
      color: ink,
      rotation,
      z: 7,
    }).layers,
  ];
}

export const typeBehind: TemplateDef = {
  id: "type-behind",
  name: "Type Behind",
  blurb: "A giant word behind the product, minimal copy.",
  tags: ["fashion", "bold", "promo", "auto", "minimal"],
  scheme: "dark",
  typography: { headline: "Anton", weight: 400, uppercase: true, scale: 0.85, lineHeight: 1.0, body: "Inter" },
  cta: "pill",
  usesScene: false,
  build(ctx) {
    const { p, blocks } = ctx;
    const placed: Block[] = [];
    const layers: DesignLayer[] = [
      rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
      bloom("bg-bloom", 540, 460, 1100, 900, p.accent, 0.16, 0),
      ...giant("giant-word", ctx.word, 24, 230, 1032, { font: "Anton", max: 330, min: 120, uppercase: true, align: "center", color: p.accent, z: 1 }).layers,
      ...stage(ctx, { cx: 540, cy: 470, w: 600, h: 560 }, { glow: false }),
    ];
    const badge = find(blocks, "badge");
    if (badge) {
      placed.push(badge);
      layers.push(...label("top-badge", badge.text, 48, 48, 480, { font: body(ctx), size: 14, weight: 700, tracking: 3, uppercase: true, color: p.text, z: 8, role: "badgeLabel" }).layers);
    }
    const price = find(blocks, "priceBlock");
    if (price) {
      placed.push(price);
      layers.push(...label("top-price", price.value, 560, 44, 472, { font: body(ctx), size: 22, weight: 700, align: "right", color: p.text, z: 8 }).layers);
    }
    const foot = stack(ctx, region(120, 840, 800, C - 44, "center", "start"), pick(blocks, ["headline", "subheadline", "description", "cta"]), { key: "f" });
    placed.push(...foot.placed);
    layers.push(...foot.layers);
    return { layers, placed: order(blocks, placed) };
  },
};

export const neoBrutal: TemplateDef = {
  id: "neo-brutal",
  name: "Neo Brutal",
  blurb: "Flooded colour, thick black borders, hard shadows.",
  tags: ["promo", "bold", "kids", "tech", "food"],
  scheme: "vivid",
  typography: { headline: "Archivo Black", weight: 400, uppercase: true, scale: 0.9, lineHeight: 1.0, tracking: -1, body: "Space Grotesk" },
  cta: "brutal",
  usesScene: false,
  build(ctx) {
    const { p, blocks } = ctx;
    const ink = p.text;
    const card = { x: 548, y: 64, w: 468, h: 612 };
    const box = { x: 548, y: 716, w: 468, h: 300 };
    const { rest, used } = splitSticker(blocks);
    const st = stack(ctx, region(64, 448, 72, 1016, "left", "center"), rest);
    const word = giant("box-word", ctx.word, box.x + 28, box.y + 40, box.w - 56, { font: "Archivo Black", max: 120, min: 40, uppercase: true, color: p.ground, z: 3 });
    return {
      placed: order(blocks, [...st.placed, ...used]),
      layers: [
        rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
        dotGrid("bg-dots", 0, 0, C, C, ink, { gap: 28, r: 1.4, opacity: 0.18, z: 0 }),
        rect("card-shadow", card.x + 12, card.y + 12, card.w, card.h, ink, { z: 1 }),
        rect("card", card.x, card.y, card.w, card.h, "#ffffff", { stroke: ink, strokeWidth: 4, z: 1 }),
        ...stage(ctx, { cx: card.x + card.w / 2, cy: card.y + card.h / 2, w: 390, h: 520 }, { glow: false }),
        rect("box", box.x, box.y, box.w, box.h, ink, { z: 2 }),
        ...word.layers,
        rect("box-rule", box.x + 28, box.y + 40 + word.height + 18, 120, 6, p.ground, { z: 3 }),
        ...stickerLayers(ctx, card.x + 18, card.y + 30, 74, shiftHue(p.ground, 150, { s: 0.85, l: 0.6 }), ink, -12),
        ...st.layers,
      ],
    };
  },
};

export const swissGrid: TemplateDef = {
  id: "swiss-grid",
  name: "Swiss Grid",
  blurb: "Paper, hairline grid, tight grotesk, one accent block.",
  tags: ["tech", "specs", "home", "minimal", "auto"],
  scheme: "light",
  typography: { headline: "Inter", weight: 800, tracking: -1.5, lineHeight: 1.0, scale: 0.95, body: "Inter" },
  cta: "rect",
  usesScene: false,
  build(ctx) {
    const { p } = ctx;
    const st = stack(ctx, region(48, 640, 640, C - 44, "left", "start"));
    const lines: DesignLayer[] = [360, 720].flatMap((v) => [
      rect(`grid-v-${v}`, v, 0, 1, C, p.line, { z: 1 }),
      rect(`grid-h-${v}`, 0, v, C, 1, p.line, { z: 1 }),
    ]);
    const blockWord = label("block-word", ctx.word, 744, 980, 312, { font: "Space Grotesk", size: 40, weight: 700, autoFit: true, minSize: 18, uppercase: true, color: p.onAccent, z: 3 });
    return {
      placed: st.placed,
      layers: [
        rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
        ...lines,
        rect("accent-block", 720, 720, 360, 360, p.accent, { z: 2 }),
        ...blockWord.layers,
        ...label("index", "01", 48, 34, 300, { font: "Space Grotesk", size: 64, weight: 700, color: p.accent, z: 8 }).layers,
        ...label("index-word", ctx.word, 736, 52, 300, { font: body(ctx), size: 13, weight: 600, tracking: 3, uppercase: true, align: "right", color: p.muted, z: 8 }).layers,
        ...stage(ctx, { cx: 600, cy: 330, w: 640, h: 520 }, { glow: false }),
        ...st.layers,
      ],
    };
  },
};

export const auroraGlass: TemplateDef = {
  id: "aurora-glass",
  name: "Aurora Glass",
  blurb: "Glowing colour mesh with a frosted glass copy card.",
  tags: ["tech", "beauty", "wellness", "specs"],
  scheme: "dark",
  typography: { headline: "Unbounded", weight: 700, scale: 0.66, lineHeight: 1.12, body: "DM Sans" },
  cta: "pill",
  usesScene: false,
  build(ctx) {
    const { p } = ctx;
    const st = stack(ctx, region(96, 440, 182, 900, "left", "center"));
    return {
      placed: st.placed,
      layers: [
        rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
        bloom("mesh-a", 240, 200, 1100, 1000, p.accent, 0.55, 0),
        bloom("mesh-b", 940, 720, 1000, 1000, p.accent2, 0.5, 0),
        bloom("mesh-c", 560, 1120, 1000, 640, shiftHue(p.accent, -50), 0.35, 0),
        rect("glass", 56, 140, 520, 800, "#ffffff", { opacity: 0.07, radius: 32, z: 1 }),
        rect("glass-edge", 56, 140, 520, 800, "transparent", { stroke: "#ffffff", strokeWidth: 1, opacity: 0.28, radius: 32, z: 1 }),
        ...stage(ctx, { cx: 812, cy: 540, w: 420, h: 640 }),
        sparkle("spark-1", 960, 150, 40, "#ffffff", 6, 0.9),
        sparkle("spark-2", 640, 900, 26, "#ffffff", 6, 0.7),
        sparkle("spark-3", 1010, 860, 18, "#ffffff", 6, 0.6),
        ...st.layers,
      ],
    };
  },
};

export const retroSunset: TemplateDef = {
  id: "retro-sunset",
  name: "Retro Sunset",
  blurb: "70s rainbow arcs, chunky script, cream paper.",
  tags: ["food", "kids", "home", "fashion", "bold"],
  scheme: "light",
  typography: { headline: "Shrikhand", weight: 400, scale: 0.95, lineHeight: 1.05, body: "DM Sans" },
  cta: "pill",
  usesScene: false,
  build(ctx) {
    const { p, blocks } = ctx;
    const placed: Block[] = [];
    const arcs = [720, 610, 500, 390].map((r, i) =>
      circle(`arc-${i}`, 540, 1200, r, i === 3 ? mix(p.accent, p.ground, 0.25) : shiftHue(p.accent, i * -16), { z: 1 }),
    );
    const top = stack(ctx, region(80, 920, 56, 420, "center", "start"), pick(blocks, ["badge", "headline", "subheadline", "description"]), { key: "t" });
    placed.push(...top.placed);
    const layers: DesignLayer[] = [
      rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
      ...arcs,
      ...stage(ctx, seatedSlot(ctx, 540, 930, 520, 500), { glow: false }),
      ...top.layers,
    ];
    const sticker = stickerText(blocks);
    if (sticker?.type === "priceBlock") {
      placed.push(find(blocks, "priceBlock")!);
      layers.push(...stickerLayers(ctx, 900, 560, 92, p.text, p.ground, 10));
    }
    const cta = find(blocks, "cta");
    if (cta) {
      placed.push(cta);
      const ctaStyle = styleOn(ctx, p.ground, { text: p.ground, accent: p.text, onAccent: p.ground });
      layers.push(...ctaButton(cta.text, ctaStyle, { id: "cta-label", x: C / 2, y: 976, anchor: "center", maxWidth: 560 }).layers);
    }
    return { layers, placed: order(blocks, placed) };
  },
};

export const y2kOrbit: TemplateDef = {
  id: "y2k-orbit",
  name: "Y2K Orbit",
  blurb: "Orbit rings, sparkles, wide chrome-era type.",
  tags: ["tech", "kids", "fashion", "bold", "promo"],
  scheme: "dark",
  typography: { headline: "Unbounded", weight: 800, uppercase: true, scale: 0.6, lineHeight: 1.05, body: "Space Grotesk" },
  cta: "outline",
  usesScene: false,
  build(ctx) {
    const { p, blocks } = ctx;
    const rings: DesignLayer[] = [-18, 18, 0].map((rot, i) =>
      ellipse(`orbit-${i}`, 90, 400, 900, i === 2 ? 220 : 280, "transparent", { stroke: i === 2 ? p.accent2 : p.accent, strokeWidth: 2, opacity: 0.75, rotation: rot, z: 1 }),
    );
    const top = stack(ctx, region(80, 920, 48, 270, "center", "start"), pick(blocks, ["badge", "headline", "subheadline"]), { key: "t" });
    const foot = stack(ctx, region(140, 800, 820, C - 40, "center", "start"), omit(blocks, ["badge", "headline", "subheadline"]), { key: "f" });
    return {
      placed: order(blocks, [...top.placed, ...foot.placed]),
      layers: [
        rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
        bloom("core", 540, 540, 900, 820, p.accent, 0.32, 0),
        dotGrid("stars", 0, 0, C, C, "#ffffff", { gap: 54, r: 1, opacity: 0.25, z: 0 }),
        ...rings,
        ...stage(ctx, { cx: 540, cy: 545, w: 470, h: 470 }),
        sparkle("spark-1", 210, 330, 46, "#ffffff", 6),
        sparkle("spark-2", 880, 720, 34, "#ffffff", 6),
        sparkle("spark-3", 830, 300, 20, p.accent, 6),
        sparkle("spark-4", 240, 760, 22, p.accent2, 6),
        ...top.layers,
        ...foot.layers,
      ],
    };
  },
};

export const minimalLuxe: TemplateDef = {
  id: "minimal-luxe",
  name: "Minimal Luxe",
  blurb: "Fine gold frame, wide-tracked serif, almost nothing else.",
  tags: ["luxury", "beauty", "fashion", "minimal"],
  scheme: "dark",
  typography: { headline: "Cormorant Garamond", weight: 600, uppercase: true, tracking: 4, scale: 0.66, lineHeight: 1.18, body: "DM Sans" },
  cta: "underline",
  usesScene: false,
  build(ctx) {
    const { p, blocks } = ctx;
    const foot = stack(ctx, region(150, 780, 800, 1000, "center", "start"), pick(blocks, ["headline", "subheadline", "priceBlock", "cta"]), { key: "f" });
    return {
      placed: foot.placed,
      layers: [
        rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
        bloom("halo", 540, 470, 820, 760, p.accent, 0.14, 0),
        rect("frame-outer", 36, 36, 1008, 1008, "transparent", { stroke: p.accent, strokeWidth: 1, opacity: 0.75, z: 1 }),
        rect("frame-inner", 48, 48, 984, 984, "transparent", { stroke: p.accent, strokeWidth: 1, opacity: 0.3, z: 1 }),
        ...label("crest", ctx.word, 140, 86, 800, { font: "Cormorant Garamond", size: 20, weight: 600, tracking: 8, uppercase: true, align: "center", color: p.accent, z: 8 }).layers,
        rect("crest-rule", 510, 124, 60, 1, p.accent, { z: 8 }),
        ...stage(ctx, { cx: 540, cy: 470, w: 500, h: 540 }),
        ...foot.layers,
      ],
    };
  },
};

export const saleBurst: TemplateDef = {
  id: "sale-burst",
  name: "Sale Burst",
  blurb: "Loud condensed type, starburst sticker, tilted tape.",
  tags: ["promo", "bold", "food", "kids", "auto"],
  scheme: "vivid",
  typography: { headline: "Bebas Neue", weight: 400, uppercase: true, scale: 1.75, lineHeight: 0.92, body: "Space Grotesk" },
  cta: "rect",
  usesScene: false,
  build(ctx) {
    const { p } = ctx;
    const { rest, used } = splitSticker(ctx.blocks);
    const st = stack(ctx, region(60, 480, 64, 740, "left", "start"), rest);
    return {
      placed: order(ctx.blocks, [...st.placed, ...used]),
      layers: [
        rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
        bloom("bg-bloom", 760, 520, 900, 900, "#ffffff", 0.22, 0),
        rect("tape", -120, 790, 1320, 130, p.text, { rotation: -6, z: 1 }),
        ...label("tape-text", repeatWord(ctx.word, 10), -120, 820, 1320, { font: "Bebas Neue", size: 70, color: p.ground, rotation: -6, z: 1 }).layers,
        ...stage(ctx, { cx: 770, cy: 540, w: 560, h: 640 }, { glow: false }),
        ...stickerLayers(ctx, 920, 170, 118, shiftHue(p.ground, 180, { s: 0.85, l: 0.55 }), "#ffffff", 12),
        ...st.layers,
      ],
    };
  },
};

export const colorBlock: TemplateDef = {
  id: "color-block",
  name: "Color Block",
  blurb: "Bold colour panel, product straddling the seam.",
  tags: ["fashion", "promo", "home", "food", "bold"],
  scheme: "dark",
  typography: { headline: "Bricolage Grotesque", weight: 800, tracking: -1, lineHeight: 0.98, body: "DM Sans" },
  cta: "pill",
  usesScene: false,
  build(ctx) {
    const { p } = ctx;
    const panel = saturation(p.accent) < 0.2 ? mix(p.accent, p.ground, 0.2) : p.accent;
    const onPanel = onColor(panel, isDark(p.ground) ? p.ground : "#0b0b0d", "#ffffff");
    const panelStyle = styleOn(ctx, panel, { text: onPanel, accent: onPanel, onAccent: panel });
    const st = stack(ctx, region(56, 440, 64, 1016, "left", "center"), ctx.blocks, { style: panelStyle });
    return {
      placed: st.placed,
      layers: [
        rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
        bloom("bg-bloom", 820, 540, 800, 900, p.accent, 0.18, 0),
        rect("panel", 0, 0, 600, C, panel, { z: 1 }),
        ...label("side-word", ctx.word, 600, 500, 900, { font: ctx.s.headlineFont, size: 96, weight: 800, autoFit: true, minSize: 40, uppercase: true, align: "center", color: p.text, opacity: 0.12, rotation: 90, z: 1 }).layers,
        ...stage(ctx, { cx: 790, cy: 540, w: 520, h: 780 }),
        ...st.layers,
      ],
    };
  },
};

export const scrapbook: TemplateDef = {
  id: "scrapbook",
  name: "Scrapbook",
  blurb: "Taped polaroid, marker handwriting, doodles.",
  tags: ["food", "kids", "home", "fashion", "wellness"],
  scheme: "light",
  typography: { headline: "Permanent Marker", weight: 400, scale: 0.95, lineHeight: 1.1, body: "DM Sans" },
  cta: "rect",
  usesScene: false,
  build(ctx) {
    const { p, blocks } = ctx;
    const tilt = -4;
    const price = find(blocks, "priceBlock");
    const st = stack(ctx, region(64, 440, 80, 1010, "left", "center"), price ? omit(blocks, ["priceBlock"]) : blocks);
    const layers: DesignLayer[] = [
      rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
      dotGrid("paper-dots", 0, 0, C, C, p.line, { gap: 30, r: 1.2, opacity: 0.6, z: 0 }),
      rect("polaroid-shadow", 568, 104, 440, 560, "#000000", { opacity: 0.12, rotation: tilt, z: 1 }),
      rect("polaroid", 560, 90, 440, 560, "#fffdf8", { rotation: tilt, z: 1 }),
      rect("polaroid-photo", 584, 114, 392, 420, mix(p.accent, "#ffffff", 0.55), { rotation: tilt, z: 1 }),
      ...stage(ctx, { cx: 780, cy: 324, w: 350, h: 380 }, { glow: false, shadow: false, rotation: tilt, z: 2 }),
      rect("tape-1", 590, 66, 130, 36, p.accent, { opacity: 0.55, rotation: -16, z: 6 }),
      rect("tape-2", 860, 70, 130, 36, p.accent, { opacity: 0.55, rotation: 12, z: 6 }),
      ...label("polaroid-caption", ctx.word, 596, 556, 368, { font: "Permanent Marker", size: 34, autoFit: true, minSize: 18, align: "center", color: p.text, rotation: tilt, z: 6 }).layers,
      arrow("doodle-arrow", 452, 640, 150, 110, p.accent),
      sparkle("doodle-star", 1010, 700, 34, p.accent, 6),
      ...st.layers,
    ];
    const placed = [...st.placed];
    if (price) {
      placed.push(price);
      layers.push(
        rect("note", 640, 736, 330, 230, mix(p.accent2, "#ffffff", 0.6), { rotation: 3, z: 3 }),
        ...label("note-price", price.value, 664, 790, 282, { font: "Permanent Marker", size: 64, autoFit: true, minSize: 24, align: "center", color: p.text, rotation: 3, z: 6 }).layers,
        ...(price.compareAt
          ? label("note-was", `was ${price.compareAt}`, 664, 880, 282, { font: "Permanent Marker", size: 24, align: "center", color: p.muted, rotation: 3, z: 6 }).layers
          : []),
      );
    } else {
      layers.push(squiggle("doodle-squiggle", 640, 820, 320, p.accent, { rotation: -3, z: 3 }));
    }
    return { layers, placed: order(blocks, placed) };
  },
};

export const receipt: TemplateDef = {
  id: "receipt",
  name: "Receipt",
  blurb: "Every fact itemised on a printed receipt, monospaced.",
  tags: ["specs", "tech", "food", "promo"],
  scheme: "light",
  typography: { headline: "Space Mono", weight: 700, uppercase: true, scale: 0.52, lineHeight: 1.18, body: "Space Mono" },
  cta: "rect",
  usesScene: false,
  build(ctx) {
    const { p } = ctx;
    const paper = "#fffefb";
    const r = { x: 580, y: 56, w: 440, h: 904 };
    const ink = ensureContrast(p.text, paper, 9);
    const paperStyle = styleOn(ctx, paper, { text: ink, muted: mix(ink, paper, 0.4), accent: ensureContrast(p.accent, paper, 3), onAccent: onColor(ensureContrast(p.accent, paper, 3)) });
    const st = stack(ctx, region(r.x + 32, r.w - 64, r.y + 112, r.y + r.h - 110, "left", "start"), ctx.blocks, { style: paperStyle });
    const dashes = svg("dash-1", r.w - 64, 4, `<line x1="0" y1="2" x2="${r.w - 64}" y2="2" stroke="${ink}" stroke-width="2" stroke-dasharray="8 6"/>`, { x: r.x + 32, y: r.y + 84, z: 3 });
    return {
      placed: st.placed,
      layers: [
        rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
        circle("product-disc", 300, 540, 260, mix(p.accent, p.ground, 0.6), { z: 1 }),
        ...stage(ctx, { cx: 300, cy: 540, w: 440, h: 640 }, { glow: false }),
        rect("receipt-shadow", r.x + 10, r.y + 14, r.w, r.h, "#000000", { opacity: 0.12, z: 2 }),
        rect("receipt", r.x, r.y, r.w, r.h, paper, { z: 2 }),
        zigzag("receipt-edge", r.x, r.y + r.h, r.w, paper, 2),
        ...label("receipt-head", ctx.word, r.x + 32, r.y + 36, r.w - 64, { font: "Space Mono", size: 22, weight: 700, uppercase: true, tracking: 2, align: "center", autoFit: true, minSize: 14, color: ink, z: 3 }).layers,
        dashes,
        ...st.layers,
        barcode("receipt-barcode", r.x + 60, r.y + r.h - 86, r.w - 120, 54, ink, ctx.word),
      ],
    };
  },
};

export const bento: TemplateDef = {
  id: "bento",
  name: "Bento Grid",
  blurb: "Rounded tiles, each fact in its own card.",
  tags: ["tech", "specs", "wellness", "home", "food"],
  scheme: "light",
  typography: { headline: "Inter", weight: 800, tracking: -1, scale: 0.8, lineHeight: 1.02, body: "Inter" },
  cta: "pill",
  usesScene: false,
  build(ctx) {
    const { p, blocks } = ctx;
    const radius = 28;
    const white = "#ffffff";
    const placed: Block[] = [];
    const accentCard = ensureContrast(p.accent, p.ground, 1.4);
    const darkStyle = styleOn(ctx, p.text, { text: p.ground, muted: mix(p.ground, p.text, 0.3), accent: ensureContrast(p.accent, p.text, 3), onAccent: onColor(ensureContrast(p.accent, p.text, 3)) });
    const onAccentCard = onColor(accentCard);
    const accentStyle = styleOn(ctx, accentCard, { text: onAccentCard, accent: onAccentCard, onAccent: accentCard });
    const whiteStyle = styleOn(ctx, white, { text: ensureContrast(p.text, white, 9), muted: mix(p.text, white, 0.4), accent: ensureContrast(p.accent, white, 3), onAccent: onColor(ensureContrast(p.accent, white, 3)) });

    const layers: DesignLayer[] = [
      rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
      rect("tile-product", 40, 40, 620, 640, mix(p.accent, white, 0.78), { radius, z: 1 }),
      rect("tile-headline", 680, 40, 360, 640, p.text, { radius, z: 1 }),
      rect("tile-a", 40, 700, 400, 340, white, { radius, z: 1 }),
      rect("tile-b", 460, 700, 280, 340, accentCard, { radius, z: 1 }),
      rect("tile-c", 760, 700, 280, 340, white, { radius, z: 1 }),
      ...stage(ctx, { cx: 350, cy: 370, w: 500, h: 520 }, { glow: false }),
    ];

    const head = stack(ctx, region(712, 296, 84, 650, "left", "start"), pick(blocks, ["badge", "headline", "subheadline", "description"]), { style: darkStyle, key: "h" });
    placed.push(...head.placed);
    layers.push(...head.layers);

    const lists = blocks.filter((b) => ["featureList", "specGrid", "statRow", "rating", "trustStrip"].includes(b.type));
    const [first, second] = lists;
    if (first) {
      const a = stack(ctx, region(72, 336, 736, 1008, "left", "center"), [first], { style: whiteStyle, key: "a" });
      placed.push(...a.placed);
      layers.push(...a.layers);
    }
    if (second) {
      const b = stack(ctx, region(488, 224, 736, 1008, "left", "center"), [second], { style: accentStyle, key: "bb" });
      placed.push(...b.placed);
      layers.push(...b.layers);
    } else {
      layers.push(...label("tile-word", ctx.word, 488, 840, 224, { font: ctx.s.headlineFont, size: 48, weight: 800, autoFit: true, minSize: 18, maxLines: 2, color: onAccentCard, z: 8 }).layers);
    }

    const c = stack(ctx, region(788, 224, 736, 1008, "left", "center"), pick(blocks, ["priceBlock", "cta"]), { style: whiteStyle, key: "c" });
    placed.push(...c.placed);
    layers.push(...c.layers);

    return { layers, placed: order(blocks, placed) };
  },
};

export const marqueeDrop: TemplateDef = {
  id: "marquee-drop",
  name: "Marquee Drop",
  blurb: "Streetwear drop: crossing tapes, stacked condensed type.",
  tags: ["fashion", "promo", "bold", "kids", "auto"],
  scheme: "dark",
  typography: { headline: "Bebas Neue", weight: 400, uppercase: true, scale: 1.6, lineHeight: 0.92, body: "Space Grotesk" },
  cta: "pill",
  usesScene: false,
  build(ctx) {
    const { p, blocks } = ctx;
    const price = find(blocks, "priceBlock");
    const st = stack(ctx, region(90, 900, 160, 430, "center", "start"), price ? omit(blocks, ["priceBlock"]) : blocks);
    const placed = price ? [...st.placed, price] : st.placed;
    return {
      placed: order(blocks, placed),
      layers: [
        rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
        bloom("bg-bloom", 540, 700, 1000, 760, p.accent, 0.2, 0),
        rect("tape-top", -80, 46, 1240, 78, p.accent, { rotation: -4, z: 1 }),
        ...label("tape-top-text", repeatWord(ctx.word, 12), -80, 58, 1240, { font: "Bebas Neue", size: 54, color: p.onAccent, rotation: -4, z: 1 }).layers,
        ...stage(ctx, { cx: 540, cy: 690, w: 580, h: 500 }),
        rect("tape-front", -80, 900, 1240, 78, p.text, { rotation: 3, z: 6 }),
        ...label("tape-front-text", repeatWord(ctx.word, 12), -80, 912, 1240, { font: "Bebas Neue", size: 54, color: p.ground, rotation: 3, z: 7 }).layers,
        ...(price ? stickerLayers(ctx, 900, 560, 84, p.accent2, onColor(p.accent2), 10) : []),
        ...st.layers,
      ],
    };
  },
};

export const pastelSoft: TemplateDef = {
  id: "pastel-soft",
  name: "Pastel Soft",
  blurb: "Soft tinted ground, floating discs, elegant serif.",
  tags: ["beauty", "wellness", "kids", "food", "home"],
  scheme: "pastel",
  typography: { headline: "DM Serif Display", weight: 400, scale: 1.05, lineHeight: 1.02, body: "DM Sans" },
  cta: "pill",
  usesScene: false,
  build(ctx) {
    const { p } = ctx;
    const st = stack(ctx, region(64, 420, 80, 1010, "left", "center"));
    return {
      placed: st.placed,
      layers: [
        rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
        circle("blob-1", 900, 140, 260, "#ffffff", { opacity: 0.35, z: 1 }),
        circle("blob-2", 1010, 960, 240, p.accent, { opacity: 0.16, z: 1 }),
        circle("disc", 750, 560, 310, "#ffffff", { opacity: 0.72, z: 1 }),
        circle("disc-ring", 750, 560, 340, "transparent", { stroke: p.accent, strokeWidth: 1, opacity: 0.5, z: 1 }),
        ...stage(ctx, { cx: 750, cy: 560, w: 470, h: 540 }, { glow: false }),
        sparkle("spark-1", 520, 180, 30, p.accent, 6),
        sparkle("spark-2", 1000, 420, 22, p.accent, 6),
        ...st.layers,
      ],
    };
  },
};

export const techHud: TemplateDef = {
  id: "tech-hud",
  name: "Tech HUD",
  blurb: "Viewfinder brackets, dot grid, monospaced readouts.",
  tags: ["tech", "specs", "auto"],
  scheme: "dark",
  typography: { headline: "Space Grotesk", weight: 700, uppercase: true, scale: 0.78, tracking: 1, body: "Space Mono" },
  cta: "rect",
  usesScene: false,
  build(ctx) {
    const { p } = ctx;
    const result = buildCallout(ctx, "hud", false);
    return {
      placed: result.placed,
      layers: [
        rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
        dotGrid("hud-grid", 0, 0, C, C, p.text, { gap: 32, r: 1.2, opacity: 0.16, z: 0 }),
        bloom("hud-core", 540, 540, 760, 760, p.accent, 0.2, 0),
        ...brackets("hud-frame", 310, 250, 460, 580, p.accent, { z: 5 }),
        rect("hud-scan", 310, 540, 460, 1, p.accent, { opacity: 0.35, z: 5 }),
        ...result.layers,
      ],
    };
  },
};

export const bigNumber: TemplateDef = {
  id: "big-number",
  name: "Big Number",
  blurb: "One headline figure, set enormous.",
  tags: ["tech", "specs", "promo", "wellness", "auto", "bold"],
  scheme: "dark",
  typography: { headline: "Anton", weight: 400, uppercase: true, scale: 0.85, lineHeight: 1.0, body: "Inter" },
  cta: "rect",
  usesScene: false,
  build(ctx) {
    const { p, blocks } = ctx;
    const stats = find(blocks, "statRow");
    const specs = find(blocks, "specGrid");
    const hero = stats?.items[0] ?? specs?.items[0];
    const placed: Block[] = [];
    const layers: DesignLayer[] = [
      rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
      bloom("bg-bloom", 800, 540, 900, 1000, p.accent, 0.2, 0),
      rect("rule", 64, 56, 80, 6, p.accent, { z: 8 }),
      ...stage(ctx, { cx: 800, cy: 560, w: 500, h: 760 }),
    ];

    let cursor = 84;
    let rest = blocks;
    const heroBlock = stats ?? specs;
    if (hero && heroBlock) {
      const figure = giant("hero-figure", hero.value, 56, cursor, 520, { font: "Anton", max: 250, min: 90, color: p.accent, z: 8 });
      const caption = label("hero-caption", hero.label, 64, cursor + figure.height + 6, 480, { font: body(ctx), size: 18, weight: 600, tracking: 3, uppercase: true, color: p.muted, z: 8 });
      layers.push(...figure.layers, ...caption.layers);
      cursor += figure.height + 6 + caption.height + 40;
      placed.push(heroBlock);
      // The remaining figures still belong on the poster, just not as hero.
      const remaining = heroBlock.items.slice(1);
      rest = blocks.flatMap((b) => (b !== heroBlock ? [b] : remaining.length >= 2 ? [{ ...heroBlock, items: remaining } as Block] : []));
    }
    const st = stack(ctx, region(64, 460, cursor, C - 56, "left", "start"), rest);
    // The trimmed copy of the hero block stands for the original, already placed.
    placed.push(...st.placed.filter((b) => !heroBlock || !hero || b.type !== heroBlock.type));
    layers.push(...st.layers);
    return { layers, placed: order(blocks, placed) };
  },
};
