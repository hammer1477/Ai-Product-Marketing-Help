import {
  type DesignLayer,
  type DesignSchema,
  type ShapeLayer,
  isImageLayer,
  isShapeLayer,
  isTextLayer,
} from "./types";

export type ValidationIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
  layerId?: string;
};

// Crude text-wrap estimate without loading real font metrics — Phase 1
// heuristic. Average glyph width is approximated as a fraction of font size;
// good enough to catch gross overflow before the Satori render, not a
// pixel-accurate layout engine.
const AVERAGE_CHAR_WIDTH_FACTOR = 0.56;

function estimateLineCount(content: string, fontSize: number, boxWidth: number): number {
  if (boxWidth <= 0) return Infinity;
  const avgCharWidth = fontSize * AVERAGE_CHAR_WIDTH_FACTOR;
  const charsPerLine = Math.max(1, Math.floor(boxWidth / avgCharWidth));
  const words = content.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;

  let lines = 1;
  let currentLineLength = 0;
  for (const word of words) {
    const wordLength = word.length + 1; // +1 for the space
    if (currentLineLength + wordLength > charsPerLine && currentLineLength > 0) {
      lines += 1;
      currentLineLength = wordLength;
    } else {
      currentLineLength += wordLength;
    }
  }
  return lines;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!match) return null;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hexA: string, hexB: string): number | null {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return null;
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

function layersOverlap(a: DesignLayer, b: DesignLayer): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

// Finds the nearest opaque shape layer directly behind a text layer (lower
// zIndex, overlapping bounds) to use as the contrast-check background.
// Falls back to the canvas background color if nothing is found.
function findBackgroundColorFor(layer: DesignLayer, schema: DesignSchema): string {
  const candidates = schema.layers
    .filter(isShapeLayer)
    .filter((shape) => shape.zIndex < layer.zIndex && layersOverlap(shape, layer))
    .sort((shapeA, shapeB) => shapeB.zIndex - shapeA.zIndex);

  const nearest: ShapeLayer | undefined = candidates[0];
  return nearest?.fill ?? schema.canvas.backgroundColor;
}

const MIN_CONTRAST_RATIO = 4.5; // WCAG AA for normal text

export function validateDesignSchema(schema: DesignSchema): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const headline = schema.layers.find((l) => isTextLayer(l) && l.role === "headline");
  if (!headline) {
    issues.push({
      severity: "error",
      code: "missing_headline",
      message: "Design is missing a headline text layer.",
    });
  }

  const cta = schema.layers.find((l) => isTextLayer(l) && l.role === "ctaLabel");
  if (!cta) {
    issues.push({
      severity: "error",
      code: "missing_cta",
      message: "Design is missing a call-to-action text layer.",
    });
  }

  for (const layer of schema.layers) {
    if (isTextLayer(layer)) {
      if (!layer.content || layer.content.trim().length === 0) {
        issues.push({
          severity: "error",
          code: "empty_text",
          message: `Text layer "${layer.id}" (${layer.role}) has no content.`,
          layerId: layer.id,
        });
        continue;
      }

      if (layer.maxLines) {
        const estimatedLines = estimateLineCount(layer.content, layer.fontSize, layer.width);
        if (estimatedLines > layer.maxLines) {
          issues.push({
            severity: "warning",
            code: "text_overflow",
            message: `Text layer "${layer.id}" (${layer.role}) estimated at ${estimatedLines} lines, exceeds maxLines=${layer.maxLines}.`,
            layerId: layer.id,
          });
        }
      }

      const backgroundColor = findBackgroundColorFor(layer, schema);
      const ratio = contrastRatio(layer.color, backgroundColor);
      if (ratio !== null && ratio < MIN_CONTRAST_RATIO) {
        issues.push({
          severity: "warning",
          code: "low_contrast",
          message: `Text layer "${layer.id}" (${layer.role}) has contrast ratio ${ratio.toFixed(2)} against ${backgroundColor}, below the ${MIN_CONTRAST_RATIO} AA minimum.`,
          layerId: layer.id,
        });
      }
    }

    if (isImageLayer(layer) && !layer.src) {
      issues.push({
        severity: "error",
        code: "missing_image_src",
        message: `Image layer "${layer.id}" has no src.`,
        layerId: layer.id,
      });
    }
  }

  return issues;
}

export function hasBlockingErrors(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}
