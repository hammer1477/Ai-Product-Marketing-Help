import { cn } from "@/lib/utils";

/** One foot seen from above, big toe on the right; mirror it for the other. */
function Foot() {
  const toes = [
    { cx: 43, cy: 17, rx: 7.5, ry: 9.5 },
    { cx: 31.5, cy: 11, rx: 4.6, ry: 6 },
    { cx: 22.5, cy: 13, rx: 4.1, ry: 5.4 },
    { cx: 14.5, cy: 18, rx: 3.6, ry: 4.8 },
    { cx: 8.5, cy: 25.5, rx: 3.1, ry: 4.1 },
  ];
  return (
    <g>
      <path
        d="M30 128C15 128 9 113 10 94C11 75 6 57 7 42C8 28 18 22 31 22C46 22 54 30 54 45C54 61 50 75 50 93C50 113 45 128 30 128Z"
        fill="url(#gs-skin)"
      />
      {toes.map((t, i) => (
        <g key={i}>
          <ellipse cx={t.cx} cy={t.cy} rx={t.rx} ry={t.ry} fill="url(#gs-skin)" />
          <ellipse cx={t.cx} cy={t.cy - t.ry * 0.3} rx={t.rx * 0.62} ry={t.ry * 0.5} fill="#16061f" />
          <ellipse cx={t.cx - t.rx * 0.2} cy={t.cy - t.ry * 0.5} rx={t.rx * 0.18} ry={t.ry * 0.14} fill="#c084fc" opacity="0.7" />
        </g>
      ))}
      {/* anklet with a little cross charm */}
      <path d="M11 112C20 118 40 118 49 112" stroke="#d4d4d8" strokeWidth="1.6" strokeDasharray="2 1.6" fill="none" />
      <path d="M30 117V125M27 119.5H33" stroke="#e4e4e7" strokeWidth="1.8" strokeLinecap="round" />
    </g>
  );
}

function Bat({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 4C3 0 6 1 8 3C9 1 10 1 11 3C13 1 16 0 19 4C16 4 15 6 14 8C12 6 11 7 9.5 9C8 7 7 6 5 8C4 6 3 4 0 4Z"
      fill="#0a0410"
    />
  );
}

/** A tilted goth sticker for the Master console: painted toes, moon and bats. */
export function GothSticker({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "shrink-0 -rotate-6 rounded-[22px] bg-white p-1.5 shadow-[0_10px_30px_-8px_rgba(168,85,247,0.55)] transition hover:rotate-0 hover:scale-105",
        className,
      )}
      title="Stay wicked"
    >
      <svg viewBox="0 0 160 190" className="block h-auto w-full rounded-[17px]" role="img" aria-label="Goth sticker: feet with black nail polish under a crescent moon">
        <defs>
          <linearGradient id="gs-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b0764" />
            <stop offset="1" stopColor="#0f0217" />
          </linearGradient>
          <linearGradient id="gs-skin" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f5e9f0" />
            <stop offset="1" stopColor="#d9c3d3" />
          </linearGradient>
        </defs>
        <rect width="160" height="190" fill="url(#gs-bg)" />
        {/* moon + stars */}
        <circle cx="128" cy="28" r="14" fill="#f5f3ff" />
        <circle cx="122" cy="24" r="13" fill="#2e0650" />
        {[
          [20, 20],
          [44, 34],
          [100, 14],
          [146, 60],
          [14, 70],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" fill="#e9d5ff" />
        ))}
        <Bat x={62} y={16} s={1.1} />
        <Bat x={92} y={40} s={0.75} />
        {/* the feet */}
        <g transform="translate(22 42) scale(0.92)">
          <g transform="translate(60 0) scale(-1 1)">
            <Foot />
          </g>
          <g transform="translate(66 0)">
            <Foot />
          </g>
        </g>
        {/* rose at the bottom */}
        <circle cx="80" cy="166" r="6" fill="#9f1239" />
        <path d="M76 165C78 161 83 161 84 166M77 168C80 170 83 169 84 166" stroke="#4c0519" strokeWidth="1.1" fill="none" />
        <path d="M70 168C66 166 63 168 62 171C66 172 69 171 70 168ZM90 168C94 166 97 168 98 171C94 172 91 171 90 168Z" fill="#14532d" />
        <text x="80" y="185" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize="9" fill="#e9d5ff" letterSpacing="1.5">
          stay wicked
        </text>
      </svg>
    </div>
  );
}
