"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Download, Eye, ImageOff, Loader2, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteCutout, renameCutout } from "@/app/(dashboard)/background-remover/actions";
import { downloadBlob, slugify } from "@/lib/background-remover/client/export";
import { BG_STYLES, BgSwatches, type PreviewBg } from "./CutoutWorkspace";

export type CutoutAsset = {
  id: string;
  name: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
  url: string | null;
};

function formatBytes(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

async function downloadAsset(asset: CutoutAsset) {
  if (!asset.url) return toast.error("This file isn't available.");
  try {
    const res = await fetch(asset.url);
    if (!res.ok) throw new Error();
    downloadBlob(await res.blob(), `${slugify(asset.name)}.png`);
  } catch {
    toast.error("Download failed — refresh the page and try again.");
  }
}

function AssetCard({ asset, onPreview }: { asset: CutoutAsset; onPreview: () => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(asset.name);
  const [pending, startTransition] = useTransition();

  const rename = () =>
    startTransition(async () => {
      const res = await renameCutout(asset.id, name);
      if (res.error) return void toast.error(res.error);
      setEditing(false);
      router.refresh();
    });

  const remove = () => {
    if (!window.confirm(`Delete "${asset.name}"? This can't be undone.`)) return;
    startTransition(async () => {
      const res = await deleteCutout(asset.id);
      if (res.error) return void toast.error(res.error);
      toast.success("Cutout deleted.");
      router.refresh();
    });
  };

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border bg-card transition hover:ring-brand">
      <button type="button" onClick={onPreview} className="relative flex aspect-square items-center justify-center p-4" style={BG_STYLES.checker}>
        {asset.url ? (
          // Short-lived signed URL from a private bucket; keep it off the optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.url} alt={asset.name} loading="lazy" className="max-h-full max-w-full object-contain drop-shadow-sm" />
        ) : (
          <ImageOff className="size-8 text-muted-foreground" />
        )}
        <span className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-background/90 opacity-0 shadow transition group-hover:opacity-100">
          <Eye className="size-4" />
        </span>
      </button>
      <div className="flex flex-col gap-2 border-t p-3">
        {editing ? (
          <form
            className="flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              rename();
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus aria-label="Cutout name" className="h-7" />
            <Button type="submit" size="icon-sm" variant="outline" disabled={pending || !name.trim()} aria-label="Save name">
              {pending ? <Loader2 className="animate-spin" /> : <Check />}
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Cancel"
              onClick={() => {
                setName(asset.name);
                setEditing(false);
              }}
            >
              <X />
            </Button>
          </form>
        ) : (
          <p className="truncate text-sm font-medium" title={asset.name}>
            {asset.name}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {asset.width}×{asset.height}px · {formatBytes(asset.bytes)}
        </p>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="flex-1" onClick={() => void downloadAsset(asset)}>
            <Download /> PNG
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Rename" onClick={() => setEditing(true)} disabled={pending}>
            <Pencil />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Delete" onClick={remove} disabled={pending} className="hover:text-destructive">
            <Trash2 />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CutoutLibrary({ assets }: { assets: CutoutAsset[] }) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [bg, setBg] = useState<PreviewBg>("checker");
  const preview = assets.find((a) => a.id === previewId) ?? null;

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed px-6 py-16 text-center">
        <p className="font-medium">No saved cutouts yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Remove a product&apos;s background, then choose &ldquo;Save&rdquo; in the export panel to keep it here.
        </p>
        <Button render={<Link href="/background-remover" />} nativeButton={false} className="bg-brand text-white hover:opacity-90">
          Open the Background Remover
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {assets.map((a) => (
          <AssetCard key={a.id} asset={a} onPreview={() => setPreviewId(a.id)} />
        ))}
      </div>
      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreviewId(null)}>
        {preview && (
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle className="truncate pr-8">{preview.name}</DialogTitle>
              <DialogDescription>
                {preview.width}×{preview.height}px · transparent PNG
              </DialogDescription>
            </DialogHeader>
            <div className="flex max-h-[65vh] items-center justify-center overflow-auto rounded-xl border p-4" style={BG_STYLES[bg]}>
              {preview.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt={preview.name} className="max-h-[60vh] max-w-full object-contain" />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <BgSwatches value={bg} onChange={setBg} />
              <Button onClick={() => void downloadAsset(preview)}>
                <Download /> Download PNG
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
