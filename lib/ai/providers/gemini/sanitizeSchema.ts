// Gemini's `responseSchema` accepts only a constrained subset of JSON
// Schema (type, description, enum, items, properties, required,
// propertyOrdering — notably NOT minItems/maxItems/additionalProperties).
// Our CREATIVE_CONTENT_SCHEMA is written as plain JSON Schema for the mock
// provider's generic synthesizer, so strip anything Gemini doesn't support
// rather than maintaining two parallel schema definitions.
export function sanitizeSchemaForGemini(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;

  const allowedKeys = ["type", "description", "enum", "items", "properties", "required", "propertyOrdering"];
  const result: Record<string, unknown> = {};

  for (const key of allowedKeys) {
    if (!(key in schema)) continue;
    if (key === "items") {
      result.items = sanitizeSchemaForGemini(schema.items);
    } else if (key === "properties") {
      const props: Record<string, unknown> = {};
      for (const propKey of Object.keys(schema.properties)) {
        props[propKey] = sanitizeSchemaForGemini(schema.properties[propKey]);
      }
      result.properties = props;
    } else {
      result[key] = schema[key];
    }
  }

  return result;
}
