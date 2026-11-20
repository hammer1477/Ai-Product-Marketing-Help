// Decorative figures behind the dashboard: soft orbs and floating shapes in
// the brand colours. Fixed, behind everything, never interactive — and low
// enough in contrast that content always wins.

const FIGURES: Array<{ kind: "ring" | "spark" | "squiggle" | "dot" | "blob"; x: string; y: string; size: number; color: 1 | 2 | 3; delay: number; rotate?: number }> = [
  { kind: "blob", x: "-6%", y: "8%", size: 420, color: 1, delay: 0 },
  { kind: "blob", x: "78%", y: "55%", size: 460, color: 2, delay: -3 },
  { kind: "blob", x: "40%", y: "88%", size: 360, color: 3, delay: -6 },
  { kind: "ring", x: "88%", y: "14%", size: 120, color: 2, delay: -1 },
  { kind: "ring", x: "6%", y: "70%", size: 84, color: 3, delay: -4 },
  { kind: "spark", x: "70%", y: "30%", size: 36, color: 3, delay: -2 },
  { kind: "spark", x: "14%", y: "36%", size: 28, color: 1, delay: -5 },
  { kind: "spark", x: "92%", y: "82%", size: 30, color: 1, delay: -7 },
  { kind: "squiggle", x: "52%", y: "12%", size: 140, color: 1, delay: -3, rotate: -12 },
  { kind: "squiggle", x: "24%", y: "92%", size: 120, color: 2, delay: -1, rotate: 18 },
  { kind: "dot", x: "62%", y: "70%", size: 14, color: 2, delay: -2 },
  { kind: "dot", x: "34%", y: "22%", size: 10, color: 3, delay: -6 },
  { kind: "dot", x: "84%", y: "40%", size: 12, color: 1, delay: -4 },
];

function Figure({ kind, size, color }: { kind: (typeof FIGURES)[number]["kind"]; size: number; color: number }) {
  const c = `var(--brand-${color})`;
  switch (kind) {
    case "blob":
      return <div className="rounded-full blur-3xl" style={{ width: size, height: size, background: c, opacity: 0.16 }} />;
    case "ring":
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="44" stroke={c} strokeWidth="3" strokeDasharray="6 10" opacity="0.45" />
          <circle cx="50" cy="50" r="30" stroke={c} strokeWidth="2" opacity="0.25" />
        </svg>
      );
    case "spark":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={c} opacity="0.55">
          <path d="M12 0c.8 5.6 3.4 9.3 12 12-8.6 2.7-11.2 6.4-12 12-.8-5.6-3.4-9.3-12-12 8.6-2.7 11.2-6.4 12-12Z" />
        </svg>
      );
    case "squiggle":
      return (
        <svg width={size} height={size / 3} viewBox="0 0 120 40" fill="none">
          <path d="M2 20c12-18 22-18 34 0s22 18 34 0 22-18 34 0" stroke={c} strokeWidth="4" strokeLinecap="round" opacity="0.4" />
        </svg>
      );
    case "dot":
      return <div className="rounded-full" style={{ width: size, height: size, background: c, opacity: 0.5 }} />;
  }
}

export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
      {FIGURES.map((f, i) => (
        <div
          key={i}
          className="absolute animate-float"
          style={{ left: f.x, top: f.y, animationDelay: `${f.delay}s`, transform: f.rotate ? `rotate(${f.rotate}deg)` : undefined }}
        >
          <Figure kind={f.kind} size={f.size} color={f.color} />
        </div>
      ))}
    </div>
  );
}
