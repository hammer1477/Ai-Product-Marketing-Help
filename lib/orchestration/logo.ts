import type { DesignLayer } from "../design-schema/types";
import type { BrandLogo } from "../brand/kit";
import { isDark } from "./color";

// Stamps the brand logo into whichever corner of the finished design is
// emptiest. Templates know nothing about logos — a logo is a brand-level
// addition, so it's placed after layout, against what the template actually
// drew, rather than reserved as a slot in 25 designs.

const MARGIN = 44;
const TARGET_HEIGHT = 64;
const MAX_WIDTH = 210;
const CHIP_PAD = 12;

type Box = { x: number; y: number; width: number; height: number };

function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Layers a logo shouldn't sit on: copy, icons, the product, small shapes like buttons and badges. */
function obstacles(layers: DesignLayer[], width: number, height: number): Box[] {
  const canvas = width * height;
  return layers.filter((layer) => {
    if (layer.opacity !== undefined && layer.opacity < 0.2) return false;
    if (layer.type === "text" || layer.type === "icon") return true;
    const area = layer.width * layer.height;
    if (layer.type === "image") return area < canvas * 0.8;
    if (layer.type === "shape") return area < canvas * 0.12;
    return false;
  });
}

/**
 * The colour behind `box`: the fill of the topmost solid shape covering its
 * centre, or the ground. Null when it's a photo or gradient — unknowable,
 * so the caller plays safe with a chip.
 */
function backdropUnder(layers: DesignLayer[], box: Box, ground: string): string | null {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const covering = layers
    .filter((l) => !l.rotation && l.x <= cx && l.y <= cy && l.x + l.width >= cx && l.y + l.height >= cy)
    .filter((l) => l.type !== "text" && l.type !== "icon")
    .filter((l) => (l.opacity ?? 1) >= 0.5)
    .sort((a, b) => b.zIndex - a.zIndex);
  const top = covering[0];
  if (!top) return ground;
  if (top.type === "shape" && top.shape === "rect") return top.fill;
  if (top.type === "image" && top.src.startsWith("data:image/svg")) return ground; // pattern overlay
  return null;
}

export function placeLogo(
  layers: DesignLayer[],
  canvas: { width: number; height: number },
  logo: BrandLogo,
  ground: string,
): DesignLayer[] {
  let w = Math.round(TARGET_HEIGHT * logo.aspect);
  let h = TARGET_HEIGHT;
  if (w > MAX_WIDTH) {
    w = MAX_WIDTH;
    h = Math.round(MAX_WIDTH / logo.aspect);
  }

  const pad = MARGIN + CHIP_PAD;
  const corners: Box[] = [
    { x: pad, y: pad, width: w, height: h },
    { x: canvas.width - pad - w, y: pad, width: w, height: h },
    { x: canvas.width - pad - w, y: canvas.height - pad - h, width: w, height: h },
    { x: pad, y: canvas.height - pad - h, width: w, height: h },
  ];

  const blocking = obstacles(layers, canvas.width, canvas.height);
  // Score with the chip's padding included, so "nearly touching" counts.
  const scored = corners.map((box, i) => {
    const halo = { x: box.x - CHIP_PAD * 2, y: box.y - CHIP_PAD * 2, width: box.width + CHIP_PAD * 4, height: box.height + CHIP_PAD * 4 };
    // Earlier corners win ties: top-left reads as a brand mark first.
    return { box, score: blocking.reduce((sum, b) => sum + overlap(halo, b), 0) + i };
  });
  const { box } = scored.reduce((best, c) => (c.score < best.score ? c : best));

  const top = layers.reduce((max, l) => Math.max(max, l.zIndex), 0);
  const out: DesignLayer[] = [];

  // A dark logo on a dark backdrop (or light on light) disappears — give it
  // a chip. Judged against what's actually under the logo, not the ground:
  // templates put dark cards on light grounds and the reverse.
  const under = backdropUnder(layers, box, ground);
  const needsChip = under === null || (logo.tone === "dark") === isDark(under);
  if (needsChip) {
    out.push({
      id: "brand-logo-chip",
      type: "shape",
      shape: "rect",
      fill: logo.tone === "dark" ? "#ffffff" : "#111111",
      x: box.x - CHIP_PAD,
      y: box.y - CHIP_PAD,
      width: box.width + CHIP_PAD * 2,
      height: box.height + CHIP_PAD * 2,
      borderRadius: 14,
      opacity: 0.92,
      zIndex: top + 1,
    });
  }
  out.push({
    id: "brand-logo",
    type: "image",
    src: logo.src,
    fit: "contain",
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    zIndex: top + 2,
  });
  return out;
}
