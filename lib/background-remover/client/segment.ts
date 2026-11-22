// Feature 4 — producing the transparency mask for a product photo.
//
// Two dedicated segmentation paths, never a generative model:
//   • cloud   — /api/background-remover/segment (fal BiRefNet / remove.bg),
//               used when the server has a provider key configured;
//   • browser — BiRefNet-lite (MIT licence) running on the user's own device
//               via transformers.js in a Web Worker (WebGPU when available,
//               WebAssembly otherwise). No key, no server load, and the
//               photo never leaves the browser.
// Either way the result is just an alpha mask at the original resolution.
// On a laptop CPU the browser path runs BEN2 (BiRefNet won't fit in memory).

const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js";
/** GPU path: BiRefNet-lite (MIT) — the best open matting quality, too big for WebAssembly memory. */
const GPU_MODEL = { model: "onnx-community/BiRefNet_lite-ONNX" };
/**
 * CPU path: BEN2 (MIT) — fits in WebAssembly memory (BiRefNet needs ~5.5 GB
 * and doesn't). ~220 MB once, then roughly 20–40 s per photo on a laptop CPU.
 */
const CPU_MODEL = { model: "onnx-community/BEN2-ONNX", dtype: "fp16" };

/** Both browser models work at 1024²; feeding them more pixels adds time, not detail. */
const BROWSER_INPUT_SIDE = 1024;
/** Cloud models run at 2048², and the upload must stay under Vercel's body limit. */
const CLOUD_INPUT_SIDE = 2048;

export type SegmentProgress =
  | { stage: "detect"; download?: { loaded: number; total: number }; device?: string }
  | { stage: "segment"; device?: string };

export type RawMask = { data: Uint8Array; width: number; height: number };

// The worker loads transformers.js from the CDN at runtime, so the app
// bundle never includes onnxruntime (and the build never has to resolve it).
const WORKER_SOURCE = `
const GPU = ${JSON.stringify(GPU_MODEL)};
const CPU = ${JSON.stringify(CPU_MODEL)};
let segmenterPromise = null;
let lib = null;
// Once WebGPU has failed on this device (some GPUs load the model but hit
// shader limits at inference), stay on WebAssembly for the session.
let forceWasm = false;

async function chooseDevice() {
  if (forceWasm) return { device: "wasm", ...CPU };
  try {
    const gpu = self.navigator && self.navigator.gpu;
    if (gpu) {
      const adapter = await gpu.requestAdapter();
      // BiRefNet needs more than 16 storage buffers per shader stage; many
      // integrated GPUs (e.g. Intel Iris Xe) cap at 16, so skip them up front
      // rather than download the model only to fail at inference.
      if (adapter && adapter.limits.maxStorageBuffersPerShaderStage > 16) return { device: "webgpu", model: GPU.model, dtype: adapter.features.has("shader-f16") ? "fp16" : "fp32" };
    }
  } catch (e) {}
  return { device: "wasm", ...CPU };
}

const files = {};
function progress_callback(p) {
  if (p.status === "progress" && p.file && p.total) {
    files[p.file] = { loaded: p.loaded, total: p.total };
    let loaded = 0, total = 0;
    for (const k in files) { loaded += files[k].loaded; total += files[k].total; }
    self.postMessage({ type: "download", loaded, total });
  }
}

function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      if (!lib) {
        lib = await import(${JSON.stringify(TRANSFORMERS_URL)});
        lib.env.allowLocalModels = false;
      }
      const choice = await chooseDevice();
      self.postMessage({ type: "device", device: choice.device });
      try {
        const segmenter = await lib.pipeline("background-removal", choice.model, { device: choice.device, dtype: choice.dtype, progress_callback });
        return { segmenter, device: choice.device };
      } catch (err) {
        // Let the page retry in a fresh worker on WebAssembly.
        if (choice.device !== "wasm" && err && typeof err === "object") err.gpu = true;
        throw err;
      }
    })();
    segmenterPromise.catch(() => { segmenterPromise = null; });
  }
  return segmenterPromise;
}

self.onmessage = async (event) => {
  const { id, width, height, pixels } = event.data;
  if (event.data.forceWasm) forceWasm = true;
  let device = "wasm";
  try {
    const loaded = await getSegmenter(); // model download / initialisation
    device = loaded.device;
    self.postMessage({ id, type: "segment" });
    const out = await loaded.segmenter(new lib.RawImage(new Uint8ClampedArray(pixels), width, height, 4));
    const n = out.width * out.height;
    const mask = new Uint8Array(n);
    const step = out.channels;
    for (let i = 0; i < n; i++) mask[i] = out.data[i * step + step - 1];
    self.postMessage({ id, type: "done", width: out.width, height: out.height, mask: mask.buffer }, [mask.buffer]);
  } catch (err) {
    // A GPU failure is flagged so the page can retry in a fresh worker on
    // WebAssembly (ONNX Runtime keeps its WebGPU state for the worker's life).
    self.postMessage({ id, type: "error", gpu: device !== "wasm" || Boolean(err && err.gpu), message: String((err && err.message) || err) });
  }
};
`;

let worker: Worker | null = null;
let nextId = 1;

const PREFER_WASM_KEY = "bg-remover:prefer-wasm";
/** Set once WebGPU has failed on this device; remembered so later visits skip it. */
let preferWasm = (() => {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(PREFER_WASM_KEY) === "1";
  } catch {
    return false;
  }
})();

function rememberWasm() {
  preferWasm = true;
  try {
    localStorage.setItem(PREFER_WASM_KEY, "1");
  } catch {
    // Storage unavailable — the in-memory flag still covers this session.
  }
}

function resetWorker() {
  worker?.terminate();
  worker = null;
}

function getWorker(): Worker {
  if (!worker) {
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
    worker = new Worker(url, { type: "module" });
  }
  return worker;
}

function drawScaled(source: CanvasImageSource, width: number, height: number, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function segmentInBrowser(
  source: CanvasImageSource,
  width: number,
  height: number,
  onProgress: (p: SegmentProgress) => void,
): Promise<RawMask> {
  const canvas = drawScaled(source, width, height, BROWSER_INPUT_SIDE);
  const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
  try {
    return await runInWorker(canvas.width, canvas.height, pixels, onProgress);
  } catch (err) {
    if (!(err as { gpu?: boolean }).gpu) throw err;
    rememberWasm();
    resetWorker();
    return runInWorker(canvas.width, canvas.height, pixels, onProgress);
  }
}

function runInWorker(
  width: number,
  height: number,
  pixels: Uint8ClampedArray,
  onProgress: (p: SegmentProgress) => void,
): Promise<RawMask> {
  const w = getWorker();
  const id = nextId++;
  let device: string | undefined;
  const copy = pixels.slice(); // transferred to the worker; keep the original for a retry

  return new Promise<RawMask>((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "device") device = msg.device;
      else if (msg.type === "download") onProgress({ stage: "detect", download: { loaded: msg.loaded, total: msg.total }, device });
      else if (msg.id !== id) return;
      else if (msg.type === "segment") onProgress({ stage: "segment", device });
      else {
        w.removeEventListener("message", onMessage);
        w.removeEventListener("error", onError);
        if (msg.type === "done") resolve({ data: new Uint8Array(msg.mask), width: msg.width, height: msg.height });
        else reject(Object.assign(new Error(msg.message || "Background removal failed."), { gpu: Boolean(msg.gpu) }));
      }
    };
    const onError = (event: ErrorEvent) => {
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      resetWorker();
      reject(new Error(event.message || "The background-removal model couldn't start in this browser."));
    };
    w.addEventListener("message", onMessage);
    w.addEventListener("error", onError);
    onProgress({ stage: "detect", device });
    w.postMessage({ id, width, height, pixels: copy.buffer, forceWasm: preferWasm }, [copy.buffer]);
  });
}

/** Thrown when the server says it has no provider, so the caller can fall back. */
export class CloudUnavailableError extends Error {}

export async function segmentInCloud(
  source: CanvasImageSource,
  width: number,
  height: number,
  onProgress: (p: SegmentProgress) => void,
): Promise<RawMask> {
  onProgress({ stage: "detect" });
  const canvas = drawScaled(source, width, height, CLOUD_INPUT_SIDE);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
  if (!blob) throw new Error("Couldn't prepare the image for upload.");

  const form = new FormData();
  form.append("image", blob, "product.jpg");
  onProgress({ stage: "segment" });
  const res = await fetch("/api/background-remover/segment", { method: "POST", body: form });
  if (res.status === 501) throw new CloudUnavailableError();
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    const err = new Error(body.error || "Background removal failed.");
    // Validation errors (4xx) are the user's to fix; service errors may fall back.
    if (res.status < 500) (err as Error & { fatal?: boolean }).fatal = true;
    throw err;
  }

  const bitmap = await createImageBitmap(await res.blob());
  const c = document.createElement("canvas");
  c.width = bitmap.width;
  c.height = bitmap.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const rgba = ctx.getImageData(0, 0, c.width, c.height).data;
  const data = new Uint8Array(c.width * c.height);
  for (let i = 0; i < data.length; i++) data[i] = rgba[i * 4];
  return { data, width: c.width, height: c.height };
}
