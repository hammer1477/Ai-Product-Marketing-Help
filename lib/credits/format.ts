const UNITS = [
  { value: 1e12, suffix: "T" },
  { value: 1e9, suffix: "B" },
  { value: 1e6, suffix: "M" },
  { value: 1e3, suffix: "K" },
] as const;

/**
 * Compact credit count: 950 → "950", 1500 → "1.5K", 1_000_000 → "1M", 2_340_000_000 → "2.3B".
 * Truncates (never rounds up) so a balance is never shown as more than it is —
 * 999_999 reads "999.9K", not "1000K" or "1M".
 */
export function formatCredits(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  for (const { value, suffix } of UNITS) {
    if (abs >= value) {
      const scaled = Math.floor((abs / value) * 10) / 10;
      return `${sign}${scaled.toString()}${suffix}`;
    }
  }
  return `${sign}${Math.floor(abs)}`;
}
