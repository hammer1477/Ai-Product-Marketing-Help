// Standalone proof that Design Schema -> Satori -> resvg -> PNG works
// end-to-end, before wiring it to the orchestration engine or any API route.
// Run with: npx tsx lib/design-schema/render/test-render.ts
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { samplePosterSchema } from "../sample";
import { validateDesignSchema } from "../validate";
import { renderSchemaToPng } from "./renderPng";

async function main() {
  const issues = validateDesignSchema(samplePosterSchema);
  console.log(`Validation issues: ${issues.length}`);
  for (const issue of issues) {
    console.log(`  [${issue.severity}] ${issue.code}: ${issue.message}`);
  }

  const png = await renderSchemaToPng(samplePosterSchema, { scale: 2 });
  const outPath = path.join(process.cwd(), "lib/design-schema/render/test-output.png");
  await writeFile(outPath, png);
  console.log(`Rendered ${png.length} bytes -> ${outPath}`);
}

main().catch((err) => {
  console.error("Render pipeline failed:", err);
  process.exit(1);
});
