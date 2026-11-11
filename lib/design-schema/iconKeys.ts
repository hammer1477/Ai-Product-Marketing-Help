// The icon names, without the icon components — so schemas and the block
// library can list them without importing React. Must match
// ICON_REGISTRY in render/icons.tsx (enforced there by type).
export const ICON_KEYS = [
  "check",
  "star",
  "leaf",
  "shield",
  "truck",
  "heart",
  "sparkles",
  "tag",
  "clock",
  "award",
  "zap",
  "gift",
  "droplet",
  "battery",
  "sun",
  "music",
  "lock",
] as const;

export type IconName = (typeof ICON_KEYS)[number];

export function isIconName(value: unknown): value is IconName {
  return typeof value === "string" && (ICON_KEYS as readonly string[]).includes(value);
}
