"use client";

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Brush,
  Download,
  Eraser,
  Expand,
  Hand,
  Library,
  Loader2,
  Maximize,
  Minimize,
  Minus,
  Plus,
  Redo2,
  RefreshCw,
  RotateCcw,
  Save,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/db/supabase/client";
import type { CutoutEngine } from "@/lib/background-remover/client/engine";
import { downloadBlob, exportCutout, slugify, type ExportOptions } from "@/lib/background-remover/client/export";
import { saveCutout } from "@/app/(dashboard)/background-remover/actions";

type Tool = "move" | "erase" | "restore";
type View = "cutout" | "compare";
export type PreviewBg = "checker" | "white" | "grey" | "black";

export const BG_STYLES: Record<PreviewBg, React.CSSProperties> = {
  checker: {
    backgroundColor: "#ffffff",
    backgroundImage: "conic-gradient(#e2e5ea 25%, transparent 0 50%, #e2e5ea 0 75%, transparent 0)",
    backgroundSize: "20px 20px",
  },
  white: { backgroundColor: "#ffffff" },
  grey: { backgroundColor: "#8a8f98" },
  black: { backgroundColor: "#0b0b0d" },
};

export const BG_OPTIONS: { id: PreviewBg; label: string }[] = [
  { id: "checker", label: "Transparent" },
  { id: "white", label: "White" },
  { id: "grey", label: "Grey" },
  { id: "black", label: "Black" },
];

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const MIN_BRUSH = 4;
const MAX_BRUSH = 240;
const WEB_MAX_SIDE = 1600;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export function BgSwatches({ value, onChange }: { value: PreviewBg; onChange: (bg: PreviewBg) => void }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Preview background">
      {BG_OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          title={o.label}
          onClick={() => onChange(o.id)}
          className={cn(
            "size-7 rounded-full border-2 transition",
            value === o.id ? "border-[var(--brand-1)] ring-2 ring-[var(--brand-1)]/30" : "border-border hover:scale-110",
          )}
          style={{ ...BG_STYLES[o.id], backgroundSize: o.id === "checker" ? "8px 8px" : undefined }}
        >
          <span className="sr-only">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: React.ReactNode; title?: string }[];
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-lg border bg-muted/50 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          title={o.title}
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition",
            value === o.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CutoutWorkspace({
  engine,
  originalUrl,
  fileName,
  onReplace,
}: {
  engine: CutoutEngine;
  originalUrl: string;
  fileName: string;
  onReplace: () => void;
}) {
  const { width: W, height: H } = engine;
  const router = useRouter();
  const [view, setView] = useState<View>("cutout");
  const [bg, setBg] = useState<PreviewBg>("checker");
  const [tool, setTool] = useState<Tool>("erase");
  const [brush, setBrush] = useState(40);
  const [zoom, setZoom] = useState(1);
  const [fitted, setFitted] = useState(true);
  const [split, setSplit] = useState(50);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [panning, setPanning] = useState(false);
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const [framing, setFraming] = useState<ExportOptions["framing"]>("canvas");
  const [padding, setPadding] = useState(0.05);
  const [resolution, setResolution] = useState<"full" | "web">("full");
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assetName, setAssetName] = useState(() => fileName.replace(/\.[a-z0-9]+$/i, "").slice(0, 120) || "Product cutout");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: "brush" | "pan" | "split"; lastX: number; lastY: number } | null>(null);
  const anchor = useRef<{ fx: number; fy: number; cx: number; cy: number } | null>(null);

  useEffect(() => {
    if (canvasRef.current) engine.attach(canvasRef.current);
  }, [engine]);

  const fitZoom = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return 1;
    const pad = 48;
    return clamp(Math.min((vp.clientWidth - pad) / W, (vp.clientHeight - pad) / H), MIN_ZOOM, MAX_ZOOM);
  }, [W, H]);

  // Keep the image fitted to the viewport until the user zooms manually.
  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    // ResizeObserver also fires once on observe(), which applies the initial fit.
    const ro = new ResizeObserver(() => fitted && setZoom(fitZoom()));
    ro.observe(vp);
    return () => ro.disconnect();
  }, [fitted, fitZoom, fullscreen]);

  /** Zooms keeping the image point under (cx, cy) — viewport coords — fixed. Defaults to the centre. */
  const zoomTo = useCallback(
    (next: number, cx?: number, cy?: number) => {
      const vp = viewportRef.current;
      if (!vp) return;
      const z = clamp(next, MIN_ZOOM, MAX_ZOOM);
      const px = cx ?? vp.clientWidth / 2;
      const py = cy ?? vp.clientHeight / 2;
      const rect = canvasRef.current!.getBoundingClientRect();
      const vpRect = vp.getBoundingClientRect();
      anchor.current = {
        fx: (vpRect.left + px - rect.left) / rect.width,
        fy: (vpRect.top + py - rect.top) / rect.height,
        cx: px,
        cy: py,
      };
      setFitted(false);
      setZoom(z);
    },
    [],
  );

  useLayoutEffect(() => {
    const a = anchor.current;
    const vp = viewportRef.current;
    const canvas = canvasRef.current;
    if (!a || !vp || !canvas) return;
    anchor.current = null;
    const rect = canvas.getBoundingClientRect();
    const vpRect = vp.getBoundingClientRect();
    vp.scrollLeft += rect.left + a.fx * rect.width - (vpRect.left + a.cx);
    vp.scrollTop += rect.top + a.fy * rect.height - (vpRect.top + a.cy);
  }, [zoom]);

  // Ctrl/⌘ + wheel zooms around the pointer (needs a non-passive listener).
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      zoomTo(zoom * Math.exp(-e.deltaY * 0.0025), e.clientX - r.left, e.clientY - r.top);
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [zoom, zoomTo]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void shellRef.current?.requestFullscreen?.().catch(() => toast.error("Full screen isn't available here."));
  };

  const undo = useCallback(() => {
    engine.undo();
    bump();
  }, [engine]);
  const redo = useCallback(() => {
    engine.redo();
    bump();
  }, [engine]);
  const reset = useCallback(() => {
    engine.reset();
    bump();
  }, [engine]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable=true]")) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && k === "y") {
        e.preventDefault();
        redo();
      } else if (mod) {
        return;
      } else if (k === "e") setTool("erase");
      else if (k === "r") setTool("restore");
      else if (k === "v" || k === "h") setTool("move");
      else if (k === "[") setBrush((b) => clamp(Math.round(b / 1.2), MIN_BRUSH, MAX_BRUSH));
      else if (k === "]") setBrush((b) => clamp(Math.round(b * 1.2), MIN_BRUSH, MAX_BRUSH));
      else if (k === "+" || k === "=") zoomTo(zoom * 1.25);
      else if (k === "-") zoomTo(zoom / 1.25);
      else if (k === "0") setFitted(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, zoom, zoomTo]);

  const toImage = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  };

  const brushing = view === "cutout" && tool !== "move";

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (view === "compare") {
      drag.current = { kind: "split", lastX: e.clientX, lastY: e.clientY };
      const rect = canvasRef.current!.getBoundingClientRect();
      setSplit(clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100));
    } else if (brushing) {
      drag.current = { kind: "brush", lastX: e.clientX, lastY: e.clientY };
      engine.beginStroke(tool as "erase" | "restore", brush / 2 / zoom, toImage(e));
    } else {
      drag.current = { kind: "pan", lastX: e.clientX, lastY: e.clientY };
      setPanning(true);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    const d = drag.current;
    if (!d) return;
    if (d.kind === "split") {
      setSplit(clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100));
    } else if (d.kind === "brush") {
      const events = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [];
      if (events.length > 0) {
        for (const ev of events) engine.extendStroke({ x: ((ev.clientX - rect.left) / rect.width) * W, y: ((ev.clientY - rect.top) / rect.height) * H });
      } else {
        engine.extendStroke(toImage(e));
      }
    } else {
      const vp = viewportRef.current!;
      vp.scrollLeft -= e.clientX - d.lastX;
      vp.scrollTop -= e.clientY - d.lastY;
    }
    d.lastX = e.clientX;
    d.lastY = e.clientY;
  };

  const endDrag = () => {
    if (drag.current?.kind === "brush") {
      engine.endStroke();
      bump();
    }
    drag.current = null;
    setPanning(false);
  };

  const dispW = Math.round(W * zoom);
  const dispH = Math.round(H * zoom);
  const ghost = view === "cutout" && tool === "restore";

  const exportOptions = (): ExportOptions => ({ framing, padding, maxSide: resolution === "web" ? WEB_MAX_SIDE : null });
  const exportName = () =>
    `${slugify(fileName)}-cutout${framing === "tight" ? "-crop" : ""}${resolution === "web" ? "-web" : ""}.png`;

  const download = async () => {
    setExporting(true);
    try {
      const { blob, width, height } = await exportCutout(engine, exportOptions());
      downloadBlob(blob, exportName());
      toast.success(`Transparent PNG downloaded · ${width}×${height}px`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const saveToLibrary = async () => {
    setSaving(true);
    try {
      const { blob } = await exportCutout(engine, exportOptions());
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again.");
      const path = `${user.id}/cutouts/${crypto.randomUUID()}.png`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, blob, { contentType: "image/png", upsert: false });
      if (upErr) throw new Error("Upload failed — please try again.");
      const res = await saveCutout({ path, name: assetName });
      if (res.error) throw new Error(res.error);
      toast.success("Saved to your asset library.", {
        action: { label: "Open", onClick: () => router.push("/background-remover/library") },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the cutout.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* Stage */}
      <div ref={shellRef} className={cn("flex min-w-0 flex-col gap-3", fullscreen && "bg-background p-4")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented<View>
            value={view}
            onChange={setView}
            options={[
              { id: "cutout", label: "Extracted product" },
              { id: "compare", label: "Before / after" },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <BgSwatches value={bg} onChange={setBg} />
            <div className="flex items-center rounded-lg border bg-background">
              <Button variant="ghost" size="icon-sm" aria-label="Zoom out" onClick={() => zoomTo(zoom / 1.25)}>
                <Minus />
              </Button>
              <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={() => zoomTo(zoom * 1.25)}>
                <Plus />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setFitted(true)} title="Fit to screen (0)">
              Fit
            </Button>
            <Button variant="outline" size="sm" onClick={() => zoomTo(1)} title="Actual pixels">
              100%
            </Button>
            <Button variant="outline" size="icon-sm" onClick={toggleFullscreen} aria-label={fullscreen ? "Exit full screen" : "Full-size preview"}>
              {fullscreen ? <Minimize /> : <Maximize />}
            </Button>
          </div>
        </div>

        <div
          ref={viewportRef}
          className={cn(
            "relative overflow-auto rounded-2xl border bg-muted/40 [overscroll-behavior:contain]",
            fullscreen ? "h-[calc(100vh-5rem)]" : "h-[min(68vh,720px)] min-h-80",
          )}
        >
          <div className="flex min-h-full w-max min-w-full p-6">
            <div
              className="relative m-auto shrink-0 touch-none overflow-hidden rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.12),0_12px_40px_-12px_rgba(0,0,0,0.35)]"
              style={{
                width: dispW,
                height: dispH,
                ...BG_STYLES[bg],
                cursor: view === "compare" ? "ew-resize" : brushing ? "none" : panning ? "grabbing" : "grab",
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onPointerLeave={() => setCursor(null)}
            >
              {/* Local object URL of the user's own upload. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={originalUrl}
                alt="Original upload"
                draggable={false}
                className="pointer-events-none absolute inset-0 size-full select-none"
                style={{
                  opacity: view === "compare" ? 1 : ghost ? 0.28 : 0,
                  clipPath: view === "compare" ? `inset(0 ${100 - split}% 0 0)` : undefined,
                }}
              />
              <canvas
                ref={canvasRef}
                className="pointer-events-none absolute inset-0 size-full"
                style={{
                  clipPath: view === "compare" ? `inset(0 0 0 ${split}%)` : undefined,
                  imageRendering: zoom >= 2 ? "pixelated" : "auto",
                }}
              />
              {view === "compare" && (
                <div className="pointer-events-none absolute inset-y-0" style={{ left: `${split}%` }}>
                  <div className="absolute inset-y-0 -ml-px w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" />
                  <div className="absolute top-1/2 -ml-4 -mt-4 flex size-8 items-center justify-center rounded-full border bg-white text-neutral-700 shadow-lg">
                    <Expand className="size-3.5 rotate-45" />
                  </div>
                  <span className="absolute right-3 top-3 whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                    Before
                  </span>
                  <span className="absolute left-3 top-3 whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                    After
                  </span>
                </div>
              )}
              {brushing && cursor && (
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute rounded-full border-2 mix-blend-difference",
                    tool === "erase" ? "border-white" : "border-white border-dashed",
                  )}
                  style={{ width: brush, height: brush, left: cursor.x - brush / 2, top: cursor.y - brush / 2 }}
                />
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {view === "compare"
            ? "Drag across the image to compare the original with the cutout."
            : tool === "move"
              ? "Drag to pan · Ctrl/⌘ + scroll to zoom."
              : tool === "erase"
                ? "Paint over anything that should be removed. [ and ] change the brush size."
                : "Paint to bring back parts of the original product (shown faintly)."}
        </p>
      </div>

      {/* Sidebar */}
      <div className="flex flex-col gap-4">
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={originalUrl} alt="" className="size-14 shrink-0 rounded-lg border object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={fileName}>
                {fileName}
              </p>
              <p className="text-xs text-muted-foreground">
                Original · {W}×{H}px
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={onReplace}>
              <RefreshCw /> Replace
            </Button>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Refine</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Segmented<Tool>
              value={tool}
              onChange={(t) => {
                setTool(t);
                if (t !== "move") setView("cutout");
              }}
              className="w-full"
              options={[
                { id: "move", label: <><Hand className="size-3.5" /> Move</>, title: "Pan (V)" },
                { id: "erase", label: <><Eraser className="size-3.5" /> Erase</>, title: "Erase brush (E)" },
                { id: "restore", label: <><Brush className="size-3.5" /> Restore</>, title: "Restore brush (R)" },
              ]}
            />
            <label className="flex flex-col gap-2">
              <span className="flex items-center justify-between text-xs text-muted-foreground">
                Brush size <span className="tabular-nums">{brush}px</span>
              </span>
              <input
                type="range"
                min={MIN_BRUSH}
                max={MAX_BRUSH}
                value={brush}
                onChange={(e) => setBrush(Number(e.target.value))}
                className="w-full accent-[var(--brand-1)]"
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" onClick={undo} disabled={!engine.canUndo} title="Undo (Ctrl+Z)">
                <Undo2 /> Undo
              </Button>
              <Button variant="outline" size="sm" onClick={redo} disabled={!engine.canRedo} title="Redo (Ctrl+Shift+Z)">
                <Redo2 /> Redo
              </Button>
              <Button variant="outline" size="sm" onClick={reset} title="Back to the automatic cutout">
                <RotateCcw /> Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Export</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Framing</span>
              <Segmented<ExportOptions["framing"]>
                value={framing}
                onChange={setFraming}
                className="w-full"
                options={[
                  { id: "canvas", label: "Original canvas" },
                  { id: "tight", label: "Tight crop" },
                ]}
              />
            </div>
            {framing === "tight" && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">Transparent padding</span>
                <Segmented<string>
                  value={String(padding)}
                  onChange={(v) => setPadding(Number(v))}
                  className="w-full"
                  options={[
                    { id: "0", label: "None" },
                    { id: "0.02", label: "2%" },
                    { id: "0.05", label: "5%" },
                    { id: "0.1", label: "10%" },
                  ]}
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Resolution</span>
              <Segmented<"full" | "web">
                value={resolution}
                onChange={setResolution}
                className="w-full"
                options={[
                  { id: "full", label: "High-res (full)" },
                  { id: "web", label: `Web (${WEB_MAX_SIDE}px)` },
                ]}
              />
            </div>
            <Button onClick={download} disabled={exporting} className="h-10 bg-brand text-white hover:opacity-90">
              {exporting ? <Loader2 className="animate-spin" /> : <Download />} Download transparent PNG
            </Button>

            <div className="flex flex-col gap-2 border-t pt-4">
              <span className="text-xs text-muted-foreground">Save to your asset library (optional)</span>
              <div className="flex gap-2">
                <Input value={assetName} onChange={(e) => setAssetName(e.target.value)} maxLength={120} aria-label="Asset name" />
                <Button variant="outline" onClick={saveToLibrary} disabled={saving || !assetName.trim()}>
                  {saving ? <Loader2 className="animate-spin" /> : <Save />} Save
                </Button>
              </div>
              <Link href="/background-remover/library" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <Library className="size-3.5" /> View saved cutouts
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="px-1 text-xs text-muted-foreground">
          Using it in an ad? Download the PNG, then upload it as the product photo in{" "}
          <Link href="/products/new" className="underline underline-offset-4">
            New product
          </Link>{" "}
          or any other tool.
        </p>
      </div>
    </div>
  );
}
