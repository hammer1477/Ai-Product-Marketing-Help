// Verifies the real pipeline: Pollinations background + scrim + real
// (placeholder) product photo, composed and rendered end-to-end.
// Run with: npx tsx lib/design-schema/render/test-real-background.ts
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { composePosterSchema } from "../../orchestration/templates/poster";
import { STYLE_PRESETS } from "../../orchestration/styles";
import { PollinationsImageGenerationProvider } from "../../ai/providers/pollinations/image";
import { renderSchemaToPng } from "./renderPng";
import type { CreativeContent } from "../../orchestration/types";

const content: CreativeContent = {
  headline: "Radiant Skin Starts Here",
  productName: "Glow Serum",
  description:
    "A lightweight daily serum with vitamin C and hyaluronic acid, formulated for visible brightness in two weeks.",
  sellingPoints: ["Dermatologist tested", "Results in 14 days"],
  ctaLabel: "Shop now",
  badgeLabel: "Limited offer",
};

const PLACEHOLDER_PRODUCT_PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUAAWJDPpUAAAAASUVORK5CYII=";

async function main() {
  const style = STYLE_PRESETS.luxury;
  const provider = new PollinationsImageGenerationProvider();

  console.log("Generating background:", style.backgroundPrompt);
  const { imageUrl: backgroundImageUrl } = await provider.generate({
    prompt: style.backgroundPrompt,
    mode: "text-to-image",
    width: 580,
    height: 1080,
  });

  const schema = composePosterSchema(
    content,
    PLACEHOLDER_PRODUCT_PHOTO,
    "standard",
    style,
    backgroundImageUrl,
  );

  const png = await renderSchemaToPng(schema, { scale: 1.5 });
  const outPath = path.join(process.cwd(), "lib/design-schema/render/test-output-real-bg.png");
  await writeFile(outPath, png);
  console.log(`Rendered ${png.length} bytes -> ${outPath}`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
