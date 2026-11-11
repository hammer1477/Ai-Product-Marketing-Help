import type { FontFamily } from "../design-schema/fontRegistry";
import { contrastRatio, isHex, luminance, mix, WHITE } from "./color";
import type { ArtDirection, LayoutVariant } from "./types";

export type StylePreset = {
  key: string;
  /** Ground behind the text column. */
  ink: string;
  /** Ground behind the whole canvas / image column. */
  panel: string;
  /** Accent used for badges, dividers, icons, and the CTA fill. */
  accent: string;
  textPrimary: string;
  textMuted: string;
  ctaTextColor: string;
  headlineFont: FontFamily;
  headlineWeight: 400 | 500 | 600 | 700 | 800;
  /** Prompt for a decorative background image — never the product itself. */
  backgroundPrompt: string;
};

// Category-driven visual identity so output doesn't look identical across
// every product — spec explicitly calls for adaptive style, not one
// template forced on everything. Serif (Playfair Display) reads as
// luxury/editorial; bold Inter reads as modern/confident; each preset pairs
// a ground, an accent, and a headline treatment that fits the category's
// typical market positioning.
export const STYLE_PRESETS = {
  luxury: {
    key: "luxury",
    ink: "#0b0b0d",
    panel: "#141417",
    accent: "#c9a84c",
    textPrimary: "#f5f1e8",
    textMuted: "#b9b3a3",
    ctaTextColor: "#0b0b0d",
    headlineFont: "Playfair Display",
    headlineWeight: 700,
    backgroundPrompt:
      "cinematic dark marble palace interior, dramatic golden light rays breaking through, ornate gold architectural details, atmospheric haze, ultra detailed, moody luxury editorial photography, no text, no watermark, no logo",
  },
  fresh: {
    key: "fresh",
    ink: "#0f2318",
    panel: "#163322",
    accent: "#6ee89a",
    textPrimary: "#f3fbf6",
    textMuted: "#b7d9c5",
    ctaTextColor: "#0f2318",
    headlineFont: "Inter",
    headlineWeight: 800,
    backgroundPrompt:
      "cinematic lush green jungle canopy with golden sunlight beams breaking through mist, vibrant tropical leaves, dreamy atmosphere, dramatic depth, editorial nature photography, no text, no watermark, no logo",
  },
  modernTech: {
    key: "modernTech",
    ink: "#0a0e17",
    panel: "#121826",
    accent: "#4da8ff",
    textPrimary: "#eef3fb",
    textMuted: "#95a6c2",
    ctaTextColor: "#0a0e17",
    headlineFont: "Inter",
    headlineWeight: 800,
    backgroundPrompt:
      "futuristic cinematic cityscape at night, glowing blue neon light trails, holographic particles floating in the air, dramatic sci-fi atmosphere, ultra detailed, product launch backdrop, no text, no watermark, no logo",
  },
  warmHome: {
    key: "warmHome",
    ink: "#2a1a12",
    panel: "#3a2a1d",
    accent: "#e2a75e",
    textPrimary: "#fbf2e8",
    textMuted: "#d8c2ab",
    ctaTextColor: "#2a1a12",
    headlineFont: "Playfair Display",
    headlineWeight: 600,
    backgroundPrompt:
      "cinematic cozy living room interior, warm golden hour sunlight streaming through large windows, soft shadows, terracotta and natural wood tones, atmospheric dust particles in light beams, editorial home photography, no text, no watermark, no logo",
  },
  playful: {
    key: "playful",
    ink: "#1a1033",
    panel: "#271849",
    accent: "#ff6b9d",
    textPrimary: "#fff5fa",
    textMuted: "#d3c2e8",
    ctaTextColor: "#1a1033",
    headlineFont: "Inter",
    headlineWeight: 800,
    backgroundPrompt:
      "vibrant cinematic explosion of colorful paint splashes and confetti frozen in motion, dynamic energy, playful bold atmosphere, studio lighting, ultra detailed, no text, no watermark, no logo",
  },
  sleekAuto: {
    key: "sleekAuto",
    ink: "#0c0c0e",
    panel: "#18181b",
    accent: "#e23b3b",
    textPrimary: "#f2f2f3",
    textMuted: "#9a9a9e",
    ctaTextColor: "#f2f2f3",
    headlineFont: "Inter",
    headlineWeight: 800,
    backgroundPrompt:
      "dramatic cinematic dark car showroom, streaking red neon light reflections, atmospheric smoke, wet reflective floor, moody automotive atmosphere, ultra detailed, no text, no watermark, no logo",
  },
  classic: {
    key: "classic",
    ink: "#0f172a",
    panel: "#1e293b",
    accent: "#4ade80",
    textPrimary: "#f8fafc",
    textMuted: "#cbd5e1",
    ctaTextColor: "#0f172a",
    headlineFont: "Inter",
    headlineWeight: 800,
    backgroundPrompt:
      "cinematic dark blue abstract light waves and soft smoke, dramatic studio atmosphere, ultra detailed, professional product launch backdrop, no text, no watermark, no logo",
  },
} as const satisfies Record<string, StylePreset>;

const CATEGORY_STYLE_MAP: Record<string, keyof typeof STYLE_PRESETS> = {
  "Beauty & Skincare": "luxury",
  "Fashion & Apparel": "luxury",
  "Food & Beverage": "fresh",
  "Health & Wellness": "fresh",
  "Electronics & Technology": "modernTech",
  "Home & Living": "warmHome",
  "Toys & Kids": "playful",
  Automotive: "sleekAuto",
};

export function decideStyle(category: string): StylePreset {
  const key = CATEGORY_STYLE_MAP[category] ?? "classic";
  return STYLE_PRESETS[key];
}

/** Colours a user picked by hand. They beat anything a template derives. */
export type ColorOverrides = {
  background?: string;
  text?: string;
  muted?: string;
  accent?: string;
};

export type FontOverrides = {
  headline?: FontFamily;
  body?: FontFamily;
};

/**
 * A style after the AI art director's choices have been merged in.
 *
 * This is the *base* palette. Each template paints it differently — a dark
 * template grounds on `ink`, a paper template grounds on a light tint and
 * sets `ink` as the text — so one palette yields many looks. Typography
 * fields here are the template's defaults after painting; `fontOverrides`
 * and `colorOverrides` are the user's edits, applied last.
 */
export type ResolvedStyle = StylePreset & {
  /** Legacy arrangement name, kept so pre-template designs still open. */
  layout: LayoutVariant;
  moodLabel: string;
  templateId?: string;
  headlineItalic?: boolean;
  headlineUppercase?: boolean;
  headlineTracking?: number;
  headlineLineHeight?: number;
  /** Multiplier over the column-derived headline size. */
  headlineScale?: number;
  bodyFont?: FontFamily;
  ctaStyle?: CtaStyle;
  /** Hairlines, borders, grid lines. */
  line?: string;
  /** Raised card fill. */
  surface?: string;
  /** Second accent for vivid/mesh templates. */
  accent2?: string;
  colorOverrides?: ColorOverrides;
  fontOverrides?: FontOverrides;
  /** The copy's angle, recorded so regenerations try a different one. */
  copyAngle?: string;
};

export type CtaStyle = "pill" | "rect" | "brutal" | "outline" | "underline";

/**
 * Merges the model's art direction over the category preset.
 *
 * The model is treated as a creative source, not a trusted one: every
 * colour it returns is validated for format and for readable contrast
 * against the ground it will sit on, and any value failing either check
 * falls back to the preset's.
 */
export function resolveStyle(preset: StylePreset, direction?: ArtDirection): ResolvedStyle {
  if (!direction) {
    return { ...preset, layout: "split", moodLabel: preset.key };
  }

  const ink = isHex(direction.colorInk) ? direction.colorInk : preset.ink;

  const accent =
    isHex(direction.colorAccent) && contrastRatio(direction.colorAccent, ink) >= 2.2
      ? direction.colorAccent
      : preset.accent;

  const textPrimary =
    isHex(direction.colorTextPrimary) && contrastRatio(direction.colorTextPrimary, ink) >= 4.5
      ? direction.colorTextPrimary
      : preset.textPrimary;

  const textMuted =
    isHex(direction.colorTextMuted) && contrastRatio(direction.colorTextMuted, ink) >= 3
      ? direction.colorTextMuted
      : preset.textMuted;

  return {
    ...preset,
    ink,
    panel: mix(ink, WHITE, 0.07),
    accent,
    textPrimary,
    textMuted,
    ctaTextColor: luminance(accent) > 0.4 ? "#0a0a0b" : "#ffffff",
    backgroundPrompt: direction.scenePrompt?.trim()
      ? `${direction.scenePrompt.trim()}, cinematic lighting, ultra detailed, professional advertising photography, no text, no watermark, no logo`
      : preset.backgroundPrompt,
    layout: "split",
    moodLabel: direction.moodLabel || preset.key,
  };
}

/** Curated base palettes offered as one-click swatches in the editor. */
export const PALETTES: Array<{ name: string; ink: string; accent: string; text: string; muted: string }> = [
  { name: "Noir Gold", ink: "#0b0b0d", accent: "#c9a84c", text: "#f5f1e8", muted: "#b9b3a3" },
  { name: "Midnight Cyan", ink: "#070d18", accent: "#38bdf8", text: "#f1f6fd", muted: "#9fb2cc" },
  { name: "Forest Lime", ink: "#0f2318", accent: "#a3e635", text: "#f3fbf6", muted: "#b7d9c5" },
  { name: "Plum Pink", ink: "#1a1033", accent: "#ff6b9d", text: "#fff5fa", muted: "#d3c2e8" },
  { name: "Espresso", ink: "#2a1a12", accent: "#e2a75e", text: "#fbf2e8", muted: "#d8c2ab" },
  { name: "Racing Red", ink: "#0c0c0e", accent: "#ef3b2d", text: "#f2f2f3", muted: "#a1a1a6" },
  { name: "Electric", ink: "#0d0b1f", accent: "#7c5cff", text: "#f4f2ff", muted: "#b4addb" },
  { name: "Acid", ink: "#111111", accent: "#d4ff3a", text: "#fafafa", muted: "#b5b5b5" },
  { name: "Ocean", ink: "#04212b", accent: "#2dd4bf", text: "#ecfeff", muted: "#9cc7cc" },
  { name: "Terracotta", ink: "#2b1510", accent: "#f0794a", text: "#fff3ec", muted: "#e0b9a8" },
  { name: "Blush", ink: "#3a1f2b", accent: "#f9a8c4", text: "#fff3f7", muted: "#e3bccb" },
  { name: "Sunflower", ink: "#1b1a14", accent: "#ffc93c", text: "#fffaf0", muted: "#cfc6a8" },
  { name: "Cobalt", ink: "#0a1a4a", accent: "#ff8a3d", text: "#f2f5ff", muted: "#aab6dd" },
  { name: "Sage", ink: "#1f2a22", accent: "#b7c9a8", text: "#f4f7f2", muted: "#b9c4b5" },
  { name: "Mono", ink: "#121212", accent: "#ffffff", text: "#ffffff", muted: "#a3a3a3" },
  { name: "Cherry Cola", ink: "#2a0a0f", accent: "#ff3d5a", text: "#fff0f2", muted: "#e0a9b3" },
];
