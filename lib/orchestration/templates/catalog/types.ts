import type { CtaStyle } from "../../styles";
import type { TemplateCtx, TemplateResult } from "../kit";
import type { Scheme, Typography } from "../theme";

/** What a template suits. Used to bias selection, never to forbid it. */
export type TemplateTag =
  | "tech"
  | "luxury"
  | "beauty"
  | "fashion"
  | "food"
  | "home"
  | "kids"
  | "auto"
  | "wellness"
  | "promo"
  | "specs"
  | "minimal"
  | "bold";

export type TemplateDef = {
  id: string;
  name: string;
  /** One line for the template picker. */
  blurb: string;
  tags: TemplateTag[];
  scheme: Scheme;
  typography: Typography;
  cta: CtaStyle;
  /** Whether the generated background scene appears in this design. */
  usesScene: boolean;
  build: (ctx: TemplateCtx) => TemplateResult;
};
