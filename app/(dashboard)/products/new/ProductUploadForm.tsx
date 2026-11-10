"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createProduct, type CreateProductState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORIES = [
  "Food & Beverage",
  "Fashion & Apparel",
  "Beauty & Skincare",
  "Electronics & Technology",
  "Home & Living",
  "Health & Wellness",
  "Toys & Kids",
  "Automotive",
  "Other",
];

const OBJECTIVES = [
  "brand-awareness",
  "sales-conversion",
  "product-launch",
  "seasonal-promotion",
  "discount-campaign",
];

const PLATFORMS = ["instagram-square", "instagram-story", "facebook-feed", "google-display", "website-banner"];

const initialState: CreateProductState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating..." : "Create product"}
    </Button>
  );
}

export function ProductUploadForm() {
  const [state, formAction] = useActionState(createProduct, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Product name *</Label>
        <Input id="name" name="name" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="category">Category *</Label>
        <Select name="category" required>
          <SelectTrigger id="category" className="w-full">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="image">Product photo *</Label>
        <Input id="image" name="image" type="file" accept="image/*" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="price">Price</Label>
          <Input id="price" name="price" placeholder="e.g. 29.99 USD" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="brandName">Brand name</Label>
          <Input id="brandName" name="brandName" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="objective">Campaign objective</Label>
          <Select name="objective">
            <SelectTrigger id="objective" className="w-full">
              <SelectValue placeholder="Select an objective" />
            </SelectTrigger>
            <SelectContent>
              {OBJECTIVES.map((o) => (
                <SelectItem key={o} value={o}>
                  {o.replace(/-/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="targetPlatform">Target platform</Label>
          <Select name="targetPlatform">
            <SelectTrigger id="targetPlatform" className="w-full">
              <SelectValue placeholder="Select a platform" />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p.replace(/-/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton />
    </form>
  );
}
