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
