import { Badge } from "@/components/ui/badge";

export function CreditBalanceWidget({ balance, reserved }: { balance: number; reserved: number }) {
  const spendable = balance - reserved;
  return (
    <Badge variant="secondary" className="gap-1 font-normal">
      <span className="font-semibold">{spendable}</span>
      <span className="text-muted-foreground">credits</span>
    </Badge>
  );
}
