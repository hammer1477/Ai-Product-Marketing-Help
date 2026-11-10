// Verifies the product-card fix with a wide/landscape product photo (the
// exact shape that used to get zoomed-and-cropped under fit:"cover").
// Run with: npx tsx lib/design-schema/render/test-wide-product.ts
import { writeFile } from "node:fs/promises";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { loadFonts } from "./fonts";
import { composePosterSchema } from "../../orchestration/templates/poster";
import { STYLE_PRESETS } from "../../orchestration/styles";
import { renderSchemaToPng } from "./renderPng";
import type { CreativeContent } from "../../orchestration/types";

async function makeWideTestPhoto(): Promise<string> {
  // A wide "product" rectangle (like headphones laid out horizontally) on
  // a plain backdrop, so we can see whether the full shape stays visible.
  const fonts = await loadFonts();
  const tree = {
    type: "div",
    props: {
      style: { width: 1600, height: 700, background: "#ffffff", display: "flex" },
      children: {
        type: "div",
        props: {
          style: {
            display: "flex",
            position: "absolute",
            left: 40,
            top: 220,
            width: 1520,
            height: 260,
            backgroundColor: "#1e3a5f",
            borderRadius: 130,
          },
        },
      },
    },
  };
  const svg = await satori(tree as any, { width: 1600, height: 700, fonts });
  const png = new Resvg(svg).render().asPng();
  return `data:image/png;base64,${png.toString("base64")}`;
}

const content: CreativeContent = {
  headline: "Experience Legendary Sound Anywhere",
  productName: "Wireless Headphones",
  description:
    "Enjoy up to 57 hours of wireless playback with renowned Pure Bass sound and Bluetooth 5.3.",
  sellingPoints: ["57 hours of battery life", "Bluetooth 5.3 streaming"],
  ctaLabel: "Buy now",
  badgeLabel: "JBL",
};

async function main() {
  const widePhoto = await makeWideTestPhoto();
  const schema = composePosterSchema(content, widePhoto, "standard", STYLE_PRESETS.modernTech);
  const png = await renderSchemaToPng(schema, { scale: 1.5 });
  const outPath = path.join(process.cwd(), "lib/design-schema/render/test-output-wide-product.png");
  await writeFile(outPath, png);
  console.log(`Rendered ${png.length} bytes -> ${outPath}`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
