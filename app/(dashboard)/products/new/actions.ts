"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/supabase/server";
import { getVisionProvider } from "@/lib/ai/providers/factory";

export type CreateProductState = { error?: string };

export async function createProduct(
  _prevState: CreateProductState,
  formData: FormData,
): Promise<CreateProductState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const objective = String(formData.get("objective") ?? "").trim() || null;
  const targetPlatform = String(formData.get("targetPlatform") ?? "").trim() || null;
  const price = String(formData.get("price") ?? "").trim();
  const brandName = String(formData.get("brandName") ?? "").trim();
  const specs = String(formData.get("specs") ?? "").trim().slice(0, 4000);
  const offer = String(formData.get("offer") ?? "").trim().slice(0, 200);
  const file = formData.get("image") as File | null;

  if (!name || !category || !file || file.size === 0) {
    return { error: "Name, category, and a product photo are required." };
  }

  const attributes: Record<string, string> = {};
  if (price) attributes.price = price;
  if (brandName) attributes.brandName = brandName;
  if (specs) attributes.specs = specs;
  if (offer) attributes.offer = offer;

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      user_id: user.id,
      name,
      category,
      description,
      objective,
      target_platform: targetPlatform,
      attributes,
    })
    .select()
    .single();

  if (productError || !product) {
    return { error: productError?.message ?? "Failed to create product." };
  }

  const fileExt = file.name.split(".").pop() || "jpg";
  const storagePath = `${user.id}/${product.id}/${randomUUID()}.${fileExt}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(storagePath, fileBuffer, { contentType: file.type || "image/jpeg" });

  if (uploadError) {
    return { error: `Image upload failed: ${uploadError.message}` };
  }

  const { data: signedUrlData } = await supabase.storage
    .from("product-images")
    .createSignedUrl(storagePath, 3600);

  const vision = getVisionProvider();
  const analysis = await vision.analyzeImage({
    imageUrl: signedUrlData?.signedUrl ?? storagePath,
    hints: { userProvidedCategory: category, userProvidedName: name },
  });

  const { error: imageError } = await supabase.from("product_images").insert({
    product_id: product.id,
    storage_path: storagePath,
    is_primary: true,
    ai_analysis: analysis.data,
    ai_analysis_confidence: analysis.data.confidence,
  });

  if (imageError) {
    return { error: `Failed to save product image: ${imageError.message}` };
  }

  await supabase
    .from("products")
    .update({ ai_suggested_category: analysis.data.suggestedCategory })
    .eq("id", product.id);

  redirect(`/products/${product.id}`);
}
