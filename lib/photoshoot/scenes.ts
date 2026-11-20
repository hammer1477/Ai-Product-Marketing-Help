import { IMAGE_QUALITY } from "../ai/personas";

// Scene presets for product photoshoots. Each prompt describes an EMPTY
// set — the product is never generated, only the place it's photographed
// in. The real cutout is composited in afterwards.

export type PhotoScene = { id: string; label: string; prompt: string; swatch: string };

export const PHOTO_SCENES: PhotoScene[] = [
  { id: "marble", label: "Marble counter", swatch: "linear-gradient(135deg,#f4f1ec,#d9d4cc)", prompt: "polished white carrara marble countertop, soft blurred bright bathroom background, morning window light" },
  { id: "studio", label: "Pastel studio", swatch: "linear-gradient(135deg,#f7d9e3,#cfe3f7)", prompt: "seamless pastel studio backdrop, simple geometric plinth, soft diffused studio lighting, minimal" },
  { id: "wood", label: "Warm kitchen", swatch: "linear-gradient(135deg,#c08a5b,#6e4528)", prompt: "rustic oak wooden table in a warm cozy kitchen, blurred background with plants, golden afternoon light" },
  { id: "beach", label: "Golden beach", swatch: "linear-gradient(135deg,#f6c56f,#3fa7c9)", prompt: "smooth sand surface on a beach at golden hour, blurred turquoise sea and sky behind, warm sunlight" },
  { id: "moss", label: "Forest moss", swatch: "linear-gradient(135deg,#6f8f4e,#2f4a2a)", prompt: "flat mossy stone on a forest floor, ferns and dappled sunlight, shallow depth of field, natural" },
  { id: "concrete", label: "Urban concrete", swatch: "linear-gradient(135deg,#a9a9a9,#4b4b4b)", prompt: "raw concrete ledge, blurred city street background with bokeh, cool overcast daylight, editorial" },
  { id: "luxe", label: "Dark luxe", swatch: "linear-gradient(135deg,#2b2b2b,#0b0b0b)", prompt: "black glossy reflective surface, dark moody backdrop with a soft warm spotlight, luxury product photography" },
  { id: "water", label: "Water splash", swatch: "linear-gradient(135deg,#9fe3ff,#2b7bd6)", prompt: "shallow clear water surface with gentle ripples, bright blue gradient background, fresh and clean, droplets" },
  { id: "desk", label: "Creator desk", swatch: "linear-gradient(135deg,#e9e4da,#9aa59a)", prompt: "minimal light wooden desk, blurred home office with a plant and warm lamp, soft daylight" },
  { id: "holiday", label: "Festive", swatch: "linear-gradient(135deg,#b3202a,#1f5c3a)", prompt: "festive table with soft bokeh lights, pine branches and ribbons at the edges, warm cozy glow" },
];

export function sceneById(id: string | null | undefined): PhotoScene | undefined {
  return PHOTO_SCENES.find((scene) => scene.id === id);
}

/** The full prompt for a scene: an empty set with a clear surface for the product. */
export function scenePrompt(scene: string): string {
  return `${scene}. An empty set with a clear flat surface in the lower middle of the frame where a product will be placed. ${IMAGE_QUALITY}`;
}
