// Renders every layout to PNG without touching the database, Supabase or
// the job pipeline — the fast way to see a design change.
//
//   npx tsx scripts/preview-designs.ts              (flat colour grounds)
//   npx tsx scripts/preview-designs.ts --background  (real generated scenes)
//
// Output lands in scripts/preview-output/ (gitignored).
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { composeDesignSchema } from "../lib/orchestration/composeDesignSchema";
import { resolveStyle, STYLE_PRESETS } from "../lib/orchestration/styles";
import { renderSchemaToPng } from "../lib/design-schema/render/renderPng";
import { removeProductBackdrop, trimTransparentEdges } from "../lib/images/cutout";
import type { ArtDirection, CreativeContent, LayoutVariant } from "../lib/orchestration/types";

const OUT_DIR = path.join(process.cwd(), "scripts/preview-output");
const USE_BACKGROUND = process.argv.includes("--background");

const content: CreativeContent = {
  headline: "Experience Legendary Sound with Wireless Freedom",
  productName: "JBL Tune 520BT",
  description:
    "Up to 57 hours of battery life and renowned JBL Pure Bass sound, with Bluetooth 5.3 for effortless streaming.",
  sellingPoints: [
    "57 hours of playback",
    "JBL Pure Bass sound",
    "Bluetooth 5.3 streaming",
    "Speed Charge: 5 min, 3 hours",
  ],
  // Deliberately long, with a price — this is the CTA that used to overflow
  // its fixed-width pill.
  ctaLabel: "Buy now for 3000 EGP",
  badgeLabel: "JBL",
  // A dense composition, standing in for what the model returns. Exercises
  // every block type so a layout change can be checked against the worst
  // case rather than the easy one.
  blocks: [
    { type: "badge", text: "JBL" },
    { type: "headline", text: "Experience Legendary Sound with Wireless Freedom" },
    { type: "description", text: "Renowned JBL Pure Bass sound, now completely untethered." },
    {
      type: "statRow",
      items: [
        { label: "Battery life", value: "57h" },
        { label: "Fast charge", value: "5 min" },
        { label: "Bluetooth", value: "5.3" },
      ],
    },
    { type: "divider" },
    {
      type: "specGrid",
      items: [
        { label: "Driver", value: "33 mm dynamic" },
        { label: "Weight", value: "160 g" },
        { label: "Charging", value: "USB-C" },
        { label: "Controls", value: "Voice Aware" },
      ],
    },
    { type: "rating", stars: 5, caption: "4.8 · 2,300 reviews" },
    { type: "priceBlock", value: "3,000 EGP", compareAt: "3,800", note: "incl. VAT" },
    {
      type: "trustStrip",
      items: [{ text: "Free delivery" }, { text: "2-year warranty" }, { text: "30-day returns" }],
    },
    { type: "cta", text: "Buy now" },
  ],
};

const direction: ArtDirection = {
  scenePrompt:
    "dark cinematic recording studio, deep blue and teal light, glowing acoustic panels, " +
    "volumetric haze, reflective floor, dramatic rim lighting",
  layout: "split",
  headlineFont: "Inter",
  colorInk: "#070d18",
  colorAccent: "#38bdf8",
  colorTextPrimary: "#f1f6fd",
  colorTextMuted: "#9fb2cc",
  moodLabel: "midnight studio",
};

/** A product photo on a white sweep, so the cutout path is exercised. */
async function makeProductPhoto(): Promise<string> {
  const sharp = (await import("sharp")).default;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700">
    <rect width="900" height="700" fill="#ffffff"/>
    <ellipse cx="300" cy="400" rx="130" ry="150" fill="#1e3a5f"/>
    <ellipse cx="600" cy="400" rx="130" ry="150" fill="#1e3a5f"/>
    <rect x="285" y="150" width="330" height="40" rx="20" fill="#2a4d7a"/>
    <rect x="270" y="170" width="40" height="240" fill="#2a4d7a"/>
    <rect x="590" y="170" width="40" height="240" fill="#2a4d7a"/>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

async function fetchScene(prompt: string): Promise<string | undefined> {
  try {
    const { PollinationsImageGenerationProvider } = await import(
      "../lib/ai/providers/pollinations/image"
    );
    const result = await new PollinationsImageGenerationProvider().generate({
      prompt,
      mode: "text-to-image",
      width: 1080,
      height: 1080,
    });
    const { toDataUri } = await import("../lib/orchestration/toDataUri");
    return await toDataUri(result.imageUrl);
  } catch (err) {
    console.warn("  scene generation failed, falling back to flat ground:", (err as Error).message);
    return undefined;
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const original = await makeProductPhoto();
  const cut = await removeProductBackdrop(original);
  const trimmed = cut.cutoutApplied ? await trimTransparentEdges(cut.dataUri) : null;
  const cutout = trimmed ? trimmed.dataUri : original;
  const aspectRatio = trimmed ? trimmed.width / trimmed.height : cut.width / cut.height;
  console.log(`Cutout applied: ${cut.cutoutApplied} (aspect ${aspectRatio.toFixed(2)})`);

  const background = USE_BACKGROUND ? await fetchScene(direction.scenePrompt) : undefined;

  const cases: Array<{ name: string; layout: LayoutVariant; infographic?: true }> = [
    { name: "split", layout: "split" },
    { name: "spotlight", layout: "spotlight" },
    { name: "editorial", layout: "editorial" },
    { name: "infographic", layout: "split", infographic: true },
  ];

  for (const testCase of cases) {
    const isInfographic = testCase.infographic === true;
    const style = resolveStyle(STYLE_PRESETS.modernTech, {
      ...direction,
      layout: testCase.layout,
    });

    const schema = composeDesignSchema({
      content,
      productImageUrl: original,
      productCutoutUrl: cutout,
      cutoutApplied: cut.cutoutApplied,
      productAspectRatio: aspectRatio,
      decision: {
        concept: isInfographic ? "infographic" : "graphic_poster",
        density: "detailed",
      },
      style,
      backgroundImageUrl: background,
    });

    const png = await renderSchemaToPng(schema, { scale: 1 });
    const outPath = path.join(OUT_DIR, `${testCase.name}.png`);
    await writeFile(outPath, png);
    console.log(`  ${testCase.name.padEnd(12)} ${png.length} bytes -> ${outPath}`);
  }
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
