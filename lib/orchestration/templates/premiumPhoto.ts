import type { DesignSchema } from "../../design-schema/types";
import type { CreativeContent } from "../types";

// Premium-photo concept: the generated photography does most of the work,
// so the overlay is deliberately minimal — just product name + CTA over a
// bottom gradient-like scrim (a semi-transparent shape, since Satori doesn't
// support CSS gradients the way a browser would).
export function composePremiumPhotoSchema(content: CreativeContent, imageUrl: string): DesignSchema {
  return {
    schemaVersion: 1,
    canvas: { width: 1080, height: 1080, backgroundColor: "#000000", aspectRatioPreset: "instagram-square" },
    meta: { density: "minimal", templateKey: "premium-photo" },
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
        fill: "#0f172a",
        opacity: 0.55,
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
        fontFamily: "Inter",
        fontSize: 48,
        fontWeight: 800,
        color: "#f8fafc",
        textAlign: "left",
        maxLines: 1,
      },
      {
        id: "cta-pill",
        type: "shape",
        shape: "badge",
        fill: "#f8fafc",
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
        content: content.ctaLabel,
        x: 64,
        y: 972,
        width: 220,
        height: 28,
        zIndex: 2,
        fontFamily: "Inter",
        fontSize: 22,
        fontWeight: 700,
        color: "#0f172a",
        textAlign: "center",
      },
    ],
  };
}
