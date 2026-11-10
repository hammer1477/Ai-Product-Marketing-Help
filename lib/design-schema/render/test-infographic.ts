// Run with: npx tsx lib/design-schema/render/test-infographic.ts
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { composeInfographicSchema } from "../../orchestration/templates/infographic";
import { STYLE_PRESETS } from "../../orchestration/styles";
import { renderSchemaToPng } from "./renderPng";
import type { CreativeContent } from "../../orchestration/types";

const content: CreativeContent = {
  headline: "Precision Sound, Engineered for You",
  productName: "Wireless Headphones",
  description: "Premium wireless headphones with industry-leading noise cancellation.",
  sellingPoints: [
    "57 hours of battery life",
    "Bluetooth 5.3 streaming",
    "Active noise cancellation",
    "Hands-free voice calls",
    "Custom EQ via companion app",
  ],
  ctaLabel: "Shop now",
};

const PLACEHOLDER_PRODUCT_PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUAAWJDPpUAAAAASUVORK5CYII=";

async function main() {
  const schema = composeInfographicSchema(content, PLACEHOLDER_PRODUCT_PHOTO, STYLE_PRESETS.modernTech);
  const png = await renderSchemaToPng(schema, { scale: 1.5 });
  const outPath = path.join(process.cwd(), "lib/design-schema/render/test-output-infographic.png");
  await writeFile(outPath, png);
  console.log(`Rendered ${png.length} bytes -> ${outPath}`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
