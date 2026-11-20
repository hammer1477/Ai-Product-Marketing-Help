// Renders the landing page's example ads with the real template engine.
//
//   npx tsx scripts/render-showcase.ts
//
// The products are fictional and drawn as vectors here, so the marketing
// site never shows a customer's upload. Output: public/showcase/*.webp.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { composeDesignSchema } from "../lib/orchestration/composeDesignSchema";
import { PALETTES, resolveStyle, STYLE_PRESETS } from "../lib/orchestration/styles";
import { renderSchemaToPng } from "../lib/design-schema/render/renderPng";
import { removeProductBackdrop, trimTransparentEdges } from "../lib/images/cutout";
import type { CreativeContent } from "../lib/orchestration/types";
import type { AdFormat } from "../lib/orchestration/formats";

const OUT_DIR = path.join(process.cwd(), "public/showcase");

// ---------------------------------------------------------------------------
// Product drawings, each on a white sweep so the cutout path runs as it would
// for a real studio photo.
// ---------------------------------------------------------------------------

const SERUM = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="1000">
  <defs>
    <linearGradient id="glass" x1="0" x2="1"><stop offset="0" stop-color="#7a3e12"/><stop offset=".35" stop-color="#c9772f"/><stop offset=".6" stop-color="#e39a4f"/><stop offset="1" stop-color="#6b3410"/></linearGradient>
    <linearGradient id="cap" x1="0" x2="1"><stop offset="0" stop-color="#111"/><stop offset=".4" stop-color="#3a3a3a"/><stop offset="1" stop-color="#0a0a0a"/></linearGradient>
    <linearGradient id="bulb" x1="0" x2="1"><stop offset="0" stop-color="#1a1a1a"/><stop offset=".45" stop-color="#4a4a4a"/><stop offset="1" stop-color="#111"/></linearGradient>
  </defs>
  <rect width="700" height="1000" fill="#fff"/>
  <rect x="300" y="90" width="100" height="170" rx="50" fill="url(#bulb)"/>
  <rect x="250" y="250" width="200" height="130" rx="14" fill="url(#cap)"/>
  <rect x="190" y="370" width="320" height="540" rx="56" fill="url(#glass)"/>
  <rect x="215" y="400" width="26" height="470" rx="13" fill="#fff" opacity=".28"/>
  <rect x="220" y="540" width="260" height="250" rx="10" fill="#f6efe6"/>
  <text x="350" y="615" font-family="Georgia, serif" font-size="46" text-anchor="middle" fill="#2a1a12">LUMEN</text>
  <rect x="300" y="640" width="100" height="2" fill="#2a1a12"/>
  <text x="350" y="690" font-family="Arial, sans-serif" font-size="22" letter-spacing="4" text-anchor="middle" fill="#6b4a38">VITAMIN C</text>
  <text x="350" y="725" font-family="Arial, sans-serif" font-size="22" letter-spacing="4" text-anchor="middle" fill="#6b4a38">SERUM 15%</text>
  <text x="350" y="768" font-family="Arial, sans-serif" font-size="16" text-anchor="middle" fill="#9a7a66">30 ml · 1 fl oz</text>
</svg>`;

const BOTTLE = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="1000">
  <defs>
    <linearGradient id="steel" x1="0" x2="1"><stop offset="0" stop-color="#0e3b2c"/><stop offset=".3" stop-color="#1f7a57"/><stop offset=".55" stop-color="#3fb487"/><stop offset="1" stop-color="#0b3326"/></linearGradient>
    <linearGradient id="lid" x1="0" x2="1"><stop offset="0" stop-color="#1b1b1b"/><stop offset=".5" stop-color="#484848"/><stop offset="1" stop-color="#121212"/></linearGradient>
  </defs>
  <rect width="560" height="1000" fill="#fff"/>
  <path d="M220 60 h120 a20 20 0 0 1 20 20 v40 h-160 v-40 a20 20 0 0 1 20 -20z" fill="url(#lid)"/>
  <rect x="195" y="115" width="170" height="110" rx="18" fill="url(#lid)"/>
  <path d="M240 75 q40 -50 80 0" stroke="#2a2a2a" stroke-width="14" fill="none"/>
  <path d="M180 225 h200 q40 40 40 120 v520 a60 60 0 0 1 -60 60 h-160 a60 60 0 0 1 -60 -60 v-520 q0 -80 40 -120z" fill="url(#steel)"/>
  <rect x="165" y="300" width="22" height="580" rx="11" fill="#fff" opacity=".22"/>
  <text x="280" y="620" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="56" text-anchor="middle" fill="#eafff5" transform="rotate(-90 280 620)">ARC</text>
</svg>`;

const BUDS = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="760">
  <defs>
    <linearGradient id="case" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f4f6"/><stop offset="1" stop-color="#b9bcc6"/></linearGradient>
    <radialGradient id="bud" cx=".35" cy=".35"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#d8dbe3"/><stop offset="1" stop-color="#9da2ae"/></radialGradient>
  </defs>
  <rect width="900" height="760" fill="#fff"/>
  <rect x="160" y="300" width="580" height="380" rx="180" fill="url(#case)" stroke="#8e93a0" stroke-width="3"/>
  <rect x="160" y="300" width="580" height="120" rx="60" fill="#e9eaee" stroke="#8e93a0" stroke-width="3"/>
  <circle cx="450" cy="560" r="10" fill="#38bdf8"/>
  <circle cx="330" cy="230" r="95" fill="url(#bud)" stroke="#9da2ae" stroke-width="3"/>
  <rect x="300" y="290" width="60" height="150" rx="30" fill="url(#bud)" stroke="#9da2ae" stroke-width="3"/>
  <circle cx="570" cy="230" r="95" fill="url(#bud)" stroke="#9da2ae" stroke-width="3"/>
  <rect x="540" y="290" width="60" height="150" rx="30" fill="url(#bud)" stroke="#9da2ae" stroke-width="3"/>
  <circle cx="330" cy="230" r="38" fill="#2b2f3a"/>
  <circle cx="570" cy="230" r="38" fill="#2b2f3a"/>
</svg>`;

const CANDLE = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="860">
  <defs>
    <linearGradient id="jar" x1="0" x2="1"><stop offset="0" stop-color="#3b2418"/><stop offset=".4" stop-color="#7a4a2e"/><stop offset="1" stop-color="#2a1810"/></linearGradient>
    <radialGradient id="flame" cx=".5" cy=".7"><stop offset="0" stop-color="#fff6c8"/><stop offset=".5" stop-color="#ffb347"/><stop offset="1" stop-color="#ff7a1a"/></radialGradient>
  </defs>
  <rect width="760" height="860" fill="#fff"/>
  <path d="M380 70 q60 90 0 170 q-60 -80 0 -170z" fill="url(#flame)"/>
  <rect x="374" y="230" width="12" height="60" fill="#222"/>
  <rect x="150" y="280" width="460" height="520" rx="40" fill="url(#jar)"/>
  <ellipse cx="380" cy="292" rx="220" ry="26" fill="#f1e4cf"/>
  <rect x="175" y="320" width="22" height="440" rx="11" fill="#fff" opacity=".18"/>
  <rect x="210" y="470" width="340" height="190" rx="6" fill="#f3e7d3"/>
  <text x="380" y="545" font-family="Georgia, serif" font-size="50" text-anchor="middle" fill="#2a1810">EMBER</text>
  <text x="380" y="600" font-family="Arial, sans-serif" font-size="20" letter-spacing="5" text-anchor="middle" fill="#7a4a2e">CEDAR · AMBER</text>
  <text x="380" y="635" font-family="Arial, sans-serif" font-size="16" text-anchor="middle" fill="#9b7a62">60 hr burn</text>
</svg>`;

const COFFEE = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="980">
  <defs>
    <linearGradient id="bag" x1="0" x2="1"><stop offset="0" stop-color="#b8451f"/><stop offset=".45" stop-color="#e2683a"/><stop offset="1" stop-color="#9c3716"/></linearGradient>
  </defs>
  <rect width="700" height="980" fill="#fff"/>
  <path d="M170 90 h360 l10 60 h-380z" fill="#8a2f12"/>
  <path d="M160 150 h380 l40 740 a30 30 0 0 1 -30 30 h-400 a30 30 0 0 1 -30 -30z" fill="url(#bag)"/>
  <rect x="180" y="170" width="20" height="700" rx="10" fill="#fff" opacity=".2"/>
  <circle cx="350" cy="430" r="120" fill="#fbeee4"/>
  <ellipse cx="350" cy="430" rx="46" ry="70" fill="#5a2a14" transform="rotate(25 350 430)"/>
  <path d="M330 370 q40 60 0 120" stroke="#fbeee4" stroke-width="8" fill="none" transform="rotate(25 350 430)"/>
  <text x="350" y="640" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="64" text-anchor="middle" fill="#fff4ec">BLOOM</text>
  <text x="350" y="690" font-family="Arial, sans-serif" font-size="24" letter-spacing="6" text-anchor="middle" fill="#ffd9c4">ETHIOPIA · LIGHT ROAST</text>
  <text x="350" y="760" font-family="Arial, sans-serif" font-size="20" text-anchor="middle" fill="#ffd9c4">WHOLE BEAN · 340 g</text>
</svg>`;

// ---------------------------------------------------------------------------

type Shot = {
  file: string;
  product: string;
  template: string;
  palette: string;
  preset: keyof typeof STYLE_PRESETS;
  format: AdFormat;
  content: CreativeContent;
};

const serumCopy: CreativeContent = {
  headline: "Glow that shows up by Friday",
  productName: "Lumen Vitamin C Serum",
  description: "15% stabilised vitamin C with ferulic acid. Brighter, more even skin in seven days.",
  sellingPoints: ["15% vitamin C", "Fragrance free", "Dermatologist tested"],
  ctaLabel: "Shop the serum",
  blocks: [
    { type: "badge", text: "New formula" },
    { type: "headline", text: "Glow that shows up by Friday" },
    { type: "description", text: "15% stabilised vitamin C with ferulic acid for brighter, even skin." },
    { type: "statRow", items: [{ label: "Vitamin C", value: "15%" }, { label: "Visible glow", value: "7 days" }, { label: "Size", value: "30 ml" }] },
    { type: "rating", stars: 5, caption: "4.9 · 1,800 reviews" },
    { type: "priceBlock", value: "$34", compareAt: "$42" },
    { type: "cta", text: "Shop the serum" },
  ],
};

const SHOTS: Array<Shot & { svg: string }> = [
  // The resize demo: one ad, four placements.
  ...(["square", "portrait", "story", "landscape"] as AdFormat[]).map((format) => ({
    file: `serum-${format}`,
    product: "serum",
    svg: SERUM,
    template: "minimal-luxe",
    palette: "Espresso",
    preset: "luxury" as const,
    format,
    content: serumCopy,
  })),
  {
    file: "bottle",
    product: "bottle",
    svg: BOTTLE,
    template: "neo-brutal",
    palette: "Acid",
    preset: "playful",
    format: "square",
    content: {
      headline: "Cold for 24 hours. Seriously.",
      productName: "Arc Insulated Bottle",
      description: "Double-wall steel that keeps ice frozen through a heatwave.",
      sellingPoints: ["24h cold", "12h hot", "Leak-proof lid"],
      ctaLabel: "Grab yours",
      blocks: [
        { type: "badge", text: "Arc" },
        { type: "headline", text: "Cold for 24 hours. Seriously." },
        { type: "featureList", items: [{ text: "24 hours ice cold" }, { text: "12 hours hot" }, { text: "Leak-proof carry lid" }] },
        { type: "priceBlock", value: "$29" },
        { type: "cta", text: "Grab yours" },
      ],
    },
  },
  {
    file: "buds",
    product: "buds",
    svg: BUDS,
    template: "tech-hud",
    palette: "Midnight Cyan",
    preset: "modernTech",
    format: "square",
    content: {
      headline: "Silence, on demand",
      productName: "Pulse Buds",
      description: "Adaptive noise cancelling earbuds with 36-hour battery.",
      sellingPoints: ["Adaptive ANC", "36h battery", "IPX5"],
      ctaLabel: "Pre-order",
      blocks: [
        { type: "headline", text: "Silence, on demand" },
        { type: "specGrid", items: [{ label: "Noise cancel", value: "Adaptive" }, { label: "Battery", value: "36 h" }, { label: "Water", value: "IPX5" }, { label: "Charge", value: "USB-C" }] },
        { type: "priceBlock", value: "$129" },
        { type: "cta", text: "Pre-order" },
      ],
    },
  },
  {
    file: "candle",
    product: "candle",
    svg: CANDLE,
    template: "podium",
    palette: "Noir Gold",
    preset: "warmHome",
    format: "square",
    content: {
      headline: "Slow evenings, bottled",
      productName: "Ember Candle",
      description: "Hand-poured soy wax with cedar and amber. 60 hours of burn.",
      sellingPoints: ["Soy wax", "60h burn", "Cotton wick"],
      ctaLabel: "Light one up",
      blocks: [
        { type: "badge", text: "Hand poured" },
        { type: "headline", text: "Slow evenings, bottled" },
        { type: "trustStrip", items: [{ text: "Soy wax" }, { text: "60 hr burn" }, { text: "Cotton wick" }] },
        { type: "priceBlock", value: "$38" },
        { type: "cta", text: "Light one up" },
      ],
    },
  },
  {
    file: "coffee",
    product: "coffee",
    svg: COFFEE,
    template: "sale-burst",
    palette: "Terracotta",
    preset: "playful",
    format: "square",
    content: {
      headline: "Your morning just got brighter",
      productName: "Bloom Coffee",
      description: "Single-origin Ethiopian beans, roasted light for notes of jasmine and peach.",
      sellingPoints: ["Single origin", "Roasted weekly", "Free shipping"],
      ctaLabel: "Order now",
      blocks: [
        { type: "badge", text: "-25%" },
        { type: "headline", text: "Your morning just got brighter" },
        { type: "description", text: "Light-roast Ethiopian beans with notes of jasmine and peach." },
        { type: "priceBlock", value: "$15", compareAt: "$20" },
        { type: "cta", text: "Order now" },
      ],
    },
  },
  {
    file: "buds-story",
    product: "buds",
    svg: BUDS,
    template: "spotlight",
    palette: "Electric",
    preset: "modernTech",
    format: "story",
    content: {
      headline: "Silence, on demand",
      productName: "Pulse Buds",
      description: "Adaptive noise cancelling, 36-hour battery.",
      sellingPoints: ["Adaptive ANC", "36h battery"],
      ctaLabel: "Pre-order",
      blocks: [
        { type: "headline", text: "Silence, on demand" },
        { type: "description", text: "Adaptive noise cancelling and a 36-hour battery." },
        { type: "priceBlock", value: "$129" },
        { type: "cta", text: "Pre-order" },
      ],
    },
  },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const sharp = (await import("sharp")).default;
  const cutouts = new Map<string, { src: string; applied: boolean; ratio: number }>();

  for (const shot of SHOTS) {
    if (!cutouts.has(shot.product)) {
      const png = await sharp(Buffer.from(shot.svg)).png().toBuffer();
      const original = `data:image/png;base64,${png.toString("base64")}`;
      const cut = await removeProductBackdrop(original);
      const trimmed = cut.cutoutApplied ? await trimTransparentEdges(cut.dataUri) : null;
      cutouts.set(shot.product, {
        src: trimmed?.dataUri ?? original,
        applied: cut.cutoutApplied,
        ratio: trimmed ? trimmed.width / trimmed.height : cut.width / cut.height,
      });
    }
    const asset = cutouts.get(shot.product)!;
    const pal = PALETTES.find((p) => p.name === shot.palette)!;
    const style = resolveStyle(STYLE_PRESETS[shot.preset], {
      scenePrompt: "",
      colorInk: pal.ink,
      colorAccent: pal.accent,
      colorTextPrimary: pal.text,
      colorTextMuted: pal.muted,
      moodLabel: shot.palette,
    });

    const schema = composeDesignSchema({
      content: shot.content,
      productCutoutUrl: asset.src,
      cutoutApplied: asset.applied,
      productAspectRatio: asset.ratio,
      decision: { concept: "graphic_poster", density: "standard" },
      style: { ...style, templateId: shot.template, format: shot.format },
    });

    const png = await renderSchemaToPng(schema, { scale: 1 });
    const webp = await sharp(png).webp({ quality: 82 }).toBuffer();
    await writeFile(path.join(OUT_DIR, `${shot.file}.webp`), webp);
    console.log(`  ${shot.file.padEnd(18)} ${String(webp.length).padStart(8)} bytes`);
  }
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
