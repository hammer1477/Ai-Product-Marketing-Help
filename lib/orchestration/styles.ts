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
    backgroundPrompt: "elegant dark marble surface with soft warm gold light, luxury product photography backdrop, no text, no watermark",
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
    backgroundPrompt: "fresh green botanical leaves and natural light, clean organic food photography backdrop, no text, no watermark",
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
    backgroundPrompt: "sleek dark blue gradient with subtle circuit board pattern, modern tech product photography backdrop, no text, no watermark",
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
    backgroundPrompt: "warm cozy terracotta and natural wood texture, soft ambient light, home decor photography backdrop, no text, no watermark",
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
    backgroundPrompt: "vibrant colorful abstract shapes, playful pastel gradient, fun energetic photography backdrop, no text, no watermark",
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
    backgroundPrompt: "dark metallic brushed surface with dramatic red accent light, automotive showroom photography backdrop, no text, no watermark",
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
    backgroundPrompt: "clean modern dark blue gradient, soft studio light, professional product photography backdrop, no text, no watermark",
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
