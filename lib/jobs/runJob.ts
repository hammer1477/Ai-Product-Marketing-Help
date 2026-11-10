import { createServiceRoleClient } from "../db/supabase/server";
import { runCreativeGeneration } from "../orchestration/engine";

export type RunJobResult =
  | { claimed: false }
  | { claimed: true; jobId: string; success: true }
  | { claimed: true; jobId: string; success: false; error: string };

// Shared logic called by both /api/jobs/run (fire-and-forget, right after
// job creation) and /api/jobs/poll (the cron sweep) — atomically claims one
// pending job via claim_pending_job() (optimistic locking means both paths
// can safely race on the same job with no double-processing), runs the
// generation pipeline, then finalizes or refunds the credit reservation.
// Retries never double-charge: every job has exactly one reservation and
// exactly one terminal resolution, enforced by the Postgres functions.
export async function runJob(targetJobId?: string): Promise<RunJobResult> {
  const supabase = createServiceRoleClient();

  const { data: claimedJobs, error: claimError } = await supabase.rpc("claim_pending_job", {
    target_job_id: targetJobId ?? null,
  });

  if (claimError) throw new Error(`Failed to claim job: ${claimError.message}`);
  if (!claimedJobs || claimedJobs.length === 0) return { claimed: false };

  const job = claimedJobs[0];

  try {
    await runCreativeGeneration(job.id);
    const { error: finalizeError } = await supabase.rpc("finalize_credits", { p_job_id: job.id });
    if (finalizeError) throw new Error(`Failed to finalize credits: ${finalizeError.message}`);
    return { claimed: true, jobId: job.id, success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const { error: refundError } = await supabase.rpc("refund_credits", {
      p_job_id: job.id,
      p_error_message: message,
    });
    if (refundError) {
      console.error(`Job ${job.id} failed AND refund failed:`, refundError.message);
    }
    return { claimed: true, jobId: job.id, success: false, error: message };
  }
}
