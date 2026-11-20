import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/db/supabase/server";
import type { DesignSchema } from "@/lib/design-schema/types";
import { renderSchemaToPng } from "@/lib/design-schema/render/renderPng";

// Re-renders a project's preview from its saved design, after the user
// saves edits — so the ads grid, campaign page and thumbnails show the ad
// as it is now, not as the AI first made it. Lives under /api because the
// renderer's fonts are traced into API functions only.
export async function POST(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS: only the owner's project is found.
  const { data: project } = await supabase
    .from("creative_projects")
    .select("id, design_schema, preview_path")
    .eq("id", projectId)
    .single();
  if (!project?.design_schema) return NextResponse.json({ error: "Nothing to render" }, { status: 404 });

  const schema = project.design_schema as DesignSchema;
  const png = await renderSchemaToPng(schema, { scale: 1 });

  // The bucket only takes service-role writes. A fresh name per render
  // keeps browsers and the CDN from serving the old image.
  const admin = createServiceRoleClient();
  const path = `${projectId}/preview-${Date.now()}.png`;
  const { error: uploadError } = await admin.storage
    .from("generated-images")
    .upload(path, png, { contentType: "image/png" });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  await admin
    .from("creative_projects")
    .update({ preview_path: path, preview_width: schema.canvas.width, preview_height: schema.canvas.height })
    .eq("id", projectId);
  if (project.preview_path) await admin.storage.from("generated-images").remove([project.preview_path]);

  return NextResponse.json({ url: admin.storage.from("generated-images").getPublicUrl(path).data.publicUrl });
}
