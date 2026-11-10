import type { DesignDensity, DesignLayer, DesignSchema } from "../../design-schema/types";
import type { IconKey } from "../../design-schema/render/icons";
import type { CreativeContent } from "../types";

const ICON_ROTATION: IconKey[] = ["check", "star", "leaf", "shield", "truck", "heart", "sparkles", "tag"];

const SELLING_POINT_COUNT_BY_DENSITY: Record<DesignDensity, number> = {
  minimal: 0,
  standard: 2,
  detailed: 4,
};

export function composePosterSchema(
  content: CreativeContent,
  imageUrl: string,
  density: DesignDensity,
): DesignSchema {
  const layers: DesignLayer[] = [
    {
      id: "product-photo",
      type: "image",
      src: imageUrl,
      fit: "cover",
      x: 580,
      y: 0,
      width: 500,
      height: 760,
      zIndex: 0,
    },
    {
      id: "bg-accent",
      type: "shape",
      shape: "rect",
      fill: "#1e293b",
      x: 0,
      y: 760,
      width: 1080,
      height: 320,
      zIndex: 0,
    },
  ];

  if (content.badgeLabel) {
    layers.push(
      {
        id: "badge",
        type: "shape",
        shape: "badge",
        fill: "#f59e0b",
        x: 64,
        y: 64,
        width: 220,
        height: 56,
        zIndex: 1,
      },
      {
        id: "badge-label",
        type: "text",
        role: "badgeLabel",
        content: content.badgeLabel.toUpperCase(),
        x: 64,
        y: 80,
        width: 220,
        height: 28,
        zIndex: 2,
        fontFamily: "Inter",
        fontSize: 20,
        fontWeight: 800,
        color: "#1f2937",
        textAlign: "center",
      },
    );
  }

  layers.push({
    id: "headline",
    type: "text",
    role: "headline",
    content: content.headline,
    x: 64,
    y: 160,
    width: 480,
    height: 180,
    zIndex: 2,
    fontFamily: "Inter",
    fontSize: 60,
    fontWeight: 800,
    color: "#f8fafc",
    textAlign: "left",
    lineHeight: 1.1,
    maxLines: 3,
  });

  if (density !== "minimal") {
    layers.push({
      id: "description",
      type: "text",
      role: "description",
      content: content.description,
      x: 64,
      y: 380,
      width: 460,
      height: 120,
      zIndex: 2,
      fontFamily: "Inter",
      fontSize: 24,
      fontWeight: 400,
      color: "#cbd5e1",
      textAlign: "left",
      lineHeight: 1.4,
      maxLines: 3,
    });
  }

  const sellingPointCount = Math.min(
    SELLING_POINT_COUNT_BY_DENSITY[density],
    content.sellingPoints.length,
  );

  for (let i = 0; i < sellingPointCount; i++) {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const baseY = 820 + row * 56;
    const baseX = 64 + col * 356;

    layers.push(
      {
        id: `selling-point-icon-${i}`,
        type: "icon",
        iconKey: ICON_ROTATION[i % ICON_ROTATION.length],
        color: "#4ade80",
        x: baseX,
        y: baseY,
        width: 32,
        height: 32,
        zIndex: 2,
      },
      {
        id: `selling-point-${i}`,
        type: "text",
        role: "sellingPoint",
        content: content.sellingPoints[i],
        x: baseX + 44,
        y: baseY + 4,
        width: 300,
        height: 32,
        zIndex: 2,
        fontFamily: "Inter",
        fontSize: 20,
        fontWeight: 600,
        color: "#f1f5f9",
        textAlign: "left",
      },
    );
  }

  const ctaY = sellingPointCount > 2 ? 980 : 920;

  layers.push(
    {
      id: "cta-pill",
      type: "shape",
      shape: "badge",
      fill: "#4ade80",
      x: 64,
      y: ctaY,
      width: 260,
      height: 76,
      zIndex: 1,
    },
    {
      id: "cta-label",
      type: "text",
      role: "ctaLabel",
      content: content.ctaLabel,
      x: 64,
      y: ctaY + 24,
      width: 260,
      height: 32,
      zIndex: 2,
      fontFamily: "Inter",
      fontSize: 26,
      fontWeight: 700,
      color: "#0f172a",
      textAlign: "center",
    },
  );

  return {
    schemaVersion: 1,
    canvas: { width: 1080, height: 1080, backgroundColor: "#0f172a", aspectRatioPreset: "instagram-square" },
    meta: { density, templateKey: `poster-${density}` },
    layers,
  };
}
