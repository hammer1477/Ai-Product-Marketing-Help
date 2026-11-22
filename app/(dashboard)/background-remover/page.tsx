import { cloudProvider } from "@/lib/background-remover/server";
import { BackgroundRemoverStudio } from "@/components/background-remover/BackgroundRemoverStudio";

export const metadata = { title: "Product Background Remover" };

// Feature 4 — an independent workspace. Shares only auth and the dashboard
// shell with the other tools; nothing else reads from or writes to it.
export default function BackgroundRemoverPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Product Background Remover</h1>
        <p className="text-muted-foreground">
          Extract any product from its background and prepare it for professional advertising designs.
        </p>
      </div>
      <BackgroundRemoverStudio cloudEnabled={cloudProvider() !== null} />
    </div>
  );
}
