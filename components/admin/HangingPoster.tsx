"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A poster hanging from a nail on a string, swaying gently. Shows the image
 * at `src` (a file in /public); renders nothing until that file exists.
 */
export function HangingPoster({
  src,
  alt = "",
  className,
  imgClassName = "aspect-square",
}: {
  src: string;
  alt?: string;
  className?: string;
  /** Sizing of the picture inside the frame; square by default. */
  imgClassName?: string;
}) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;

  return (
    <div className={cn("relative shrink-0 pt-7", className)}>
      {/* the nail */}
      <span className="absolute left-1/2 top-0 z-10 size-3 -translate-x-1/2 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-500 shadow-[0_1px_3px_rgba(0,0,0,0.8)]" />
      <div className="animate-sway origin-[50%_-28px]">
        {/* the string, from the nail to the two top corners */}
        <svg className="pointer-events-none absolute -top-7 left-0 h-8 w-full overflow-visible" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden>
          <path d="M50 1L8 32M50 1L92 32" stroke="#a1a1aa" strokeWidth="1" vectorEffect="non-scaling-stroke" fill="none" />
        </svg>
        <div className="relative rounded-sm border border-white/10 bg-zinc-950 p-1.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.9),0_0_30px_-10px_rgba(168,85,247,0.5)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed local file, no optimisation needed */}
          <img src={src} alt={alt} onError={() => setMissing(true)} className={cn("block w-full object-cover", imgClassName)} />
          {/* pins on the top corners */}
          <span className="absolute left-1.5 top-1.5 size-1.5 rounded-full bg-zinc-300" />
          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-zinc-300" />
        </div>
      </div>
    </div>
  );
}
