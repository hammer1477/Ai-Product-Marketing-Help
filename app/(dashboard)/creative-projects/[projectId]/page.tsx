import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/db/supabase/server";
import { GenerationTrigger } from "./GenerationTrigger";
import { CreativeEditor } from "./CreativeEditor";
import { Badge } from "@/components/ui/badge";
import { BRAND_KIT_COLUMNS, readBrandKit } from "@/lib/brand/kit";
import { angleById } from "@/lib/orchestration/angles";

export default async function CreativeProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("creative_projects")
    .select("*, products(id, name)")
    .eq("id", projectId)
    .single();

  if (!project) {
    notFound();
  }

  const { data: kitRow } = await supabase
    .from("brand_kits")
    .select(BRAND_KIT_COLUMNS)
    .eq("user_id", project.user_id)
    .maybeSingle();
  const brandKit = readBrandKit(kitRow);
  const angle = angleById(project.angle);

  const product = project.products as unknown as { id: string; name: string } | null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        {product && (
          <Link href={`/products/${product.id}`} className="text-sm text-muted-foreground underline underline-offset-4">
            &larr; {product.name}
          </Link>
        )}
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Creative project</h1>
          {project.concept && <Badge variant="secondary">{project.concept.replace("_", " ")}</Badge>}
          {project.density && <Badge variant="outline">{project.density}</Badge>}
          {angle && <Badge variant="outline">{angle.label}</Badge>}
        </div>
      </div>

      <GenerationTrigger
        projectId={projectId}
        hasSchema={Boolean(project.design_schema)}
        brandSwatch={brandKit?.colors ? [brandKit.colors.ink, brandKit.colors.accent] : null}
        initialColorSource={project.color_source}
      />

      {project.design_schema ? (
        <CreativeEditor key={JSON.stringify(project.design_schema)} projectId={projectId} initialSchema={project.design_schema} brandKit={brandKit} />
      ) : (
        <p className="text-sm text-muted-foreground">
          No creative generated yet. Click &ldquo;Generate creative&rdquo; above to get started.
        </p>
      )}
    </div>
  );
}
