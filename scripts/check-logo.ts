// Verifies the brand logo is never covered, never overlaps copy, the product
// or stickers, and never leaves the canvas — every template, every format.
// Riding on top of a tape is allowed (the logo is drawn above it).
//   npx tsx scripts/check-logo.ts

import sharp from "sharp";
import { composeDesignSchema } from "../lib/orchestration/composeDesignSchema";
import { resolveStyle, STYLE_PRESETS } from "../lib/orchestration/styles";
import { TEMPLATES } from "../lib/orchestration/templates/registry";
import { removeProductBackdrop, trimTransparentEdges } from "../lib/images/cutout";
import type { DesignLayer } from "../lib/design-schema/types";

const blocks = [
  { type: "badge", text: "GIFT IDEA" },
  { type: "headline", text: "Bring home a sweet surprise" },
  { type: "subheadline", text: "Made with fresh strawberries and rich cream." },
  { type: "description", text: "Soft sponge layers and smooth frosting topped with fresh fruit." },
  { type: "featureList", items: ["Fresh strawberries on top", "Smooth creamy frosting", "Soft moist sponge layers"], icons: ["heart", "sparkle", "check"] },
  { type: "specGrid", items: [{ label: "Fruit", value: "Fresh strawberries inside and top" }, { label: "Shape", value: "Round layer cake" }] },
  { type: "priceBlock", value: "650 EGP" },
  { type: "cta", text: "Order now" },
];

function bounds(l: DesignLayer) {
  if (!l.rotation) return { x: l.x, y: l.y, w: l.width, h: l.height };
  const a = (l.rotation * Math.PI) / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const w = l.width * c + l.height * s, h = l.width * s + l.height * c;
  return { x: l.x + l.width / 2 - w / 2, y: l.y + l.height / 2 - h / 2, w, h };
}
function inside(l: DesignLayer, px: number, py: number) {
  let x = px, y = py;
  if (l.rotation) {
    const a = (-l.rotation * Math.PI) / 180, cx = l.x + l.width / 2, cy = l.y + l.height / 2;
    x = cx + (px - cx) * Math.cos(a) - (py - cy) * Math.sin(a);
    y = cy + (px - cx) * Math.sin(a) + (py - cy) * Math.cos(a);
  }
  return x >= l.x && x <= l.x + l.width && y >= l.y && y <= l.y + l.height;
}
/** Fraction of the logo box covered by layer l (sampled). */
function coverage(box: { x: number; y: number; width: number; height: number }, l: DesignLayer) {
  const b = bounds(l);
  if (b.x > box.x + box.width || b.x + b.w < box.x || b.y > box.y + box.height || b.y + b.h < box.y) return 0;
  let n = 0;
  for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) if (inside(l, box.x + (i + 0.5) / 10 * box.width, box.y + (j + 0.5) / 10 * box.height)) n++;
  return n / 100;
}

async function main() {
  const cake = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1000"><rect x="150" y="380" width="900" height="320" rx="40" fill="#f3e6d0"/><ellipse cx="600" cy="380" rx="450" ry="90" fill="#d7263d"/></svg>`)).png().toBuffer();
  const cut = await removeProductBackdrop(`data:image/png;base64,${cake.toString("base64")}`);
  const tr = await trimTransparentEdges(cut.dataUri);
  const mark = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120"><circle cx="60" cy="60" r="44" fill="#fff"/><rect x="120" y="40" width="160" height="40" fill="#fff"/></svg>`)).png().toBuffer();
  const logo = { src: `data:image/png;base64,${mark.toString("base64")}`, aspect: 2.5, tone: "light" as const };
  const style = resolveStyle(STYLE_PRESETS.modernTech, { colorInk: "#d62828", colorAccent: "#ffffff", colorTextPrimary: "#ffffff", colorTextMuted: "#ffe5e5", moodLabel: "x", scenePrompt: "x" } as never);
  let problems = 0, checked = 0;
  for (const format of ["square", "portrait", "story", "landscape"] as const) {
    for (const t of TEMPLATES) {
      const schema = composeDesignSchema({
        content: { headline: "Bring home a sweet surprise", productName: "Strawberry Cake", description: "", sellingPoints: [], ctaLabel: "Order now", badgeLabel: "Gift idea", blocks } as never,
        productCutoutUrl: tr.dataUri, cutoutApplied: true, productAspectRatio: tr.width / tr.height,
        decision: { concept: "graphic_poster", density: "detailed" }, style: { ...style, templateId: t.id, format }, logo,
      });
      checked++;
      const L = schema.layers.find((l) => l.id === "brand-logo")!;
      const above = schema.layers.filter((l) => l.zIndex > L.zIndex);
      const box = { x: L.x, y: L.y, width: L.width, height: L.height };
      const hits = schema.layers
        .filter((l) => !l.id.startsWith("brand-logo") && !l.id.startsWith("tape"))
        .filter((l) => l.type === "text" || l.id.startsWith("product-photo") || l.id.startsWith("sticker") || (l.type === "shape" && l.zIndex >= 8))
        .map((l) => [l.id, coverage(box, l)] as const)
        .filter(([, c]) => c > 0);
      const offCanvas = L.x < 0 || L.y < 0 || L.x + L.width > schema.canvas.width || L.y + L.height > schema.canvas.height;
      if (above.length || hits.length || offCanvas) {
        problems++;
        console.log(`${format.padEnd(9)} ${t.id.padEnd(18)} above:[${above.map((l) => l.id)}] overlaps:[${hits.map(([id, c]) => `${id} ${Math.round(c * 100)}%`)}]${offCanvas ? " OFF-CANVAS" : ""}`);
      }
    }
  }
  console.log(`checked ${checked}, problems ${problems}`);
}
main().then(() => undefined, (e) => { console.error(e); process.exit(1); });
