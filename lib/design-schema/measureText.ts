// Text measurement for layout.
//
// Every text layer in a Design Schema carries an absolute x/y/width/height,
// which means a template that hardcodes those numbers is silently betting
// that the copy will be a certain length. It never is — AI-written copy
// varies wildly, and when a 3-line description came back 5 lines long it
// ran straight through the block underneath it. Templates therefore need to
// know how tall a string will actually render *before* they place the next
// layer.
//
// Satori does the real line-breaking at render time using the embedded font
// buffers. Measurement reads advance widths generated from those very same
// files (fontMetrics.generated.ts), so every typeface in the registry —
// condensed display faces and wide grotesques alike — wraps here exactly as
// it will there, give or take kerning.

import { resolveFontFile, type FontStyle } from "./fontRegistry";
import { FONT_METRICS, METRIC_CHARS } from "./fontMetrics.generated";

export type { FontFamily } from "./fontRegistry";

const CHAR_INDEX = new Map<string, number>();
Array.from(METRIC_CHARS).forEach((ch, i) => CHAR_INDEX.set(ch, i));

const N_INDEX = CHAR_INDEX.get("n")!;

function tableFor(fontFamily: string, fontWeight: number, fontStyle: FontStyle = "normal"): number[] {
  const file = resolveFontFile(fontFamily, fontWeight, fontStyle);
  return (
    FONT_METRICS[`${file.family}|${file.weight}|${file.style}`] ?? FONT_METRICS["Inter|400|normal"]
  );
}

function charWidth(char: string, table: number[]): number {
  const index = CHAR_INDEX.get(char);
  if (index !== undefined) return table[index];
  // Non-Latin or rare symbols: assume a slightly wide glyph so foreign copy
  // errs toward breaking early rather than overflowing.
  return table[N_INDEX] * 1.08;
}

// A small deliberate over-estimate. The renderer clamps every layer to its
// line budget, so an under-measure can only clip a word, while a large
// over-measure predicts a line that never renders and leaves a visible hole.
// Kerning only ever tightens, so this margin is mostly headroom.
const SAFETY = 1.02;

export type MeasureOptions = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle?: FontStyle;
  letterSpacing?: number;
};

/** Rendered width of a single-line string, in px. */
export function measureTextWidth(text: string, opts: MeasureOptions): number {
  const table = tableFor(opts.fontFamily, opts.fontWeight, opts.fontStyle);

  let width = 0;
  let count = 0;
  for (const char of text) {
    width += charWidth(char, table) * opts.fontSize;
    count += 1;
  }
  width += (opts.letterSpacing ?? 0) * Math.max(0, count - 1);

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
 * returning the size that fits plus its metrics. Better a slightly smaller
 * headline than one that overruns the block below it.
 */
export function fitText(
  text: string,
  maxWidth: number,
  maxLines: number,
  opts: MeasureOptions & { lineHeight?: number; minFontSize?: number },
): { fontSize: number; metrics: TextMetrics } {
  const minFontSize = opts.minFontSize ?? Math.max(12, Math.round(opts.fontSize * 0.6));
  const words = text.split(/\s+/).filter(Boolean);
  let fontSize = opts.fontSize;

  for (;;) {
    const metrics = measureTextBlock(text, maxWidth, { ...opts, fontSize });
    // Fitting the line budget isn't enough on its own: a word too wide for
    // the column gets hard-broken mid-word ("3,00 / 0 EGP"), which reads as
    // a bug. Keep shrinking until every word fits whole.
    const wordsFit = words.every((word) => measureTextWidth(word, { ...opts, fontSize }) <= maxWidth);
    if ((metrics.lineCount <= maxLines && wordsFit) || fontSize <= minFontSize) {
      return { fontSize, metrics };
    }
    fontSize -= 1;
  }
}
