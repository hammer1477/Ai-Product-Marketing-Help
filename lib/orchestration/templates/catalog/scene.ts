import type { DesignLayer } from "../../../design-schema/types";
import { mix, WHITE } from "../../color";

import type { Block } from "../../blocks/types";
import {
  C,
  bloom,
  ellipse,
  find,
  giant,
  label,
  linear,
  omit,
  pick,
  rect,
  region,
  sceneBackdrop,
  sceneWindow,
  seatedSlot,
  stack,
  stage,
  watermarkFade,
} from "../kit";
import { buildCallout, calloutItems } from "./callout";
import type { TemplateDef } from "./types";

// Templates built around the generated scene — it fills the canvas, or is
// clipped into an arch or a window. Each still renders well without one:
// the scene helpers fall back to a lit gradient ground.

export const midnightSplit: TemplateDef = {
  id: "midnight-split",
  name: "Midnight Split",
  blurb: "Copy column beside the product, cinematic scene behind.",
  tags: ["tech", "specs", "auto", "home"],
  scheme: "dark",
  typography: { headline: "Inter", weight: 800, body: "Inter", tracking: -0.5 },
  cta: "pill",
  usesScene: true,
  build(ctx) {
    const st = stack(ctx, region(76, 448, 72, C - 96, "left", "center"));
    return {
      placed: st.placed,
      layers: [
        ...sceneBackdrop(ctx),
        linear("copy-scrim", 0, 0, 700, C, 90, [[ctx.p.ground, 0, 0.9], [ctx.p.ground, 1, 0]]),
        ...stage(ctx, { cx: 806, cy: 520, w: 540, h: 820 }),
        ...st.layers,
        ...watermarkFade(ctx),
      ],
    };
  },
};

export const spotlight: TemplateDef = {
  id: "spotlight",
  name: "Spotlight",
  blurb: "Product centre stage, copy in a band beneath.",
  tags: ["beauty", "luxury", "food", "home", "kids"],
  scheme: "dark",
  typography: { headline: "DM Serif Display", weight: 400, body: "Inter", lineHeight: 1.04 },
  cta: "pill",
  usesScene: true,
  build(ctx) {
    const bandTop = 575;
    const st = stack(ctx, region(140, 800, bandTop + 34, C - 96, "center", "start"));
    return {
      placed: st.placed,
      layers: [
        ...sceneBackdrop(ctx),
        ...stage(ctx, { cx: C / 2, cy: 300, w: 820, h: 540 }),
        linear("band-scrim", 0, bandTop - 150, C, 190, 180, [[ctx.p.ground, 0, 0], [ctx.p.ground, 1, 0.92]]),
        rect("band-solid", 0, bandTop + 40, C, C - bandTop - 40, ctx.p.ground, { opacity: 0.92 }),
        ...st.layers,
        ...watermarkFade(ctx),
      ],
    };
  },
};

export const editorialCorner: TemplateDef = {
  id: "editorial-corner",
  name: "Editorial Corner",
  blurb: "Oversized italic serif, product anchored bottom-right.",
  tags: ["fashion", "luxury", "beauty", "home"],
  scheme: "dark",
  typography: { headline: "Fraunces", weight: 700, italic: true, scale: 1.08, lineHeight: 1.02, body: "DM Sans" },
  cta: "underline",
  usesScene: true,
  build(ctx) {
    const st = stack(ctx, region(76, 440, 110, C - 96, "left", "start"));
    return {
      placed: st.placed,
      layers: [
        ...sceneBackdrop(ctx),
        linear("editorial-scrim", 0, 0, 760, C, 90, [[ctx.p.ground, 0, 0.88], [ctx.p.ground, 1, 0]]),
        linear("editorial-top", 0, 0, C, 280, 180, [[ctx.p.ground, 0, 0.7], [ctx.p.ground, 1, 0]]),
        ...label("corner-word", ctx.word, 560, 58, 444, {
          font: ctx.s.bodyFont ?? "DM Sans",
          size: 14,
          weight: 500,
          tracking: 5,
          uppercase: true,
          align: "right",
          color: ctx.p.muted,
          z: 8,
        }).layers,
        rect("corner-rule", 76, 70, 64, 2, ctx.p.accent, { z: 8 }),
        ...stage(ctx, { cx: 810, cy: 690, w: 540, h: 660 }),
        ...st.layers,
        ...watermarkFade(ctx),
      ],
    };
  },
};

export const specCallout: TemplateDef = {
  id: "spec-callout",
  name: "Spec Callout",
  blurb: "Numbered leader lines pointing at each feature.",
  tags: ["tech", "specs", "auto", "wellness"],
  scheme: "dark",
  typography: { headline: "Space Grotesk", weight: 700, body: "Inter", scale: 0.9, tracking: -0.5 },
  cta: "pill",
  usesScene: true,
  build(ctx) {
    const result = buildCallout(ctx, "classic", Boolean(ctx.scene));
    return { placed: result.placed, layers: [...sceneBackdrop(ctx), ...result.layers, ...watermarkFade(ctx)] };
  },
};

export const galleryArch: TemplateDef = {
  id: "gallery-arch",
  name: "Gallery Arch",
  blurb: "Warm paper, the scene framed in an arch, italic serif.",
  tags: ["beauty", "luxury", "home", "fashion", "wellness", "minimal"],
  scheme: "light",
  typography: { headline: "Instrument Serif", weight: 400, italic: true, scale: 1.3, lineHeight: 1.0, body: "DM Sans" },
  cta: "underline",
  usesScene: true,
  build(ctx) {
    const { p } = ctx;
    const arch = { x: 560, y: 96, w: 456, h: 860 };
    const st = stack(ctx, region(72, 440, 120, 1000, "left", "center"));
    return {
      placed: st.placed,
      layers: [
        rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
        ...sceneWindow(ctx, arch.x, arch.y, arch.w, arch.h, {
          radii: [arch.w / 2, arch.w / 2, 18, 18],
          fallback: mix(p.accent, p.ground, 0.55),
          fadeTo: p.ground,
        }),
        rect("arch-outline", arch.x - 14, arch.y - 14, arch.w + 28, arch.h + 28, "transparent", {
          radii: [arch.w / 2 + 14, arch.w / 2 + 14, 28, 28],
          stroke: p.accent,
          strokeWidth: 1,
          opacity: 0.6,
          z: 1,
        }),
        ...label("folio", `Nº 01 — ${ctx.word}`, 72, 56, 460, {
          font: ctx.s.bodyFont ?? "DM Sans",
          size: 13,
          weight: 500,
          tracking: 3,
          uppercase: true,
          color: p.muted,
          z: 8,
        }).layers,
        ...stage(ctx, seatedSlot(ctx, arch.x + arch.w / 2, 900, 400, 540), { glow: false }),
        ...st.layers,
      ],
    };
  },
};

export const podium: TemplateDef = {
  id: "podium",
  name: "Podium",
  blurb: "Product on a lit plinth, features floating either side.",
  tags: ["beauty", "tech", "luxury", "wellness", "minimal"],
  scheme: "dark",
  typography: { headline: "Syne", weight: 800, uppercase: true, scale: 0.78, lineHeight: 1.04, body: "Inter" },
  cta: "pill",
  usesScene: true,
  build(ctx) {
    const { p, s, blocks } = ctx;
    const podTop = 790;
    const podW = 580;
    const podX = (C - podW) / 2;
    const placed: Block[] = [];
    const layers: DesignLayer[] = [...sceneBackdrop(ctx, 0.3)];

    // The plinth: a lit cylinder — a body fading into the ground, and an
    // elliptical top face catching the light.
    layers.push(
      linear("podium-body", podX, podTop, podW, C - podTop, 180, [[mix(p.ground, WHITE, 0.16), 0, 1], [p.ground, 1, 1]], 1),
      ellipse("podium-top", podX, podTop - 48, podW, 96, mix(p.ground, WHITE, 0.24), { z: 1 }),
      ellipse("podium-rim", podX, podTop - 48, podW, 96, "transparent", { stroke: p.accent, strokeWidth: 2, opacity: 0.6, z: 1 }),
      bloom("podium-light", C / 2, podTop - 260, 760, 620, p.accent, 0.22, 1),
    );

    layers.push(...stage(ctx, seatedSlot(ctx, C / 2, podTop + 6, 440, 520)));

    const top = stack(ctx, region(100, 880, 56, 300, "center", "start"), pick(blocks, ["badge", "headline", "subheadline", "description"]), { key: "t" });
    placed.push(...top.placed);
    layers.push(...top.layers);

    // Features float either side of the product.
    const items = calloutItems(blocks);
    for (const type of ["specGrid", "featureList"] as const) {
      const block = find(blocks, type);
      if (block && items.length > 0) placed.push(block);
    }
    const body = s.bodyFont ?? "Inter";
    items.forEach((item, i) => {
      const left = i % 2 === 0;
      const y = 370 + Math.floor(i / 2) * 120;
      const x = left ? 56 : C - 56 - 220;
      layers.push(rect(`float-mark-${i}`, left ? x : x + 220 - 28, y, 28, 3, p.accent, { z: 8 }));
      if (item.value) {
        layers.push(
          ...label(`float-label-${i}`, item.label, x, y + 14, 220, { font: body, size: 12, weight: 600, tracking: 1.4, uppercase: true, color: p.accent, align: left ? "left" : "right", z: 8 }).layers,
          ...label(`float-value-${i}`, item.value, x, y + 34, 220, { font: body, size: 20, weight: 700, color: p.text, align: left ? "left" : "right", maxLines: 2, z: 8, role: "sellingPoint" }).layers,
        );
      } else {
        layers.push(
          ...label(`float-label-${i}`, item.label, x, y + 14, 220, { font: body, size: 17, weight: 500, color: p.text, align: left ? "left" : "right", maxLines: 3, lineHeight: 1.3, z: 8, role: "sellingPoint" }).layers,
        );
      }
    });

    const bottom = stack(ctx, region(290, 500, podTop + 70, C - 30, "center", "start"), pick(blocks, ["priceBlock", "cta"]), { key: "f" });
    placed.push(...bottom.placed);
    layers.push(...bottom.layers, ...watermarkFade(ctx));

    return { layers, placed: order(blocks, placed) };
  },
};

export const magazineCover: TemplateDef = {
  id: "magazine-cover",
  name: "Magazine Cover",
  blurb: "Masthead across the top, cover lines down the side.",
  tags: ["fashion", "beauty", "luxury", "food", "bold"],
  scheme: "dark",
  typography: { headline: "DM Serif Display", weight: 400, italic: true, scale: 1.0, lineHeight: 1.02, body: "DM Sans" },
  cta: "rect",
  usesScene: true,
  build(ctx) {
    const { p, s, blocks } = ctx;
    const placed: Block[] = [];
    const layers: DesignLayer[] = [
      ...sceneBackdrop(ctx, 0.18),
      linear("mast-scrim", 0, 0, C, 360, 180, [[p.ground, 0, 0.78], [p.ground, 1, 0]]),
      linear("lines-scrim", 0, 0, 520, C, 90, [[p.ground, 0, 0.7], [p.ground, 1, 0]]),
      linear("foot-scrim", 0, 640, C, 440, 180, [[p.ground, 0, 0], [p.ground, 1, 0.94]]),
    ];

    const mast = giant("masthead", ctx.word, 44, 34, 992, {
      font: s.headlineFont,
      weight: s.headlineWeight,
      max: 190,
      min: 70,
      uppercase: true,
      tracking: -2,
      align: "center",
      color: p.text,
      lineHeight: 1,
      z: 3,
    });
    layers.push(...mast.layers);
    const mastBottom = 34 + mast.height;
    layers.push(
      rect("mast-rule", 48, mastBottom + 10, 984, 1, p.text, { opacity: 0.6, z: 8 }),
      ...label("issue", "Issue Nº 01", 48, mastBottom + 20, 400, { font: s.bodyFont ?? "DM Sans", size: 13, weight: 500, tracking: 3, uppercase: true, color: p.muted, z: 8 }).layers,
    );

    // The product breaks over the masthead's lower edge, as cover models do.
    layers.push(...stage(ctx, { cx: 690, cy: 580, w: 600, h: 620 }, { z: 4 }));

    const lines = stack(ctx, region(48, 320, mastBottom + 70, 780, "left", "start"), pick(blocks, ["badge", "featureList", "specGrid", "statRow", "rating"]), { key: "l" });
    const foot = stack(ctx, region(48, 640, 800, C - 48, "left", "start"), pick(blocks, ["headline", "subheadline", "priceBlock", "cta"]), { key: "f" });
    placed.push(...lines.placed, ...foot.placed);
    layers.push(...lines.layers, ...foot.layers, ...watermarkFade(ctx));
    return { layers, placed: order(blocks, placed) };
  },
};

export const duotone: TemplateDef = {
  id: "duotone",
  name: "Duotone",
  blurb: "Scene washed in one colour, towering condensed headline.",
  tags: ["promo", "bold", "fashion", "auto", "kids"],
  scheme: "dark",
  typography: { headline: "Bebas Neue", weight: 400, uppercase: true, scale: 1.7, lineHeight: 0.92, body: "Space Grotesk" },
  cta: "rect",
  usesScene: true,
  build(ctx) {
    const { p, s, blocks } = ctx;
    const placed: Block[] = [];
    const layers: DesignLayer[] = ctx.scene
      ? [...sceneBackdrop(ctx, 0), rect("wash", 0, 0, C, C, p.accent, { opacity: 0.55, z: 0 })]
      : [rect("bg", 0, 0, C, C, p.accent, { z: 0 }), bloom("bg-bloom", 540, 380, 1000, 900, "#ffffff", 0.25, 0)];
    layers.push(linear("ink-rise", 0, 480, C, 600, 180, [[p.ground, 0, 0], [p.ground, 0.55, 0.85], [p.ground, 1, 1]], 1));
    layers.push(...stage(ctx, { cx: 540, cy: 400, w: 640, h: 600 }, { glow: false }));

    const body = s.bodyFont ?? "Space Grotesk";
    const badge = find(blocks, "badge");
    if (badge) {
      placed.push(badge);
      layers.push(...label("corner-badge", badge.text, 48, 44, 460, { font: body, size: 15, weight: 700, tracking: 3, uppercase: true, color: p.text, z: 8, role: "badgeLabel" }).layers);
    }
    const price = find(blocks, "priceBlock");
    if (price) {
      placed.push(price);
      layers.push(...label("corner-price", price.value, 560, 40, 472, { font: s.headlineFont, size: 44, weight: s.headlineWeight, align: "right", color: p.text, z: 8 }).layers);
    }

    const foot = stack(ctx, region(48, 984, 700, C - 40, "left", "start"), pick(blocks, ["headline", "subheadline", "description", "cta"]), { key: "f" });
    placed.push(...foot.placed);
    layers.push(...foot.layers, ...watermarkFade(ctx));
    return { layers, placed: order(blocks, placed) };
  },
};

export const windowCard: TemplateDef = {
  id: "window-card",
  name: "Window Card",
  blurb: "Scene in a rounded window, product popping out over its edge.",
  tags: ["home", "food", "wellness", "beauty", "kids"],
  scheme: "light",
  typography: { headline: "Fraunces", weight: 700, scale: 0.8, lineHeight: 1.02, body: "DM Sans" },
  cta: "pill",
  usesScene: true,
  build(ctx) {
    const { p, blocks } = ctx;
    const left = stack(ctx, region(56, 480, 712, C - 40, "left", "start"), pick(blocks, ["badge", "headline", "subheadline", "description"]), { key: "l" });
    const right = stack(ctx, region(584, 440, 722, C - 40, "left", "start"), omit(blocks, ["badge", "headline", "subheadline", "description"]), { key: "r" });
    return {
      placed: order(blocks, [...left.placed, ...right.placed]),
      layers: [
        rect("bg", 0, 0, C, C, p.ground, { z: 0 }),
        ...sceneWindow(ctx, 40, 40, 1000, 600, { radius: 36, fallback: mix(p.accent, p.ground, 0.5), fadeTo: p.text }),
        ...stage(ctx, seatedSlot(ctx, 540, 676, 560, 600), { glow: false }),
        rect("column-rule", 560, 722, 1, 300, p.line, { z: 1 }),
        ...left.layers,
        ...right.layers,
      ],
    };
  },
};

/** Restores the model's block order after templates place blocks piecemeal. */
export function order(source: Block[], placed: Block[]): Block[] {
  const unique = placed.filter((block, i) => placed.indexOf(block) === i);
  return unique.sort((a, b) => indexOfType(source, a) - indexOfType(source, b));
}

function indexOfType(source: Block[], block: Block): number {
  const exact = source.indexOf(block);
  if (exact >= 0) return exact;
  const byType = source.findIndex((candidate) => candidate.type === block.type);
  return byType >= 0 ? byType : source.length;
}


