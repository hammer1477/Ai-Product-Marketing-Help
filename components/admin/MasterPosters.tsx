// Posters taped to the walls of the master console: gold-on-oxblood
// art-deco pieces in the margins either side of the content (wide screens
// only), each held up with a strip of tape.

const GOLD = "#d4a43a";
const GOLD_LIGHT = "#f1d27a";
const OX = "#3a0a14";

function Tape({ rotate }: { rotate: number }) {
  return (
    <div
      className="absolute -top-3 left-1/2 h-6 w-20 -translate-x-1/2 bg-amber-100/25 backdrop-blur-[1px]"
      style={{ transform: `translateX(-50%) rotate(${rotate}deg)`, boxShadow: "0 1px 2px rgba(0,0,0,.3)" }}
    />
  );
}

function Frame({ children, rotate, tape }: { children: React.ReactNode; rotate: number; tape: number }) {
  return (
    <div className="relative" style={{ transform: `rotate(${rotate}deg)` }}>
      <Tape rotate={tape} />
      <div className="overflow-hidden rounded-sm border border-amber-500/30 shadow-[0_20px_40px_-10px_rgba(0,0,0,.8)]">{children}</div>
    </div>
  );
}

/** "THE MASTER": a crown in an art-deco sunburst. */
function CrownPoster() {
  const rays = Array.from({ length: 18 }, (_, i) => {
    const a = Math.PI + (i / 17) * Math.PI;
    return <line key={i} x1="80" y1="118" x2={80 + 90 * Math.cos(a)} y2={118 + 90 * Math.sin(a)} stroke={GOLD} strokeWidth="1" opacity=".45" />;
  });
  return (
    <svg width="170" height="240" viewBox="0 0 160 226">
      <rect width="160" height="226" fill={OX} />
      <rect x="8" y="8" width="144" height="210" fill="none" stroke={GOLD} strokeWidth="1.5" />
      <rect x="13" y="13" width="134" height="200" fill="none" stroke={GOLD} strokeWidth=".6" opacity=".7" />
      {rays}
      <path d="M44 112 L50 72 L66 92 L80 62 L94 92 L110 72 L116 112 Z" fill={GOLD} />
      <rect x="44" y="114" width="72" height="9" fill={GOLD_LIGHT} />
      <circle cx="50" cy="70" r="4" fill={GOLD_LIGHT} />
      <circle cx="80" cy="59" r="4.5" fill={GOLD_LIGHT} />
      <circle cx="110" cy="70" r="4" fill={GOLD_LIGHT} />
      <text x="80" y="160" textAnchor="middle" fill={GOLD_LIGHT} fontSize="20" fontWeight="800" letterSpacing="5" fontFamily="Georgia, serif">THE</text>
      <text x="80" y="186" textAnchor="middle" fill={GOLD} fontSize="24" fontWeight="800" letterSpacing="4" fontFamily="Georgia, serif">MASTER</text>
      <text x="80" y="204" textAnchor="middle" fill={GOLD} fontSize="7" letterSpacing="3" opacity=".7" fontFamily="Georgia, serif">EST. BY DECREE</text>
    </svg>
  );
}

/** "AT YOUR COMMAND": stacked deco type. */
function CommandPoster() {
  return (
    <svg width="160" height="220" viewBox="0 0 160 220">
      <rect width="160" height="220" fill="#120607" />
      <rect x="0" y="0" width="160" height="220" fill="none" stroke={GOLD} strokeWidth="6" opacity=".9" />
      <path d="M0 40 L160 40 M0 180 L160 180" stroke={GOLD} strokeWidth="1" opacity=".5" />
      <text x="80" y="76" textAnchor="middle" fill={GOLD_LIGHT} fontSize="26" fontWeight="900" letterSpacing="3" fontFamily="Georgia, serif">AT</text>
      <text x="80" y="106" textAnchor="middle" fill={GOLD} fontSize="26" fontWeight="900" letterSpacing="3" fontFamily="Georgia, serif">YOUR</text>
      <text x="80" y="140" textAnchor="middle" fill="#e05a6d" fontSize="22" fontWeight="900" letterSpacing="2" fontFamily="Georgia, serif">COMMAND</text>
      <text x="80" y="164" textAnchor="middle" fill={GOLD} fontSize="7" letterSpacing="3" opacity=".7" fontFamily="Georgia, serif">THE STUDIO OBEYS</text>
      <path d="M70 196 L80 188 L90 196 L80 204 Z" fill={GOLD} />
    </svg>
  );
}

/** "THE EMPIRE": a seal with laurels. */
function EmpirePoster() {
  const leaves = Array.from({ length: 9 }, (_, i) => {
    const a = Math.PI * 0.62 + (i / 8) * Math.PI * 0.76;
    const x = 80 + 46 * Math.cos(a);
    const y = 92 + 46 * Math.sin(a);
    return (
      <g key={i}>
        <ellipse cx={x} cy={y} rx="7" ry="3" fill={GOLD} transform={`rotate(${(a * 180) / Math.PI + 60} ${x} ${y})`} />
        <ellipse cx={160 - x} cy={y} rx="7" ry="3" fill={GOLD} transform={`rotate(${120 - (a * 180) / Math.PI} ${160 - x} ${y})`} />
      </g>
    );
  });
  return (
    <svg width="160" height="210" viewBox="0 0 160 210">
      <rect width="160" height="210" fill={OX} />
      <rect x="10" y="10" width="140" height="190" fill="none" stroke={GOLD} strokeWidth="1" strokeDasharray="4 3" opacity=".7" />
      {leaves}
      <circle cx="80" cy="88" r="30" fill="none" stroke={GOLD} strokeWidth="2" />
      <circle cx="80" cy="88" r="24" fill={GOLD} opacity=".15" />
      <text x="80" y="98" textAnchor="middle" fill={GOLD_LIGHT} fontSize="28" fontWeight="900" fontFamily="Georgia, serif">M</text>
      <text x="80" y="160" textAnchor="middle" fill={GOLD} fontSize="18" fontWeight="800" letterSpacing="4" fontFamily="Georgia, serif">EMPIRE</text>
      <text x="80" y="178" textAnchor="middle" fill={GOLD_LIGHT} fontSize="7" letterSpacing="2.5" opacity=".75" fontFamily="Georgia, serif">ALL OF IT · YOURS</text>
    </svg>
  );
}

export function MasterPosters() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 hidden select-none min-[1500px]:block">
      <div className="absolute left-[2.5%] top-[16%]">
        <Frame rotate={-4} tape={-3}>
          <CrownPoster />
        </Frame>
      </div>
      <div className="absolute left-[4%] top-[58%]">
        <Frame rotate={3} tape={4}>
          <EmpirePoster />
        </Frame>
      </div>
      <div className="absolute right-[3%] top-[30%]">
        <Frame rotate={5} tape={-5}>
          <CommandPoster />
        </Frame>
      </div>
    </div>
  );
}
