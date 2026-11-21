import { Badge } from "@/components/ui/badge";
import { formatCredits } from "@/lib/credits/format";
import { RoyalCrown, royalTitle, type Tier } from "@/components/royal/Royal";
import type { Honorific } from "@/lib/profile/getProfile";
import { cn } from "@/lib/utils";

export function CreditBalanceWidget({
  balance,
  reserved,
  unlimited = false,
  tier = null,
  honorific,
}: {
  balance: number;
  reserved: number;
  unlimited?: boolean;
  /** Royalty wears its metal on the badge. */
  tier?: Tier | null;
  /** How the owner is addressed — Master or Mistress. */
  honorific?: Honorific;
}) {
  if (unlimited) {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "gap-1 font-normal",
          tier === "master" && "border border-amber-500/40 bg-amber-500/10",
          tier === "family" && "border border-[#e9a99b]/50 bg-[#f6d5cb]/30 dark:bg-[#e9a99b]/10",
        )}
        title={tier === "family" ? "Royal family: unlimited, on the house" : `The ${honorific?.title ?? "Master"}: unlimited credits`}
      >
        {tier && <RoyalCrown tier={tier} honorific={honorific} className="size-3" />}
        <span className="font-semibold">∞</span>
        <span className="text-muted-foreground">credits</span>
      </Badge>
    );
  }

  // Number() guards against bigint/numeric columns, which Supabase can return as strings.
  const spendable = Number(balance) - Number(reserved);
  return (
    <Badge
      variant="secondary"
      className={cn("gap-1 font-normal", tier === "friend" && "border border-slate-400/50 bg-slate-200/40 dark:bg-slate-300/10")}
      title={tier === "friend" ? royalTitle("friend", honorific) : undefined}
    >
      {tier === "friend" && <RoyalCrown tier="friend" honorific={honorific} className="size-3" />}
      <span className="font-semibold" title={`${spendable.toLocaleString("en-US")} credits`}>
        {formatCredits(spendable)}
      </span>
      <span className="text-muted-foreground">credits</span>
    </Badge>
  );
}
