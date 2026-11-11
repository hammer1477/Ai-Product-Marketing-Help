// Hand-authored, hook-free icon set for feature callouts/badges in Satori
// renders. We deliberately do NOT use lucide-react here: its icon
// components call a React context hook internally, which breaks when
// Satori invokes them directly (there's no real React render tree / hook
// dispatcher in that context) — see https://github.com/vercel/satori/issues
// for the general class of bug. These are plain functions returning only
// primitive SVG elements (path/circle/polygon/line), which Satori renders
// natively with no React involved.
type IconProps = { color: string; size: number };

function IconShell({
  size,
  children,
}: {
  size: number;
  children: React.ReactNode;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {children}
    </svg>
  );
}

const Check = ({ color, size }: IconProps) => (
  <IconShell size={size}>
    <polyline
      points="4 12 9 18 20 6"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </IconShell>
);

const Star = ({ color, size }: IconProps) => (
  <IconShell size={size}>
    <polygon
      points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"
      fill={color}
    />
  </IconShell>
);

const Leaf = ({ color, size }: IconProps) => (
  <IconShell size={size}>
    <ellipse cx="12" cy="12" rx="9" ry="5" fill={color} transform="rotate(-45 12 12)" />
  </IconShell>
);

const Shield = ({ color, size }: IconProps) => (
  <IconShell size={size}>
    <polygon points="12 2 20 6 20 12 12 22 4 12 4 6" fill={color} />
  </IconShell>
);

const Truck = ({ color, size }: IconProps) => (
  <IconShell size={size}>
    <rect x="2" y="9" width="13" height="9" fill={color} />
    <rect x="15" y="12" width="6" height="6" fill={color} />
    <circle cx="6" cy="19" r="2" fill={color} />
    <circle cx="17" cy="19" r="2" fill={color} />
  </IconShell>
);

const Heart = ({ color, size }: IconProps) => (
  <IconShell size={size}>
    <path
      d="M12 21s-6.7-4.35-9.5-8.5C.7 9.5 2 6 5.5 6c2 0 3.5 1.2 4.5 2.7C11 7.2 12.5 6 14.5 6 18 6 19.3 9.5 17.5 12.5 14.7 16.65 12 21 12 21z"
      fill={color}
    />
  </IconShell>
);

const Sparkles = ({ color, size }: IconProps) => (
  <IconShell size={size}>
    <polygon points="12 2 14 10 22 12 14 14 12 22 10 14 2 12 10 10" fill={color} />
  </IconShell>
);

const Tag = ({ color, size }: IconProps) => (
  <IconShell size={size}>
    <polygon points="2 12 2 4 10 4 20 14 12 22" fill={color} />
    <circle cx="6" cy="8" r="1.5" fill="white" />
  </IconShell>
);

const Clock = ({ color, size }: IconProps) => (
  <IconShell size={size}>
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth={2} />
    <line x1="12" y1="12" x2="12" y2="7" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <line x1="12" y1="12" x2="16" y2="14" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </IconShell>
);

const Award = ({ color, size }: IconProps) => (
  <IconShell size={size}>
    <circle cx="12" cy="8" r="6" stroke={color} strokeWidth={2} />
    <polyline
      points="8.5 13 7 22 12 19 17 22 15.5 13"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </IconShell>
);

const Zap = ({ color, size }: IconProps) => (
  <IconShell size={size}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill={color} />
  </IconShell>
);

const Gift = ({ color, size }: IconProps) => (
  <IconShell size={size}>
    <rect x="3" y="8" width="18" height="13" stroke={color} strokeWidth={2} />
    <rect x="2" y="4" width="20" height="4" stroke={color} strokeWidth={2} />
    <line x1="12" y1="4" x2="12" y2="21" stroke={color} strokeWidth={2} />
  </IconShell>
);

const Droplet = ({ color, size }: IconProps) => (
  <IconShell size={size}>
    <path d="M12 2.5C12 2.5 5 10.5 5 15a7 7 0 0 0 14 0c0-4.5-7-12.5-7-12.5z" fill={color} />
  </IconShell>
);

const Battery = ({ color, size }: IconProps) => (
  <IconShell size={size}>
    <rect x="2" y="7" width="17" height="10" rx="2" stroke={color} strokeWidth={2} />
    <rect x="20" y="10" width="2" height="4" fill={color} />
    <rect x="4.5" y="9.5" width="9" height="5" fill={color} />
  </IconShell>
);

const Sun = ({ color, size }: IconProps) => (
  <IconShell size={size}>
    <circle cx="12" cy="12" r="4.5" fill={color} />
    <path
      d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </IconShell>
);

const Music = ({ color, size }: IconProps) => (
  <IconShell size={size}>
    <path d="M9 18V5l11-2v13" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    <circle cx="6.5" cy="18" r="3" fill={color} />
    <circle cx="17.5" cy="16" r="3" fill={color} />
  </IconShell>
);

const Lock = ({ color, size }: IconProps) => (
  <IconShell size={size}>
    <rect x="4" y="10" width="16" height="12" rx="2" fill={color} />
    <path d="M7.5 10V7a4.5 4.5 0 0 1 9 0v3" stroke={color} strokeWidth={2} />
  </IconShell>
);

export const ICON_REGISTRY = {
  check: Check,
  star: Star,
  leaf: Leaf,
  shield: Shield,
  truck: Truck,
  heart: Heart,
  sparkles: Sparkles,
  tag: Tag,
  clock: Clock,
  award: Award,
  zap: Zap,
  gift: Gift,
  droplet: Droplet,
  battery: Battery,
  sun: Sun,
  music: Music,
  lock: Lock,
} as const;

export type IconKey = keyof typeof ICON_REGISTRY;

export function isKnownIconKey(key: string): key is IconKey {
  return key in ICON_REGISTRY;
}

// Compile-time check that iconKeys.ts and the registry list the same names.
type _SameKeys = [IconKey] extends [import("../iconKeys").IconName]
  ? [import("../iconKeys").IconName] extends [IconKey]
    ? true
    : never
  : never;
export const ICON_KEYS_IN_SYNC: _SameKeys = true;
