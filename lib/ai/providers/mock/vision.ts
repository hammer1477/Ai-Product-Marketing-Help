import type { ImageAnalysisProvider } from "../types";
import { mockDelay } from "./delay";

const SAMPLE_CATEGORIES = [
  "Beauty & Skincare",
  "Food & Beverage",
  "Fashion & Apparel",
  "Electronics & Technology",
  "Home & Living",
  "Health & Wellness",
];

// Deliberately returns LOW confidence (0.35-0.5) on every call, and a
// category guess that ignores the user's own input — a real vision model
// genuinely wouldn't know what the user typed. This forces the "AI
// suggested this — please confirm" review UI path to always be exercised
// in local dev, including the "AI disagrees with the user" case, even with
// no real vision provider configured.
export class MockImageAnalysisProvider implements ImageAnalysisProvider {
  readonly id = "mock";

  async analyzeImage(args: {
    imageUrl: string;
    hints?: { userProvidedCategory?: string; userProvidedName?: string };
  }) {
    await mockDelay();

    const suggestedCategory = SAMPLE_CATEGORIES[Math.floor(Math.random() * SAMPLE_CATEGORIES.length)];
    const confidence = 0.35 + Math.random() * 0.15;

    return {
      data: {
        suggestedCategory,
        suggestedProductName: args.hints?.userProvidedName,
        detectedColors: ["#f8fafc", "#0f172a", "#4ade80"],
        detectedText: [],
        productType: "product",
        visibleClaims: [],
        materials: [],
        visualDetails: [],
        styleKeywords: ["modern"],
        confidence,
        notes: "Mock analysis — no real vision model configured. Low confidence is intentional.",
      },
      usage: { costUsd: 0 },
    };
  }
}
