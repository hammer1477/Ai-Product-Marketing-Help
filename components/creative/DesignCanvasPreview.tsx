"use client";

import { useEffect, useRef, useState } from "react";
import type { DesignSchema } from "@/lib/design-schema/types";
import { renderSchemaToSatoriTree } from "@/lib/design-schema/render/satoriTree";

// Reuses the exact same schema -> tree logic the server-side Satori exporter
// uses (lib/design-schema/render/satoriTree.tsx) so the live preview and the
// final high-res export can never visually drift — one source of truth,
// rendered twice: here as real DOM/CSS, there as a Satori SVG -> PNG.
export function DesignCanvasPreview({
  schema,
  maxWidth = 520,
}: {
  schema: DesignSchema;
  maxWidth?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = (containerWidth ?? maxWidth) / schema.canvas.width;

  return (
    <div
      ref={containerRef}
      // The canvas is laid out at its full 1080px and scaled down, so the
      // container's height has to come from the aspect ratio rather than
      // from the scaled content — otherwise the box collapses on first
      // paint and the design spills over whatever sits next to it.
      // `overflow-hidden` also stops that 1080px child from forcing the
      // grid column wider than its share.
      style={{ aspectRatio: `${schema.canvas.width} / ${schema.canvas.height}`, maxWidth }}
      className="relative w-full overflow-hidden rounded-lg border bg-muted"
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: schema.canvas.width,
          height: schema.canvas.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {renderSchemaToSatoriTree(schema)}
      </div>
    </div>
  );
}
