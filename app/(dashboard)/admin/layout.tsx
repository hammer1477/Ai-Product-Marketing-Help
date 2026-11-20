import { requireOwner } from "@/lib/admin/data";
import { MasterNav } from "@/components/admin/MasterNav";
import { MasterPosters } from "@/components/admin/MasterPosters";

/** Gold filigree tile: a crown in a diamond lattice with corner flourishes. */
const FILIGREE = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'>` +
    `<g fill='none' stroke='#d4a43a' stroke-width='1'>` +
    `<path d='M60 4 L116 60 L60 116 L4 60 Z'/>` +
    `<path d='M60 22 L98 60 L60 98 L22 60 Z' opacity='.6'/>` +
    `<path d='M0 0 q14 4 16 16 M120 0 q-14 4 -16 16 M0 120 q14 -4 16 -16 M120 120 q-14 -4 -16 -16'/>` +
    `</g>` +
    `<path d='M48 66 l3 -14 l6 7 l3 -10 l3 10 l6 -7 l3 14 Z' fill='#d4a43a'/>` +
    `</svg>`,
)}")`;

// The master's realm: every console page is owner-only (404 for anyone
// else), always dark, oxblood and gold, with the tabs across the top.
export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return (
    // `dark` forces the dark tokens in here whatever the site theme is.
    <div className="dark -mx-4 -my-8 min-h-[calc(100vh-57px)] bg-[#0d0608] px-4 py-8 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(70% 50% at 10% 0%, rgba(127,18,38,0.45), transparent 70%), radial-gradient(60% 50% at 100% 100%, rgba(180,120,20,0.18), transparent 70%)",
        }}
      />
      <div aria-hidden className="pointer-events-none fixed inset-0 opacity-[0.07]" style={{ backgroundImage: FILIGREE }} />
      <MasterPosters />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8">
        <MasterNav />
        {children}
        <p className="text-center text-xs uppercase tracking-[0.25em] text-amber-200/30">At your command, always.</p>
      </div>
    </div>
  );
}
