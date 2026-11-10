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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="flex flex-col items-start gap-3">
        <div className="lg:sticky lg:top-6">
          <DesignCanvasPreview schema={schema} />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {initialComposition ? (
          <BlockEditPanel blocks={blocks} onChange={setBlocks} />
        ) : (
          <DesignEditPanel schema={layerSchema} onChange={setLayerSchema} />
        )}
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
          <Button
            variant="outline"
            render={<a href={`/api/creative-projects/${projectId}/export`} />}
            nativeButton={false}
          >
            Export PNG
          </Button>
        </div>
        {savedMessage && <p className="text-sm text-muted-foreground">{savedMessage}</p>}
      </div>
    </div>
  );
}
