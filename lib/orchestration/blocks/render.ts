import type { DesignLayer } from "../../design-schema/types";
import type { IconKey } from "../../design-schema/render/icons";
import { measureTextBlock, measureTextWidth } from "../../design-schema/measureText";
import type { ResolvedStyle } from "../styles";
import { COPY_Z, pill, text, type Built } from "../templates/layoutKit";
import type { Block } from "./types";

// One renderer per block type. Every one returns its measured height, which
// is the contract the stacking engine depends on — a block that reports a
// height smaller than it draws is the only way text can overlap again.

const FEATURE_ICONS: IconKey[] = ["check", "star", "shield", "sparkles", "leaf", "truck", "heart", "tag"];

export type BlockContext = {
  style: ResolvedStyle;
  x: number;
  width: number;
  y: number;
  align: "left" | "center";
  /** Index within the stack, so repeated blocks get unique layer ids. */
  key: string;
};

export function renderBlock(block: Block, ctx: BlockContext): Built {
  switch (block.type) {
    case "badge":
      return renderBadge(block.text, ctx);
    case "headline":
      return renderHeadline(block.text, ctx);
    case "description":
      return renderDescription(block.text, ctx);
    case "featureList":
      return renderFeatureList(block.items, ctx);
    case "specGrid":
      return renderSpecGrid(block.items, ctx);
    case "statRow":
      return renderStatRow(block.items, ctx);
    case "priceBlock":
      return renderPriceBlock(block, ctx);
    case "rating":
      return renderRating(block.stars, block.caption, ctx);
    case "trustStrip":
      return renderTrustStrip(block.items, ctx);
    case "cta":
      return renderCta(block.text, ctx);
    case "divider":
      return renderDivider(ctx);
  }
}

/** Vertical gap to leave *after* a block, in px. */
export function gapAfter(block: Block, next: Block | undefined): number {
  if (!next) return 0;
  if (block.type === "badge") return 24;
  if (block.type === "headline") return next.type === "description" ? 20 : 26;
  if (block.type === "divider") return 24;
  if (next.type === "divider") return 24;
  if (next.type === "cta") return 32;
  return 22;
}

// ---------------------------------------------------------------------------

function centreX(ctx: BlockContext): number {
  return ctx.x + ctx.width / 2;
}

function renderBadge(label: string, ctx: BlockContext): Built {
  return pill({
    id: `${ctx.key}-badge`,
    role: "badgeLabel",
    label: label.toUpperCase(),
    x: ctx.align === "center" ? centreX(ctx) : ctx.x,
    y: ctx.y,
    anchor: ctx.align === "center" ? "center" : "left",
    fill: "transparent",
    stroke: ctx.style.accent,
    textColor: ctx.style.accent,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: 2.4,
    paddingX: 22,
    maxWidth: ctx.width,
  });
}

function renderHeadline(content: string, ctx: BlockContext): Built {
  // Display size scales with the column: the same 58px that reads as
  // confident in a 450px column is cramped across 780px.
  const base = ctx.width > 640 ? 54 : ctx.width > 520 ? 60 : 52;
  const size = ctx.style.headlineFont === "Playfair Display" ? base + 4 : base;

  return text({
    id: `${ctx.key}-headline`,
    role: "headline",
    content,
    x: ctx.x,
    y: ctx.y,
    maxWidth: ctx.width,
    fontFamily: ctx.style.headlineFont,
    fontSize: size,
    fontWeight: ctx.style.headlineWeight,
    color: ctx.style.textPrimary,
    textAlign: ctx.align,
    lineHeight: 1.1,
    maxLines: 4,
    autoFit: true,
    minFontSize: Math.round(size * 0.55),
  });
}

function renderDescription(content: string, ctx: BlockContext): Built {
  return text({
    id: `${ctx.key}-description`,
    role: "description",
    content,
    x: ctx.x,
    y: ctx.y,
    maxWidth: ctx.width,
    fontFamily: "Inter",
    fontSize: 20,
    fontWeight: 400,
    color: ctx.style.textMuted,
    textAlign: ctx.align,
    lineHeight: 1.5,
    maxLines: 3,
  });
}

function renderFeatureList(items: string[], ctx: BlockContext): Built {
  const layers: DesignLayer[] = [];
  const iconSize = 20;
  const indent = ctx.align === "center" ? 0 : iconSize + 14;
  let cursor = ctx.y;
  let widest = 0;

  items.forEach((item, i) => {
    const row = text({
      id: `${ctx.key}-feature-${i}`,
      role: "sellingPoint",
      content: item,
      x: ctx.x + indent,
      y: cursor,
      maxWidth: ctx.width - indent,
      fontFamily: "Inter",
      fontSize: 17,
      fontWeight: 500,
      color: ctx.style.textPrimary,
      textAlign: ctx.align,
      lineHeight: 1.35,
      maxLines: 2,
    });

    if (ctx.align !== "center") {
      layers.push({
        id: `${ctx.key}-feature-icon-${i}`,
        type: "icon",
        iconKey: FEATURE_ICONS[i % FEATURE_ICONS.length],
        color: ctx.style.accent,
        x: ctx.x,
        y: Math.round(cursor + 2),
        width: iconSize,
        height: iconSize,
        zIndex: COPY_Z,
      });
    }

    layers.push(...row.layers);
    widest = Math.max(widest, row.width + indent);
    // Advance by the row's own measured height, so a bullet that wraps to
    // two lines pushes the next one down instead of printing through it.
    cursor += row.height + 14;
  });

  return { layers, height: cursor - ctx.y - 14, width: widest };
}

function renderSpecGrid(items: { label: string; value: string }[], ctx: BlockContext): Built {
  // Two columns when the column is wide enough to keep each cell readable,
  // otherwise one. This is the densest block in the library — it's how a
  // poster carries eight real facts without looking like a wall of text.
  const columns = ctx.width >= 420 ? 2 : 1;
  const gutter = 24;
  const cellWidth = Math.floor((ctx.width - gutter * (columns - 1)) / columns);
  const layers: DesignLayer[] = [];

  const rowHeights: number[] = [];
  const cells = items.map((item, i) => {
    const column = i % columns;
    const row = Math.floor(i / columns);

    const labelMetrics = measureTextBlock(item.label.toUpperCase(), cellWidth, {
      fontFamily: "Inter",
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: 1.4,
      lineHeight: 1.3,
      maxLines: 1,
    });
    const valueMetrics = measureTextBlock(item.value, cellWidth, {
      fontFamily: "Inter",
      fontSize: 19,
      fontWeight: 700,
      lineHeight: 1.25,
      maxLines: 2,
    });

    const height = labelMetrics.height + 6 + valueMetrics.height;
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, height);
    return { item, column, row, labelMetrics, valueMetrics };
  });

  // Row offsets are cumulative over the *tallest* cell in each row, so a
  // two-line value on the left can't collide with the row beneath it.
  const rowOffsets: number[] = [];
  let offset = 0;
  rowHeights.forEach((height, index) => {
    rowOffsets[index] = offset;
    offset += height + 20;
  });

  for (const cell of cells) {
    const cellX = ctx.x + cell.column * (cellWidth + gutter);
    const cellY = ctx.y + rowOffsets[cell.row];

    layers.push(
      ...text({
        id: `${ctx.key}-spec-label-${cell.row}-${cell.column}`,
        role: "custom",
        content: cell.item.label.toUpperCase(),
        x: cellX,
        y: cellY,
        maxWidth: cellWidth,
        fontFamily: "Inter",
        fontSize: 12,
        fontWeight: 600,
        color: ctx.style.accent,
        textAlign: ctx.align,
        letterSpacing: 1.4,
        lineHeight: 1.3,
        maxLines: 1,
      }).layers,
      ...text({
        id: `${ctx.key}-spec-value-${cell.row}-${cell.column}`,
        role: "sellingPoint",
        content: cell.item.value,
        x: cellX,
        y: cellY + cell.labelMetrics.height + 6,
        maxWidth: cellWidth,
        fontFamily: "Inter",
        fontSize: 19,
        fontWeight: 700,
        color: ctx.style.textPrimary,
        textAlign: ctx.align,
        lineHeight: 1.25,
        maxLines: 2,
      }).layers,
    );
  }

  return { layers, height: Math.max(0, offset - 20), width: ctx.width };
}

function renderStatRow(items: { label: string; value: string }[], ctx: BlockContext): Built {
  const columns = Math.min(items.length, 3);
  const gutter = 18;
  const cellWidth = Math.floor((ctx.width - gutter * (columns - 1)) / columns);
  const layers: DesignLayer[] = [];

  // Figures are the loudest thing in the library, so they get display
  // weight and the accent colour — a poster needs at most one of these.
  const valueSize = cellWidth > 200 ? 44 : 36;
  let tallest = 0;

  items.slice(0, columns).forEach((item, i) => {
    const cellX = ctx.x + i * (cellWidth + gutter);

    const value = text({
      id: `${ctx.key}-stat-value-${i}`,
      role: "custom",
      content: item.value,
      x: cellX,
      y: ctx.y,
      maxWidth: cellWidth,
      fontFamily: "Inter",
      fontSize: valueSize,
      fontWeight: 800,
      color: ctx.style.accent,
      textAlign: ctx.align === "center" ? "center" : "left",
      lineHeight: 1.05,
      maxLines: 1,
      autoFit: true,
      minFontSize: 24,
    });

    const caption = text({
      id: `${ctx.key}-stat-label-${i}`,
      role: "sellingPoint",
      content: item.label,
      x: cellX,
      y: ctx.y + value.height + 6,
      maxWidth: cellWidth,
      fontFamily: "Inter",
      fontSize: 14,
      fontWeight: 500,
      color: ctx.style.textMuted,
      textAlign: ctx.align === "center" ? "center" : "left",
      lineHeight: 1.3,
      maxLines: 2,
    });

    layers.push(...value.layers, ...caption.layers);
    tallest = Math.max(tallest, value.height + 6 + caption.height);
  });

  return { layers, height: tallest, width: ctx.width };
}

function renderPriceBlock(
  block: { value: string; compareAt?: string; note?: string },
  ctx: BlockContext,
): Built {
  const layers: DesignLayer[] = [];
  const priceSize = 46;

  const price = text({
    id: `${ctx.key}-price`,
    role: "custom",
    content: block.value,
    x: ctx.x,
    y: ctx.y,
    maxWidth: ctx.width,
    fontFamily: "Inter",
    fontSize: priceSize,
    fontWeight: 800,
    color: ctx.style.textPrimary,
    textAlign: ctx.align,
    lineHeight: 1.1,
    maxLines: 1,
    autoFit: true,
    minFontSize: 28,
  });
  layers.push(...price.layers);

  let width = price.width;

  // The comparison price sits on the price's baseline rather than under it,
  // which is how it reads as "was X, now Y" instead of two separate facts.
  if (block.compareAt) {
    const compareSize = 22;
    const compareX =
      ctx.align === "center"
        ? Math.round(centreX(ctx) + price.width / 2 + 14)
        : Math.round(ctx.x + price.width + 14);
    const compareWidth = Math.ceil(
      measureTextWidth(block.compareAt, {
        fontFamily: "Inter",
        fontSize: compareSize,
        fontWeight: 500,
      }),
    );

    if (compareX + compareWidth <= ctx.x + ctx.width) {
      layers.push(
        ...text({
          id: `${ctx.key}-price-compare`,
          role: "custom",
          content: block.compareAt,
          x: compareX,
          y: Math.round(ctx.y + price.height - compareSize * 1.25),
          maxWidth: compareWidth,
          fontFamily: "Inter",
          fontSize: compareSize,
          fontWeight: 500,
          color: ctx.style.textMuted,
          textAlign: "left",
          lineHeight: 1.2,
          maxLines: 1,
        }).layers,
        // Satori has no text-decoration, so the strike is drawn.
        {
          id: `${ctx.key}-price-strike`,
          type: "shape",
          shape: "rect",
          fill: ctx.style.textMuted,
          opacity: 0.85,
          x: compareX,
          y: Math.round(ctx.y + price.height - compareSize * 0.68),
          width: compareWidth,
          height: 2,
          zIndex: COPY_Z + 1,
        },
      );
      width += compareWidth + 14;
    }
  }

  let height = price.height;

  if (block.note) {
    const note = text({
      id: `${ctx.key}-price-note`,
      role: "custom",
      content: block.note,
      x: ctx.x,
      y: ctx.y + price.height + 4,
      maxWidth: ctx.width,
      fontFamily: "Inter",
      fontSize: 14,
      fontWeight: 400,
      color: ctx.style.textMuted,
      textAlign: ctx.align,
      lineHeight: 1.3,
      maxLines: 1,
    });
    layers.push(...note.layers);
    height += 4 + note.height;
  }

  return { layers, height, width };
}

function renderRating(stars: number, caption: string, ctx: BlockContext): Built {
  const layers: DesignLayer[] = [];
  const starSize = 19;
  const starGap = 5;
  const starsWidth = stars * starSize + (stars - 1) * starGap;
  const captionWidth = Math.ceil(
    measureTextWidth(caption, { fontFamily: "Inter", fontSize: 15, fontWeight: 500 }),
  );
  const totalWidth = starsWidth + 12 + captionWidth;

  const startX =
    ctx.align === "center" ? Math.round(centreX(ctx) - totalWidth / 2) : ctx.x;

  for (let i = 0; i < stars; i++) {
    layers.push({
      id: `${ctx.key}-star-${i}`,
      type: "icon",
      iconKey: "star",
      color: ctx.style.accent,
      x: startX + i * (starSize + starGap),
      y: ctx.y,
      width: starSize,
      height: starSize,
      zIndex: COPY_Z,
    });
  }

  layers.push(
    ...text({
      id: `${ctx.key}-rating-caption`,
      role: "custom",
      content: caption,
      x: startX + starsWidth + 12,
      y: ctx.y + 1,
      maxWidth: captionWidth + 4,
      fontFamily: "Inter",
      fontSize: 15,
      fontWeight: 500,
      color: ctx.style.textMuted,
      textAlign: "left",
      lineHeight: 1.2,
      maxLines: 1,
    }).layers,
  );

  return { layers, height: starSize + 2, width: totalWidth };
}

function renderTrustStrip(items: string[], ctx: BlockContext): Built {
  // Rendered as one dot-separated line so it reads as a quiet footer rather
  // than competing with the feature list above it.
  const content = items.join("  ·  ");
  return text({
    id: `${ctx.key}-trust`,
    role: "custom",
    content,
    x: ctx.x,
    y: ctx.y,
    maxWidth: ctx.width,
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: 500,
    color: ctx.style.textMuted,
    textAlign: ctx.align,
    lineHeight: 1.4,
    maxLines: 2,
  });
}

function renderCta(label: string, ctx: BlockContext): Built {
  return pill({
    id: `${ctx.key}-cta`,
    role: "ctaLabel",
    label: label.toUpperCase(),
    x: ctx.align === "center" ? centreX(ctx) : ctx.x,
    y: ctx.y,
    anchor: ctx.align === "center" ? "center" : "left",
    fill: ctx.style.accent,
    textColor: ctx.style.ctaTextColor,
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 1.6,
    paddingX: 34,
    maxWidth: ctx.width,
  });
}

function renderDivider(ctx: BlockContext): Built {
  const width = ctx.align === "center" ? 120 : Math.round(ctx.width * 0.42);
  return {
    layers: [
      {
        id: `${ctx.key}-divider`,
        type: "shape",
        shape: "rect",
        fill: ctx.style.accent,
        opacity: 0.45,
        x: ctx.align === "center" ? Math.round(centreX(ctx) - width / 2) : ctx.x,
        y: ctx.y,
        width,
        height: 2,
        zIndex: COPY_Z,
      },
    ],
    height: 2,
    width,
  };
}
