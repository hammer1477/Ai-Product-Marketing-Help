import type { DesignLayer } from "../design-schema/types";
import type { BrandLogo } from "../brand/kit";
import { contrastRatio, isHex } from "./color";

// Stamps the brand logo into the emptiest spot of the finished design.
// Templates know nothing about logos — a logo is a brand-level addition,
// placed after layout against what the template actually drew.
//
// Two rules, both from sellers' complaints:
//   1. The logo is never covered and never covers. It tries every corner
//      and edge centre, shrinking before it settles on a busy spot, and the
//      product is then refitted around it (see keepProductClear).
//   2. The logo is the brand's own artwork — its colours are never
//      changed. Where it wouldn't read on what's under it, it sits on a
//      small rounded chip in a contrasting colour instead of being recoloured.

const MARGIN = 40;
const SIZES = [64, 54, 46];
const MAX_WIDTH = 220;
/** Clear space kept around the logo. */
const CLEAR = 14;
/** Chip padding, when a chip is needed. */
const CHIP_X = 14;
const CHIP_Y = 8;

type Box = { x: number; y: number; width: number; height: number };

function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

const isProduct = (layer: DesignLayer) => layer.id.startsWith("product-");

/**
 * What the logo must not sit on, weighted: copy and buttons are hard
 * obstacles; the product is soft, because it can be refitted around the
 * logo; big decorative shapes don't count.
 */
function obstacles(layers: DesignLayer[], width: number, height: number): Array<Box & { weight: number }> {
  const canvas = width * height;
  return layers.flatMap((layer) => {
    if (layer.opacity !== undefined && layer.opacity < 0.2) return [];
    if (isProduct(layer)) return layer.id === "product-photo" ? [{ ...layer, weight: 1 }] : [];
    if (layer.id.startsWith("tape")) return [{ ...rotatedBounds(layer), weight: 4 }];
    if (layer.type === "text" || layer.type === "icon") return [{ ...rotatedBounds(layer), weight: 4 }];
    const area = layer.width * layer.height;
    if (layer.type === "image") return area < canvas * 0.6 ? [{ ...layer, weight: 2 }] : [];
    if (layer.type === "shape") return area < canvas * 0.08 ? [{ ...layer, weight: 3 }] : [];
    return [];
  });
}

/**
 * The colour behind `box`: the fill of the topmost solid layer covering its
 * centre, or the ground. Null over a photograph — unknowable.
 */
function backdropAt(layers: DesignLayer[], cx: number, cy: number, ground: string): string | null {
  const covering = layers
    .filter((l) => !l.rotation && !isProduct(l) && l.x <= cx && l.y <= cy && l.x + l.width >= cx && l.y + l.height >= cy)
    .filter((l) => l.type !== "text" && l.type !== "icon")
    .filter((l) => (l.opacity ?? 1) >= 0.5)
    // Soft glows are tints, not a backdrop.
    .filter((l) => l.type !== "gradient" || l.gradient === "linear")
    .filter((l) => l.type !== "shape" || (isHex(l.fill) && !/^#[0-9a-f]{6}00$/i.test(l.fill) && l.fill !== "transparent"))
    .sort((a, b) => b.zIndex - a.zIndex);
  const top = covering[0];
  if (!top) return ground;
  if (top.type === "shape") return top.fill;
  if (top.type === "gradient") {
    const strongest = [...top.stops].sort((a, b) => (b.opacity ?? 1) - (a.opacity ?? 1))[0];
    return strongest && (strongest.opacity ?? 1) >= 0.6 ? strongest.color : ground;
  }
  if (top.type === "image" && top.src.startsWith("data:image/svg")) return ground; // pattern overlay
  return null;
}

/**
 * Whether a logo of this tone reads everywhere across `box` without help —
 * sampled at the centre and near each corner, so a logo straddling a dark
 * panel and a light ground counts as not reading.
 */
function reads(layers: DesignLayer[], box: Box, tone: BrandLogo["tone"], ground: string): boolean {
  const ink = tone === "dark" ? "#222222" : "#eeeeee";
  const points: Array<[number, number]> = [
    [0.5, 0.5],
    [0.08, 0.15],
    [0.92, 0.15],
    [0.08, 0.85],
    [0.92, 0.85],
  ];
  return points.every(([fx, fy]) => {
    const under = backdropAt(layers, box.x + box.width * fx, box.y + box.height * fy, ground);
    return under !== null && contrastRatio(ink, under) >= 2.4;
  });
}

/** Axis-aligned bounds of a possibly rotated layer. */
function rotatedBounds(l: DesignLayer): Box {
  if (!l.rotation) return l;
  const a = (l.rotation * Math.PI) / 180;
  const w = l.width * Math.abs(Math.cos(a)) + l.height * Math.abs(Math.sin(a));
  const h = l.width * Math.abs(Math.sin(a)) + l.height * Math.abs(Math.cos(a));
  return { x: l.x + l.width / 2 - w / 2, y: l.y + l.height / 2 - h / 2, width: w, height: h };
}

export type PlacedLogo = { layers: DesignLayer[]; box: Box };

export function placeLogo(
  layers: DesignLayer[],
  canvas: { width: number; height: number },
  logo: BrandLogo,
  palette: { ground: string; text: string },
): PlacedLogo {
  const blocking = obstacles(layers, canvas.width, canvas.height);
  const top = layers.reduce((max, l) => Math.max(max, l.zIndex), 0);

  type Candidate = { box: Box; score: number; chip: boolean };
  let chosen: Candidate | null = null;

  for (const target of SIZES) {
    let w = Math.round(target * logo.aspect);
    let h = target;
    if (w > MAX_WIDTH) {
      w = MAX_WIDTH;
      h = Math.round(MAX_WIDTH / logo.aspect);
    }
    const pad = MARGIN + CLEAR;
    const { width: W, height: H } = canvas;
    const spots: Box[] = [
      { x: pad, y: pad, width: w, height: h },
      { x: W - pad - w, y: pad, width: w, height: h },
      { x: W - pad - w, y: H - pad - h, width: w, height: h },
      { x: pad, y: H - pad - h, width: w, height: h },
      { x: Math.round((W - w) / 2), y: pad, width: w, height: h },
      { x: Math.round((W - w) / 2), y: H - pad - h, width: w, height: h },
      { x: pad, y: Math.round((H - h) / 2), width: w, height: h },
      { x: W - pad - w, y: Math.round((H - h) / 2), width: w, height: h },
    ];
    const scored = spots.map((box, i): Candidate => {
      const halo = { x: box.x - CLEAR * 2, y: box.y - CLEAR * 2, width: box.width + CLEAR * 4, height: box.height + CLEAR * 4 };
      const hit = blocking.reduce((sum, b) => sum + overlap(halo, b) * b.weight, 0);
      const chip = !reads(layers, box, logo.tone, palette.ground);
      // Corners before edge centres, and a bare logo before a chipped one.
      return { box, score: hit + (chip ? 400 : 0) + i * 10, chip };
    });
    const best = scored.reduce((a, b) => (b.score < a.score ? b : a));
    if (!chosen || best.score < chosen.score) chosen = best;
    // A spot clear of everything at this size beats a smaller one.
    if (best.score < 1000) break;
  }

  const { box, chip } = chosen!;
  const out: DesignLayer[] = [];
  if (chip) {
    const fill = logo.tone === "dark" ? "#ffffff" : "#111111";
    out.push({
      id: "brand-logo-chip",
      type: "shape",
      shape: "rect",
      fill,
      opacity: 0.94,
      borderRadius: Math.round((box.height + CHIP_Y * 2) / 2),
      x: box.x - CHIP_X,
      y: box.y - CHIP_Y,
      width: box.width + CHIP_X * 2,
      height: box.height + CHIP_Y * 2,
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

  const outer = chip
    ? { x: box.x - CHIP_X, y: box.y - CHIP_Y, width: box.width + CHIP_X * 2, height: box.height + CHIP_Y * 2 }
    : box;
  return { layers: out, box: outer };
}
