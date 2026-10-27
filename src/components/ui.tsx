import type { ReactNode } from "react";
import type { CandidateStyle } from "@/lib/party";
import { onToneVar, toneFill, toneVar } from "@/lib/party";

/** Section with the zonemix.tech heading rail on the left. */
export function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="sect" aria-labelledby={`${id}-title`}>
      <div className="sect-head">
        <h2 id={`${id}-title`} className="h2">
          {title}
        </h2>
        {note ? <p>{note}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** Party letter badge (R, D, I, L). The letter, not the color, names the party. */
export function PartyBadge({
  style,
  large = false,
}: {
  style: CandidateStyle;
  large?: boolean;
}) {
  return (
    <span
      className={`badge ${large ? "badge-lg" : ""}`}
      style={{ background: toneVar(style.tone), color: onToneVar(style.tone) }}
      title={style.label}
      aria-label={style.label}
    >
      {style.letter}
    </span>
  );
}

/** Horizontal share bar, striped for the second tone in a race. */
export function ShareTrack({
  style,
  pct,
  large = false,
}: {
  style: CandidateStyle;
  pct: number;
  large?: boolean;
}) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className={`track ${large ? "track-lg" : ""}`} aria-hidden>
      <div className="fill left-0" style={{ width: `${w}%`, background: toneFill(style) }} />
    </div>
  );
}

/** Neutral progress meter (precincts reporting). */
export function Meter({ value, label }: { value: number; label: string }) {
  const w = Math.max(0, Math.min(100, value));
  return (
    <div
      className="track"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(w)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="fill left-0" style={{ width: `${w}%`, background: "var(--fg-soft)" }} />
    </div>
  );
}

export function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-4 border-t border-line pt-6" aria-hidden>
      <div className="skeleton h-6 w-48" />
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="space-y-2">
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-2 w-full" />
        </div>
      ))}
    </div>
  );
}
