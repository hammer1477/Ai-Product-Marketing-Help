"use client";

import { useMemo, useState, useTransition } from "react";
import type { DesignSchema } from "@/lib/design-schema/types";
import { readComposition, recomposePoster, type PosterComposition } from "@/lib/orchestration/composition";
import { DesignCanvasPreview } from "@/components/creative/DesignCanvasPreview";
import { BlockEditPanel } from "@/components/creative/BlockEditPanel";
import { DesignEditPanel } from "@/components/creative/DesignEditPanel";
import { StylePanel } from "@/components/creative/StylePanel";
import { FontFaces } from "@/components/creative/FontFaces";
import { UnusedFacts } from "@/components/creative/UnusedFacts";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveDesignSchema } from "./actions";

export function CreativeEditor({
  projectId,
  initialSchema,
}: {
  projectId: string;
  initialSchema: DesignSchema;
}) {
  const initialComposition = useMemo(() => readComposition(initialSchema), [initialSchema]);

  // Composition editing is the real path: content, template, colours and
  // fonts all live in it, and the poster is re-laid-out from it on every
  // change. The layer editor remains for designs saved before
  // compositions existed.
  const [composition, setComposition] = useState<PosterComposition | null>(initialComposition);
  const [layerSchema, setLayerSchema] = useState(initialSchema);
  const [isSaving, startSaving] = useTransition();
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const schema = useMemo(() => {
    if (!composition) return layerSchema;
    return recomposePoster(initialSchema, composition);
  }, [composition, initialSchema, layerSchema]);

  // Blocks the current template had no room for — still kept, so they
  // return when the user switches to a roomier template.
  const hiddenTypes = useMemo(() => {
    const placed = readComposition(schema)?.placedTypes;
    if (!composition || !placed) return [];
    return composition.blocks.map((b) => b.type).filter((type) => !placed.includes(type));
  }, [schema, composition]);

  function handleSave() {
    setSavedMessage(null);
    startSaving(async () => {
      const { issues } = await saveDesignSchema(projectId, schema);
      const warnings = issues.filter((issue) => issue.severity === "warning");
      setSavedMessage(
        warnings.length > 0 ? `Saved, with ${warnings.length} warning(s): ${warnings[0].message}` : "Saved.",
      );
    });
  }

  return (
    // `min-w-0` on both columns is load-bearing: grid tracks size to their
    // content's minimum by default, and the preview lays its canvas out at
    // a full 1080px before scaling it down.
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <FontFaces />
      <div className="min-w-0 lg:sticky lg:top-6">
        <DesignCanvasPreview schema={schema} />
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        {composition ? (
          <Tabs defaultValue="design">
            <TabsList>
              <TabsTrigger value="design">Design</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
            </TabsList>
            <TabsContent value="design" className="pt-3">
              <StylePanel schema={initialSchema} composition={composition} onChange={setComposition} />
            </TabsContent>
            <TabsContent value="content" className="flex flex-col gap-5 pt-3">
              <UnusedFacts
                facts={composition.facts}
                blocks={composition.blocks}
                onChange={(blocks) => setComposition({ ...composition, blocks })}
              />
              <BlockEditPanel
                blocks={composition.blocks}
                hiddenTypes={hiddenTypes}
                onChange={(blocks) => setComposition({ ...composition, blocks })}
              />
            </TabsContent>
          </Tabs>
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
          Exports use the last saved version, so save before downloading. SVG keeps all text and
          shapes as vectors — sharp at any size, and editable in Illustrator or Figma. PNG for print
          is 4320&nbsp;px, a 14-inch poster at 300&nbsp;dpi.
        </p>
        {savedMessage && <p className="text-sm text-muted-foreground">{savedMessage}</p>}
      </div>
    </div>
  );
}
