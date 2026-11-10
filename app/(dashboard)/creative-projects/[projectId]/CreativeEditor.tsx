"use client";

import { useMemo, useState, useTransition } from "react";
import type { DesignSchema } from "@/lib/design-schema/types";
import type { Block } from "@/lib/orchestration/blocks/types";
import { readComposition, recomposePoster } from "@/lib/orchestration/composition";
import { DesignCanvasPreview } from "@/components/creative/DesignCanvasPreview";
import { BlockEditPanel } from "@/components/creative/BlockEditPanel";
import { DesignEditPanel } from "@/components/creative/DesignEditPanel";
import { Button } from "@/components/ui/button";
import { saveDesignSchema } from "./actions";

export function CreativeEditor({
  projectId,
  initialSchema,
}: {
  projectId: string;
  initialSchema: DesignSchema;
}) {
  const initialComposition = useMemo(() => readComposition(initialSchema), [initialSchema]);

  // Block editing is the real path. The layer editor remains for designs
  // saved before compositions existed, and for the concepts that don't
  // compose from blocks (premium photo, infographic).
  const [blocks, setBlocks] = useState<Block[]>(initialComposition?.blocks ?? []);
  const [layerSchema, setLayerSchema] = useState(initialSchema);
  const [isSaving, startSaving] = useTransition();
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // Re-running layout on every edit is what makes the preview honest: type
  // a longer description and the blocks below it move down, rather than the
  // text overflowing a box that was measured for the old wording.
  const schema = useMemo(() => {
    if (!initialComposition) return layerSchema;
    return recomposePoster(initialSchema, { ...initialComposition, blocks });
  }, [initialComposition, initialSchema, blocks, layerSchema]);

  function handleSave() {
    setSavedMessage(null);
    startSaving(async () => {
      const { issues } = await saveDesignSchema(projectId, schema);
      const warnings = issues.filter((issue) => issue.severity === "warning");
      setSavedMessage(
        warnings.length > 0
          ? `Saved, with ${warnings.length} warning(s): ${warnings[0].message}`
          : "Saved.",
      );
    });
  }

  return (
    // `min-w-0` on both columns is load-bearing: grid tracks size to their
    // content's minimum by default, and the preview lays its canvas out at
    // a full 1080px before scaling it down, which otherwise pushes this
    // column over the one beside it.
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <div className="min-w-0 lg:sticky lg:top-6">
        <DesignCanvasPreview schema={schema} />
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        {initialComposition ? (
          <BlockEditPanel blocks={blocks} onChange={setBlocks} />
        ) : (
          <DesignEditPanel schema={layerSchema} onChange={setLayerSchema} />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
          <Button
            variant="outline"
            render={<a href={`/api/creative-projects/${projectId}/export?format=svg`} />}
            nativeButton={false}
          >
            Download SVG
          </Button>
          <Button
            variant="outline"
            render={<a href={`/api/creative-projects/${projectId}/export?format=png&scale=2`} />}
            nativeButton={false}
          >
            PNG for web
          </Button>
          <Button
            variant="outline"
            render={<a href={`/api/creative-projects/${projectId}/export?format=png&scale=4`} />}
            nativeButton={false}
          >
            PNG for print
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          SVG keeps all text and shapes as vectors — sharp at any size, and editable in
          Illustrator or Figma. The product photo and background stay as images inside it.
          PNG for print is 4320&nbsp;px, a 14-inch poster at 300&nbsp;dpi.
        </p>
        {savedMessage && <p className="text-sm text-muted-foreground">{savedMessage}</p>}
      </div>
    </div>
  );
}
