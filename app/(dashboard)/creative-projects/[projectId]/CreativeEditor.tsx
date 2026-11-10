"use client";

import { useState, useTransition } from "react";
import type { DesignSchema } from "@/lib/design-schema/types";
import { DesignCanvasPreview } from "@/components/creative/DesignCanvasPreview";
import { DesignEditPanel } from "@/components/creative/DesignEditPanel";
import { Button } from "@/components/ui/button";
import { saveDesignSchema } from "./actions";

export function CreativeEditor({ projectId, initialSchema }: { projectId: string; initialSchema: DesignSchema }) {
  const [schema, setSchema] = useState(initialSchema);
  const [isSaving, startSaving] = useTransition();
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  function handleSave() {
    setSavedMessage(null);
    startSaving(async () => {
      const { issues } = await saveDesignSchema(projectId, schema);
      const warnings = issues.filter((i) => i.severity === "warning");
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
        <DesignCanvasPreview schema={schema} previewWidth={480} />
      </div>
      <div className="flex flex-col gap-4">
        <DesignEditPanel schema={schema} onChange={setSchema} />
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
          <Button
            variant="outline"
            render={<a href={`/api/creative-projects/${projectId}/export`} />}
          >
            Export PNG
          </Button>
        </div>
        {savedMessage && <p className="text-sm text-muted-foreground">{savedMessage}</p>}
      </div>
    </div>
  );
}
