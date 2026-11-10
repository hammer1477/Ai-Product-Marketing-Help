import type { DesignSchema } from "../../design-schema/types";
import type { CreativeContent } from "../types";
import type { StylePreset } from "../styles";

// Premium-photo concept: the generated photography does most of the work,
// so the overlay is deliberately minimal — just product name + CTA over a
// bottom scrim (a semi-transparent shape, since Satori doesn't support CSS
// gradients the way a browser would). Still takes the category's style
// preset so the accent/CTA treatment matches the poster concept for the
// same product.
export function composePremiumPhotoSchema(
  content: CreativeContent,
  imageUrl: string,
  style: StylePreset,
): DesignSchema {
  return {
    schemaVersion: 1,
    canvas: { width: 1080, height: 1080, backgroundColor: style.ink, aspectRatioPreset: "instagram-square" },
    meta: { density: "minimal", templateKey: `premium-photo-${style.key}` },
    layers: [
      {
        id: "product-photo",
        type: "image",
        src: imageUrl,
        fit: "cover",
        x: 0,
        y: 0,
        width: 1080,
        height: 1080,
        zIndex: 0,
      },
      {
        id: "scrim",
        type: "shape",
        shape: "rect",
        fill: style.ink,
        opacity: 0.6,
        x: 0,
        y: 820,
        width: 1080,
        height: 260,
        zIndex: 1,
      },
      {
        id: "product-name",
        type: "text",
        role: "productName",
        content: content.productName,
        x: 64,
        y: 860,
        width: 952,
        height: 72,
        zIndex: 2,
        fontFamily: style.headlineFont,
        fontSize: style.headlineFont === "Playfair Display" ? 46 : 42,
        fontWeight: style.headlineWeight,
        color: style.textPrimary,
        textAlign: "left",
        maxLines: 1,
      },
      {
        id: "cta-pill",
        type: "shape",
        shape: "badge",
        fill: style.accent,
        x: 64,
        y: 950,
        width: 220,
        height: 68,
        zIndex: 1,
      },
      {
        id: "cta-label",
        type: "text",
        role: "ctaLabel",
        content: content.ctaLabel.toUpperCase(),
        x: 64,
        y: 972,
        width: 220,
        height: 28,
        zIndex: 2,
        fontFamily: "Inter",
        fontSize: 16,
        fontWeight: 700,
        color: style.ctaTextColor,
        textAlign: "center",
        letterSpacing: 1.5,
      },
    ],
  };
}
