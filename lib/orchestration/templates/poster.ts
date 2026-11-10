import type { DesignDensity, DesignLayer, DesignSchema } from "../../design-schema/types";
import type { IconKey } from "../../design-schema/render/icons";
import type { CreativeContent } from "../types";
import type { StylePreset } from "../styles";

const ICON_ROTATION: IconKey[] = ["check", "star", "leaf", "shield", "truck", "heart", "sparkles", "tag"];

const SELLING_POINT_COUNT_BY_DENSITY: Record<DesignDensity, number> = {
  minimal: 0,
  standard: 2,
  detailed: 4,
};

export function composePosterSchema(
  content: CreativeContent,
  productImageUrl: string,
  density: DesignDensity,
  style: StylePreset,
  backgroundImageUrl?: string,
): DesignSchema {
  // The product photo sits on a clean card, not an edge-to-edge crop: the
  // slot is tall and narrow (500x1080), and an arbitrary uploaded photo's
  // aspect ratio rarely matches that, so `fit: "cover"` would zoom in and
  // chop off parts of the product (exactly what it did before this fix —
  // a wide product like headphones lost most of its frame). `contain`
  // guarantees the whole product is always visible, and the card gives it
  // a deliberate presentation instead of looking like an accidental crop.
  const layers: DesignLayer[] = [
    {
      id: "product-card",
      type: "shape",
      shape: "rect",
      fill: "#fafaf8",
      borderRadius: 20,
      x: 620,
      y: 72,
      width: 420,
      height: 936,
      zIndex: 0,
    },
    {
      id: "product-photo",
      type: "image",
      src: productImageUrl,
      fit: "contain",
      x: 652,
      y: 104,
      width: 356,
      height: 872,
      zIndex: 1,
    },
  ];

  if (content.badgeLabel) {
    layers.push(
      {
        id: "badge",
        type: "shape",
        shape: "badge",
        fill: "transparent",
        stroke: style.accent,
        strokeWidth: 1,
        x: 64,
        y: 72,
        width: 200,
        height: 40,
        zIndex: 1,
      },
      {
        id: "badge-label",
        type: "text",
        role: "badgeLabel",
        content: content.badgeLabel.toUpperCase(),
        x: 64,
        y: 84,
        width: 200,
        height: 20,
        zIndex: 2,
        fontFamily: "Inter",
        fontSize: 13,
        fontWeight: 600,
        color: style.accent,
        textAlign: "center",
        letterSpacing: 2,
      },
    );
  }

  layers.push({
    id: "headline",
    type: "text",
    role: "headline",
    content: content.headline,
    x: 64,
    y: content.badgeLabel ? 160 : 120,
    width: 480,
    height: 220,
    zIndex: 2,
    fontFamily: style.headlineFont,
    fontSize: style.headlineFont === "Playfair Display" ? 58 : 50,
    fontWeight: style.headlineWeight,
    color: style.textPrimary,
    textAlign: "left",
    lineHeight: 1.18,
    maxLines: 3,
  });

  if (density !== "minimal") {
    layers.push({
      id: "description",
      type: "text",
      role: "description",
      content: content.description,
      x: 64,
      y: 400,
      width: 460,
      height: 120,
      zIndex: 2,
      fontFamily: "Inter",
      fontSize: 21,
      fontWeight: 400,
      color: style.textMuted,
      textAlign: "left",
      lineHeight: 1.5,
      maxLines: 3,
    });
  }

  const sellingPointCount = Math.min(
    SELLING_POINT_COUNT_BY_DENSITY[density],
    content.sellingPoints.length,
  );

  if (sellingPointCount > 0) {
    layers.push({
      id: "selling-points-divider",
      type: "shape",
      shape: "rect",
      fill: style.accent,
      opacity: 0.4,
      x: 64,
      y: 800,
      width: 460,
      height: 1,
      zIndex: 1,
    });
  }

  for (let i = 0; i < sellingPointCount; i++) {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const baseY = 836 + row * 52;
    const baseX = 64 + col * 236;

    layers.push(
      {
        id: `selling-point-icon-${i}`,
        type: "icon",
        iconKey: ICON_ROTATION[i % ICON_ROTATION.length],
        color: style.accent,
        x: baseX,
        y: baseY,
        width: 22,
        height: 22,
        zIndex: 2,
      },
      {
        id: `selling-point-${i}`,
        type: "text",
        role: "sellingPoint",
        content: content.sellingPoints[i],
        x: baseX + 32,
        y: baseY + 2,
        width: 190,
        height: 28,
        zIndex: 2,
        fontFamily: "Inter",
        fontSize: 16,
        fontWeight: 500,
        color: style.textPrimary,
        textAlign: "left",
      },
    );
  }

  const ctaY = sellingPointCount > 2 ? 960 : 920;

  layers.push(
    {
      id: "cta-pill",
      type: "shape",
      shape: "badge",
      fill: style.accent,
      x: 64,
      y: ctaY,
      width: 200,
      height: 56,
      zIndex: 1,
    },
    {
      id: "cta-label",
      type: "text",
      role: "ctaLabel",
      content: content.ctaLabel.toUpperCase(),
      x: 64,
      y: ctaY + 19,
      width: 200,
      height: 20,
      zIndex: 2,
      fontFamily: "Inter",
      fontSize: 15,
      fontWeight: 700,
      color: style.ctaTextColor,
      textAlign: "center",
      letterSpacing: 1.5,
    },
  );

  // Background image is decorative mood/texture, never the product itself
  // — AI-generated backgrounds can't guarantee identity preservation, but
  // they don't need to since the real photo above carries that job. It's
  // full-bleed across the whole canvas for a cohesive cinematic feel
  // (rather than confined to the text column), with a lighter scrim only
  // over the text column to keep copy legible — the product card is
  // already opaque, so the scene reads clearly behind/around it.
  const backgroundLayers: DesignLayer[] = backgroundImageUrl
    ? [
        {
          id: "bg-image",
          type: "image",
          src: backgroundImageUrl,
          fit: "cover",
          x: 0,
          y: 0,
          width: 1080,
          height: 1080,
          zIndex: 0,
        },
        {
          id: "bg-scrim",
          type: "shape",
          shape: "rect",
          fill: style.ink,
          opacity: 0.7,
          x: 0,
          y: 0,
          width: 580,
          height: 1080,
          zIndex: 0,
        },
        // Free background generators often stamp a watermark in a bottom
        // corner. Opacity dimming alone doesn't reliably hide high-contrast
        // text, so fully mask the bottom strip regardless of what's there —
        // full width, since the background now spans the whole canvas.
        {
          id: "bg-watermark-mask",
          type: "shape",
          shape: "rect",
          fill: style.panel,
          x: 0,
          y: 1030,
          width: 1080,
          height: 50,
          zIndex: 0,
        },
      ]
    : [
        {
          id: "bg",
          type: "shape",
          shape: "rect",
          fill: style.ink,
          x: 0,
          y: 0,
          width: 580,
          height: 1080,
          zIndex: 0,
        },
      ];

  return {
    schemaVersion: 1,
    canvas: { width: 1080, height: 1080, backgroundColor: style.panel, aspectRatioPreset: "instagram-square" },
    meta: { density, templateKey: `poster-${density}-${style.key}` },
    layers: [...backgroundLayers, ...layers],
  };
}
