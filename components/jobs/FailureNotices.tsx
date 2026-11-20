"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export type JobFailure = { id: string; label: string };

const SEEN_KEY = "notified-failed-jobs";

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function writeSeen(seen: Set<string>) {
  try {
    // Only recent failures are ever passed in, so a short tail is enough.
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-100)));
  } catch {
    // Storage unavailable: worst case a toast repeats on reload.
  }
}

/**
 * Failed jobs as toasts instead of tiles: each failure is announced once
 * (remembered per browser), saying its credits came back, and then it's
 * gone. Pages pass in recent failures; the auto-refresh while jobs run
 * means a failure that happens while you watch toasts straight away.
 */
export function FailureNotices({ failures, noun = "shots" }: { failures: JobFailure[]; noun?: string }) {
  useEffect(() => {
    if (failures.length === 0) return;
    const seen = readSeen();
    const fresh = failures.filter((f) => !seen.has(f.id));
    if (fresh.length === 0) return;

    if (fresh.length === 1) {
      toast.error(`${fresh[0].label} didn't come out`, {
        description: "Your credits were refunded. Try it again in a moment.",
      });
    } else {
      toast.error(`${fresh.length} ${noun} didn't come out`, {
        description: `${fresh.map((f) => f.label).join(", ")}. Your credits were refunded.`,
      });
    }
    for (const f of fresh) seen.add(f.id);
    writeSeen(seen);
  }, [failures, noun]);

  return null;
}
