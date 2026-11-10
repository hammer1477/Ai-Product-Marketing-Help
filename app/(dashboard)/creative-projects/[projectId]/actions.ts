"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/supabase/server";
import type { DesignSchema } from "@/lib/design-schema/types";
import { validateDesignSchema } from "@/lib/design-schema/validate";

export async function saveDesignSchema(projectId: string, schema: DesignSchema) {
  const issues = validateDesignSchema(schema);

  const supabase = await createClient();
  const { error } = await supabase
    .from("creative_projects")
    .update({ design_schema: schema })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/creative-projects/${projectId}`);
  return { issues };
}
