"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/supabase/server";

export async function approveAnalysis(
  productId: string,
  productImageId: string,
  confirmedCategory: string,
) {
  const supabase = await createClient();

  const { error: productError } = await supabase
    .from("products")
    .update({ category: confirmedCategory, category_confirmed: true })
    .eq("id", productId);

  if (productError) {
    throw new Error(productError.message);
  }

  const { error: imageError } = await supabase
    .from("product_images")
    .update({ analysis_approved_at: new Date().toISOString() })
    .eq("id", productImageId);

  if (imageError) {
    throw new Error(imageError.message);
  }

  revalidatePath(`/products/${productId}`);
}

export async function createCreativeProject(productId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: project, error } = await supabase
    .from("creative_projects")
    .insert({ user_id: user.id, product_id: productId })
    .select("id")
    .single();

  if (error || !project) {
    throw new Error(error?.message ?? "Failed to create creative project.");
  }

  redirect(`/creative-projects/${project.id}`);
}
