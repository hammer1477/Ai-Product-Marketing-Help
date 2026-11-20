"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GENERATION_COST_CREDITS } from "@/lib/credits/pricing";
import { formatCredits } from "@/lib/credits/format";

type JobStatus = "idle" | "pending" | "processing" | "completed" | "failed" | "cancelled";

export function GenerationTrigger({ projectId, hasSchema }: { projectId: string; hasSchema: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<JobStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleGenerate() {
    setStatus("pending");
    setError(null);

    const res = await fetch(`/api/creative-projects/${projectId}/generate`, { method: "POST" });
    const body = await res.json();

    if (!res.ok) {
      setStatus("failed");
      setError(body.error ?? "Failed to start generation.");
      return;
    }

    const jobId = body.jobId as string;

    pollRef.current = setInterval(async () => {
      const jobRes = await fetch(`/api/jobs/${jobId}`);
      const jobBody = await jobRes.json();

      if (!jobRes.ok) {
        clearInterval(pollRef.current!);
        setStatus("failed");
        setError(jobBody.error ?? "Failed to check job status.");
        return;
      }

      const jobStatus = jobBody.job.status as JobStatus;
      setStatus(jobStatus);

      if (jobStatus === "completed") {
        clearInterval(pollRef.current!);
        router.refresh();
      } else if (jobStatus === "failed" || jobStatus === "cancelled") {
        clearInterval(pollRef.current!);
        setError(jobBody.job.error_message ?? "Generation failed.");
      }
    }, 2000);
  }

  const isBusy = status === "pending" || status === "processing";

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleGenerate} disabled={isBusy}>
        {isBusy
          ? "Generating..."
          : hasSchema
            ? `Regenerate (${formatCredits(GENERATION_COST_CREDITS)} credits)`
            : `Generate creative (${formatCredits(GENERATION_COST_CREDITS)} credits)`}
      </Button>
      {error &&
        (/insufficient credits/i.test(error) ? (
          <p className="text-sm text-destructive">
            You&apos;re out of credits.{" "}
            <Link href="/credits" className="font-medium underline underline-offset-4">
              Buy more
            </Link>{" "}
            to keep generating.
          </p>
        ) : (
          <p className="text-sm text-destructive">{error}</p>
        ))}
    </div>
  );
}
