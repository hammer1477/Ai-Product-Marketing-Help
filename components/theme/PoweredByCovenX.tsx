import Image from "next/image";
import { cn } from "@/lib/utils";

/** The studio's maker's mark, matching CovenX's other products: "Powered by CovenX". */
export function PoweredByCovenX({ className }: { className?: string }) {
  return (
    <p className={cn("inline-flex items-center gap-1.5 text-xs", className)} title="CovenX Solutions">
      <Image src="/covenx-icon.png" alt="" width={16} height={16} className="size-4 rounded-[4px]" />
      <span>
        Powered by <span className="font-semibold">CovenX</span>
      </span>
    </p>
  );
}
