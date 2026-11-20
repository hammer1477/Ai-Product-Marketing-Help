// Die-cut stickers stuck around the edges of the dashboard: young-creator
// energy in the brand colours. They live in the wide-screen margins, outside
// the content column, so they decorate without ever covering anything.

type StickerProps = { size: number };

const SHADOW = "drop-shadow(0 6px 10px rgba(0,0,0,0.25))";

function Wrap({ children, size, ratio = 1 }: { children: React.ReactNode; size: number; ratio?: number }) {
  return (
    <svg width={size} height={size * ratio} viewBox={`0 0 100 ${100 * ratio}`} style={{ filter: SHADOW }}>
      {children}
    </svg>
  );
}

/** A pill-shaped word sticker with a white die-cut edge. */
function WordSticker({ size, text, from, to, ink = "#fff" }: StickerProps & { text: string; from: string; to: string; ink?: string }) {
  const id = `g-${text.replace(/\W/g, "")}`;
  return (
    <Wrap size={size} ratio={0.42}>
      <defs>
        <linearGradient id={id} x1="0" x2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="98" height="40" rx="20" fill="#fff" />
      <rect x="5" y="5" width="90" height="32" rx="16" fill={`url(#${id})`} />
      <text x="50" y="26.5" textAnchor="middle" fontSize={Math.min(11, 96 / text.length)} fontWeight="900" fill={ink} fontFamily="system-ui, sans-serif" letterSpacing="0.5">
        {text}
      </text>
    </Wrap>
  );
}

function Smiley({ size }: StickerProps) {
  return (
    <Wrap size={size}>
      <circle cx="50" cy="50" r="48" fill="#fff" />
      <circle cx="50" cy="50" r="42" fill="#ffd23f" />
      <ellipse cx="36" cy="42" rx="5" ry="8" fill="#1d1d1f" />
      <ellipse cx="64" cy="42" rx="5" ry="8" fill="#1d1d1f" />
      <path d="M28 58 Q50 82 72 58" stroke="#1d1d1f" strokeWidth="6" fill="none" strokeLinecap="round" />
    </Wrap>
  );
}

function Bolt({ size }: StickerProps) {
  return (
    <Wrap size={size}>
      <path d="M58 2 L16 58 H44 L36 98 L86 38 H56 L66 2 Z" fill="#fff" />
      <path d="M57 9 L24 53 H50 L43 86 L78 43 H50 L59 9 Z" fill="#7c5cff" />
    </Wrap>
  );
}

function Flame({ size }: StickerProps) {
  return (
    <Wrap size={size}>
      <path d="M50 2 C70 26 88 40 88 64 C88 86 70 98 50 98 C30 98 12 86 12 64 C12 46 26 36 30 20 C40 32 44 40 44 48 C50 34 52 20 50 2 Z" fill="#fff" />
      <path d="M50 10 C66 30 82 44 82 64 C82 82 68 92 50 92 C32 92 18 82 18 64 C18 50 28 42 32 30 C40 40 46 48 46 56 C54 42 54 26 50 10 Z" fill="#ff5a36" />
      <path d="M50 52 C60 62 66 68 66 76 C66 85 59 90 50 90 C41 90 34 85 34 76 C34 68 42 62 50 52 Z" fill="#ffd23f" />
    </Wrap>
  );
}

function Burst({ size, text }: StickerProps & { text: string }) {
  const points = Array.from({ length: 24 }, (_, i) => {
    const r = i % 2 ? 36 : 48;
    const a = (i / 24) * Math.PI * 2;
    return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`;
  }).join(" ");
  const inner = Array.from({ length: 24 }, (_, i) => {
    const r = i % 2 ? 31 : 42;
    const a = (i / 24) * Math.PI * 2;
    return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`;
  }).join(" ");
  return (
    <Wrap size={size}>
      <polygon points={points} fill="#fff" />
      <polygon points={inner} fill="#ff4fa3" />
      <text x="50" y="56" textAnchor="middle" fontSize="17" fontWeight="900" fill="#fff" fontFamily="system-ui, sans-serif">
        {text}
      </text>
    </Wrap>
  );
}

function HeartSpark({ size }: StickerProps) {
  return (
    <Wrap size={size}>
      <path d="M50 92 C20 70 4 54 4 34 C4 18 16 6 31 6 C40 6 46 11 50 18 C54 11 60 6 69 6 C84 6 96 18 96 34 C96 54 80 70 50 92 Z" fill="#fff" />
      <path d="M50 84 C24 64 11 51 11 34 C11 22 20 13 31 13 C40 13 46 19 50 27 C54 19 60 13 69 13 C80 13 89 22 89 34 C89 51 76 64 50 84 Z" fill="#ff3d7f" />
      <path d="M30 28 c1 6 3 8 9 9 c-6 1 -8 3 -9 9 c-1 -6 -3 -8 -9 -9 c6 -1 8 -3 9 -9Z" fill="#fff" />
    </Wrap>
  );
}

function Star({ size }: StickerProps) {
  return (
    <Wrap size={size}>
      <path d="M50 2 L63 34 L98 37 L71 59 L80 94 L50 75 L20 94 L29 59 L2 37 L37 34 Z" fill="#fff" />
      <path d="M50 12 L60 38 L88 40 L66 58 L73 85 L50 70 L27 85 L34 58 L12 40 L40 38 Z" fill="#34d399" />
    </Wrap>
  );
}

const STICKERS: Array<{ el: React.ReactNode; x: string; y: string; rotate: number; side: "left" | "right" }> = [
  { el: <WordSticker size={150} text="MAIN CHARACTER" from="#7c5cff" to="#ff4fa3" />, x: "1.5%", y: "18%", rotate: -10, side: "left" },
  { el: <Smiley size={78} />, x: "4%", y: "38%", rotate: 12, side: "left" },
  { el: <Flame size={70} />, x: "2%", y: "58%", rotate: -6, side: "left" },
  { el: <WordSticker size={130} text="GO VIRAL" from="#ff8a00" to="#ff3d7f" />, x: "1%", y: "76%", rotate: 8, side: "left" },
  { el: <Bolt size={74} />, x: "2.5%", y: "16%", rotate: 14, side: "right" },
  { el: <WordSticker size={140} text="IDEAS ONLY" from="#00c2ff" to="#7c5cff" />, x: "1%", y: "34%", rotate: -8, side: "right" },
  { el: <Burst size={88} text="WOW" />, x: "3%", y: "53%", rotate: 10, side: "right" },
  { el: <HeartSpark size={72} />, x: "4%", y: "71%", rotate: -12, side: "right" },
  { el: <Star size={60} />, x: "2%", y: "86%", rotate: 6, side: "right" },
];

export function Stickers() {
  return (
    // Only where there's margin to spare outside the 6xl content column.
    <div aria-hidden className="pointer-events-none fixed inset-0 hidden select-none min-[1500px]:block">
      {STICKERS.map((s, i) => (
        <div
          key={i}
          className="absolute"
          style={{ [s.side]: s.x, top: s.y, transform: `rotate(${s.rotate}deg)` }}
        >
          {s.el}
        </div>
      ))}
    </div>
  );
}
