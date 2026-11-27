import type { DesignLayer, GradientLayer, ImageLayer, TextLayer } from "../../design-schema/types";
import { measureTextBlock } from "../../design-schema/measureText";
import { COPY_Z, containedBox, productStage } from "./layoutKit";
import { C, type ProductAsset } from "./kit";

// The product is the ad. It must never run under the copy, under a tape or
// off the canvas — and it should be as large as the design allows.
//
// Templates give the product a generous slot; how much copy lands beside
// it is only known once the blocks are stacked, and a long headline or a
// wide product used to push the two into each other. This pass runs after
// every template: it carves the slot down to the largest region clear of
// every obstacle and refits the product there, as big as that region holds.

/** Gap kept between the product and anything it must not touch. */
const CLEARANCE = 18;
/** Distance from the canvas edge the product stays inside. */
const EDGE = 28;

type Box = { l: number; t: number; r: number; b: number };

const area = (b: Box) => Math.max(0, b.r - b.l) * Math.max(0, b.b - b.t);
const overlaps = (a: Box, b: Box) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

/** Axis-aligned bounds of a layer, accounting for rotation about its centre. */
function bounds(x: number, y: number, w: number, h: number, rotation?: number): Box {
  if (!rotation) return { l: x, t: y, r: x + w, b: y + h };
  const a = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(a));
  const sin = Math.abs(Math.sin(a));
  const bw = w * cos + h * sin;
  const bh = w * sin + h * cos;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return { l: cx - bw / 2, t: cy - bh / 2, r: cx + bw / 2, b: cy + bh / 2 };
}

/** The ink a text layer actually covers, not the full width of its column. */
function textBounds(layer: TextLayer): Box {
  let width = layer.width;
  try {
    width = Math.min(
      layer.width,
      measureTextBlock(layer.content, layer.width, {
        fontFamily: layer.fontFamily,
        fontSize: layer.fontSize,
        fontWeight: layer.fontWeight,
        fontStyle: layer.fontStyle,
        letterSpacing: layer.letterSpacing,
        lineHeight: layer.lineHeight,
        maxLines: layer.maxLines,
      }).width,
    );
  } catch {
    // Unmeasurable — fall back to the whole column.
  }
  const align = layer.textAlign ?? "left";
  const x = align === "center" ? layer.x + (layer.width - width) / 2 : align === "right" ? layer.x + layer.width - width : layer.x;
  return bounds(x, layer.y, width, layer.height, layer.rotation);
}

/** Copy, buttons and tapes: everything the product must stay clear of. */
function isObstacle(layer: DesignLayer): boolean {
  const id = layer.id;
  if (id.startsWith("product-")) return false;
  // Stickers deliberately overlap a corner of the product.
  if (id.startsWith("sticker")) return false;
  // Callout markers are pinned to the product's edge on purpose.
  if (id.startsWith("callout-number")) return false;
  if (id.startsWith("tape")) return true;
  const z = layer.zIndex ?? 0;
  if (layer.type === "text") return z >= 5 && (layer.opacity ?? 1) > 0.3;
  return layer.type === "shape" && z >= COPY_Z;
}

/**
 * The largest-product region inside `slot` that clears every obstacle.
 * Each obstacle in the way can be avoided from four sides; a small
 * branch-and-bound search keeps whichever cut leaves the biggest product.
 */
function carve(slot: Box, obstacles: Box[], aspect: number): Box {
  const productArea = (b: Box) => {
    const w = b.r - b.l;
    const h = b.b - b.t;
    if (w <= 0 || h <= 0) return 0;
    const fit = containedBox(w, h, aspect);
    return fit.width * fit.height;
  };
  let best: Box | null = null;
  let bestArea = 0;
  let budget = 4000;

  const search = (box: Box) => {
    if (--budget < 0) return;
    const a = productArea(box);
    if (a <= bestArea) return;
    const hit = obstacles.find((o) => overlaps(box, o));
    if (!hit) {
      best = box;
      bestArea = a;
      return;
    }
    const cuts: Box[] = [
      { ...box, r: Math.min(box.r, hit.l) },
      { ...box, l: Math.max(box.l, hit.r) },
      { ...box, b: Math.min(box.b, hit.t) },
      { ...box, t: Math.max(box.t, hit.b) },
    ];
    cuts.sort((x, y) => productArea(y) - productArea(x));
    for (const cut of cuts) search(cut);
  };

  search(slot);
  return best ?? slot;
}

function gradientColor(layer: DesignLayer | undefined): string | undefined {
  return layer?.type === "gradient" ? (layer as GradientLayer).stops[0]?.color : undefined;
}

export function keepProductClear(layers: DesignLayer[], product: ProductAsset): DesignLayer[] {
  const photo = layers.find((l): l is ImageLayer => l.id === "product-photo" && l.type === "image");
  // A tilted product sits in a designed frame (a polaroid); leave it be.
  if (!photo || photo.rotation) return layers;

  const aspect = product.aspectRatio;
  const slot: Box = {
    l: Math.max(EDGE, photo.x),
    t: Math.max(EDGE, photo.y),
    r: Math.min(C - EDGE, photo.x + photo.width),
    b: Math.min(C - EDGE, photo.y + photo.height),
  };

  const obstacles = layers
    .filter((l) => l !== photo && isObstacle(l))
    .map((l) => (l.type === "text" ? textBounds(l) : bounds(l.x, l.y, l.width, l.height, l.rotation)))
    .filter((b) => area(b) > 0)
    .map((b) => ({ l: b.l - CLEARANCE, t: b.t - CLEARANCE, r: b.r + CLEARANCE, b: b.b + CLEARANCE }));

  const origFit = containedBox(photo.width, photo.height, aspect);
  const origCx = photo.x + photo.width / 2;
  const origCy = photo.y + photo.height / 2;
  const origBox: Box = { l: origCx - origFit.width / 2, t: origCy - origFit.height / 2, r: origCx + origFit.width / 2, b: origCy + origFit.height / 2 };
  const insideCanvas = origBox.l >= EDGE - 1 && origBox.t >= EDGE - 1 && origBox.r <= C - EDGE + 1 && origBox.b <= C - EDGE + 1;
  if (insideCanvas && !obstacles.some((o) => overlaps(origBox, o))) return layers;

  const free = carve(slot, obstacles, aspect);
  const fit = containedBox(free.r - free.l, free.b - free.t, aspect);
  // Stay as close to where the design put the product as the free space allows.
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
  const cx = clamp(origCx, free.l + fit.width / 2, free.r - fit.width / 2);
  const cy = clamp(origCy, free.t + fit.height / 2, free.b - fit.height / 2);

  const glow = layers.find((l) => l.id === "product-glow");
  const shadow = layers.some((l) => l.id === "product-shadow");
  const staged = productStage({
    src: photo.src,
    centerX: cx,
    centerY: cy,
    width: Math.floor(fit.width),
    height: Math.floor(fit.height),
    accent: gradientColor(glow) ?? "#ffffff",
    cutoutApplied: product.cutoutApplied,
    aspectRatio: aspect,
    zIndex: (photo.zIndex ?? 4) - 2,
    glow: Boolean(glow),
    shadow,
    photoRadius: photo.borderRadius,
  });

  const replaced = new Set(["product-glow", "product-shadow", "product-photo"]);
  const at = layers.findIndex((l) => replaced.has(l.id));
  const rest = layers.filter((l) => !replaced.has(l.id));
  rest.splice(Math.min(at, rest.length), 0, ...staged);
  return rest;
}
