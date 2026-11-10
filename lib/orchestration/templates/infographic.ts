import type { DesignLayer, DesignSchema } from "../../design-schema/types";
import type { CreativeContent } from "../types";
import type { StylePreset } from "../styles";

const PRODUCT_BOX = { x: 390, y: 300, width: 300, height: 480 };
const ROW_Y = [330, 500, 670];

// Numbered feature-callout layout: product centered, circled numbers at its
// edges connected by thin lines out to a label in the margin — the classic
// "infographic" ad format, good for spec-heavy categories where a few
// stated selling points read better as itemized callouts than as a single
// paragraph (spec section 3's "electronics advertisement may need
// specifications, technical features..." maps directly to this format).
export function composeInfographicSchema(
  content: CreativeContent,
  productImageUrl: string,
  style: StylePreset,
): DesignSchema {
  const layers: DesignLayer[] = [
    {
      id: "headline",
      type: "text",
      role: "headline",
      content: content.headline,
      x: 90,
      y: 48,
      width: 900,
      height: 90,
      zIndex: 2,
      fontFamily: style.headlineFont,
      fontSize: style.headlineFont === "Playfair Display" ? 42 : 38,
      fontWeight: style.headlineWeight,
      color: style.textPrimary,
      textAlign: "center",
      lineHeight: 1.15,
      maxLines: 2,
    },
    {
      id: "product-card",
      type: "shape",
      shape: "rect",
      fill: "#fafaf8",
      borderRadius: 20,
      x: PRODUCT_BOX.x,
      y: PRODUCT_BOX.y,
      width: PRODUCT_BOX.width,
      height: PRODUCT_BOX.height,
      zIndex: 0,
    },
    {
      id: "product-photo",
      type: "image",
      src: productImageUrl,
      fit: "contain",
      x: PRODUCT_BOX.x + 24,
      y: PRODUCT_BOX.y + 24,
      width: PRODUCT_BOX.width - 48,
      height: PRODUCT_BOX.height - 48,
      zIndex: 1,
    },
  ];

  const points = content.sellingPoints.slice(0, 6);
  points.forEach((point, i) => {
    const side = i % 2 === 0 ? "left" : "right";
    const row = Math.floor(i / 2);
    const rowY = ROW_Y[row] ?? ROW_Y[ROW_Y.length - 1] + row * 150;
    const number = String(i + 1);

    if (side === "left") {
      layers.push(
        {
          id: `callout-line-${i}`,
          type: "shape",
          shape: "rect",
          fill: style.accent,
          opacity: 0.6,
          x: 160,
          y: rowY - 1,
          width: PRODUCT_BOX.x - 160,
          height: 2,
          zIndex: 1,
        },
        {
          id: `callout-circle-${i}`,
          type: "shape",
          shape: "ellipse",
          fill: style.accent,
          x: PRODUCT_BOX.x - 16,
          y: rowY - 16,
          width: 32,
          height: 32,
          zIndex: 2,
        },
        {
          id: `callout-number-${i}`,
          type: "text",
          role: "custom",
          content: number,
          x: PRODUCT_BOX.x - 16,
          y: rowY - 11,
          width: 32,
          height: 22,
          zIndex: 3,
          fontFamily: "Inter",
          fontSize: 16,
          fontWeight: 700,
          color: style.ctaTextColor,
          textAlign: "center",
        },
        {
          id: `callout-label-${i}`,
          type: "text",
          role: "sellingPoint",
          content: point,
          x: 40,
          y: rowY - 32,
          width: 210,
          height: 64,
          zIndex: 2,
          fontFamily: "Inter",
          fontSize: 17,
          fontWeight: 500,
          color: style.textPrimary,
          textAlign: "left",
          lineHeight: 1.3,
          maxLines: 3,
        },
      );
    } else {
      const rightEdge = PRODUCT_BOX.x + PRODUCT_BOX.width;
      layers.push(
        {
          id: `callout-line-${i}`,
          type: "shape",
          shape: "rect",
          fill: style.accent,
          opacity: 0.6,
          x: rightEdge,
          y: rowY - 1,
          width: 920 - rightEdge,
          height: 2,
          zIndex: 1,
        },
        {
          id: `callout-circle-${i}`,
          type: "shape",
          shape: "ellipse",
          fill: style.accent,
          x: rightEdge - 16,
          y: rowY - 16,
          width: 32,
          height: 32,
          zIndex: 2,
        },
        {
          id: `callout-number-${i}`,
          type: "text",
          role: "custom",
          content: number,
          x: rightEdge - 16,
          y: rowY - 11,
          width: 32,
          height: 22,
          zIndex: 3,
          fontFamily: "Inter",
          fontSize: 16,
          fontWeight: 700,
          color: style.ctaTextColor,
          textAlign: "center",
        },
        {
          id: `callout-label-${i}`,
          type: "text",
          role: "sellingPoint",
          content: point,
          x: 830,
          y: rowY - 32,
          width: 210,
          height: 64,
          zIndex: 2,
          fontFamily: "Inter",
          fontSize: 17,
          fontWeight: 500,
          color: style.textPrimary,
          textAlign: "left",
          lineHeight: 1.3,
          maxLines: 3,
        },
      );
    }
  });

  layers.push(
    {
      id: "cta-pill",
      type: "shape",
      shape: "badge",
      fill: style.accent,
      x: 440,
      y: 900,
      width: 200,
      height: 64,
      zIndex: 1,
    },
    {
      id: "cta-label",
      type: "text",
      role: "ctaLabel",
      content: content.ctaLabel.toUpperCase(),
      x: 440,
      y: 922,
      width: 200,
      height: 24,
      zIndex: 2,
      fontFamily: "Inter",
      fontSize: 16,
      fontWeight: 700,
      color: style.ctaTextColor,
      textAlign: "center",
      letterSpacing: 1.5,
    },
  );

  return {
    schemaVersion: 1,
    canvas: { width: 1080, height: 1080, backgroundColor: style.ink, aspectRatioPreset: "instagram-square" },
    meta: { density: "detailed", templateKey: `infographic-${style.key}` },
    layers,
  };
}
