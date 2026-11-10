// Renders one poster per style preset using the same mock content, to
// visually confirm category-driven styling actually looks different.
// Run with: npx tsx lib/design-schema/render/test-styles.ts
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { composePosterSchema } from "../../orchestration/templates/poster";
import { STYLE_PRESETS } from "../../orchestration/styles";
import { renderSchemaToPng } from "./renderPng";
import type { CreativeContent } from "../../orchestration/types";

const content: CreativeContent = {
  headline: "Radiant Skin Starts Here",
  productName: "Glow Serum",
  description:
    "A lightweight daily serum with vitamin C and hyaluronic acid, formulated for visible brightness in two weeks.",
  sellingPoints: ["Dermatologist tested", "Results in 14 days", "Cruelty free", "Vegan formula"],
  ctaLabel: "Shop now",
  badgeLabel: "Limited offer",
};

const PLACEHOLDER_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUAAWJDPpUAAAAASUVORK5CYII=";

async function main() {
  for (const style of Object.values(STYLE_PRESETS)) {
    const schema = composePosterSchema(content, PLACEHOLDER_IMAGE, "standard", style);
    const png = await renderSchemaToPng(schema, { scale: 1.5 });
    const outPath = path.join(process.cwd(), `lib/design-schema/render/test-output-${style.key}.png`);
    await writeFile(outPath, png);
    console.log(`${style.key}: ${png.length} bytes -> ${outPath}`);
  }
}

main().catch((err) => {
  console.error("Style render failed:", err);
  process.exit(1);
});
