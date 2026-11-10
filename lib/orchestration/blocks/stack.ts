import type { DesignLayer } from "../../design-schema/types";
import type { ResolvedStyle } from "../styles";
import type { Built } from "../templates/layoutKit";
import { gapAfter, renderBlock } from "./render";
import { DROP_ORDER, REQUIRED_BLOCKS, type Block } from "./types";

// Stacks a composed block list into a region of the canvas.
//
// This is the piece that lets the model compose freely without being able
// to break the design. It decides the model's output doesn't fit *before*
// drawing anything, then degrades — shortening lists first, dropping whole
// blocks only when shortening isn't enough, and never touching the headline
// or the button. Whatever the model returns, the result fits the region.

export type StackRegion = {
  x: number;
  width: number;
  top: number;
  bottom: number;
  align: "left" | "center";
  /** "start" pins to the top; "center" centres the stack in the region. */
  justify: "start" | "center";
};

export type StackResult = Built & {
  /** Blocks that actually made it onto the poster, in order. */
  placed: Block[];
};

/** Longest a list-style block may get before the fitting pass shortens it. */
const MAX_ITEMS: Partial<Record<Block["type"], number>> = {
  featureList: 6,
  specGrid: 6,
  statRow: 3,
  trustStrip: 4,
};

/** Shortest a list-style block is allowed to get before it's dropped whole. */
const MIN_ITEMS: Partial<Record<Block["type"], number>> = {
  featureList: 2,
  specGrid: 2,
  statRow: 2,
  trustStrip: 2,
};

function itemCount(block: Block): number | null {
  if (block.type === "featureList" || block.type === "trustStrip") return block.items.length;
  if (block.type === "specGrid" || block.type === "statRow") return block.items.length;
  return null;
}

function withItemCount(block: Block, count: number): Block {
  if (block.type === "featureList" || block.type === "trustStrip") {
    return { ...block, items: block.items.slice(0, count) };
  }
  if (block.type === "specGrid" || block.type === "statRow") {
    return { ...block, items: block.items.slice(0, count) };
  }
  return block;
}

/** Measures a candidate list without emitting layers. */
function measureStack(blocks: Block[], region: StackRegion, style: ResolvedStyle): number {
  let cursor = 0;
  blocks.forEach((block, index) => {
    const built = renderBlock(block, {
      style,
      x: region.x,
      width: region.width,
      y: cursor,
      align: region.align,
      key: `b${index}`,
    });
    cursor += built.height + gapAfter(block, blocks[index + 1]);
  });
  return cursor;
}

/**
 * Shrinks a block list until it fits `available` px.
 *
 * Order matters here and is deliberate. Shortening a list loses one fact;
 * dropping a block loses a whole category of information; so every list is
 * trimmed to its minimum before anything is dropped. Required blocks are
 * never candidates — a poster without a headline isn't a smaller poster,
 * it's a broken one.
 */
function fitBlocks(blocks: Block[], region: StackRegion, style: ResolvedStyle): Block[] {
  const available = region.bottom - region.top;
  let candidate = blocks.map((block) => {
    const count = itemCount(block);
    const max = MAX_ITEMS[block.type];
    return count !== null && max !== undefined && count > max ? withItemCount(block, max) : block;
  });

  if (measureStack(candidate, region, style) <= available) return candidate;

  // Pass one: shave one item at a time off the longest list block.
  for (;;) {
    const trimmable = candidate
      .map((block, index) => ({ block, index, count: itemCount(block) }))
      .filter(
        (entry): entry is { block: Block; index: number; count: number } =>
          entry.count !== null && entry.count > (MIN_ITEMS[entry.block.type] ?? 2),
      )
      .sort((a, b) => b.count - a.count);

    if (trimmable.length === 0) break;

    const target = trimmable[0];
    candidate = candidate.map((block, index) =>
      index === target.index ? withItemCount(block, target.count - 1) : block,
    );

    if (measureStack(candidate, region, style) <= available) return candidate;
  }

  // Pass two: drop whole blocks, least important first.
  for (const type of DROP_ORDER) {
    if (REQUIRED_BLOCKS.includes(type)) continue;
    if (!candidate.some((block) => block.type === type)) continue;

    candidate = candidate.filter((block) => block.type !== type);
    if (measureStack(candidate, region, style) <= available) return candidate;
  }

  // Everything optional is gone and it still doesn't fit. The remaining
  // blocks are required, and each one self-limits its own height (the
  // headline auto-shrinks, the CTA is a single line), so this is as small
  // as the stack gets.
  return candidate;
}

export function stackBlocks(
  blocks: Block[],
  region: StackRegion,
  style: ResolvedStyle,
): StackResult {
  const placed = fitBlocks(blocks, region, style);
  const total = measureStack(placed, region, style);

  const slack = region.bottom - region.top - total;
  const startY =
    region.justify === "center" ? Math.round(region.top + Math.max(0, slack) / 2) : region.top;

  const layers: DesignLayer[] = [];
  let cursor = startY;
  let widest = 0;

  placed.forEach((block, index) => {
    const built = renderBlock(block, {
      style,
      x: region.x,
      width: region.width,
      y: cursor,
      align: region.align,
      key: `b${index}`,
    });
    layers.push(...built.layers);
    widest = Math.max(widest, built.width);
    cursor += built.height + gapAfter(block, placed[index + 1]);
  });

  return { layers, height: cursor - startY, width: widest, placed };
}
