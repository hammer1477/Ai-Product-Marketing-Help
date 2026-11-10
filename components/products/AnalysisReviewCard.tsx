"use client";

import { useState, useTransition } from "react";
import { approveAnalysis } from "@/app/(dashboard)/products/[productId]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function AnalysisReviewCard({
  productId,
  productImageId,
  currentCategory,
  suggestedCategory,
  confidence,
}: {
  productId: string;
  productImageId: string;
  currentCategory: string;
  suggestedCategory: string | null;
  confidence: number | null;
}) {
  const [correctedCategory, setCorrectedCategory] = useState(currentCategory);
  const [isPending, startTransition] = useTransition();

  function handleAccept(category: string) {
    startTransition(() => approveAnalysis(productId, productImageId, category));
  }

  return (
    <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Confirm product category</CardTitle>
          <Badge variant="secondary">AI suggestion — please confirm</Badge>
        </div>
        <CardDescription>
          AI analyzed the photo and suggests{" "}
          <span className="font-medium text-foreground">{suggestedCategory ?? "no category"}</span>
          {confidence != null && ` (${Math.round(confidence * 100)}% confidence)`}. You entered{" "}
          <span className="font-medium text-foreground">{currentCategory}</span>. Nothing is used in
          generated creatives until you confirm or correct it below.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="correctedCategory">Final category</Label>
            <Input
              id="correctedCategory"
              value={correctedCategory}
              onChange={(e) => setCorrectedCategory(e.target.value)}
            />
          </div>
          <Button disabled={isPending} onClick={() => handleAccept(correctedCategory)}>
            {isPending ? "Saving..." : "Confirm"}
          </Button>
        </div>
        {suggestedCategory && suggestedCategory !== correctedCategory && (
          <button
            type="button"
            className="w-fit text-left text-sm text-muted-foreground underline underline-offset-4"
            onClick={() => setCorrectedCategory(suggestedCategory)}
          >
            Use AI suggestion ("{suggestedCategory}") instead
          </button>
        )}
      </CardContent>
    </Card>
  );
}
