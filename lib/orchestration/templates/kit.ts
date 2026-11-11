import type {
  CornerRadii,
  DesignLayer,
  GradientLayer,
  ImageLayer,
  ShapeLayer,
} from "../../design-schema/types";
import type { FontFamily } from "../../design-schema/fontRegistry";
import type { TextLayer } from "../../design-schema/types";
import { mix } from "../color";
import type { ResolvedStyle } from "../styles";
import type { Block, BlockType } from "../blocks/types";
import { stackBlocks, type StackRegion, type StackResult } from "../blocks/stack";
import { containedBox, productStage, text, type Built } from "./layoutKit";
import type { Palette } from "./theme";

// The drawing kit every template is built from.
//
// Templates are compositions of these primitives plus the measured block
// stack. Keeping the primitives terse is what makes it practical to have
// two dozen genuinely different designs rather than four layouts with
// colour swaps — each template reads as a short description of a poster.

export const C = 1080;

/** Bottom strip where free image generators stamp a watermark. */
export const WATERMARK_BAND = 96;

export type ProductAsset = { src: string; cutoutApplied: boolean; aspectRatio: number };

export type TemplateCtx = {
  /** All composed blocks, in the model's order. */
  blocks: Block[];
  /** The painted style — what block renderers read. */
  s: ResolvedStyle;
  /** The painted palette — what decoration reads. */
  p: Palette;
  product: ProductAsset;
  /** Generated background scene, when there is one. */
  scene?: string;
  /** A short display word for decoration: the product or brand name. */
  word: string;
};

export type TemplateResult = { layers: DesignLayer[]; placed: Block[] };

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

type ShapeOpts = {
  opacity?: number;
  radius?: number;
  radii?: CornerRadii;
  stroke?: string;
  strokeWidth?: number;
  z?: number;
  rotation?: number;
};

export function rect(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  o: ShapeOpts = {},
): ShapeLayer {
  return {
    id,
    type: "shape",
    shape: "rect",
    fill,
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    opacity: o.opacity,
    borderRadius: o.radius,
    radii: o.radii,
    stroke: o.stroke,
    strokeWidth: o.stroke ? (o.strokeWidth ?? 1) : undefined,
    rotation: o.rotation,
    zIndex: o.z ?? 1,
  };
}

export function ellipse(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  o: ShapeOpts = {},
): ShapeLayer {
  return { ...rect(id, x, y, width, height, fill, o), shape: "ellipse", borderRadius: undefined };
}

/** A circle by centre and radius. */
export function circle(id: string, cx: number, cy: number, r: number, fill: string, o: ShapeOpts = {}) {
  return ellipse(id, cx - r, cy - r, r * 2, r * 2, fill, o);
}

export function linear(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  angle: number,
  stops: Array<[color: string, offset: number, opacity: number]>,
  z = 1,
): GradientLayer {
  return {
    id,
    type: "gradient",
    gradient: "linear",
    angle,
    stops: stops.map(([color, offset, opacity]) => ({ color, offset, opacity })),
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    zIndex: z,
  };
}

/** A soft radial bloom centred on (cx, cy), fading to nothing. */
export function bloom(
  id: string,
  cx: number,
  cy: number,
  width: number,
  height: number,
  color: string,
  strength: number,
  z = 1,
): GradientLayer {
  return {
    id,
    type: "gradient",
    gradient: "radial",
    stops: [
      { color, offset: 0, opacity: strength },
      { color, offset: 0.5, opacity: strength * 0.45 },
      { color, offset: 1, opacity: 0 },
    ],
    x: Math.round(cx - width / 2),
    y: Math.round(cy - height / 2),
    width: Math.round(width),
    height: Math.round(height),
    zIndex: z,
  };
}

function toBase64(markup: string): string {
  // btoa is global in browsers and in Node 16+; the markup is ASCII-only.
  return btoa(markup);
}

/**
 * An inline SVG ornament — starbursts, squiggles, arcs, dot grids.
 *
 * Shapes the layer model can't express are drawn as SVG and placed as an
 * image. Satori and the browser both rasterise SVG images natively, and
 * the vector export keeps them as nested vectors. Never put text inside:
 * an SVG image can't see the embedded fonts.
 */
export function svg(
  id: string,
  width: number,
  height: number,
  body: string,
  at: { x: number; y: number; z?: number; rotation?: number; opacity?: number },
): ImageLayer {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
  return {
    id,
    type: "image",
    src: `data:image/svg+xml;base64,${toBase64(markup)}`,
    fit: "contain",
    x: Math.round(at.x),
    y: Math.round(at.y),
    width,
    height,
    rotation: at.rotation,
    opacity: at.opacity,
    zIndex: at.z ?? 1,
  };
}

export function image(
  id: string,
  src: string,
  x: number,
  y: number,
  width: number,
  height: number,
  o: { radius?: number; radii?: CornerRadii; z?: number; opacity?: number } = {},
): ImageLayer {
  return {
    id,
    type: "image",
    src,
    fit: "cover",
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    borderRadius: o.radius,
    radii: o.radii,
    opacity: o.opacity,
    zIndex: o.z ?? 0,
  };
}

export type LabelOpts = {
  font: FontFamily;
  size: number;
  weight?: 400 | 500 | 600 | 700 | 800;
  color: string;
  align?: "left" | "center" | "right";
  tracking?: number;
  z?: number;
  maxLines?: number;
  italic?: boolean;
  uppercase?: boolean;
  rotation?: number;
  lineHeight?: number;
  opacity?: number;
  autoFit?: boolean;
  minSize?: number;
  role?: TextLayer["role"];
};

/** Free-standing decorative or structural text. */
export function label(id: string, content: string, x: number, y: number, width: number, o: LabelOpts): Built {
  return text({
    id,
    role: o.role ?? "custom",
    content,
    x: Math.round(x),
    y: Math.round(y),
    maxWidth: Math.round(width),
    fontFamily: o.font,
    fontSize: o.size,
    fontWeight: o.weight ?? 400,
    italic: o.italic,
    uppercase: o.uppercase,
    rotation: o.rotation,
    opacity: o.opacity,
    color: o.color,
    textAlign: o.align ?? "left",
    letterSpacing: o.tracking,
    lineHeight: o.lineHeight ?? 1.15,
    maxLines: o.maxLines ?? 1,
    autoFit: o.autoFit,
    minFontSize: o.minSize,
    zIndex: o.z ?? 1,
  });
}

// ---------------------------------------------------------------------------
// Ornaments (SVG)
// ---------------------------------------------------------------------------

/** A many-pointed burst — the classic price/"new" sticker. */
export function starburst(id: string, cx: number, cy: number, r: number, fill: string, o: { points?: number; z?: number; rotation?: number; stroke?: string } = {}) {
  const n = o.points ?? 18;
  const size = Math.ceil(r * 2 + 8);
  const c = size / 2;
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 === 0 ? r : r * 0.82;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push(`${(c + rr * Math.cos(a)).toFixed(1)},${(c + rr * Math.sin(a)).toFixed(1)}`);
  }
  const stroke = o.stroke ? ` stroke="${o.stroke}" stroke-width="3" stroke-linejoin="round"` : "";
  return svg(id, size, size, `<polygon points="${pts.join(" ")}" fill="${fill}"${stroke}/>`, {
    x: cx - c,
    y: cy - c,
    z: o.z,
    rotation: o.rotation,
  });
}

/** A four-pointed sparkle. */
export function sparkle(id: string, cx: number, cy: number, size: number, fill: string, z = 2, opacity?: number) {
  const s = size;
  const h = s / 2;
  const k = s * 0.12;
  const d = `M${h} 0 C${h + k} ${h - k} ${h + k} ${h - k} ${s} ${h} C${h + k} ${h + k} ${h + k} ${h + k} ${h} ${s} C${h - k} ${h + k} ${h - k} ${h + k} 0 ${h} C${h - k} ${h - k} ${h - k} ${h - k} ${h} 0 Z`;
  return svg(id, s, s, `<path d="${d}" fill="${fill}"/>`, { x: cx - h, y: cy - h, z, opacity });
}

/** A hand-drawn-looking wavy underline / squiggle. */
export function squiggle(id: string, x: number, y: number, width: number, color: string, o: { z?: number; rotation?: number; amp?: number; stroke?: number } = {}) {
  const amp = o.amp ?? 8;
  const h = amp * 2 + 8;
  const waves = Math.max(2, Math.round(width / 40));
  const step = (width - 8) / waves;
  let d = `M4 ${h / 2}`;
  for (let i = 0; i < waves; i++) {
    const x0 = 4 + i * step;
    d += ` Q${(x0 + step / 4).toFixed(1)} ${(h / 2 - amp).toFixed(1)} ${(x0 + step / 2).toFixed(1)} ${h / 2} T${(x0 + step).toFixed(1)} ${h / 2}`;
  }
  return svg(id, width, h, `<path d="${d}" fill="none" stroke="${color}" stroke-width="${o.stroke ?? 4}" stroke-linecap="round"/>`, {
    x,
    y: y - h / 2,
    z: o.z,
    rotation: o.rotation,
  });
}

/** A curved hand-drawn arrow from bottom-left to top-right of its box. */
export function arrow(id: string, x: number, y: number, width: number, height: number, color: string, z = 6) {
  const d = `M6 ${height - 6} C ${width * 0.2} ${height * 0.2}, ${width * 0.6} ${height * 0.05}, ${width - 10} 10`;
  const head = `M${width - 30} 8 L${width - 8} 10 L${width - 16} 32`;
  return svg(
    id,
    width,
    height,
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"/><path d="${head}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    { x, y, z },
  );
}

/** A dot grid texture covering a box — one layer instead of hundreds. */
export function dotGrid(id: string, x: number, y: number, width: number, height: number, color: string, o: { gap?: number; r?: number; opacity?: number; z?: number } = {}) {
  const gap = o.gap ?? 36;
  const r = o.r ?? 1.6;
  let dots = "";
  for (let yy = gap / 2; yy < height; yy += gap) {
    for (let xx = gap / 2; xx < width; xx += gap) dots += `<circle cx="${xx}" cy="${yy}" r="${r}"/>`;
  }
  return svg(id, width, height, `<g fill="${color}">${dots}</g>`, { x, y, z: o.z, opacity: o.opacity });
}

/** Diagonal hatching inside a box. */
export function stripes(id: string, x: number, y: number, width: number, height: number, color: string, o: { gap?: number; weight?: number; opacity?: number; z?: number } = {}) {
  const gap = o.gap ?? 22;
  const w = o.weight ?? 6;
  let lines = "";
  for (let i = -height; i < width + height; i += gap) {
    lines += `<line x1="${i}" y1="${height}" x2="${i + height}" y2="0"/>`;
  }
  return svg(id, width, height, `<g stroke="${color}" stroke-width="${w}">${lines}</g>`, { x, y, z: o.z, opacity: o.opacity });
}

/** Corner registration brackets around a box — the HUD / viewfinder look. */
export function brackets(id: string, x: number, y: number, width: number, height: number, color: string, o: { len?: number; weight?: number; z?: number } = {}): DesignLayer[] {
  const len = o.len ?? 34;
  const w = o.weight ?? 3;
  const z = o.z ?? 5;
  const r = x + width;
  const b = y + height;
  return [
    rect(`${id}-tl-h`, x, y, len, w, color, { z }),
    rect(`${id}-tl-v`, x, y, w, len, color, { z }),
    rect(`${id}-tr-h`, r - len, y, len, w, color, { z }),
    rect(`${id}-tr-v`, r - w, y, w, len, color, { z }),
    rect(`${id}-bl-h`, x, b - w, len, w, color, { z }),
    rect(`${id}-bl-v`, x, b - len, w, len, color, { z }),
    rect(`${id}-br-h`, r - len, b - w, len, w, color, { z }),
    rect(`${id}-br-v`, r - w, b - len, w, len, color, { z }),
  ];
}

/** A barcode, for receipts and tickets. Deterministic from `seed`. */
export function barcode(id: string, x: number, y: number, width: number, height: number, color: string, seed: string, z = 6) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  let bars = "";
  let cx = 0;
  while (cx < width) {
    hash = (hash * 1103515245 + 12345) >>> 0;
    const bw = 1 + (hash % 4);
    if ((hash >> 3) % 3 !== 0) bars += `<rect x="${cx}" y="0" width="${bw}" height="${height}"/>`;
    cx += bw + 1 + ((hash >> 5) % 3);
  }
  return svg(id, width, height, `<g fill="${color}">${bars}</g>`, { x, y, z });
}

/** A zigzag (torn receipt) edge along the bottom of a box. */
export function zigzag(id: string, x: number, y: number, width: number, color: string, z = 3) {
  const tooth = 16;
  let d = `M0 0`;
  for (let xx = 0; xx <= width; xx += tooth) d += ` L${xx + tooth / 2} ${tooth / 2} L${xx + tooth} 0`;
  d += ` L${width} 0 Z`;
  return svg(id, width, tooth, `<path d="${d}" fill="${color}"/>`, { x, y, z });
}

// ---------------------------------------------------------------------------
// Composition helpers
// ---------------------------------------------------------------------------

export function ground(ctx: TemplateCtx, fill = ctx.p.ground): DesignLayer {
  return rect("bg", 0, 0, C, C, fill, { z: 0 });
}

/**
 * Full-bleed generated scene with a unifying tint, or — when there's no
 * scene — a lit gradient ground so the template still reads as designed
 * rather than as a flat placeholder.
 */
export function sceneBackdrop(ctx: TemplateCtx, tint = 0.22): DesignLayer[] {
  if (!ctx.scene) {
    return [
      ground(ctx),
      bloom("bg-bloom-a", 760, 420, 1100, 1000, ctx.p.accent, 0.2, 0),
      bloom("bg-bloom-b", 160, 980, 900, 700, ctx.p.accent2, 0.12, 0),
    ];
  }
  return [
    image("bg-image", ctx.scene, 0, 0, C, C, { z: 0 }),
    rect("bg-tint", 0, 0, C, C, ctx.p.ground, { opacity: tint, z: 0 }),
  ];
}

/** Masks the bottom strip of a full-bleed scene, where watermarks live. */
export function watermarkFade(ctx: TemplateCtx): DesignLayer[] {
  if (!ctx.scene) return [];
  return [
    linear("bottom-fade", 0, C - 170, C, 126, 180, [[ctx.p.ground, 0, 0], [ctx.p.ground, 1, 1]], 1),
    rect("watermark-mask", 0, C - 44, C, 44, ctx.p.ground, { z: 1 }),
  ];
}

/**
 * The scene clipped into a shape (arch, card, window), with the bottom
 * faded into `fadeTo` so a watermark there never shows.
 */
export function sceneWindow(
  ctx: TemplateCtx,
  x: number,
  y: number,
  width: number,
  height: number,
  o: { radius?: number; radii?: CornerRadii; fallback: string; fadeTo?: string; z?: number },
): DesignLayer[] {
  const z = o.z ?? 1;
  if (!ctx.scene) {
    return [
      rect("window-fill", x, y, width, height, o.fallback, { radius: o.radius, radii: o.radii, z }),
      bloom("window-bloom", x + width / 2, y + height * 0.45, width * 1.1, height * 0.9, ctx.p.accent, 0.22, z),
    ];
  }
  const layers: DesignLayer[] = [
    image("bg-image", ctx.scene, x, y, width, height, { radius: o.radius, radii: o.radii, z }),
  ];
  if (o.fadeTo) {
    const fadeH = Math.min(220, height * 0.35);
    layers.push(
      linear("window-fade", x, y + height - fadeH, width, fadeH, 180, [[o.fadeTo, 0, 0], [o.fadeTo, 1, 0.92]], z),
    );
  }
  return layers;
}

export type Slot = { cx: number; cy: number; w: number; h: number };

/** The product in a slot, with optional glow, shadow, tilt. */
export function stage(
  ctx: TemplateCtx,
  slot: Slot,
  o: { glow?: boolean; shadow?: boolean; z?: number; rotation?: number; radius?: number } = {},
): DesignLayer[] {
  return productStage({
    src: ctx.product.src,
    centerX: slot.cx,
    centerY: slot.cy,
    width: slot.w,
    height: slot.h,
    accent: ctx.p.accent,
    cutoutApplied: ctx.product.cutoutApplied,
    aspectRatio: ctx.product.aspectRatio,
    glow: o.glow,
    shadow: o.shadow,
    zIndex: o.z,
    rotation: o.rotation,
    photoRadius: o.radius,
  });
}

/** Where the product actually lands in a slot — for seating it on things. */
export function footprint(ctx: TemplateCtx, slot: Slot) {
  const box = containedBox(slot.w, slot.h, ctx.product.aspectRatio);
  return {
    width: box.width,
    height: box.height,
    top: slot.cy - box.height / 2,
    bottom: slot.cy + box.height / 2,
    left: slot.cx - box.width / 2,
    right: slot.cx + box.width / 2,
  };
}

/** A slot whose product's *bottom edge* sits at `baseY`. */
export function seatedSlot(ctx: TemplateCtx, cx: number, baseY: number, w: number, h: number): Slot {
  const box = containedBox(w, h, ctx.product.aspectRatio);
  return { cx, cy: baseY - box.height / 2, w, h };
}

export function region(
  x: number,
  width: number,
  top: number,
  bottom: number,
  align: "left" | "center" = "left",
  justify: "start" | "center" = "start",
): StackRegion {
  return { x, width, top, bottom, align, justify };
}

/** Stacks blocks into a region in the template's style. */
export function stack(
  ctx: TemplateCtx,
  r: StackRegion,
  blocks: Block[] = ctx.blocks,
  o: { style?: ResolvedStyle; key?: string } = {},
): StackResult {
  return stackBlocks(blocks, r, o.style ?? ctx.s, o.key ?? "b");
}

export function pick(blocks: Block[], types: BlockType[]): Block[] {
  return blocks.filter((b) => types.includes(b.type));
}

export function omit(blocks: Block[], types: BlockType[]): Block[] {
  return blocks.filter((b) => !types.includes(b.type));
}

export function find<T extends BlockType>(blocks: Block[], type: T): Extract<Block, { type: T }> | undefined {
  return blocks.find((b) => b.type === type) as Extract<Block, { type: T }> | undefined;
}

/**
 * A style for copy sitting on a different ground than the template's main
 * one — a colour block, an inverted card. Text and accent are re-derived
 * so the copy stays readable on that ground.
 */
export function styleOn(ctx: TemplateCtx, fill: string, o: { text: string; muted?: string; accent?: string; onAccent?: string }): ResolvedStyle {
  return {
    ...ctx.s,
    ink: fill,
    textPrimary: o.text,
    textMuted: o.muted ?? mix(o.text, fill, 0.25),
    accent: o.accent ?? o.text,
    ctaTextColor: o.onAccent ?? fill,
  };
}

/**
 * Oversized single-line display text, sized to fill `width`.
 * The typographic hero of the type-led templates.
 */
export function giant(
  id: string,
  content: string,
  x: number,
  y: number,
  width: number,
  o: Omit<LabelOpts, "size" | "autoFit" | "maxLines"> & { max: number; min?: number },
): Built {
  return label(id, content, x, y, width, {
    ...o,
    size: o.max,
    autoFit: true,
    minSize: o.min ?? 40,
    maxLines: 1,
    lineHeight: o.lineHeight ?? 1,
  });
}

/** A repeated word strip, e.g. "DROP • DROP • DROP". */
export function repeatWord(word: string, times = 8, sep = "  •  "): string {
  return Array.from({ length: times }, () => word.toUpperCase()).join(sep);
}

/** Facts a block puts on the poster — a list contributes one per item. */
export function contentScore(blocks: Block[]): number {
  return blocks.reduce((total, block) => {
    if (block.type === "divider") return total;
    if ("items" in block) return total + block.items.length;
    return total + 1;
  }, 0);
}
