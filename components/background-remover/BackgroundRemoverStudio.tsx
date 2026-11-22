"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, ImageUp, Library, Loader2, ScanLine, ShieldCheck, Sparkles, TriangleAlert, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { buildBaseMask, CutoutEngine } from "@/lib/background-remover/client/engine";
import {
  CloudUnavailableError,
  segmentInBrowser,
  segmentInCloud,
  type RawMask,
  type SegmentProgress,
} from "@/lib/background-remover/client/segment";
import { CutoutWorkspace } from "./CutoutWorkspace";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MIN_SIDE = 64;
/** Working-resolution caps (keeps every browser, including iOS Safari, inside its canvas limits). */
const MAX_SIDE = 6000;
const MAX_PIXELS = 16_000_000;

const STEPS = ["Detecting the main product", "Segmenting the product", "Removing the background", "Refining edges", "Generating transparent PNG"];

type Phase =
  | { kind: "idle" }
  | { kind: "processing"; step: number; detail?: string }
  | { kind: "ready" }
  | { kind: "error"; message: string };

type Loaded = { run: number; fileName: string; originalUrl: string; engine: CutoutEngine; downscaled: boolean };

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 60)));

function formatMB(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

export function BackgroundRemoverStudio({ cloudEnabled }: { cloudEnabled: boolean }) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [preview, setPreview] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const runRef = useRef(0);
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    const urls = urlsRef.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const process = useCallback(
    async (file: File) => {
      if (!ACCEPTED.includes(file.type)) {
        setPhase({ kind: "error", message: "Please choose a JPG, PNG or WebP image." });
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setPhase({ kind: "error", message: `That file is ${formatMB(file.size)} — the limit is ${formatMB(MAX_FILE_BYTES)}.` });
        return;
      }

      const run = ++runRef.current;
      const stale = () => run !== runRef.current;
      const url = URL.createObjectURL(file);
      urlsRef.current.push(url);
      setPreview(url);
      setPhase({ kind: "processing", step: 0 });

      let bitmap: ImageBitmap;
      try {
        bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch {
        if (!stale()) setPhase({ kind: "error", message: "That file couldn't be read as an image." });
        return;
      }
      if (Math.min(bitmap.width, bitmap.height) < MIN_SIDE) {
        bitmap.close();
        if (!stale()) setPhase({ kind: "error", message: `The image is too small — at least ${MIN_SIDE}px on each side, please.` });
        return;
      }

      let downscaled = false;
      const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height), Math.sqrt(MAX_PIXELS / (bitmap.width * bitmap.height)));
      if (scale < 1) {
        const resized = await createImageBitmap(bitmap, {
          resizeWidth: Math.round(bitmap.width * scale),
          resizeHeight: Math.round(bitmap.height * scale),
          resizeQuality: "high",
        });
        bitmap.close();
        bitmap = resized;
        downscaled = true;
      }

      const onProgress = (p: SegmentProgress) => {
        if (stale()) return;
        if (p.stage === "detect" && p.download && p.download.total > 0) {
          const pct = Math.min(100, Math.round((p.download.loaded / p.download.total) * 100));
          setPhase({
            kind: "processing",
            step: 0,
            detail: `Downloading the background-removal model to your browser — ${pct}% of ${formatMB(p.download.total)} (one-time)`,
          });
        } else {
          setPhase({ kind: "processing", step: p.stage === "segment" ? 1 : 0, detail: p.device === "wasm" ? "No compatible GPU found — using the lighter CPU model. Touch up any edges with the refine brushes." : undefined });
        }
      };

      let raw: RawMask;
      try {
        if (cloudEnabled) {
          try {
            raw = await segmentInCloud(bitmap, bitmap.width, bitmap.height, onProgress);
          } catch (err) {
            if ((err as { fatal?: boolean }).fatal) throw err;
            if (!(err instanceof CloudUnavailableError)) toast.info("Cloud service unavailable — processing in your browser instead.");
            raw = await segmentInBrowser(bitmap, bitmap.width, bitmap.height, onProgress);
          }
        } else {
          raw = await segmentInBrowser(bitmap, bitmap.width, bitmap.height, onProgress);
        }
      } catch (err) {
        bitmap.close();
        if (!stale()) setPhase({ kind: "error", message: err instanceof Error ? err.message : "Background removal failed." });
        return;
      }
      if (stale()) return bitmap.close();

      setPhase({ kind: "processing", step: 2 });
      await nextFrame();
      const { mask, coverage } = buildBaseMask(raw, bitmap.width, bitmap.height);
      if (coverage < 0.003) {
        bitmap.close();
        setPhase({
          kind: "error",
          message: "We couldn't find a clear product in this photo. Try one where the product is the main subject.",
        });
        return;
      }

      setPhase({ kind: "processing", step: 3 });
      await nextFrame();
      if (stale()) return bitmap.close();
      setPhase({ kind: "processing", step: 4 });
      const engine = new CutoutEngine(bitmap, mask);
      await nextFrame();
      if (stale()) return;

      setLoaded({ run, fileName: file.name, originalUrl: url, engine, downscaled });
      setPhase({ kind: "ready" });
      if (downscaled) toast.info(`Large photo scaled to ${bitmap.width}×${bitmap.height}px for editing.`);
    },
    [cloudEnabled],
  );

  const pick = () => inputRef.current?.click();

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPTED.join(",")}
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) void process(file);
      }}
    />
  );

  if (phase.kind === "ready" && loaded) {
    return (
      <>
        {fileInput}
        <CutoutWorkspace key={loaded.run} engine={loaded.engine} originalUrl={loaded.originalUrl} fileName={loaded.fileName} onReplace={pick} />
      </>
    );
  }

  if (phase.kind === "processing" && preview) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <style>{`@keyframes bgr-scan{0%{top:0%}50%{top:calc(100% - 3px)}100%{top:0%}}`}</style>
        <Card className="overflow-hidden p-0">
          <div className="relative flex min-h-80 items-center justify-center bg-muted/40 p-6">
            {/* A local object URL; the optimizer can't (and shouldn't) see it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Uploaded product" className="max-h-[60vh] w-auto rounded-lg object-contain opacity-90" />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-6 h-[3px] rounded-full bg-brand shadow-[0_0_24px_6px_color-mix(in_oklab,var(--brand-2)_45%,transparent)]"
              style={{ animation: "bgr-scan 2.4s ease-in-out infinite" }}
            />
          </div>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-5 py-2">
            <div>
              <h2 className="text-lg font-semibold">Extracting your product</h2>
              <p className="text-sm text-muted-foreground">Your original pixels are kept exactly — only the background is removed.</p>
            </div>
            <ol className="flex flex-col gap-3">
              {STEPS.map((label, i) => {
                const done = i < phase.step;
                const active = i === phase.step;
                return (
                  <li key={label} className={cn("flex items-center gap-3 text-sm", !done && !active && "text-muted-foreground")}>
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full border",
                        done && "border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                        active && "border-transparent bg-brand text-white",
                      )}
                    >
                      {done ? <Check className="size-4" /> : active ? <Loader2 className="size-4 animate-spin" /> : <span className="text-xs">{i + 1}</span>}
                    </span>
                    <span className={cn(active && "font-medium")}>{label}</span>
                  </li>
                );
              })}
            </ol>
            {phase.detail && <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{phase.detail}</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {fileInput}
      {phase.kind === "error" && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>{phase.message}</p>
        </div>
      )}
      <button
        type="button"
        onClick={pick}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void process(file);
        }}
        className={cn(
          "group relative flex min-h-[340px] flex-col items-center justify-center gap-5 overflow-hidden rounded-3xl border-2 border-dashed bg-card px-6 py-12 text-center transition",
          dragging ? "border-[var(--brand-1)] bg-muted/60 ring-brand" : "hover:border-[var(--brand-1)]/60 hover:bg-muted/30",
        )}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.35] [background-image:conic-gradient(var(--muted)_25%,transparent_0_50%,var(--muted)_0_75%,transparent_0)] [background-size:28px_28px] [mask-image:radial-gradient(60%_60%_at_50%_50%,black,transparent)]"
        />
        <span className="relative flex size-16 items-center justify-center rounded-2xl bg-brand text-white shadow-lg transition group-hover:scale-105">
          {dragging ? <Upload className="size-7" /> : <ImageUp className="size-7" />}
        </span>
        <div className="relative flex flex-col gap-1.5">
          <p className="text-xl font-semibold">{dragging ? "Drop to extract" : "Drop a product photo here"}</p>
          <p className="text-sm text-muted-foreground">
            or <span className="font-medium text-foreground underline underline-offset-4">browse files</span> · JPG, PNG or WebP · up to{" "}
            {formatMB(MAX_FILE_BYTES)}
          </p>
        </div>
        <p className="relative max-w-md text-xs text-muted-foreground">
          Perfume, packaging, cosmetics, shoes, electronics, food — any physical product. The background is removed automatically as
          soon as you upload.
        </p>
      </button>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: ShieldCheck, title: "Your product, untouched", body: "Colours, logos and printed text stay exactly as photographed." },
          { icon: ScanLine, title: "Dedicated cutout model", body: "Dedicated segmentation (BiRefNet) — background removal, not AI redrawing." },
          { icon: Sparkles, title: "Ready for ads", body: "Transparent PNG at full resolution, with an optional tight crop." },
        ].map((f) => (
          <div key={f.title} className="flex gap-3 rounded-2xl border bg-card p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
              <f.icon className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium">{f.title}</p>
              <p className="text-xs text-muted-foreground">{f.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <p>
          {cloudEnabled
            ? "Processed securely on our servers."
            : "Processed privately on your device — the first run downloads the model once (about 45–225 MB, depending on your device)."}
        </p>
        <Button variant="outline" size="sm" render={<Link href="/background-remover/library" />} nativeButton={false}>
          <Library /> Asset library
        </Button>
      </div>
    </div>
  );
}
