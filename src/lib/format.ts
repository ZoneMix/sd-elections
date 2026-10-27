// Display formatting helpers (pure).

export const int = (n: number): string =>
  Math.round(n).toLocaleString("en-US");

export const pct = (n: number, digits = 1): string => `${n.toFixed(digits)}%`;

export const pctCompact = (n: number): string =>
  Number.isInteger(n) ? `${n}%` : `${n.toFixed(1)}%`;

/** "just now" / "12s ago" / "3m 04s ago" — for the live update ticker. */
export function agoLabel(atMs: number | null, nowMs: number): string {
  if (!atMs) return "—";
  const s = Math.max(0, Math.round((nowMs - atMs) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m ago`;
}

/** "Toby Doeden" → "Doeden" — compact label for tallies and margins. A joint
 * ticket ("Larry Rhoden and Tony Venhuizen") uses the top of the ticket. */
export function lastName(name: string): string {
  const top = name.split(/\s+and\s+/i)[0] ?? name;
  const parts = top.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

/** Initials for a candidate avatar chip. */
export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
