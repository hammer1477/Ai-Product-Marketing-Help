"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Redo2, Undo2 } from "lucide-react";
import type { DesignSchema } from "@/lib/design-schema/types";
import { pruneBlocks, readComposition, recomposePoster, type PosterComposition } from "@/lib/orchestration/composition";
import type { BrandKit } from "@/lib/brand/kit";
import type { Placement } from "@/lib/campaign/plan";
import { DesignCanvasPreview } from "@/components/creative/DesignCanvasPreview";
import { BlockEditPanel } from "@/components/creative/BlockEditPanel";
import { DesignEditPanel } from "@/components/creative/DesignEditPanel";
import { StylePanel } from "@/components/creative/StylePanel";
import { FontFaces } from "@/components/creative/FontFaces";
import { UnusedFacts } from "@/components/creative/UnusedFacts";
import { Recommendations } from "@/components/creative/Recommendations";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveDesignSchema } from "./actions";

const HISTORY_LIMIT = 50;

export function CreativeEditor({
  projectId,
  initialSchema,
  brandKit = null,
  productPrice,
  placements,
  campaignId,
}: {
  projectId: string;
  initialSchema: DesignSchema;
  brandKit?: BrandKit | null;
  productPrice?: string;
  placements?: Placement[];
  campaignId?: string | null;
}) {
  const initialComposition = useMemo(() => readComposition(initialSchema), [initialSchema]);

  // Composition editing is the real path: content, template, colours and
  // fonts all live in it, and the poster is re-laid-out from it on every
  // change. The layer editor remains for designs saved before compositions.
  const [history, setHistory] = useState<{ past: PosterComposition[]; present: PosterComposition | null; future: PosterComposition[] }>({
    past: [],
    present: initialComposition,
    future: [],
  });
  const composition = history.present;
  const [layerSchema, setLayerSchema] = useState(initialSchema);
  const [tab, setTab] = useState("design");
  const [isSaving, startSaving] = useTransition();
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const setComposition = useCallback((next: PosterComposition) => {
    setHistory((h) => ({ past: [...h.past, h.present!].slice(-HISTORY_LIMIT), present: next, future: [] }));
    setDirty(true);
    setSavedMessage(null);
  }, []);
  const undo = useCallback(() => {
    setHistory((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present!, ...h.future] } : h));
    setDirty(true);
  }, []);
  const redo = useCallback(() => {
    setHistory((h) => (h.future.length ? { past: [...h.past, h.present!], present: h.future[0], future: h.future.slice(1) } : h));
    setDirty(true);
  }, []);

  // Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z — but not while typing in a field,
  // where the browser's own text undo is what people expect.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const schema = useMemo(() => {
    if (!composition) return layerSchema;
    return recomposePoster(initialSchema, composition);
  }, [composition, initialSchema, layerSchema]);

  // Blocks the current template had no room for — still kept, so they
  // return when the user switches to a roomier template. Sections still
  // being filled in aren't "hidden", just empty.
  const hiddenTypes = useMemo(() => {
    const placed = readComposition(schema)?.placedTypes;
    if (!composition || !placed) return [];
    return pruneBlocks(composition.blocks)
      .map((b) => b.type)
      .filter((type) => !placed.includes(type));
  }, [schema, composition]);

  // Lists the template cut short to fit.
  const trimmed = useMemo(() => {
    const counts = readComposition(schema)?.placedCounts;
    if (!composition || !counts) return false;
    return pruneBlocks(composition.blocks).some((b) => "items" in b && counts[b.type] !== undefined && counts[b.type]! < b.items.length);
  }, [schema, composition]);

  function handleSave() {
    setSavedMessage(null);
    startSaving(async () => {
      const { issues } = await saveDesignSchema(projectId, schema);
      // Re-render the stored preview so grids and the campaign show this edit.
      const preview = await fetch(`/api/creative-projects/${projectId}/preview`, { method: "POST" }).catch(() => null);
      const warnings = issues.filter((issue) => issue.severity === "warning");
      setDirty(false);
      setSavedMessage(
        warnings.length > 0
          ? `Saved, with ${warnings.length} warning(s): ${warnings[0].message}`
          : preview?.ok
            ? campaignId
              ? "Saved. Your campaign and downloads now use this version."
              : "Saved. Your ads and downloads now use this version."
            : "Saved.",
      );
    });
  }

  return (
    // `min-w-0` on both columns is load-bearing: grid tracks size to their
    // content's minimum by default, and the preview lays its canvas out at
    // a full 1080px before scaling it down.
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <FontFaces />
      <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-20">
        <DesignCanvasPreview schema={schema} maxHeight={680} />
        {composition && (
          <div className="flex items-center justify-center gap-1">
            <Button variant="ghost" size="sm" onClick={undo} disabled={history.past.length === 0} className="gap-1.5" title="Undo (Ctrl+Z)">
              <Undo2 className="size-4" /> Undo
            </Button>
            <Button variant="ghost" size="sm" onClick={redo} disabled={history.future.length === 0} className="gap-1.5" title="Redo (Ctrl+Shift+Z)">
              <Redo2 className="size-4" /> Redo
            </Button>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        {composition ? (
          <>
            <Recommendations
              composition={composition}
              onChange={setComposition}
              hiddenTypes={hiddenTypes}
              trimmed={trimmed}
              brandKit={brandKit}
              productPrice={productPrice}
              placements={placements}
              onOpenContent={() => setTab("content")}
            />
            <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
              <TabsList>
                <TabsTrigger value="design">Design</TabsTrigger>
                <TabsTrigger value="content">Content</TabsTrigger>
              </TabsList>
              <TabsContent value="design" className="pt-3">
                <StylePanel schema={initialSchema} composition={composition} onChange={setComposition} brandKit={brandKit} />
              </TabsContent>
              <TabsContent value="content" className="flex flex-col gap-5 pt-3">
                <UnusedFacts
                  facts={composition.facts}
                  blocks={composition.blocks}
                  onChange={(blocks) => setComposition({ ...composition, blocks })}
                />
                <BlockEditPanel
                  projectId={projectId}
                  blocks={composition.blocks}
                  hiddenTypes={hiddenTypes}
                  placedCounts={readComposition(schema)?.placedCounts}
                  productPrice={productPrice}
                  onChange={(blocks) => setComposition({ ...composition, blocks })}
                />
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <DesignEditPanel schema={layerSchema} onChange={setLayerSchema} />
        )}
        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : dirty ? "Save changes" : "Saved"}
          </Button>
          {campaignId && (
            <Button variant="outline" render={<Link href={`/campaigns/${campaignId}`} />} nativeButton={false}>
              Back to campaign
            </Button>
          )}
          <Button variant="outline" render={<a href={`/api/creative-projects/${projectId}/export?format=svg`} />} nativeButton={false}>
            SVG
          </Button>
          <Button variant="outline" render={<a href={`/api/creative-projects/${projectId}/export?format=png&scale=2`} />} nativeButton={false}>
            PNG for web
          </Button>
          <Button variant="outline" render={<a href={`/api/creative-projects/${projectId}/export?format=png&scale=4`} />} nativeButton={false}>
            PNG for print
          </Button>
          {dirty && <span className="text-xs text-amber-600">Unsaved changes — downloads use the last saved version.</span>}
          {savedMessage && <span className="text-xs text-muted-foreground">{savedMessage}</span>}
        </div>
      </div>
    </div>
  );
}
