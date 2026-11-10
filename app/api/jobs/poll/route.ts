import { NextResponse } from "next/server";
import { runJob } from "@/lib/jobs/runJob";
import { createServiceRoleClient } from "@/lib/db/supabase/server";

const MAX_JOBS_PER_INVOCATION = 5;
const STUCK_JOB_TIMEOUT_MINUTES = 10;

// Vercel Cron target (see vercel.json) — sweeps any pending job the
// fire-and-forget call in the generate route missed, and resets jobs stuck
// in 'processing' (a crashed worker) back to 'pending' so they get retried.
// Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on
// scheduled invocations when CRON_SECRET is set in the project env.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  await supabase.rpc("reset_stuck_processing_jobs", { stuck_after_minutes: STUCK_JOB_TIMEOUT_MINUTES });

  const results = [];
  for (let i = 0; i < MAX_JOBS_PER_INVOCATION; i++) {
    const result = await runJob();
    if (!result.claimed) break;
    results.push(result);
  }

  return NextResponse.json({ processed: results.length, results });
}
