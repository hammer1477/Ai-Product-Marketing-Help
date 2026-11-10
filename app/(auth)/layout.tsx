export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[#0b0d14] p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 30% 0%, rgba(245,158,11,0.18), transparent), radial-gradient(ellipse 60% 50% at 90% 100%, rgba(99,102,241,0.18), transparent)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative flex items-center gap-2 text-sm font-medium tracking-wide text-white/70">
          <span className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-amber-400 to-amber-600 text-[13px] font-bold text-black">
            A
          </span>
          AI Advertising Studio
        </div>
        <div className="relative flex flex-col gap-5">
          <p className="text-xs font-semibold tracking-[0.2em] text-amber-400 uppercase">
            From product photo to campaign
          </p>
          <h1 className="max-w-md text-4xl leading-[1.15] font-semibold text-balance">
            Agency-grade advertising, generated in minutes.
          </h1>
          <p className="max-w-sm text-base leading-relaxed text-white/60">
            Upload a product photo. Get back premium photography, persuasive ad copy, and
            scroll-stopping creative — no designer, no studio, no agency retainer.
          </p>
        </div>
        <p className="relative text-xs text-white/40">
          Built for brands, sellers, and agencies who want their ads to look expensive.
        </p>
      </div>

      <div className="flex w-full items-center justify-center bg-muted/30 px-4 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
