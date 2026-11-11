import type { DesignLayer } from "../../../design-schema/types";
import { measureTextBlock } from "../../../design-schema/measureText";
import { ctaButton, renderBlock } from "../../blocks/render";
import type { Block } from "../../blocks/types";
import { text } from "../layoutKit";
import { C, find, rect, stage, type TemplateCtx, type TemplateResult } from "../kit";

/** The most leader lines that fit around the product without crowding it. */
const MAX_CALLOUTS = 6;

/**
 * The callouts to draw, drawn from both list blocks. Specs come first —
 * a name plus a value makes the stronger callout — with features filling
 * any remaining lines.
 */
export function calloutItems(blocks: Block[]): Array<{ label: string; value?: string }> {
  const specs = find(blocks, "specGrid");
  const features = find(blocks, "featureList");
  const items: Array<{ label: string; value?: string }> = [];
  if (specs) items.push(...specs.items.map((item) => ({ label: item.label, value: item.value })));
  if (features) items.push(...features.items.map((item) => ({ label: item })));
  return items.slice(0, MAX_CALLOUTS);
}

/** A display headline outside the stack, in the template's typography. */
export function headlineAt(
  ctx: TemplateCtx,
  content: string,
  x: number,
  y: number,
  width: number,
  o: { size: number; align?: "left" | "center"; maxLines?: number; color?: string; z?: number },
) {
  const s = ctx.s;
  return text({
    id: "headline",
    role: "headline",
    content,
    x,
    y,
    maxWidth: width,
    fontFamily: s.headlineFont,
    fontSize: Math.round(o.size * (s.headlineScale ?? 1)),
    fontWeight: s.headlineWeight,
    italic: s.headlineItalic,
    uppercase: s.headlineUppercase,
    letterSpacing: s.headlineTracking,
    color: o.color ?? s.textPrimary,
    textAlign: o.align ?? "center",
    lineHeight: s.headlineLineHeight ?? 1.12,
    maxLines: o.maxLines ?? 2,
    autoFit: true,
    zIndex: o.z,
  });
}

/**
 * Product centred, with leader lines pointing out to its facts.
 *
 * "classic" draws numbered accent dots; "hud" draws square markers and
 * monospaced labels, the viewfinder look for tech.
 */
export function buildCallout(ctx: TemplateCtx, variant: "classic" | "hud", calm: boolean): TemplateResult {
  const { s, p, blocks } = ctx;
  const product = { cx: 540, cy: 540, w: 400, h: 520 };
  const labelWidth = 220;
  const sideMargin = 48;
  const rowYs = [360, 540, 720];
  const productLeft = product.cx - product.w / 2;
  const productRight = product.cx + product.w / 2;
  const body = s.bodyFont ?? "Inter";

  const layers: DesignLayer[] = [];
  const placed: Block[] = [];

  if (calm) layers.push(rect("callout-calm", 0, 0, C, C, p.ground, { opacity: 0.62, z: 1 }));

  let headlineY = 58;

  const badge = find(blocks, "badge");
  if (badge) {
    placed.push(badge);
    const built = renderBlock(badge, { style: s, x: 340, width: 400, y: 46, align: "center", key: "callout-badge" });
    layers.push(...built.layers);
    headlineY = 46 + built.height + 20;
  }

  const headline = find(blocks, "headline");
  if (headline) {
    placed.push(headline);
    layers.push(...headlineAt(ctx, headline.text, 90, headlineY, 900, { size: 50 }).layers);
  }

  layers.push(...stage(ctx, product, { z: 2, glow: variant === "classic" }));

  for (const type of ["specGrid", "featureList"] as const) {
    const block = find(blocks, type);
    if (block) placed.push(block);
  }

  calloutItems(blocks).forEach((callout, index) => {
    const isLeft = index % 2 === 0;
    const row = Math.floor(index / 2);
    const rowY = rowYs[row] ?? rowYs[rowYs.length - 1] + (row - rowYs.length + 1) * 170;
    const anchorX = isLeft ? productLeft : productRight;
    const labelX = isLeft ? sideMargin : C - sideMargin - labelWidth;
    const align = isLeft ? "right" : "left";
    const hud = variant === "hud";

    const nameSize = callout.value ? 12 : 16;
    const nameOpts = {
      fontFamily: body,
      fontSize: nameSize,
      fontWeight: callout.value ? 600 : 500,
      letterSpacing: callout.value ? 1.4 : undefined,
      lineHeight: 1.3,
      maxLines: callout.value ? 1 : 3,
    };
    const nameMetrics = measureTextBlock(callout.label, labelWidth, nameOpts);
    const valueMetrics = callout.value
      ? measureTextBlock(callout.value, labelWidth, { fontFamily: body, fontSize: 20, fontWeight: 700, lineHeight: 1.25, maxLines: 2 })
      : null;

    // Centred on the leader line, so a long value grows symmetrically.
    const totalHeight = nameMetrics.height + (valueMetrics ? 4 + valueMetrics.height : 0);
    const blockY = Math.round(rowY - totalHeight / 2);
    const lineX = isLeft ? labelX + labelWidth + 14 : productRight;
    const lineW = isLeft ? anchorX - (labelX + labelWidth + 14) : labelX - 14 - productRight;

    layers.push(
      rect(`callout-line-${index}`, lineX, rowY - 1, lineW, hud ? 1 : 2, hud ? p.text : p.accent, {
        opacity: hud ? 0.5 : 0.55,
        z: 6,
      }),
    );

    if (hud) {
      layers.push(rect(`callout-dot-${index}`, anchorX - 6, rowY - 6, 12, 12, p.accent, { z: 6 }));
    } else {
      layers.push(
        { id: `callout-dot-${index}`, type: "shape", shape: "ellipse", fill: p.accent, x: anchorX - 17, y: rowY - 17, width: 34, height: 34, zIndex: 6 },
        ...text({
          id: `callout-number-${index}`,
          role: "custom",
          content: String(index + 1),
          x: anchorX - 17,
          y: rowY - 11,
          maxWidth: 34,
          fontFamily: body,
          fontSize: 16,
          fontWeight: 700,
          color: p.onAccent,
          textAlign: "center",
          maxLines: 1,
          zIndex: 7,
        }).layers,
      );
    }

    layers.push(
      ...text({
        id: `callout-label-${index}`,
        role: callout.value ? "custom" : "sellingPoint",
        content: callout.value ? callout.label.toUpperCase() : callout.label,
        x: labelX,
        y: blockY,
        maxWidth: labelWidth,
        fontFamily: body,
        fontSize: nameSize,
        fontWeight: callout.value ? 600 : 500,
        color: callout.value ? p.accent : p.text,
        textAlign: align,
        letterSpacing: callout.value ? 1.4 : undefined,
        lineHeight: 1.3,
        maxLines: callout.value ? 1 : 3,
        zIndex: 6,
      }).layers,
    );

    if (callout.value && valueMetrics) {
      layers.push(
        ...text({
          id: `callout-value-${index}`,
          role: "sellingPoint",
          content: callout.value,
          x: labelX,
          y: blockY + nameMetrics.height + 4,
          maxWidth: labelWidth,
          fontFamily: body,
          fontSize: 20,
          fontWeight: 700,
          color: p.text,
          textAlign: align,
          lineHeight: 1.25,
          maxLines: 2,
          zIndex: 6,
        }).layers,
      );
    }
  });

  // Price and button close the composition, centred under the product.
  let footerY = 846;

  const price = find(blocks, "priceBlock");
  if (price) {
    placed.push(price);
    const built = renderBlock(price, { style: s, x: 240, width: 600, y: footerY, align: "center", key: "callout-price" });
    layers.push(...built.layers);
    footerY += built.height + 16;
  }

  const cta = find(blocks, "cta");
  if (cta) {
    placed.push(cta);
    layers.push(...ctaButton(cta.text, s, { id: "cta-label", x: C / 2, y: footerY, anchor: "center", maxWidth: 560 }).layers);
  }

  return { layers, placed };
}
