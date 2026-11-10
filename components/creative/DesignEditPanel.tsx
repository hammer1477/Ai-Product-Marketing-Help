"use client";

import type { DesignSchema, TextLayer } from "@/lib/design-schema/types";
import { isTextLayer } from "@/lib/design-schema/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ROLE_LABELS: Record<TextLayer["role"], string> = {
  headline: "Headline",
  productName: "Product name",
  description: "Description",
  sellingPoint: "Selling point",
  ctaLabel: "Call to action",
  badgeLabel: "Badge",
  custom: "Text",
};

export function DesignEditPanel({
  schema,
  onChange,
}: {
  schema: DesignSchema;
  onChange: (next: DesignSchema) => void;
}) {
  const textLayers = schema.layers.filter(isTextLayer);

  function updateLayer(id: string, patch: Partial<TextLayer>) {
    onChange({
      ...schema,
      layers: schema.layers.map((layer) =>
        layer.id === id && isTextLayer(layer) ? { ...layer, ...patch } : layer,
      ),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {textLayers.map((layer) => (
        <div key={layer.id} className="flex flex-col gap-2">
          <Label htmlFor={`text-${layer.id}`}>{ROLE_LABELS[layer.role]}</Label>
          <div className="flex gap-2">
            <Input
              id={`text-${layer.id}`}
              value={layer.content}
              onChange={(e) => updateLayer(layer.id, { content: e.target.value })}
              className="flex-1"
            />
            <input
              type="color"
              value={layer.color}
              onChange={(e) => updateLayer(layer.id, { color: e.target.value })}
              className="h-8 w-10 shrink-0 cursor-pointer rounded border"
              aria-label={`${ROLE_LABELS[layer.role]} color`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
