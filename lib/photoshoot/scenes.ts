import { IMAGE_QUALITY } from "../ai/personas";

// Scene presets for product photoshoots. Each prompt describes an EMPTY
// set — the product is never generated, only the place it's photographed
// in. The real cutout is composited in afterwards.

export type PhotoScene = {
  id: string;
  label: string;
  prompt: string;
  swatch: string;
  /** A reflective surface: the composite adds a reflection under the product. */
  glossy?: boolean;
};

export const PHOTO_SCENES: PhotoScene[] = [
  { id: "marble", label: "Marble counter", glossy: true, swatch: "linear-gradient(135deg,#f4f1ec,#d9d4cc)", prompt: "polished white carrara marble countertop, soft blurred bright bathroom background, morning window light" },
  { id: "studio", label: "Pastel studio", swatch: "linear-gradient(135deg,#f7d9e3,#cfe3f7)", prompt: "seamless pastel studio backdrop, simple geometric plinth, soft diffused studio lighting, minimal" },
  { id: "wood", label: "Warm kitchen", swatch: "linear-gradient(135deg,#c08a5b,#6e4528)", prompt: "rustic oak wooden table in a warm cozy kitchen, blurred background with plants, golden afternoon light" },
  { id: "beach", label: "Golden beach", swatch: "linear-gradient(135deg,#f6c56f,#3fa7c9)", prompt: "smooth sand surface on a beach at golden hour, blurred turquoise sea and sky behind, warm sunlight" },
  { id: "moss", label: "Forest moss", swatch: "linear-gradient(135deg,#6f8f4e,#2f4a2a)", prompt: "flat mossy stone on a forest floor, ferns and dappled sunlight, shallow depth of field, natural" },
  { id: "concrete", label: "Urban concrete", swatch: "linear-gradient(135deg,#a9a9a9,#4b4b4b)", prompt: "raw concrete ledge, blurred city street background with bokeh, cool overcast daylight, editorial" },
  { id: "luxe", label: "Dark luxe", glossy: true, swatch: "linear-gradient(135deg,#2b2b2b,#0b0b0b)", prompt: "black glossy reflective surface, dark moody backdrop with a soft warm spotlight, luxury product photography" },
  { id: "water", label: "Water splash", glossy: true, swatch: "linear-gradient(135deg,#9fe3ff,#2b7bd6)", prompt: "shallow clear water surface with gentle ripples, bright blue gradient background, fresh and clean, droplets" },
  { id: "desk", label: "Creator desk", swatch: "linear-gradient(135deg,#e9e4da,#9aa59a)", prompt: "minimal light wooden desk, blurred home office with a plant and warm lamp, soft daylight" },
  { id: "holiday", label: "Festive", swatch: "linear-gradient(135deg,#b3202a,#1f5c3a)", prompt: "festive table with soft bokeh lights, pine branches and ribbons at the edges, warm cozy glow" },
  { id: "linen", label: "Linen bedroom", swatch: "linear-gradient(135deg,#f3ece2,#c9b8a3)", prompt: "crisp white linen bedsheet surface, blurred sunlit bedroom behind, soft morning light through sheer curtains, calm and airy" },
  { id: "cafe", label: "Café table", swatch: "linear-gradient(135deg,#d8b48a,#5a3b28)", prompt: "small round café table top, blurred cosy coffee shop interior with warm bokeh lights behind, late afternoon" },
  { id: "pedestal", label: "Stone pedestal", swatch: "linear-gradient(135deg,#e6dfd3,#a59b8c)", prompt: "round travertine stone pedestal against a warm beige seamless wall, a single soft palm-leaf shadow, gallery lighting" },
  { id: "gradient", label: "Colour gradient", glossy: true, swatch: "linear-gradient(135deg,#ff8a65,#7c4dff)", prompt: "smooth glossy acrylic floor reflecting a vivid orange-to-violet gradient backdrop, clean commercial studio lighting, bold and modern" },
  { id: "window", label: "Sunlit window", swatch: "linear-gradient(135deg,#fff3d6,#e0b77a)", prompt: "white windowsill bathed in golden sunlight, crisp window-frame shadows across the surface, blurred greenery outside" },
  { id: "picnic", label: "Picnic", swatch: "linear-gradient(135deg,#f2d27a,#6aa84f)", prompt: "checkered picnic blanket on a sunny lawn, blurred park trees and soft sun flare behind, cheerful summer day" },
];

export function sceneById(id: string | null | undefined): PhotoScene | undefined {
  return PHOTO_SCENES.find((scene) => scene.id === id);
}

/** Whether a free-text set brief describes a reflective surface. */
export function looksGlossy(text: string): boolean {
  return /\b(gloss|glossy|reflect|reflective|mirror|marble|water|acrylic|lacquer|polished|wet|chrome|glass table)\b/i.test(text);
}

export type FramingChoice = "hero" | "closeup" | "thirds";

const FRAMING_SPACE: Record<FramingChoice, string> = {
  hero: "The centre foreground is an empty, uncluttered flat surface where a product will be placed",
  closeup: "Shot close: the flat surface fills the bottom of the frame and the centre is empty for a product, background very softly out of focus",
  thirds: "The flat surface spans the whole width of the lower third; keep it empty and uncluttered across the frame, with any props only at the far edges",
};

/** The full prompt for a scene: an empty set with a clear surface for the product. */
export function scenePrompt(scene: string, framing: FramingChoice = "hero"): string {
  return (
    `${scene}. ${FRAMING_SPACE[framing]}. Eye-level camera, natural perspective, the surface is level and fully visible. ` +
    `No products, no people, no hands, no text, no logos, no packaging. ${IMAGE_QUALITY}`
  );
}
