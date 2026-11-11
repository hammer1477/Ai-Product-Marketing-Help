import type { FontFamily } from "../../design-schema/fontRegistry";
import {
  BLACK,
  WHITE,
  contrastRatio,
  ensureContrast,
  isDark,
  isHex,
  mix,
  onColor,
  shiftHue,
  withLightness,
  saturation,
} from "../color";
import type { CtaStyle, ResolvedStyle } from "../styles";

// Painting: how one base palette becomes a template's actual colours.
//
// The art director (or the user) chooses a palette once — a deep ink, an
// accent, text colours. Templates don't each need their own palette; they
// need a *scheme* for using it. A dark template grounds on the ink; a paper
// template grounds on a warm light tint and sets the ink as type; a vivid
// template floods the canvas with the accent. That's how the same product
// and palette yield posters that look nothing alike.
//
// Every derived colour is contrast-checked against the ground it lands on,
// so no scheme can produce unreadable copy from any palette.

export type Scheme = "dark" | "light" | "vivid" | "pastel";

export type Typography = {
  headline: FontFamily;
  weight: 400 | 500 | 600 | 700 | 800;
  italic?: boolean;
  uppercase?: boolean;
  tracking?: number;
  scale?: number;
  lineHeight?: number;
  body: FontFamily;
};

/** The colours a template draws with, after painting. */
export type Palette = {
  ground: string;
  text: string;
  muted: string;
  accent: string;
  /** Text colour on an accent fill. */
  onAccent: string;
  /** Raised card fill. */
  surface: string;
  /** Hairlines and borders. */
  line: string;
  /** Second accent, for meshes and stickers. */
  accent2: string;
};

const PAPER = "#f5f0e8";

function schemeColors(base: ResolvedStyle, scheme: Scheme): Pick<Palette, "ground" | "text" | "muted" | "accent"> {
  switch (scheme) {
    case "dark": {
      const ground = isDark(base.ink) ? base.ink : mix(base.ink, BLACK, 0.7);
      return {
        ground,
        text: ensureContrast(base.textPrimary, ground, 7),
        muted: ensureContrast(base.textMuted, ground, 4.5),
        accent: ensureContrast(base.accent, ground, 2.6),
      };
    }
    case "light": {
      const ground = mix(PAPER, base.accent, 0.07);
      const text = ensureContrast(isDark(base.ink) ? base.ink : "#141414", ground, 9);
      return {
        ground,
        text,
        muted: ensureContrast(mix(text, ground, 0.38), ground, 4.5),
        accent: ensureContrast(base.accent, ground, 2.8),
      };
    }
    case "pastel": {
      const ground = withLightness(base.accent, 0.9, Math.min(0.55, saturation(base.accent)));
      const text = ensureContrast(isDark(base.ink) ? base.ink : "#1a1a1a", ground, 9);
      return {
        ground,
        text,
        muted: ensureContrast(mix(text, ground, 0.35), ground, 4.5),
        accent: ensureContrast(withLightness(base.accent, 0.42), ground, 3),
      };
    }
    case "vivid": {
      // A muddy accent makes a muddy poster; push it to full colour first.
      const ground =
        saturation(base.accent) < 0.25 ? shiftHue(base.accent, 0, { s: 0.75, l: 0.55 }) : base.accent;
      const text = contrastRatio(base.ink, ground) >= 7 ? base.ink : onColor(ground, "#0b0b0d", "#ffffff");
      return {
        ground,
        text,
        muted: ensureContrast(mix(text, ground, 0.22), ground, 4.5),
        // On a flooded accent ground, the "accent" role (button, rules,
        // icons) becomes the type colour — the inverse of the ground.
        accent: text,
      };
    }
  }
}

/**
 * Paints `base` for a template, then applies the user's overrides.
 *
 * Returns both the flat palette (for template decoration) and a style with
 * the painted colours and typography written into the fields block
 * renderers read — so the block library needs no knowledge of schemes.
 */
export function paint(
  base: ResolvedStyle,
  scheme: Scheme,
  typography: Typography,
  cta: CtaStyle,
): { style: ResolvedStyle; palette: Palette } {
  const derived = schemeColors(base, scheme);
  const o = base.colorOverrides ?? {};

  const ground = isHex(o.background) ? o.background : derived.ground;
  const text = isHex(o.text) ? o.text : o.background ? ensureContrast(derived.text, ground, 7) : derived.text;
  const muted = isHex(o.muted) ? o.muted : o.background ? ensureContrast(derived.muted, ground, 4.5) : derived.muted;
  const accent = isHex(o.accent) ? o.accent : derived.accent;

  const onAccent =
    contrastRatio(ground, accent) >= 4.5 ? ground : onColor(accent, "#0b0b0d", "#ffffff");

  const dark = isDark(ground);
  const palette: Palette = {
    ground,
    text,
    muted,
    accent,
    onAccent,
    surface: dark ? mix(ground, WHITE, 0.08) : scheme === "vivid" ? mix(ground, WHITE, 0.35) : mix(ground, WHITE, 0.65),
    line: mix(text, ground, 0.78),
    accent2: isHex(base.accent2) && !o.accent ? base.accent2 : shiftHue(accent === text ? ground : accent, 38),
  };

  const headline = base.fontOverrides?.headline ?? typography.headline;
  const bodyFont = base.fontOverrides?.body ?? typography.body;
  // A user-picked face may not have the template's weight or italic; the
  // renderer snaps to the nearest face it has, so the template's intent is
  // passed through unchanged.
  const style: ResolvedStyle = {
    ...base,
    ink: ground,
    panel: palette.surface,
    accent,
    textPrimary: text,
    textMuted: muted,
    ctaTextColor: onAccent,
    headlineFont: headline,
    headlineWeight: typography.weight,
    headlineItalic: typography.italic,
    headlineUppercase: typography.uppercase,
    headlineTracking: typography.tracking,
    headlineScale: typography.scale,
    headlineLineHeight: typography.lineHeight,
    bodyFont,
    ctaStyle: cta,
    line: palette.line,
    surface: palette.surface,
    accent2: palette.accent2,
  };

  return { style, palette };
}
