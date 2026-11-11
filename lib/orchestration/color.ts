// Colour arithmetic shared by style resolution, template painting and the
// editor. Pure and dependency-free so it runs in the browser too.

export type Rgb = { r: number; g: number; b: number };

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isHex(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

export function parseHex(hex: string): Rgb | null {
  if (!isHex(hex)) return null;
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const WHITE: Rgb = { r: 255, g: 255, b: 255 };
export const BLACK: Rgb = { r: 0, g: 0, b: 0 };

export function mix(hex: string, target: Rgb | string, amount: number): string {
  const rgb = parseHex(hex);
  const to = typeof target === "string" ? parseHex(target) : target;
  if (!rgb || !to) return hex;
  return toHex({
    r: rgb.r + (to.r - rgb.r) * amount,
    g: rgb.g + (to.g - rgb.g) * amount,
    b: rgb.b + (to.b - rgb.b) * amount,
  });
}

export function isDark(hex: string): boolean {
  return luminance(hex) < 0.18;
}

/** Near-black or near-white, whichever reads better on `ground`. */
export function onColor(ground: string, dark = "#0b0b0d", light = "#ffffff"): string {
  return contrastRatio(dark, ground) >= contrastRatio(light, ground) ? dark : light;
}

/**
 * Moves `hex` toward black or white (away from `ground`) until it reaches
 * `min` contrast against it. Keeps the hue a user or model chose instead of
 * discarding it for a fallback.
 */
export function ensureContrast(hex: string, ground: string, min: number): string {
  if (!isHex(hex)) return onColor(ground);
  if (contrastRatio(hex, ground) >= min) return hex;
  const target = isDark(ground) ? WHITE : BLACK;
  for (let step = 1; step <= 20; step++) {
    const candidate = mix(hex, target, step * 0.05);
    if (contrastRatio(candidate, ground) >= min) return candidate;
  }
  return onColor(ground);
}

function rgbToHsl({ r, g, b }: Rgb): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] :
    hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

/** Rotates hue, optionally overriding saturation/lightness (0–1). */
export function shiftHue(hex: string, degrees: number, opts: { s?: number; l?: number } = {}): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const [h, s, l] = rgbToHsl(rgb);
  return toHex(hslToRgb(h + degrees, opts.s ?? s, opts.l ?? l));
}

export function withLightness(hex: string, l: number, s?: number): string {
  return shiftHue(hex, 0, { l, s });
}

export function saturation(hex: string): number {
  const rgb = parseHex(hex);
  return rgb ? rgbToHsl(rgb)[1] : 0;
}
