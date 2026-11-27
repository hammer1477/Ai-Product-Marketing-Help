import { contrastRatio, ensureContrast, hueDistance, lightnessOf, saturation, shiftHue } from "./color";
import type { ResolvedStyle } from "./styles";

// Keeps the art director's palette in the product's own colour family.
//
// The accent is the colour that carries an ad — vivid templates flood the
// whole background with it, pastel ones tint with it, dark ones light their
// buttons and figures with it. So when the model picks an accent off the
// product's hue (a gold or pink ad for a red strawberry cake), it's pulled
// back to the measured product colour. The model still chooses the dark
// ground, the text and the exact shade; hue and lightness band are held.

/** Within this many degrees, a colour counts as the product's own family. */
const SAME_FAMILY = 18;
/**
 * How far the accent's lightness may stray from the product's. Hue alone
 * isn't enough: hot pink is red's hue made light, and a pink ad for a red
 * cake is exactly the miss this exists to prevent.
 */
const LIGHTNESS_RANGE = 0.16;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export function anchorToProduct(style: ResolvedStyle, productHex: string | undefined): ResolvedStyle {
  if (!productHex) return style;

  const productL = clamp(lightnessOf(productHex), 0.3, 0.6);
  let accent = style.accent;
  if (saturation(accent) < 0.2 || hueDistance(accent, productHex) > SAME_FAMILY) {
    // The product's hue at a confident, usable strength.
    accent = shiftHue(productHex, 0, {
      s: clamp(saturation(productHex), 0.55, 0.9),
      l: clamp(lightnessOf(productHex), 0.38, 0.56),
    });
  } else if (Math.abs(lightnessOf(accent) - productL) > LIGHTNESS_RANGE) {
    // Right hue, wrong colour (pink for red, cream for gold): keep the
    // model's shade direction but bring it back within range.
    accent = shiftHue(accent, 0, { l: clamp(lightnessOf(accent), productL - LIGHTNESS_RANGE, productL + LIGHTNESS_RANGE) });
  }

  // A coloured ground in a foreign hue is just as off; neutrals (near
  // black, near white) are fine as they are.
  let ink = style.ink;
  if (saturation(ink) > 0.22 && hueDistance(ink, productHex) > 35) {
    ink = shiftHue(productHex, 0, { s: 0.45, l: lightnessOf(ink) < 0.5 ? 0.1 : 0.94 });
  }

  if (contrastRatio(accent, ink) < 2.2) accent = ensureContrast(accent, ink, 2.2);
  const textPrimary = ensureContrast(style.textPrimary, ink, 4.5);
  const textMuted = ensureContrast(style.textMuted, ink, 3);

  if (accent === style.accent && ink === style.ink) return style;
  return {
    ...style,
    ink,
    accent,
    textPrimary,
    textMuted,
    ctaTextColor: contrastRatio(accent, "#0a0a0b") > contrastRatio(accent, "#ffffff") ? "#0a0a0b" : "#ffffff",
  };
}
