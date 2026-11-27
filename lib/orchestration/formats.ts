import type { DesignLayer } from "../design-schema/types";

// Ad formats: one design, every placement.
//
// Templates are drawn on a fixed 1080 square (see templates/kit.ts), and
// hand-redrawing 25 of them per size would mean 100 layouts to maintain.
// Instead every non-square format keeps one side at 1080 and *extends* the
// other, and `reframeLayers` grows the square design to fill it:
//
//   - full-bleed backgrounds, scrims and panels stretch to the new edges
//   - bands anchored to one edge stay anchored to it and grow
//   - full-canvas patterns (dot grids, star fields) tile
//   - everything else — copy, product, ornament — stays centred, untouched
//
// So the copy is never rescaled or re-flowed, and what reads well on the
// square reads identically on the story. The extra room lands at the top
// and bottom of a story, which is exactly where Instagram and TikTok lay
// their own UI over it.

export type AdFormat = "square" | "portrait" | "story" | "landscape";

export type AdFormatDef = {
  id: AdFormat;
  label: string;
  ratio: string;
  width: number;
  height: number;
  /** Where it's used, for the picker. */
  usage: string;
  /** Legacy canvas.aspectRatioPreset value. */
  preset: string;
};

export const BASE = 1080;

export const AD_FORMATS: AdFormatDef[] = [
  { id: "square", label: "Square", ratio: "1:1", width: 1080, height: 1080, usage: "Instagram & Facebook feed", preset: "instagram-square" },
  { id: "portrait", label: "Portrait", ratio: "4:5", width: 1080, height: 1350, usage: "Feed — takes the most screen", preset: "instagram-portrait" },
  { id: "story", label: "Story", ratio: "9:16", width: 1080, height: 1920, usage: "Stories, Reels, TikTok", preset: "instagram-story" },
  { id: "landscape", label: "Landscape", ratio: "16:9", width: 1920, height: 1080, usage: "Banners, YouTube, display", preset: "landscape-16-9" },
];

export function formatDef(format: AdFormat | string | undefined | null): AdFormatDef {
  return AD_FORMATS.find((f) => f.id === format) ?? AD_FORMATS[0];
}

/** The format a product's chosen target platform implies. */
export function formatForPlatform(platform: string | null | undefined): AdFormat {
  switch (platform) {
    case "instagram-story":
      return "story";
    case "facebook-feed":
      return "portrait";
    case "google-display":
    case "website-banner":
      return "landscape";
    default:
      return "square";
  }
}

/**
 * `before` is how much of the extra space goes before the design (above or
 * to the left of it); the rest goes after. Centred by default.
 */
type Axis = { pos: "x" | "y"; len: "width" | "height"; extra: number; before: number };

function isStretchable(layer: DesignLayer): boolean {
  if (layer.rotation) return false;
  if (layer.type === "shape") return true;
  // Radial blooms would turn into ovals; they move with the design instead.
  if (layer.type === "gradient") return layer.gradient === "linear";
  if (layer.type === "image") return layer.fit === "cover";
  return false;
}

function isPattern(layer: DesignLayer): boolean {
  return (
    layer.type === "image" &&
    layer.fit === "contain" &&
    !layer.rotation &&
    layer.x <= 0 &&
    layer.y <= 0 &&
    layer.x + layer.width >= BASE &&
    layer.y + layer.height >= BASE &&
    layer.src.startsWith("data:image/svg")
  );
}

function reframeAxis(layer: DesignLayer, { pos, len, extra, before }: Axis): DesignLayer {
  if (extra <= 0) return layer;
  const start = layer[pos];
  const end = start + layer[len];

  if (isStretchable(layer)) {
    const touchesStart = start <= 0;
    const touchesEnd = end >= BASE;
    if (touchesStart && touchesEnd) return { ...layer, [len]: layer[len] + extra };
    if (touchesStart) return { ...layer, [len]: layer[len] + before };
    if (touchesEnd) return { ...layer, [pos]: start + before, [len]: layer[len] + (extra - before) };
  }
  return { ...layer, [pos]: start + before };
}

/** Copies of a full-canvas pattern laid edge to edge along `axis`. */
function tile(layer: DesignLayer, { pos, len, extra, before }: Axis): DesignLayer[] {
  if (extra <= 0) return [layer];
  const step = layer[len];
  const total = BASE + extra;
  const tiles: DesignLayer[] = [];
  let first = layer[pos] + before;
  while (first > 0) first -= step;
  for (let p = first, i = 0; p < total; p += step, i++) {
    tiles.push({ ...layer, id: i === 0 ? layer.id : `${layer.id}-tile${i}`, [pos]: p });
  }
  return tiles;
}

/**
 * Grows a 1080-square design to `format`. Square returns the layers as they
 * are. `offset` places the square inside the larger canvas (how far from
 * the left and top); by default it's centred.
 */
export function reframeLayers(
  layers: DesignLayer[],
  format: AdFormat | undefined,
  offset?: { x?: number; y?: number },
): DesignLayer[] {
  const def = formatDef(format);
  if (def.width === BASE && def.height === BASE) return layers;

  const extraX = def.width - BASE;
  const extraY = def.height - BASE;
  const axes: Axis[] = [
    { pos: "x", len: "width", extra: extraX, before: offset?.x ?? Math.round(extraX / 2) },
    { pos: "y", len: "height", extra: extraY, before: offset?.y ?? Math.round(extraY / 2) },
  ];

  return layers.flatMap((layer) => {
    if (isPattern(layer)) {
      return axes.reduce<DesignLayer[]>((acc, axis) => acc.flatMap((l) => tile(l, axis)), [layer]);
    }
    return [axes.reduce((l, axis) => reframeAxis(l, axis), layer)];
  });
}
