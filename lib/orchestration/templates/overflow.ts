import type { DesignLayer } from "../../design-schema/types";
import type { Block, BlockType } from "../blocks/types";
import type { AdFormat } from "../formats";
import { formatDef } from "../formats";
import { rect, region, stack, type TemplateCtx } from "./kit";

// Bigger formats carry more facts.
//
// Every template is drawn on the 1080 square, and on a square it fits what
// it can: lists get trimmed, the least important blocks dropped. A portrait,
// landscape or story canvas has room the square never had, so instead of
// just stretching the background into it, the content the square left out
// is laid out there — a facts band under the design (portrait, story) or a
// column beside it (landscape), in the template's own type and colours.

/** Blocks that are never worth a band of their own. */
const SKIP: BlockType[] = ["headline", "cta", "divider", "badge", "priceBlock"];

/** List sections that read well on their own, in a band or column. */
// Key figures and the rating stay in the square: short, visual, and part of its look.
const MOVABLE: BlockType[] = ["featureList", "specGrid", "trustStrip"];

/**
 * Templates whose lists ARE the design — callouts around the product, a
 * tile per fact, an itemised receipt. Moving their lists out would leave
 * the design empty, so they only send their leftovers to the band.
 */
const LISTS_ARE_STRUCTURAL = new Set([
  "spec-callout",
  "tech-hud",
  "podium",
  "bento",
  "receipt",
  "big-number",
  "spec-sheet",
  "fact-board",
  "catalog-page",
]);

/**
 * How a bigger format splits the content: `square` is what the 1080 design
 * is built with, `band` what goes in the added space. Most templates hand
 * their lists to the band whole, so the square breathes and every feature
 * and spec is shown uncut; structural templates keep theirs.
 */
export function splitForBand(templateId: string, blocks: Block[]): { square: Block[]; band: Block[] } {
  if (LISTS_ARE_STRUCTURAL.has(templateId)) return { square: blocks, band: [] };
  const band = blocks.filter((b) => MOVABLE.includes(b.type));
  if (band.length === 0) return { square: blocks, band: [] };
  return { square: blocks.filter((b) => !MOVABLE.includes(b.type)), band };
}

/** What the square design had to leave out: dropped blocks, and the trimmed tails of lists. */
export function leftovers(all: Block[], placed: Block[]): Block[] {
  const out: Block[] = [];
  for (const block of all) {
    if (SKIP.includes(block.type)) continue;
    const shown = placed.find((p) => p.type === block.type);
    if (!shown) {
      out.push(block);
      continue;
    }
    if ("items" in block && "items" in shown && shown.items.length < block.items.length) {
      const rest = block.items.slice(shown.items.length);
      // A one-item list reads as an orphan; only carry a real remainder.
      if (rest.length >= 2 || (block.type === "specGrid" && rest.length >= 1)) {
        if (block.type === "featureList") {
          out.push({ ...block, items: rest as string[], icons: block.icons?.slice(shown.items.length) });
        } else {
          out.push({ ...block, items: rest } as Block);
        }
      }
    }
  }
  return out;
}

type Band = {
  /** Where the 1080 square sits inside the larger canvas. */
  offset: { x: number; y: number };
  /** The band's backing area. */
  area: { x: number; y: number; width: number; height: number };
  /** Where copy goes inside it. */
  copy: { x: number; y: number; width: number; height: number };
  orientation: "row" | "column";
};

/** The space a format adds beyond the square, laid out for copy. Null for square. */
export function bandFor(format: AdFormat | undefined): Band | null {
  const def = formatDef(format);
  if (def.id === "portrait") {
    // The square at the top; the 270px below it is the band.
    return {
      offset: { x: 0, y: 0 },
      area: { x: 0, y: 1080, width: def.width, height: def.height - 1080 },
      copy: { x: 64, y: 1104, width: def.width - 128, height: def.height - 1080 - 48 },
      orientation: "row",
    };
  }
  if (def.id === "story") {
    // Instagram and TikTok lay their own UI over roughly the top 250px and
    // bottom 340px, so the square sits below the top zone and the band uses
    // only the clear space under it.
    const top = 230;
    const bandTop = top + 1080;
    const bandBottom = def.height - 340;
    return {
      offset: { x: 0, y: top },
      area: { x: 0, y: bandTop, width: def.width, height: def.height - bandTop },
      copy: { x: 64, y: bandTop + 24, width: def.width - 128, height: bandBottom - bandTop - 24 },
      orientation: "row",
    };
  }
  if (def.id === "landscape") {
    return {
      offset: { x: 0, y: 0 },
      area: { x: 1080, y: 0, width: def.width - 1080, height: def.height },
      copy: { x: 1080 + 56, y: 72, width: def.width - 1080 - 120, height: def.height - 144 },
      orientation: "column",
    };
  }
  return null;
}

/** Lays the leftovers into the band. Returns the layers and what made it on. */
export function renderBand(ctx: TemplateCtx, band: Band, blocks: Block[]): { layers: DesignLayer[]; placed: Block[] } {
  const { p } = ctx;
  const layers: DesignLayer[] = [
    // A solid strip in the ground colour: stretched panels and photographs
    // end at the square, and copy here always reads.
    rect("band-ground", band.area.x, band.area.y, band.area.width, band.area.height, p.ground, { z: 5 }),
    band.orientation === "row"
      ? rect("band-rule", band.copy.x, band.area.y, band.copy.width, 1, p.line, { z: 8 })
      : rect("band-rule", band.area.x, band.copy.y, 1, band.copy.height, p.line, { z: 8 }),
  ];
  const placed: Block[] = [];
  const { copy } = band;

  if (band.orientation === "column") {
    // A tall, roomy column: set its type larger than the square's.
    const roomy = { ...ctx.s, textScale: (ctx.s.textScale ?? 1) * 1.3 };
    const st = stack(ctx, region(copy.x, copy.width, copy.y, copy.y + copy.height, "left", "center"), blocks, { key: "band", style: roomy });
    return { layers: [...layers, ...st.layers], placed: st.placed };
  }

  // Row: prose and benefits on the left, the structured facts on the right,
  // so a short, wide band reads as two tidy columns.
  const leftTypes: BlockType[] = ["subheadline", "description", "featureList"];
  let left = blocks.filter((b) => leftTypes.includes(b.type));
  let right = blocks.filter((b) => !leftTypes.includes(b.type));
  // A lone list splits across both columns rather than leaving half the band empty.
  if (blocks.length === 1 && "items" in blocks[0] && blocks[0].items.length >= 4) {
    const only = blocks[0];
    const half = Math.ceil(only.items.length / 2);
    const part = (from: number, to: number): Block =>
      only.type === "featureList"
        ? { ...only, items: only.items.slice(from, to), icons: only.icons?.slice(from, to) }
        : ({ ...only, items: only.items.slice(from, to) } as Block);
    left = [part(0, half)];
    right = [part(half, only.items.length)];
  }
  const twoColumns = left.length > 0 && right.length > 0;
  const gap = 48;
  const colW = twoColumns ? Math.floor((copy.width - gap) / 2) : copy.width;
  const columns: Array<[Block[], number]> = twoColumns ? [[left, copy.x], [right, copy.x + colW + gap]] : [[blocks, copy.x]];
  columns.forEach(([list, x], i) => {
    const st = stack(ctx, region(x, colW, copy.y, copy.y + copy.height, "left", "center"), list, { key: `band${i}` });
    layers.push(...st.layers);
    placed.push(...st.placed);
  });
  return { layers, placed };
}
