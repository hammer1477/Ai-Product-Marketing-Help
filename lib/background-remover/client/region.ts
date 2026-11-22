// Feature 4 — running segmentation on the whole photo or on a user-chosen area.

import { buildBaseMask } from "./engine";
import { CloudUnavailableError, segmentInBrowser, segmentInCloud, type RawMask, type SegmentProgress } from "./segment";

export type Rect = { x: number; y: number; width: number; height: number };

/**
 * Cloud first when the server has a provider configured (falling back to the
 * browser if the service is unavailable), otherwise the browser model.
 */
export async function runSegmentation(
  source: CanvasImageSource,
  width: number,
  height: number,
  cloudEnabled: boolean,
  onProgress: (p: SegmentProgress) => void,
  onCloudFallback?: () => void,
): Promise<RawMask> {
  if (!cloudEnabled) return segmentInBrowser(source, width, height, onProgress);
  try {
    return await segmentInCloud(source, width, height, onProgress);
  } catch (err) {
    if ((err as { fatal?: boolean }).fatal) throw err;
    if (!(err instanceof CloudUnavailableError)) onCloudFallback?.();
    return segmentInBrowser(source, width, height, onProgress);
  }
}

/**
 * "Select product area": cuts out only what's inside `rect` of the original
 * photo. The model sees just that area — so a box, table or shelf around the
 * product no longer competes for "main object" — and everything outside the
 * rectangle is transparent. Returns a full-size base mask.
 */
export async function segmentArea(
  original: ImageBitmap,
  rect: Rect,
  cloudEnabled: boolean,
  onProgress: (p: SegmentProgress) => void,
  onCloudFallback?: () => void,
): Promise<{ mask: HTMLCanvasElement; coverage: number }> {
  const crop = document.createElement("canvas");
  crop.width = rect.width;
  crop.height = rect.height;
  crop.getContext("2d")!.drawImage(original, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);

  const raw = await runSegmentation(crop, rect.width, rect.height, cloudEnabled, onProgress, onCloudFallback);
  const { mask: part, coverage } = buildBaseMask(raw, rect.width, rect.height);

  const full = document.createElement("canvas");
  full.width = original.width;
  full.height = original.height;
  full.getContext("2d")!.drawImage(part, rect.x, rect.y);
  return { mask: full, coverage };
}
