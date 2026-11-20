"use client";

import { cn } from "@/lib/utils";

export type ColorSourceChoice = "brand" | "product";

/** Brand colours or the product's own — chosen per generation. */
export function ColorSourcePicker({
  value,
  onChange,
  brandSwatch,
}: {
  value: ColorSourceChoice;
  onChange: (value: ColorSourceChoice) => void;
  brandSwatch: [string, string];
}) {
  const options = [
    { id: "brand" as const, label: "Brand colours", hint: "Your kit, exactly" },
    { id: "product" as const, label: "Product colours", hint: "Drawn from the photo" },
  ];
  return (
    <div className="inline-flex rounded-lg border p-0.5" role="radiogroup" aria-label="Colours">
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.hint}
            onClick={() => onChange(o.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-medium transition",
              on ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="flex h-3.5 w-5 overflow-hidden rounded-sm border border-current/20">
              {o.id === "brand" ? (
                <>
                  <span className="flex-1" style={{ background: brandSwatch[0] }} />
                  <span className="flex-1" style={{ background: brandSwatch[1] }} />
                </>
              ) : (
                <span className="flex-1 bg-[conic-gradient(#f87171,#facc15,#4ade80,#60a5fa,#c084fc,#f87171)]" />
              )}
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
