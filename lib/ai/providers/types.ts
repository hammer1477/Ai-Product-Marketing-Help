export type Usage = { costUsd: number };

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface TextGenerationProvider {
  readonly id: string; // "mock" | "openai" | "anthropic"

  generateJSON<T>(args: {
    system: string;
    messages: ChatMessage[];
    /** JSON schema the response must conform to. */
    schema: unknown;
  }): Promise<{ data: T; usage: Usage & { inputTokens: number; outputTokens: number } }>;
}

export type ImageAnalysisResult = {
  suggestedCategory: string;
  suggestedProductName?: string;
  detectedColors: string[];
  detectedText?: string[];
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
