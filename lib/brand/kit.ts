import { isFontFamily, type FontFamily } from "../design-schema/fontRegistry";
import { isHex, mix, WHITE } from "../orchestration/color";
import type { ResolvedStyle } from "../orchestration/styles";

// A brand kit: the parts of a brand that should look and sound the same in
// every ad. Saved once on /brand, applied by the engine to every new
// generation, and offered in the editor for designs made before it existed.

export type BrandColors = { ink: string; accent: string; text: string; muted: string };

export type BrandLogo = {
  /** Small PNG data URI, so designs embed it and never depend on storage. */
  src: string;
  /** width / height. */
  aspect: number;
  /** Whether the logo is mostly light or dark ink — decides if it needs a chip. */
  tone: "light" | "dark";
};

export type BrandKit = {
  brandName?: string;
  tagline?: string;
  voice?: string;
  colors?: BrandColors;
  headlineFont?: FontFamily;
  bodyFont?: FontFamily;
  logo?: BrandLogo;
};

type BrandKitRow = {
  brand_name: string | null;
  tagline: string | null;
  voice: string | null;
  colors: unknown;
  headline_font: string | null;
  body_font: string | null;
  logo_data_uri: string | null;
  logo_aspect: number | null;
  logo_tone: string | null;
};

export const BRAND_KIT_COLUMNS =
  "brand_name, tagline, voice, colors, headline_font, body_font, logo_data_uri, logo_aspect, logo_tone";

function readColors(raw: unknown): BrandColors | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  const ok = (v: unknown): v is string => typeof v === "string" && isHex(v);
  return ok(c.ink) && ok(c.accent) && ok(c.text) && ok(c.muted)
    ? { ink: c.ink, accent: c.accent, text: c.text, muted: c.muted }
    : undefined;
}

export function readBrandKit(row: BrandKitRow | null | undefined): BrandKit | null {
  if (!row) return null;
  const kit: BrandKit = {
    brandName: row.brand_name?.trim() || undefined,
    tagline: row.tagline?.trim() || undefined,
    voice: row.voice?.trim() || undefined,
    colors: readColors(row.colors),
    headlineFont: isFontFamily(row.headline_font) ? row.headline_font : undefined,
    bodyFont: isFontFamily(row.body_font) ? row.body_font : undefined,
    logo: row.logo_data_uri
      ? {
          src: row.logo_data_uri,
          aspect: row.logo_aspect && row.logo_aspect > 0 ? Number(row.logo_aspect) : 1,
          tone: row.logo_tone === "light" ? "light" : "dark",
        }
      : undefined,
  };
  return hasAnything(kit) ? kit : null;
}

function hasAnything(kit: BrandKit): boolean {
  return Object.values(kit).some((v) => v !== undefined);
}

/** Whether a kit changes how a design looks (as opposed to only the copy). */
export function kitHasLook(kit: BrandKit | null): boolean {
  return Boolean(kit && (kit.colors || kit.headlineFont || kit.bodyFont));
}

/**
 * The style with the brand's palette and typefaces swapped in.
 *
 * Brand colours are applied *exactly*, as overrides. Handed over only as a
 * base palette, templates repaint them to their own scheme — a paper
 * template swaps the brand background for cream, a dark one muddies a light
 * background — and the brand's colours never actually appear.
 */
export function applyBrandStyle(style: ResolvedStyle, kit: BrandKit | null): ResolvedStyle {
  if (!kit) return style;
  let next = style;
  if (kit.colors) {
    next = {
      ...next,
      ink: kit.colors.ink,
      accent: kit.colors.accent,
      textPrimary: kit.colors.text,
      textMuted: kit.colors.muted,
      panel: mix(kit.colors.ink, WHITE, 0.07),
      accent2: undefined,
      colorOverrides: {
        background: kit.colors.ink,
        text: kit.colors.text,
        muted: kit.colors.muted,
        accent: kit.colors.accent,
      },
    };
  }
  if (kit.headlineFont || kit.bodyFont) {
    next = {
      ...next,
      fontOverrides: {
        ...next.fontOverrides,
        ...(kit.headlineFont ? { headline: kit.headlineFont } : {}),
        ...(kit.bodyFont ? { body: kit.bodyFont } : {}),
      },
    };
  }
  return next;
}

/** Whether `style` already carries the kit's colours and fonts. */
export function brandApplied(style: ResolvedStyle, kit: BrandKit | null): boolean {
  if (!kit) return false;
  const o = style.colorOverrides;
  const colorsOk =
    !kit.colors ||
    (o?.background === kit.colors.ink &&
      o?.text === kit.colors.text &&
      o?.muted === kit.colors.muted &&
      o?.accent === kit.colors.accent);
  const fontsOk =
    (!kit.headlineFont || style.fontOverrides?.headline === kit.headlineFont) &&
    (!kit.bodyFont || style.fontOverrides?.body === kit.bodyFont);
  return colorsOk && fontsOk;
}
