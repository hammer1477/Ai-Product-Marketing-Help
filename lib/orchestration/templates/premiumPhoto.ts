import type { DesignLayer, DesignSchema } from "../../design-schema/types";
import type { CreativeContent } from "../types";
import type { ResolvedStyle } from "../styles";
import { gradientBand, pill, text } from "./layoutKit";

const CANVAS = 1080;

// Premium-photo concept: the photography does all the work, so the overlay
// is deliberately minimal — product name + CTA over a bottom scrim. The
// uncut original photo is used here on purpose: this layout wants the
// product *in its environment*, so removing the backdrop would delete the
// very thing the concept is built on.
export function composePremiumPhotoSchema(
  content: CreativeContent,
  imageUrl: string,
  style: ResolvedStyle,
): DesignSchema {
  const layers: DesignLayer[] = [
    {
      id: "product-photo",
      type: "image",
      src: imageUrl,
      fit: "cover",
      x: 0,
      y: 0,
      width: CANVAS,
      height: CANVAS,
      zIndex: 0,
    },
    // A graduated scrim rather than one flat panel — a hard-edged bar at
    // 820px reads as a sticker laid over the photo.
    ...gradientBand({
      idPrefix: "scrim",
      fill: style.ink,
      x: 0,
      y: 620,
      width: CANVAS,
      height: 300,
      from: 0,
      to: 0.86,
      direction: "vertical",
      steps: 16,
      zIndex: 1,
    }),
    {
      id: "scrim-solid",
      type: "shape",
      shape: "rect",
      fill: style.ink,
      opacity: 0.86,
      x: 0,
      y: 920,
      width: CANVAS,
      height: 160,
      zIndex: 1,
    },
  ];

  const name = text({
    id: "product-name",
    role: "productName",
    content: content.productName,
    x: 72,
    y: 806,
    maxWidth: 936,
    fontFamily: style.headlineFont,
    fontSize: style.headlineFont === "Playfair Display" ? 50 : 44,
    fontWeight: style.headlineWeight,
    color: style.textPrimary,
    textAlign: "left",
    lineHeight: 1.15,
    maxLines: 2,
    autoFit: true,
  });
  layers.push(...name.layers);

  layers.push(
    ...pill({
      id: "cta-label",
      role: "ctaLabel",
      label: content.ctaLabel.toUpperCase(),
      x: 72,
      y: 806 + name.height + 26,
      fill: style.accent,
      textColor: style.ctaTextColor,
      fontSize: 16,
      fontWeight: 700,
      letterSpacing: 1.6,
      paddingX: 34,
      maxWidth: 560,
      zIndex: 2,
    }).layers,
  );

  return {
    schemaVersion: 1,
    canvas: {
      width: CANVAS,
      height: CANVAS,
      backgroundColor: style.ink,
      aspectRatioPreset: "instagram-square",
    },
    meta: {
      density: "minimal",
      templateKey: `premium-photo-${style.moodLabel.replace(/\s+/g, "-")}`,
    },
    layers,
  };
}
