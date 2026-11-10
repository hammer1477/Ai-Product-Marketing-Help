"use client";

import { useEffect, useRef, useState } from "react";
import type { DesignSchema } from "@/lib/design-schema/types";
import { renderSchemaToSatoriTree } from "@/lib/design-schema/render/satoriTree";

// Reuses the exact same schema -> tree logic the server-side Satori exporter
// uses (lib/design-schema/render/satoriTree.tsx) so the live preview and the
// final high-res export can never visually drift — one source of truth,
// rendered twice: here as real DOM/CSS, there as a Satori SVG -> PNG.
//
// Measures its own container width via ResizeObserver rather than using
// `previewWidth` as a literal size — a fixed pixel width previously
// overflowed its grid column whenever the page layout gave it less room
// than that (e.g. a two-column grid inside a narrower max-width page),
// visually bleeding into the neighboring column.
export function DesignCanvasPreview({
  schema,
  previewWidth = 480,
}: {
  schema: DesignSchema;
  previewWidth?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(previewWidth);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = containerWidth / schema.canvas.width;
  const previewHeight = schema.canvas.height * scale;

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        maxWidth: previewWidth,
        height: previewHeight,
        overflow: "hidden",
        position: "relative",
      }}
      className="rounded-lg border"
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {renderSchemaToSatoriTree(schema)}
      </div>
    </div>
  );
}
