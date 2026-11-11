export type Usage = { costUsd: number };

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface TextGenerationProvider {
  readonly id: string; // "mock" | "openai" | "anthropic"

  generateJSON<T>(args: {
    system: string;
    messages: ChatMessage[];
    /** JSON schema the response must conform to. */
    schema: unknown;
    /**
     * Images (URLs or data URIs) the model should see alongside the first
     * user message. Providers without vision ignore them.
     */
    images?: string[];
    /** Sampling temperature: low for extraction, higher for creative work. */
    temperature?: number;
  }): Promise<{ data: T; usage: Usage & { inputTokens: number; outputTokens: number } }>;
}

export type ImageAnalysisResult = {
  suggestedCategory: string;
  suggestedProductName?: string;
  detectedColors: string[];
  detectedText?: string[];
  /** What the product is, in a few words ("over-ear wireless headphones"). */
  productType?: string;
  /** Brand name if it is legibly printed on the product or packaging. */
  brandGuess?: string;
  /** Claims printed on the product/packaging, verbatim ("SPF 50", "500 ml"). */
  visibleClaims?: string[];
  /** Visible materials and finishes ("brushed aluminium", "matte plastic"). */
  materials?: string[];
  /** Shape, form factor, notable design details. */
  visualDetails?: string[];
  /** Aesthetic keywords ("minimal", "luxury", "playful"). */
  styleKeywords?: string[];
  /** Who the product looks aimed at, as a hint only. */
  audienceHint?: string;
  /** 0-1. UI must label this as "AI suggestion — please confirm" and never
   * auto-promote it to a canonical product field below a reasonable threshold. */
  confidence: number;
  notes?: string;
};

export interface ImageAnalysisProvider {
  readonly id: string;

  analyzeImage(args: {
    imageUrl: string;
    hints?: { userProvidedCategory?: string; userProvidedName?: string };
  }): Promise<{ data: ImageAnalysisResult; usage: Usage }>;
}

export type ImageGenerationMode = "text-to-image" | "image-to-image" | "inpaint";

export interface ImageGenerationProvider {
  readonly id: string;

  generate(args: {
    prompt: string;
    /** Required for image-to-image/inpaint — preserves product identity. */
    referenceImageUrl?: string;
    mode: ImageGenerationMode;
    width: number;
    height: number;
    /** Optional mask URL protecting the product/logo region from alteration. */
    preserveSubjectMask?: string;
  }): Promise<{ imageUrl: string; usage: Usage }>;
}

// Reserved for Phase 3 (Product Video Studio). Defining the interface now
// costs nothing and means adding a real implementation later requires no
// changes to any calling code.
export interface ImageToVideoProvider {
  readonly id: string;

  generate(args: {
    imageUrl: string;
    prompt?: string;
    durationSeconds: number;
  }): Promise<{ videoUrl: string; usage: Usage }>;
}
