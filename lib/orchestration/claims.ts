// A safety net under the "never invent claims" prompt rule.
//
// Models reach for popularity and urgency words to make copy punchy —
// "viral", "bestseller", "back in stock" — even when told not to, and on an
// ad those are claims the seller can't back. Prompting gets most of them;
// this strips the rest, unless the seller's own fields say it (a seller who
// typed "Free shipping" may advertise free shipping).

/**
 * `word` claims are adjectives — removing the word leaves a sentence
 * ("the viral sign" -> "the sign"). `phrase` claims are statements —
 * removing them strands a sentence ("is back in stock."), so the whole
 * clause or sentence holding one goes instead.
 */
type Rule = { pattern: RegExp; kind: "word" | "phrase"; /** Seller text that permits the claim. */ allowedBy: RegExp };

const RULES: Rule[] = [
  { kind: "word", pattern: /\b(?:viral|trending|internet[- ]famous)\b/gi, allowedBy: /\b(viral|trending|famous)\b/i },
  {
    kind: "word",
    pattern: /\b(?:best[- ]?sell(?:er|ing)s?|best seller|top[- ]rated|most[- ]popular|fan[- ]favou?rite|award[- ]winning|#1|number one)\b/gi,
    allowedBy: /\b(best[- ]?sell|top[- ]rated|popular|favou?rite|award|#1|number one)\b/i,
  },
  {
    kind: "phrase",
    pattern: /\b(?:back in stock|in stock|limited stock|low stock|selling fast|while (?:stocks|supplies) last|almost gone)\b/gi,
    allowedBy: /\b(stock|selling fast|supplies)\b/i,
  },
  { kind: "phrase", pattern: /\b(?:free|fast|express|next[- ]day|same[- ]day) (?:shipping|delivery)\b/gi, allowedBy: /\b(shipping|delivery)\b/i },
  {
    kind: "phrase",
    // Commercial guarantees only — "a guaranteed laugh" is a figure of speech.
    pattern: /\b(?:(?:money[- ]back|satisfaction|lifetime|price[- ]match) guarantee(?:d)?|guaranteed (?:results|returns?|refunds?)|\d+[- ](?:year|month)s? warranty|warranty)\b/gi,
    allowedBy: /\b(guarantee|warranty)/i,
  },
];

function tidy(text: string): string {
  return text
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/^[\s,.;:·•|—–-]+|[\s,;:·•|—–-]+$/g, "")
    .trim();
}

const hits = (rule: Rule, text: string) => new RegExp(rule.pattern.source, "i").test(text);

/** Builds a scrubber for one seller: strips claims their own fields don't make. */
export function claimScrubber(sellerText: string) {
  const active = RULES.filter((rule) => !rule.allowedBy.test(sellerText));
  const phrases = active.filter((r) => r.kind === "phrase");
  const words = active.filter((r) => r.kind === "word");

  const scrub = (text: string): string => {
    if (!active.some((rule) => hits(rule, text))) return text;
    let out = text;
    if (phrases.some((rule) => hits(rule, out))) {
      // Drop the sentences, then the clauses, that carry a phrase claim.
      const sentences = out.match(/[^.!?]+[.!?]*\s*/g) ?? [out];
      const kept = sentences.filter((sentence) => !phrases.some((rule) => hits(rule, sentence)));
      out = kept.length > 0 && kept.length < sentences.length ? kept.join("") : out;
      if (phrases.some((rule) => hits(rule, out))) {
        const clauses = out.split(/(\s*(?:,|·|•|\||—|–| - )\s*)/);
        out = clauses
          .filter((part, i) => i % 2 === 1 || !phrases.some((rule) => hits(rule, part)))
          .join("")
          .replace(/(\s*(?:,|·|•|\||—|–| - )\s*){2,}/g, "$1");
      }
      // A claim that was the whole text leaves nothing — that's correct.
      for (const rule of phrases) out = out.replace(rule.pattern, " ");
    }
    for (const rule of words) out = out.replace(rule.pattern, " ");
    out = tidy(out);
    // "Trending decor…" -> "decor…": keep the sentence-case it started with.
    if (/^[A-Z]/.test(text.trim()) && /^[a-z]/.test(out)) out = out[0].toUpperCase() + out.slice(1);
    return out;
  };

  const emptied = (v: unknown) =>
    v === "" ||
    (typeof v === "object" && v !== null && "text" in v && (v as { text: unknown }).text === "" &&
      !(v as { label?: unknown }).label && !(v as { value?: unknown }).value);

  return {
    text: scrub,
    /** Deep-scrubs every string in a value (blocks, social copy). */
    deep<T>(value: T): T {
      if (typeof value === "string") return scrub(value) as T;
      // Items emptied by scrubbing (a "Free shipping" trust badge) are dropped.
      if (Array.isArray(value)) return value.map((v) => this.deep(v)).filter((v) => !emptied(v)) as T;
      if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, this.deep(v)])) as T;
      }
      return value;
    },
  };
}

/** The seller's own words, which are allowed to make claims. */
export function sellerText(brief: { name?: string | null; description?: string | null; attributes?: Record<string, unknown> }): string {
  return [brief.name, brief.description, ...Object.values(brief.attributes ?? {})]
    .filter((v) => typeof v === "string")
    .join(" \n ");
}

/** Blocks whose text was entirely a claim (a "Bestseller" badge) are dropped. */
export function dropEmptyBlocks<T extends { type?: string; text?: unknown }>(blocks: T[] | undefined): T[] | undefined {
  return blocks?.filter((b) => !(typeof b?.text === "string" && b.text.trim() === "" && b.type !== "divider"));
}
