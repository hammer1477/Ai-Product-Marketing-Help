// Text measurement for layout.
//
// Every text layer in a Design Schema carries an absolute x/y/width/height,
// which means a template that hardcodes those numbers is silently betting
// that the copy will be a certain length. It never is — AI-written copy
// varies wildly, and when a 3-line description came back 5 lines long it
// ran straight through the block underneath it (the overlapping selling
// points bug). Templates therefore need to know how tall a string will
// actually render *before* they place the next layer.
//
// Satori does the real line-breaking at render time using the embedded font
// buffers, so the only exact measurement would be a render. Instead we
// approximate advance widths with a per-character class table calibrated to
// the two fonts we ship (Inter, Playfair Display). The error is a few
// percent, which is harmless because callers use the result to *flow*
// layout — a slightly tall estimate opens a slightly bigger gap, it never
// overlaps. A slight under-estimate is the dangerous direction, so
// measurements carry a small safety factor.

export type FontFamily = "Inter" | "Playfair Display";

// Per-character advance widths in em units (1em === fontSize), transcribed
// from the shipped fonts' own metrics. A coarse "all lowercase is 0.55"
// table was the original approach and it under-measured bold headlines by
// enough to predict four lines where Satori drew five — which is precisely
// how a headline ended up printed through the description beneath it.
const INTER_WIDTHS: Record<string, number> = {
  a: 0.546, b: 0.58, c: 0.52, d: 0.58, e: 0.551, f: 0.345, g: 0.58, h: 0.569,
  i: 0.249, j: 0.249, k: 0.528, l: 0.249, m: 0.869, n: 0.569, o: 0.579, p: 0.58,
  q: 0.58, r: 0.368, s: 0.494, t: 0.36, u: 0.569, v: 0.498, w: 0.76, x: 0.496,
  y: 0.498, z: 0.479,
  A: 0.657, B: 0.657, C: 0.69, D: 0.701, E: 0.602, F: 0.587, G: 0.722, H: 0.714,
  I: 0.272, J: 0.527, K: 0.645, L: 0.556, M: 0.871, N: 0.714, O: 0.74, P: 0.639,
  Q: 0.74, R: 0.645, S: 0.629, T: 0.597, U: 0.701, V: 0.657, W: 0.969, X: 0.637,
  Y: 0.611, Z: 0.606,
};

const PLAYFAIR_WIDTHS: Record<string, number> = {
  a: 0.49, b: 0.55, c: 0.44, d: 0.55, e: 0.46, f: 0.33, g: 0.49, h: 0.56,
  i: 0.29, j: 0.29, k: 0.54, l: 0.29, m: 0.84, n: 0.56, o: 0.52, p: 0.55,
  q: 0.55, r: 0.4, s: 0.38, t: 0.35, u: 0.56, v: 0.5, w: 0.75, x: 0.5,
  y: 0.5, z: 0.42,
  A: 0.72, B: 0.66, C: 0.68, D: 0.74, E: 0.63, F: 0.6, G: 0.72, H: 0.78,
  I: 0.37, J: 0.37, K: 0.73, L: 0.6, M: 0.93, N: 0.75, O: 0.74, P: 0.6,
  Q: 0.74, R: 0.67, S: 0.52, T: 0.63, U: 0.74, V: 0.72, W: 1.02, X: 0.72,
  Y: 0.7, Z: 0.6,
};

type FontMetrics = {
  widths: Record<string, number>;
  space: number;
  digit: number;
  punct: number;
  fallback: number;
};

const INTER: FontMetrics = {
  widths: INTER_WIDTHS,
  space: 0.26,
  digit: 0.6,
  punct: 0.3,
  fallback: 0.58,
};

const PLAYFAIR: FontMetrics = {
  widths: PLAYFAIR_WIDTHS,
  space: 0.25,
  digit: 0.52,
  punct: 0.28,
  fallback: 0.55,
};

const PUNCT_CHARS = new Set(".,'\"`!|:;()[]{}-–—".split(""));

function charWidth(char: string, metrics: FontMetrics): number {
  if (char === " ") return metrics.space;
  const known = metrics.widths[char];
  if (known !== undefined) return known;
  if (PUNCT_CHARS.has(char)) return metrics.punct;
  if (char >= "0" && char <= "9") return metrics.digit;
  // Accents, symbols, non-Latin — assume a slightly wide average glyph so
  // foreign-language copy errs toward breaking early rather than overflowing.
  return metrics.fallback;
}

// Heavier weights set measurably wider — roughly 8% from Regular to
// ExtraBold in Inter, which is exactly the range headlines use.
function weightFactor(fontWeight: number): number {
  return 1 + (fontWeight - 400) * 0.0002;
}

// Deliberate over-estimate. The two error directions are not symmetric:
// over-measuring costs a slightly early line break or a slightly smaller
// headline, while under-measuring puts one block on top of another. So the
// approximation is biased to break early, every time.
const SAFETY = 1.035;

export type MeasureOptions = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing?: number;
};

/** Rendered width of a single-line string, in px. */
export function measureTextWidth(text: string, opts: MeasureOptions): number {
  const table = opts.fontFamily === "Playfair Display" ? PLAYFAIR : INTER;
  const factor = weightFactor(opts.fontWeight) * opts.fontSize;

  let width = 0;
  for (const char of text) width += charWidth(char, table) * factor;
  width += (opts.letterSpacing ?? 0) * Math.max(0, text.length - 1);

  return width * SAFETY;
}

/**
 * Greedy word-wrap matching how Satori breaks a text block at `maxWidth`.
 * A single word longer than the line is hard-broken rather than allowed to
 * overflow, which is also what the renderer does.
 */
export function wrapText(text: string, maxWidth: number, opts: MeasureOptions): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (measureTextWidth(candidate, opts) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);

    // A word that can't fit on a line of its own gets chopped at the
    // character that overflows, mirroring the renderer's hard break.
    if (measureTextWidth(word, opts) > maxWidth) {
      let chunk = "";
      for (const char of word) {
        if (measureTextWidth(chunk + char, opts) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk += char;
        }
      }
      current = chunk;
    } else {
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

export type TextMetrics = {
  lines: string[];
  lineCount: number;
  /** Height the block occupies once wrapped, in px. */
  height: number;
  /** Width of the longest wrapped line — for auto-sizing pills/cards. */
  width: number;
};

export function measureTextBlock(
  text: string,
  maxWidth: number,
  opts: MeasureOptions & { lineHeight?: number; maxLines?: number },
): TextMetrics {
  const lineHeight = opts.lineHeight ?? 1.2;
  let lines = wrapText(text, maxWidth, opts);

  if (opts.maxLines && lines.length > opts.maxLines) {
    lines = lines.slice(0, opts.maxLines);
  }

  const width = lines.reduce((max, line) => Math.max(max, measureTextWidth(line, opts)), 0);

  return {
    lines,
    lineCount: lines.length,
    height: Math.ceil(lines.length * opts.fontSize * lineHeight),
    width: Math.ceil(width),
  };
}

/**
 * Shrinks `fontSize` until the text fits within `maxWidth` × `maxLines`,
 * returning the size that fits plus its metrics. Used for headlines and
 * CTA labels, where the copy length isn't known up front but the slot is
 * fixed — better a slightly smaller headline than one that overruns the
 * block below it.
 */
export function fitText(
  text: string,
  maxWidth: number,
  maxLines: number,
  opts: MeasureOptions & { lineHeight?: number; minFontSize?: number },
): { fontSize: number; metrics: TextMetrics } {
  const minFontSize = opts.minFontSize ?? Math.max(12, Math.round(opts.fontSize * 0.6));
  let fontSize = opts.fontSize;

  for (;;) {
    const metrics = measureTextBlock(text, maxWidth, { ...opts, fontSize });
    if (metrics.lineCount <= maxLines || fontSize <= minFontSize) {
      return { fontSize, metrics };
    }
    fontSize -= 1;
  }
}
