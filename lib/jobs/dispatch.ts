import "server-only";
import { after } from "next/server";

/**
 * Starts the worker for each job without making the caller wait.
 *
 * Each job gets its own /api/jobs/run invocation, so a campaign's ads
 * generate in parallel rather than one after another. `after()` keeps the
 * function alive long enough to send the requests once the response is
 * out; the cron sweep in /api/jobs/poll picks up anything dropped.
 */
export function dispatchJobs(origin: string, jobIds: string[]) {
  after(async () => {
    await Promise.all(
      jobIds.map((jobId) =>
        fetch(`${origin}/api/jobs/run`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${process.env.CRON_SECRET}` },
          body: JSON.stringify({ jobId }),
        }).catch((err) => console.error(`Failed to dispatch job ${jobId}:`, err)),
      ),
    );
  });
}
