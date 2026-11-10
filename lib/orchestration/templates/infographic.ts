import type { DesignLayer, DesignSchema } from "../../design-schema/types";
import type { CreativeContent } from "../types";
import type { ResolvedStyle } from "../styles";
import { measureTextBlock } from "../../design-schema/measureText";
import { pill, productStage, text } from "./layoutKit";

const CANVAS = 1080;
const PRODUCT = { centerX: 540, centerY: 540, width: 360, height: 460 };
const ROW_Y = [370, 540, 710];
const LABEL_WIDTH = 230;

export type InfographicInput = {
  content: CreativeContent;
  productImageUrl: string;
  style: ResolvedStyle;
  cutoutApplied: boolean;
  productAspectRatio: number;
  backgroundImageUrl?: string;
};

// Numbered feature-callout layout: product centered, circled numbers at its
// edges connected by thin lines out to a label in the margin — the classic
// "infographic" ad format, good for spec-heavy categories where a few
// stated selling points read better as itemized callouts than as a single
// paragraph (spec section 3's "electronics advertisement may need
// specifications, technical features..." maps directly to this format).
export function composeInfographicSchema(input: InfographicInput): DesignSchema {
  const { content, style, productImageUrl, cutoutApplied, backgroundImageUrl } = input;

  const layers: DesignLayer[] = [];

  // The scene is pushed much further back than on a poster — callout lines
  // and numerals need a calm ground to stay readable against.
  if (backgroundImageUrl) {
    layers.push(
      {
        id: "bg-image",
        type: "image",
        src: backgroundImageUrl,
        fit: "cover",
        x: 0,
        y: 0,
        width: CANVAS,
        height: CANVAS,
        zIndex: 0,
      },
      {
        id: "bg-tint",
        type: "shape",
        shape: "rect",
        fill: style.ink,
        opacity: 0.82,
        x: 0,
        y: 0,
        width: CANVAS,
        height: CANVAS,
        zIndex: 0,
      },
    );
  } else {
    layers.push({
      id: "bg",
      type: "shape",
      shape: "rect",
      fill: style.ink,
      x: 0,
      y: 0,
      width: CANVAS,
      height: CANVAS,
      zIndex: 0,
    });
  }

  const headline = text({
    id: "headline",
    role: "headline",
    content: content.headline,
    x: 90,
    y: 58,
    maxWidth: 900,
    fontFamily: style.headlineFont,
    fontSize: style.headlineFont === "Playfair Display" ? 44 : 40,
    fontWeight: style.headlineWeight,
    color: style.textPrimary,
    textAlign: "center",
    lineHeight: 1.15,
    maxLines: 2,
    autoFit: true,
  });
  layers.push(...headline.layers);

  layers.push(
    ...productStage({
      src: productImageUrl,
      centerX: PRODUCT.centerX,
      centerY: PRODUCT.centerY,
      width: PRODUCT.width,
      height: PRODUCT.height,
      accent: style.accent,
      cutoutApplied,
      aspectRatio: input.productAspectRatio,
      zIndex: 2,
    }),
  );

  const productLeft = PRODUCT.centerX - PRODUCT.width / 2;
  const productRight = PRODUCT.centerX + PRODUCT.width / 2;
  const points = content.sellingPoints.slice(0, 6);

  points.forEach((point, i) => {
    const isLeft = i % 2 === 0;
    const row = Math.floor(i / 2);
    const rowY = ROW_Y[row] ?? ROW_Y[ROW_Y.length - 1] + (row - ROW_Y.length + 1) * 160;
    const anchorX = isLeft ? productLeft : productRight;

    // Labels are measured and centred on the connector, so a long bullet
    // grows symmetrically instead of drifting into the row above it.
    const metrics = measureTextBlock(point, LABEL_WIDTH, {
      fontFamily: "Inter",
      fontSize: 17,
      fontWeight: 500,
      lineHeight: 1.3,
      maxLines: 3,
    });
    const labelY = Math.round(rowY - metrics.height / 2);
    const labelX = isLeft ? 56 : CANVAS - 56 - LABEL_WIDTH;

    layers.push(
      {
        id: `callout-line-${i}`,
        type: "shape",
        shape: "rect",
        fill: style.accent,
        opacity: 0.55,
        x: isLeft ? labelX + LABEL_WIDTH + 12 : productRight,
        y: rowY - 1,
        width: isLeft
          ? anchorX - (labelX + LABEL_WIDTH + 12)
          : labelX - 12 - productRight,
        height: 2,
        zIndex: 5,
      },
      {
        id: `callout-circle-${i}`,
        type: "shape",
        shape: "ellipse",
        fill: style.accent,
        x: anchorX - 17,
        y: rowY - 17,
        width: 34,
        height: 34,
        zIndex: 6,
      },
      {
        id: `callout-number-${i}`,
        type: "text",
        role: "custom",
        content: String(i + 1),
        x: anchorX - 17,
        y: rowY - 11,
        width: 34,
        height: 22,
        zIndex: 7,
        fontFamily: "Inter",
        fontSize: 16,
        fontWeight: 700,
        color: style.ctaTextColor,
        textAlign: "center",
        lineHeight: 1.2,
        maxLines: 1,
      },
      ...text({
        id: `callout-label-${i}`,
        role: "sellingPoint",
        content: point,
        x: labelX,
        y: labelY,
        maxWidth: LABEL_WIDTH,
        fontFamily: "Inter",
        fontSize: 17,
        fontWeight: 500,
        color: style.textPrimary,
        textAlign: isLeft ? "right" : "left",
        lineHeight: 1.3,
        maxLines: 3,
        zIndex: 5,
      }).layers,
    );
  });

  layers.push(
    ...pill({
      id: "cta-label",
      role: "ctaLabel",
      label: content.ctaLabel.toUpperCase(),
      x: CANVAS / 2,
      y: 900,
      anchor: "center",
      fill: style.accent,
      textColor: style.ctaTextColor,
      fontSize: 16,
      fontWeight: 700,
      letterSpacing: 1.6,
      paddingX: 34,
      maxWidth: 560,
      zIndex: 5,
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
      density: "detailed",
      templateKey: `infographic-${style.moodLabel.replace(/\s+/g, "-")}`,
    },
    layers,
  };
}
