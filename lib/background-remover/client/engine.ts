// Feature 4 — the cutout editor's core. Everything is a transparency mask
// over the ORIGINAL pixels: the original bitmap is never modified, and the
// visible result is always `original ∩ mask`. Brushes only paint the mask.
//
// History is kept as vector operations replayed from the model's base mask,
// so undo/redo is exact and costs almost no memory even for 12 MP photos.

import type { RawMask } from "./segment";

export type BrushMode = "erase" | "restore";
type Point = { x: number; y: number };
type Op = { kind: "stroke"; mode: BrushMode; radius: number; points: Point[] } | { kind: "reset" };

/** Brush edge softness: inner fraction of the radius that is fully opaque. */
const HARDNESS = 0.65;

/**
 * Opacity (of 255) from which the model's mask counts as product: after
 * isolation real background is near zero, while areas a lighter model is
 * "unsure" about (big plain surfaces) sit around 35–60%.
 */
const SOLID_ALPHA = 64;

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

/**
 * "Refine edges": snaps near-zero alpha (background haze the model wasn't
 * sure about) to fully transparent and near-full alpha to fully opaque,
 * leaving the genuine soft edge band untouched.
 */
function refineAlpha(value: number): number {
  if (value < 12) return 0;
  if (value > 243) return 255;
  return value;
}

/** Square max-filter of a binary map (two separable sliding-window passes). */
function dilate(bin: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let count = 0;
    const row = y * w;
    for (let x = 0; x < Math.min(r, w); x++) count += bin[row + x];
    for (let x = 0; x < w; x++) {
      if (x + r < w) count += bin[row + x + r];
      if (x - r - 1 >= 0) count -= bin[row + x - r - 1];
      tmp[row + x] = count > 0 ? 1 : 0;
    }
  }
  for (let x = 0; x < w; x++) {
    let count = 0;
    for (let y = 0; y < Math.min(r, h); y++) count += tmp[y * w + x];
    for (let y = 0; y < h; y++) {
      if (y + r < h) count += tmp[(y + r) * w + x];
      if (y - r - 1 >= 0) count -= tmp[(y - r - 1) * w + x];
      out[y * w + x] = count > 0 ? 1 : 0;
    }
  }
  return out;
}

/**
 * "Detect the main product": keeps the largest solid region the model found
 * (plus any other region at least 15% of its size — a pair of shoes, a
 * set), and clears faint detached haze such as background props or light
 * streaks. Soft edges within a small margin of a kept region survive.
 */
export function isolateMainProduct(alpha: Uint8Array, w: number, h: number): Uint8Array {
  const n = w * h;
  const labels = new Int32Array(n);
  const sizes: number[] = [0];
  const stack: number[] = [];
  for (let start = 0; start < n; start++) {
    if (labels[start] || alpha[start] < SOLID_ALPHA) continue;
    const label = sizes.length;
    let size = 0;
    labels[start] = label;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % w;
      const y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const q = ny * w + nx;
          if (!labels[q] && alpha[q] >= SOLID_ALPHA) {
            labels[q] = label;
            stack.push(q);
          }
        }
      }
    }
    sizes.push(size);
  }
  if (sizes.length === 1) return alpha; // nothing solid — leave it to the coverage check

  const largest = Math.max(...sizes);
  const keepLabel = sizes.map((s) => s >= largest * 0.15);
  const keep = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (labels[i] && keepLabel[labels[i]]) keep[i] = 1;
  const zone = dilate(keep, w, h, Math.max(3, Math.round(Math.max(w, h) * 0.02)));

  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!zone[i]) continue;
    // Solid pixels of a dropped region stay dropped even inside the margin.
    out[i] = labels[i] && !keepLabel[labels[i]] ? 0 : alpha[i];
  }
  return out;
}

/** Marks every 0-pixel reachable from the image border (4-connected flood fill). */
function reachableFromBorder(bin: Uint8Array, w: number, h: number): Uint8Array {
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (p: number) => {
    if (!seen[p] && !bin[p]) {
      seen[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < w * (h - 1)) push(p + w);
  }
  return seen;
}

/**
 * Makes the product's body solid. Lighter models often go semi-transparent
 * on large plain areas of a product (a flat chocolate surface, a matte box
 * side) because they look "background-ish". Inside the product's envelope —
 * its solid parts with small gaps closed and enclosed holes filled — any
 * pixel the model was unsure about becomes fully opaque. Pixels the model was
 * confident are background (alpha < 24, e.g. the hole in a mug handle) stay
 * transparent, and soft outer edges are untouched.
 */
export function solidifyInterior(alpha: Uint8Array, w: number, h: number): Uint8Array {
  const n = w * h;
  // ≥ 25% opacity counts as product: after isolation, real background is
  // near zero, while "unsure" product areas sit around 35–60%.
  const solid = new Uint8Array(n);
  let any = false;
  for (let i = 0; i < n; i++) {
    if (alpha[i] >= SOLID_ALPHA) {
      solid[i] = 1;
      any = true;
    }
  }
  if (!any) return alpha;

  // Morphological closing: dilate, then erode (= dilate the complement).
  const r = Math.max(2, Math.round(Math.max(w, h) * 0.035));
  const grown = dilate(solid, w, h, r);
  const inverse = new Uint8Array(n);
  for (let i = 0; i < n; i++) inverse[i] = grown[i] ? 0 : 1;
  const shrunkInverse = dilate(inverse, w, h, r);
  const envelope = new Uint8Array(n);
  for (let i = 0; i < n; i++) envelope[i] = shrunkInverse[i] ? solid[i] : 1;

  // Fill holes fully enclosed by the envelope.
  const outside = reachableFromBorder(envelope, w, h);
  for (let i = 0; i < n; i++) if (!outside[i]) envelope[i] = 1;

  // Core = envelope minus a thin rim; the rim keeps a soft (boosted) edge.
  const rim = Math.max(1, Math.round(Math.max(w, h) * 0.002));
  const notEnvelope = new Uint8Array(n);
  for (let i = 0; i < n; i++) notEnvelope[i] = envelope[i] ? 0 : 1;
  const nearOutside = dilate(notEnvelope, w, h, rim);

  const out = new Uint8Array(alpha);
  for (let i = 0; i < n; i++) {
    if (!envelope[i] || alpha[i] < 24) continue;
    out[i] = nearOutside[i] ? Math.min(255, alpha[i] * 2) : 255;
  }
  return out;
}

/** Builds the full-resolution base mask from the model's (smaller) mask. */
export function buildBaseMask(raw: RawMask, width: number, height: number): { mask: HTMLCanvasElement; coverage: number } {
  const small = makeCanvas(raw.width, raw.height);
  const sctx = small.getContext("2d")!;
  const img = sctx.createImageData(raw.width, raw.height);
  const isolated = solidifyInterior(isolateMainProduct(raw.data, raw.width, raw.height), raw.width, raw.height);
  let opaque = 0;
  for (let i = 0; i < isolated.length; i++) {
    const a = refineAlpha(isolated[i]);
    img.data[i * 4 + 3] = a;
    if (a > 127) opaque++;
  }
  sctx.putImageData(img, 0, 0);

  const mask = makeCanvas(width, height);
  const ctx = mask.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, width, height);
  return { mask, coverage: opaque / raw.data.length };
}

export class CutoutEngine {
  readonly width: number;
  readonly height: number;
  /** The untouched original photo (never modified). */
  readonly original: ImageBitmap;
  private readonly base: HTMLCanvasElement;
  private readonly mask: HTMLCanvasElement;
  private readonly maskCtx: CanvasRenderingContext2D;
  private view: HTMLCanvasElement | null = null;
  private ops: Op[] = [];
  private cursor = 0;
  private active: Extract<Op, { kind: "stroke" }> | null = null;

  constructor(original: ImageBitmap, baseMask: HTMLCanvasElement) {
    this.original = original;
    this.width = original.width;
    this.height = original.height;
    this.base = baseMask;
    this.mask = makeCanvas(this.width, this.height);
    this.maskCtx = this.mask.getContext("2d")!;
    this.maskCtx.drawImage(baseMask, 0, 0);
  }

  /** Attaches the on-screen canvas the composite is drawn into. */
  attach(canvas: HTMLCanvasElement) {
    this.view = canvas;
    canvas.width = this.width;
    canvas.height = this.height;
    this.composite(0, 0, this.width, this.height);
  }

  get canUndo() {
    return this.cursor > 0;
  }
  get canRedo() {
    return this.cursor < this.ops.length;
  }

  beginStroke(mode: BrushMode, radius: number, at: Point) {
    this.active = { kind: "stroke", mode, radius, points: [at] };
    this.stamp(this.active, at);
  }

  extendStroke(to: Point) {
    const op = this.active;
    if (!op) return;
    const from = op.points[op.points.length - 1];
    op.points.push(to);
    this.segment(op, from, to);
  }

  endStroke() {
    if (!this.active) return;
    this.ops.length = this.cursor; // drop the redo branch
    this.ops.push(this.active);
    this.cursor = this.ops.length;
    this.active = null;
  }

  undo() {
    if (!this.canUndo) return;
    this.cursor--;
    this.replay();
  }

  redo() {
    if (!this.canRedo) return;
    this.cursor++;
    this.replay();
  }

  /**
   * Swaps in a new starting cutout (e.g. from "Select product area"). It
   * becomes what Reset returns to; brush history starts fresh.
   */
  replaceBase(mask: HTMLCanvasElement) {
    const ctx = this.base.getContext("2d")!;
    ctx.globalCompositeOperation = "copy";
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    this.ops = [];
    this.cursor = 0;
    this.active = null;
    this.replay();
  }

  /** Back to the model's cutout. Undoable like any other edit. */
  reset() {
    this.ops.length = this.cursor;
    this.ops.push({ kind: "reset" });
    this.cursor = this.ops.length;
    this.replay();
  }

  /** The final cutout at full original resolution. */
  renderFull(): HTMLCanvasElement {
    const out = makeCanvas(this.width, this.height);
    this.drawComposite(out.getContext("2d")!, 0, 0, this.width, this.height);
    return out;
  }

  /** Tight bounding box of everything visible (alpha above a small threshold), or null if empty. */
  contentBounds(threshold = 8): { x: number; y: number; width: number; height: number } | null {
    const { data } = this.maskCtx.getImageData(0, 0, this.width, this.height);
    let minX = this.width,
      minY = this.height,
      maxX = -1,
      maxY = -1;
    for (let y = 0; y < this.height; y++) {
      const row = y * this.width * 4;
      for (let x = 0; x < this.width; x++) {
        if (data[row + x * 4 + 3] > threshold) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }

  private replay() {
    let start = 0;
    for (let i = this.cursor - 1; i >= 0; i--) {
      if (this.ops[i].kind === "reset") {
        start = i + 1;
        break;
      }
    }
    const ctx = this.maskCtx;
    ctx.globalCompositeOperation = "copy";
    ctx.drawImage(this.base, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    for (let i = start; i < this.cursor; i++) {
      const op = this.ops[i];
      if (op.kind !== "stroke") continue;
      this.paint(op, op.points[0]);
      for (let p = 1; p < op.points.length; p++) this.paintSegment(op, op.points[p - 1], op.points[p]);
    }
    this.composite(0, 0, this.width, this.height);
  }

  private paint(op: Extract<Op, { kind: "stroke" }>, at: Point) {
    const ctx = this.maskCtx;
    const g = ctx.createRadialGradient(at.x, at.y, op.radius * HARDNESS, at.x, at.y, op.radius);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalCompositeOperation = op.mode === "erase" ? "destination-out" : "source-over";
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(at.x, at.y, op.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  private paintSegment(op: Extract<Op, { kind: "stroke" }>, from: Point, to: Point) {
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const spacing = Math.max(1, op.radius * 0.2);
    const steps = Math.max(1, Math.ceil(dist / spacing));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      this.paint(op, { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
    }
  }

  private stamp(op: Extract<Op, { kind: "stroke" }>, at: Point) {
    this.paint(op, at);
    const r = op.radius + 2;
    this.composite(at.x - r, at.y - r, r * 2, r * 2);
  }

  private segment(op: Extract<Op, { kind: "stroke" }>, from: Point, to: Point) {
    this.paintSegment(op, from, to);
    const r = op.radius + 2;
    const x = Math.min(from.x, to.x) - r;
    const y = Math.min(from.y, to.y) - r;
    this.composite(x, y, Math.abs(to.x - from.x) + r * 2, Math.abs(to.y - from.y) + r * 2);
  }

  /** Redraws `original ∩ mask` into the on-screen canvas, limited to a dirty rect. */
  private composite(x: number, y: number, w: number, h: number) {
    if (!this.view) return;
    this.drawComposite(this.view.getContext("2d")!, x, y, w, h);
  }

  private drawComposite(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + w));
    const y1 = Math.min(this.height, Math.ceil(y + h));
    const cw = x1 - x0;
    const ch = y1 - y0;
    if (cw <= 0 || ch <= 0) return;
    ctx.save();
    // `copy` and `destination-in` clear everything outside the source
    // shape, so the clip is what confines this redraw to the dirty rect.
    ctx.beginPath();
    ctx.rect(x0, y0, cw, ch);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = "copy";
    ctx.drawImage(this.original, x0, y0, cw, ch, x0, y0, cw, ch);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(this.mask, x0, y0, cw, ch, x0, y0, cw, ch);
    ctx.restore();
  }
}
