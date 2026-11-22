import { Crown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Marks the one permanent Master account in the console. */
export function MasterSeal({ className }: { className?: string }) {
  return (
    <span
      title="The one and only Master — permanent, untouchable"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/60 bg-gradient-to-r from-amber-300/25 via-amber-500/20 to-rose-600/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200 shadow-[0_0_18px_-4px_rgba(245,158,11,0.7)]",
        className,
      )}
    >
      <Crown className="size-3" /> The Master
    </span>
  );
}

/** Stands in for a control the viewer isn't allowed to use. */
export function LockedNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-amber-200/60">
      <Lock className="size-3 shrink-0" /> {children}
    </p>
  );
}
