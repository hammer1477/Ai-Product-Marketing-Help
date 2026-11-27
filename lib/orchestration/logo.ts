import type { DesignLayer } from "../design-schema/types";
import type { BrandLogo, LogoStyle } from "../brand/kit";
import { contrastRatio, isDark, isHex } from "./color";

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
const FIXED_SIZE = { s: 44, m: 60, l: 84 } as const;
const MAX_WIDTH_BY_SIZE = { s: 170, m: 220, l: 300 } as const;
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
type Obstacle = Box & { weight: number; /** Tilted layer, tested exactly rather than by its bounding box. */ tilted?: DesignLayer };

/** Weighted overlap of a box with an obstacle; tilted ones are sampled. */
function hitArea(halo: Box, o: Obstacle): number {
  const coarse = overlap(halo, o);
  if (!coarse || !o.tilted) return coarse;
  const n = 6;
  let inside = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (contains(o.tilted, halo.x + ((i + 0.5) / n) * halo.width, halo.y + ((j + 0.5) / n) * halo.height)) inside++;
    }
  }
  return (inside / (n * n)) * halo.width * halo.height;
}

function obstacles(layers: DesignLayer[], width: number, height: number): Obstacle[] {
  const canvas = width * height;
  return layers.flatMap((layer): Obstacle[] => {
    if (layer.opacity !== undefined && layer.opacity < 0.2) return [];
    // The product is the ad: the logo keeps off it unless every other spot is copy.
    if (isProduct(layer)) return layer.id === "product-photo" ? [{ x: layer.x, y: layer.y, width: layer.width, height: layer.height, weight: 3 }] : [];
    const tilted = layer.rotation ? layer : undefined;
    if (layer.id.startsWith("tape")) return [{ ...rotatedBounds(layer), weight: 4, tilted }];
    if (layer.type === "text" || layer.type === "icon") return [{ ...rotatedBounds(layer), weight: 4, tilted }];
    const area = layer.width * layer.height;
    if (layer.type === "image") return area < canvas * 0.6 ? [{ ...rotatedBounds(layer), weight: 2, tilted }] : [];
    if (layer.type === "shape") return area < canvas * 0.1 ? [{ ...rotatedBounds(layer), weight: 3, tilted }] : [];
    return [];
  });
}

/**
 * The colour behind `box`: the fill of the topmost solid layer covering its
 * centre, or the ground. Null over a photograph — unknowable.
 */
function backdropAt(layers: DesignLayer[], cx: number, cy: number, ground: string): string | null {
  const covering = layers
    .filter((l) => !isProduct(l) && contains(l, cx, cy))
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
function reads(layers: DesignLayer[], box: Box, ink: string, ground: string): boolean {
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

/** Whether (px, py) lies inside a layer, rotated about its centre. */
function contains(l: DesignLayer, px: number, py: number): boolean {
  let x = px;
  let y = py;
  if (l.rotation) {
    const a = (-l.rotation * Math.PI) / 180;
    const cx = l.x + l.width / 2;
    const cy = l.y + l.height / 2;
    const dx = px - cx;
    const dy = py - cy;
    x = cx + dx * Math.cos(a) - dy * Math.sin(a);
    y = cy + dx * Math.sin(a) + dy * Math.cos(a);
  }
  return l.x <= x && l.y <= y && l.x + l.width >= x && l.y + l.height >= y;
}

/**
 * Candidate boxes for a fixed position, nearest first: straight inward from
 * the edge, then along it toward the centre, then both.
 */
function slides(start: Box, position: string, W: number, H: number): Box[] {
  const step = 22;
  const down = position.startsWith("top") ? 1 : -1;
  const across = position.endsWith("left") ? 1 : position.endsWith("right") ? -1 : 0;
  const maxY = Math.round(H * 0.3);
  const maxX = Math.round(W * 0.3);
  const out: Box[] = [];
  for (let d = 0; d <= Math.max(maxY, maxX); d += step) {
    if (d <= maxY) out.push({ ...start, y: start.y + down * d });
    if (across && d > 0 && d <= maxX) out.push({ ...start, x: start.x + across * d });
  }
  for (let dy = step; dy <= maxY; dy += step * 2) {
    for (let dx = step; across && dx <= maxX; dx += step * 2) out.push({ ...start, x: start.x + across * dx, y: start.y + down * dy });
  }
  return out;
}

export type PlacedLogo = { layers: DesignLayer[]; box: Box };

export function placeLogo(
  layers: DesignLayer[],
  canvas: { width: number; height: number },
  logo: BrandLogo,
  palette: { ground: string; text: string },
  style: LogoStyle = {},
): PlacedLogo {
  const blocking = obstacles(layers, canvas.width, canvas.height);
  const recolor = style.color && style.color !== "original" && isHex(style.color) ? style.color : null;
  // The colour that actually lands on the design, for the contrast test.
  const ink = recolor ?? (logo.tone === "dark" ? "#222222" : "#eeeeee");
  const position = style.position ?? "auto";
  const sizes = style.size ? [FIXED_SIZE[style.size]] : SIZES;
  const maxWidth = style.size ? MAX_WIDTH_BY_SIZE[style.size] : MAX_WIDTH;
  const spotIndex: Record<Exclude<typeof position, "auto">, number> = {
    "top-left": 0,
    "top-right": 1,
    "bottom-right": 2,
    "bottom-left": 3,
    "top-center": 4,
    "bottom-center": 5,
  };
  const top = layers.reduce((max, l) => Math.max(max, l.zIndex), 0);

  type Candidate = { box: Box; score: number; chip: boolean };
  let chosen: Candidate | null = null;

  for (const target of sizes) {
    let w = Math.round(target * logo.aspect);
    let h = target;
    if (w > maxWidth) {
      w = maxWidth;
      h = Math.round(maxWidth / logo.aspect);
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
    // A chosen position is honoured as a side of the canvas: the logo slides
    // inward from that spot to the nearest place clear of copy, rather than
    // printing over a price or a tape that happens to be there.
    const allowed = position === "auto" ? spots : slides(spots[spotIndex[position]], position, W, H);
    const scored = allowed.map((box, i): Candidate => {
      const halo = { x: box.x - CLEAR * 2, y: box.y - CLEAR * 2, width: box.width + CLEAR * 4, height: box.height + CLEAR * 4 };
      const hit = blocking.reduce((sum, b) => sum + hitArea(halo, b) * b.weight, 0);
      const chip = style.chip === "on" ? true : style.chip === "off" ? false : !reads(layers, box, ink, palette.ground);
      // Auto: corners before edge centres, a bare logo before a chipped one.
      // Fixed: the closer to the chosen spot, the better.
      const order = position === "auto" ? i * 10 + (chip ? 400 : 0) : i * 6;
      return { box, score: hit + order, chip };
    });
    const best = scored.reduce((a, b) => (b.score < a.score ? b : a));
    if (!chosen || best.score < chosen.score) chosen = best;
    // A spot clear of everything at this size beats a smaller one.
    if (best.score < 1000) break;
  }

  const { box, chip } = chosen!;
  const out: DesignLayer[] = [];
  if (chip) {
    const fill = isDark(ink) ? "#ffffff" : "#111111";
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
    src: recolor ? tinted(logo.src, box.width, box.height, recolor) : logo.src,
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

/**
 * The logo in one colour the seller chose: a rect of `color` masked by the
 * logo's alpha (its shape). SVG rather than image processing so it runs in
 * the browser's live preview as well as the exporter. An alpha *mask*
 * specifically: resvg drops nested rasters drawn directly or via filters,
 * but renders them as mask content.
 */
function tinted(src: string, width: number, height: number, color: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><mask id="m" mask-type="alpha" style="mask-type:alpha" x="0" y="0" width="${width}" height="${height}" maskUnits="userSpaceOnUse">` +
    `<image href="${src}" xlink:href="${src}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>` +
    `</mask></defs>` +
    `<rect width="${width}" height="${height}" fill="${color}" mask="url(#m)"/>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
