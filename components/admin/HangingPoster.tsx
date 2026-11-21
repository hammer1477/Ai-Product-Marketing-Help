"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A picture on the wall: either a framed poster hanging from a nail on a
 * string and swaying gently, or a tilted polaroid taped up with black lace.
 * Renders nothing if the image at `src` can't be loaded.
 */
export function HangingPoster({
  src,
  alt = "",
  className,
  imgClassName = "aspect-square",
  variant = "hanging",
  caption = "stay wicked",
  tilt = "right",
}: {
  /** Which way a polaroid leans. */
  tilt?: "left" | "right";
  src: string;
  alt?: string;
  className?: string;
  /** Sizing of the picture inside the frame; square by default. */
  imgClassName?: string;
  variant?: "hanging" | "polaroid" | "feature";
  /** Handwritten line under a polaroid. */
  caption?: string;
}) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;

  if (variant === "feature") {
    // No frame: the picture itself, large, with a soft glow and a big line beneath.
    return (
      <figure className={cn("relative shrink-0", className)}>
        <div aria-hidden className="absolute inset-6 rounded-[2rem] bg-gradient-to-br from-rose-500/40 via-fuchsia-600/30 to-amber-500/30 blur-3xl" />
        {/* eslint-disable-next-line @next/next/no-img-element -- served by our own route, no optimisation needed */}
        <img
          src={src}
          alt={alt}
          onError={() => setMissing(true)}
          className={cn("relative block w-full rounded-3xl object-cover shadow-[0_30px_60px_-20px_rgba(0,0,0,0.95)]", imgClassName)}
        />
        {caption && (
          <figcaption className="relative mt-5 text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className="bg-gradient-to-r from-amber-200 via-rose-300 to-fuchsia-300 bg-clip-text text-transparent">{caption}</span>{" "}
            <span className="inline-block animate-bounce [animation-duration:2s]">😈</span>
            <span className="inline-block animate-pulse">❤️</span>
          </figcaption>
        )}
      </figure>
    );
  }

  if (variant === "polaroid") {
    return (
      <div className={cn("relative shrink-0 pt-4", className)}>
        <figure
          className={cn(
            "relative bg-[#f4f1ea] p-3 pb-0 shadow-[0_20px_45px_-14px_rgba(0,0,0,0.9),0_0_30px_-12px_rgba(244,63,94,0.45)] transition duration-500 hover:rotate-0 hover:scale-[1.02]",
            tilt === "left" ? "-rotate-3" : "rotate-3",
          )}
        >
          {/* a strip of black lace tape holding it to the wall */}
          <span
            aria-hidden
            className="absolute -top-3 left-1/2 z-10 h-7 w-24 -translate-x-1/2 -rotate-6 bg-zinc-900/85 shadow-sm"
            style={{
              backgroundImage:
                "radial-gradient(circle at 6px 6px, rgba(255,255,255,0.18) 2px, transparent 2.5px), radial-gradient(circle at 0 0, rgba(255,255,255,0.08) 1px, transparent 1.5px)",
              backgroundSize: "12px 12px, 6px 6px",
              clipPath: "polygon(3% 0, 97% 4%, 100% 50%, 96% 100%, 2% 96%, 0 50%)",
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- served by our own route, no optimisation needed */}
          <img src={src} alt={alt} onError={() => setMissing(true)} className={cn("block w-full object-cover", imgClassName)} />
          <figcaption className="py-3 text-center font-serif text-lg italic tracking-wide text-zinc-800">
            {caption}
            <span className="ml-1.5 text-rose-700">♥</span>
          </figcaption>
        </figure>
      </div>
    );
  }

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
