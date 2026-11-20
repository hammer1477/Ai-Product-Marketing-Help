import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** The studio's mark: a sunrise-gradient tile with a spark. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-8 items-center justify-center rounded-xl bg-brand text-white shadow-sm ring-brand", className)}>
      <Sparkles className="size-4" />
    </span>
  );
}
