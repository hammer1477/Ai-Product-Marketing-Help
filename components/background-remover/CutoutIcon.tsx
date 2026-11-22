/** Feature 4 icon: a product silhouette lifted out of a dashed (transparent) frame. Lucide-style strokes. */
export function CutoutIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3" />
      <path d="M10.5 6.5h3v2.2c1.5.6 2.5 2 2.5 3.6V17a.5.5 0 0 1-.5.5h-7A.5.5 0 0 1 8 17v-4.7c0-1.6 1-3 2.5-3.6Z" fill="currentColor" fillOpacity={0.25} />
    </svg>
  );
}
