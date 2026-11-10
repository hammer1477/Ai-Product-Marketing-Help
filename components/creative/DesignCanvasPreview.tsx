import type { DesignSchema } from "@/lib/design-schema/types";
import { renderSchemaToSatoriTree } from "@/lib/design-schema/render/satoriTree";

// Reuses the exact same schema -> tree logic the server-side Satori exporter
// uses (lib/design-schema/render/satoriTree.tsx) so the live preview and the
// final high-res export can never visually drift — one source of truth,
// rendered twice: here as real DOM/CSS, there as a Satori SVG -> PNG.
export function DesignCanvasPreview({
  schema,
  previewWidth = 480,
}: {
  schema: DesignSchema;
  previewWidth?: number;
}) {
  const scale = previewWidth / schema.canvas.width;
  const previewHeight = schema.canvas.height * scale;

  return (
    <div
      style={{ width: previewWidth, height: previewHeight, overflow: "hidden", position: "relative" }}
      className="rounded-lg border"
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {renderSchemaToSatoriTree(schema)}
      </div>
    </div>
  );
}
