// Smoke test for all three Gemini providers against the real API.
// Run with: npx tsx lib/ai/providers/gemini/test-gemini.ts
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { GeminiTextGenerationProvider } from "./text";
import { GeminiImageAnalysisProvider } from "./vision";
import { GeminiImageGenerationProvider } from "./image";
import { CREATIVE_CONTENT_SCHEMA, type CreativeContent } from "../../../orchestration/types";

async function main() {
  // 1. Text generation
  const text = new GeminiTextGenerationProvider();
  const { data: content, usage: textUsage } = await text.generateJSON<CreativeContent>({
    system:
      "You are an advertising copywriter. Write persuasive, truthful ad copy using ONLY the verified " +
      "product information provided. Never invent specifications, certifications, or claims not present in the input.",
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          name: "Glow Serum",
          category: "Beauty & Skincare",
          description: "A lightweight vitamin C serum",
          objective: "brand-awareness",
          attributes: { price: "29.99 USD" },
        }),
      },
    ],
    schema: CREATIVE_CONTENT_SCHEMA,
  });
  console.log("TEXT:", JSON.stringify(content, null, 2), "usage:", textUsage);

  // 2. Vision / image analysis — use the sample test image already in the repo
  const samplePath = path.join(process.cwd(), "public/next.svg");
  const sampleBuffer = await readFile(samplePath);
  const sampleDataUri = `data:image/svg+xml;base64,${sampleBuffer.toString("base64")}`;

  const vision = new GeminiImageAnalysisProvider();
  const { data: analysis, usage: visionUsage } = await vision.analyzeImage({
    imageUrl: sampleDataUri,
    hints: { userProvidedCategory: "Electronics & Technology" },
  });
  console.log("VISION:", JSON.stringify(analysis, null, 2), "usage:", visionUsage);

  // 3. Image generation (text-to-image, no reference, to keep this quick)
  const image = new GeminiImageGenerationProvider();
  const { imageUrl, usage: imageUsage } = await image.generate({
    prompt: "A minimalist product photo of a skincare serum bottle on a marble surface, studio lighting",
    mode: "text-to-image",
    width: 1024,
    height: 1024,
  });
  console.log("IMAGE usage:", imageUsage, "data URI length:", imageUrl.length);

  const base64 = imageUrl.split(",")[1];
  const outPath = path.join(process.cwd(), "lib/ai/providers/gemini/test-output.png");
  await writeFile(outPath, Buffer.from(base64, "base64"));
  console.log("Saved generated image to", outPath);
}

main().catch((err) => {
  console.error("Gemini smoke test failed:", err);
  process.exit(1);
});
