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
  headlineFont: "Playfair Display" | "Inter";
  headlineWeight: 600 | 700 | 800;
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

/** A style preset after the AI art director's choices have been merged in. */
export type ResolvedStyle = StylePreset & {
  layout: LayoutVariant;
  moodLabel: string;
};

const DEFAULT_LAYOUT_BY_STYLE: Record<string, LayoutVariant> = {
  luxury: "editorial",
  fresh: "spotlight",
  modernTech: "split",
  warmHome: "spotlight",
  playful: "spotlight",
  sleekAuto: "editorial",
  classic: "split",
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  if (!HEX.test(hex)) return null;
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function mixToward(hex: string, target: { r: number; g: number; b: number }, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return toHex({
    r: rgb.r + (target.r - rgb.r) * amount,
    g: rgb.g + (target.g - rgb.g) * amount,
    b: rgb.b + (target.b - rgb.b) * amount,
  });
}

const WHITE = { r: 255, g: 255, b: 255 };

/**
 * Merges the model's art direction over the category preset.
 *
 * The model is treated as a creative source, not a trusted one: every
 * colour it returns is validated for format and for actual readable
 * contrast against the ground it will sit on, and any value failing either
 * check falls back to the preset's. That keeps "every product looks
 * different" from turning into "some products are illegible" — the one
 * failure mode a category preset could never produce.
 */
export function resolveStyle(preset: StylePreset, direction?: ArtDirection): ResolvedStyle {
  const fallbackLayout = DEFAULT_LAYOUT_BY_STYLE[preset.key] ?? "split";

  if (!direction) {
    return { ...preset, layout: fallbackLayout, moodLabel: preset.key };
  }

  const ink = parseHex(direction.colorInk) ? direction.colorInk : preset.ink;

  const accent =
    parseHex(direction.colorAccent) && contrastRatio(direction.colorAccent, ink) >= 2.2
      ? direction.colorAccent
      : preset.accent;

  const textPrimary =
    parseHex(direction.colorTextPrimary) && contrastRatio(direction.colorTextPrimary, ink) >= 4.5
      ? direction.colorTextPrimary
      : preset.textPrimary;

  const textMuted =
    parseHex(direction.colorTextMuted) && contrastRatio(direction.colorTextMuted, ink) >= 3
      ? direction.colorTextMuted
      : preset.textMuted;

  // Derived rather than model-chosen: these have exactly one correct answer
  // given the colours above, and asking the model for them only adds a way
  // to get unreadable CTA text.
  const panel = mixToward(ink, WHITE, 0.07);
  const ctaTextColor = luminance(accent) > 0.4 ? "#0a0a0b" : "#ffffff";

  const layout = direction.layout ?? fallbackLayout;
  const headlineFont =
    direction.headlineFont === "Playfair Display" || direction.headlineFont === "Inter"
      ? direction.headlineFont
      : preset.headlineFont;

  return {
    key: preset.key,
    ink,
    panel,
    accent,
    textPrimary,
    textMuted,
    ctaTextColor,
    headlineFont,
    headlineWeight: headlineFont === "Playfair Display" ? 700 : 800,
    backgroundPrompt: direction.scenePrompt?.trim()
      ? `${direction.scenePrompt.trim()}, cinematic lighting, ultra detailed, professional advertising photography, no text, no watermark, no logo`
      : preset.backgroundPrompt,
    layout,
    moodLabel: direction.moodLabel || preset.key,
  };
}
