import { NextResponse } from "next/server";
import { runJob } from "@/lib/jobs/runJob";

// Runs on the default Node.js runtime (required: @resvg/resvg-js uses
// native bindings, unavailable on edge). Invoked fire-and-forget right
// after a job is created (see
// app/api/creative-projects/[projectId]/generate/route.ts), and acts as a
// one-shot worker for a single specific job — the cron sweep in
// app/api/jobs/poll/route.ts catches anything this misses.
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = (await request.json()) as { jobId?: string };
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const result = await runJob(jobId);
  return NextResponse.json(result);
}
