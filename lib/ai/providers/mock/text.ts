import type { ChatMessage, TextGenerationProvider } from "../types";
import { mockDelay } from "./delay";

const PLACEHOLDER_TEMPLATES: Record<string, string> = {
  headline: "Experience the Difference Today",
  productname: "Sample Product",
  description: "A thoughtfully designed product built to make everyday moments better.",
  ctalabel: "Shop Now",
  sellingpoint: "Premium quality, built to last",
  badgelabel: "New Arrival",
};

function placeholderStringFor(fieldName: string): string {
  const lowerKey = fieldName.toLowerCase();
  const match = Object.entries(PLACEHOLDER_TEMPLATES).find(([key]) => lowerKey.includes(key));
  return match ? match[1] : `Mock ${fieldName}`;
}

// Walks an arbitrary JSON Schema and synthesizes a plausible-looking value,
// so this mock works for whatever structured content shape the orchestration
// engine asks for, without hardcoding any one call site's schema here.
function synthesizeFromSchema(schema: any, fieldName = "value"): unknown {
  if (!schema) return null;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];

  switch (schema.type) {
    case "object": {
      const result: Record<string, unknown> = {};
      const properties = schema.properties ?? {};
      for (const key of Object.keys(properties)) {
        result[key] = synthesizeFromSchema(properties[key], key);
      }
      return result;
    }
    case "array": {
      const count = schema.minItems ?? 3;
      return Array.from({ length: count }, (_, i) => synthesizeFromSchema(schema.items ?? {}, `${fieldName}${i}`));
    }
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return false;
    case "string":
    default:
      return placeholderStringFor(fieldName);
  }
}

export class MockTextGenerationProvider implements TextGenerationProvider {
  readonly id = "mock";

  async generateJSON<T>(args: {
    system: string;
    messages: ChatMessage[];
    schema: unknown;
  }): Promise<{ data: T; usage: { inputTokens: number; outputTokens: number; costUsd: number } }> {
    await mockDelay();

    const data = synthesizeFromSchema(args.schema) as T;
    const inputTokens = args.system.length + args.messages.reduce((sum, m) => sum + m.content.length, 0);

    return {
      data,
      usage: { inputTokens: Math.ceil(inputTokens / 4), outputTokens: 120, costUsd: 0 },
    };
  }
}
