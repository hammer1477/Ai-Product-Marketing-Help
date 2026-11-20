import { Badge } from "@/components/ui/badge";
import { formatCredits } from "@/lib/credits/format";

export function CreditBalanceWidget({ balance, reserved }: { balance: number; reserved: number }) {
  // Number() guards against bigint/numeric columns, which Supabase can return as strings.
  const spendable = Number(balance) - Number(reserved);
  return (
    <Badge variant="secondary" className="gap-1 font-normal">
      <span className="font-semibold" title={`${spendable.toLocaleString("en-US")} credits`}>
        {formatCredits(spendable)}
      </span>
      <span className="text-muted-foreground">credits</span>
    </Badge>
  );
}
