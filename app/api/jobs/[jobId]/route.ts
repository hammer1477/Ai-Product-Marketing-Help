import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // RLS ("owner read" policy on generation_jobs) ensures this returns
  // nothing for a job that isn't the caller's own, regardless of jobId.
  const { data: job, error } = await supabase
    .from("generation_jobs")
    .select("id, status, error_message, created_at, completed_at")
    .eq("id", jobId)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  let generatedImage: { id: string; storagePath: string; publicUrl: string } | null = null;
  if (job.status === "completed") {
    const { data: image } = await supabase
      .from("generated_images")
      .select("id, storage_path")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (image) {
      const { data: publicUrlData } = supabase.storage
        .from("generated-images")
        .getPublicUrl(image.storage_path);
      generatedImage = { id: image.id, storagePath: image.storage_path, publicUrl: publicUrlData.publicUrl };
    }
  }

  return NextResponse.json({ job, generatedImage });
}
