import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductUploadForm } from "./ProductUploadForm";

export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Add a product</CardTitle>
          <CardDescription>
            Upload a photo and basic details. AI will suggest a category from the photo, but you always
            confirm or correct it before it's used in any generated creative.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductUploadForm />
        </CardContent>
      </Card>
    </div>
  );
}
