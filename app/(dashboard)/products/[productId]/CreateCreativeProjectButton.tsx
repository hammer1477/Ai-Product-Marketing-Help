"use client";

import { useTransition } from "react";
import { createCreativeProject } from "./actions";
import { Button } from "@/components/ui/button";

export function CreateCreativeProjectButton({
  productId,
  disabled,
}: {
  productId: string;
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      disabled={disabled || isPending}
      title={disabled ? "Confirm the product category first" : undefined}
      onClick={() => startTransition(() => createCreativeProject(productId))}
    >
      {isPending ? "Creating..." : "Generate creative"}
    </Button>
  );
}
