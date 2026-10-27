"use client";

import type { Candidate, RaceDetail } from "@/lib/types";
import type { CandidateStyle } from "@/lib/party";
import { splitTicket, styleCandidates, toneFill } from "@/lib/party";
import { awaitingLabel } from "@/lib/sdapi";
import { int, pct, lastName } from "@/lib/format";
import { useCountUp } from "@/hooks/useCountUp";
import { useNow } from "@/hooks/useNow";
import { PartyBadge, SkeletonBlock } from "./ui";

function Side({
  candidate,
  style,
  align,
  hasResults,
  status,
}: {
  candidate: Candidate;
  style: CandidateStyle;
  align: "left" | "right";
  hasResults: boolean;
  status: string | null;
}) {
  const votes = useCountUp(candidate.votes);
  const { lead, mate } = splitTicket(candidate.name);
  const right = align === "right";

  return (
    <div className={`flex min-w-0 flex-col ${right ? "items-end text-right" : "items-start"}`}>
      <div className={`flex items-start gap-3 ${right ? "flex-row-reverse" : ""}`}>
        <PartyBadge style={style} large />
        <div className="min-w-0">
          <div className="text-[clamp(1.25rem,3vw,2rem)] font-semibold leading-[1.1] tracking-tight">
            {lead}
          </div>
          {mate ? <div className="mt-1 text-sm text-muted">with {mate}</div> : null}
          <div className="mt-1 text-sm text-muted">{style.label}</div>
        </div>
      </div>
      <div className="num mt-5 text-[clamp(2.25rem,7vw,4.75rem)] font-semibold leading-none tracking-[-0.035em]">
        {int(votes)}
      </div>
      <div className="num mt-2 text-lg text-fg-soft">{hasResults ? pct(candidate.pct) : "No votes yet"}</div>
      <div className="mt-2 min-h-[1.5rem] text-sm font-semibold">{status}</div>
    </div>
  );
}

export function FeaturedRace({
  race,
  title,
  final = false,
}: {
  race: RaceDetail | undefined;
  title?: string; // defaults to the race name
  final?: boolean; // archived result: "Won", not "Projected winner"
}) {
  const now = useNow();
  if (!race) return <SkeletonBlock lines={2} />;

  const candidates = [...race.candidates].sort((a, b) => a.ballotOrder - b.ballotOrder);
  if (candidates.length !== 2) return null;
  const [left, right] = candidates;
  const styles = styleCandidates(candidates);
  const ls = styles.get(left.id)!;
  const rs = styles.get(right.id)!;

  const total = left.votes + right.votes;
  const hasResults = total > 0;
  const uniqueLeader = race.candidates.filter((c) => c.isLeading).length === 1;
  const statusFor = (c: Candidate): string | null => {
    if (!hasResults) return null;
    if (c.isWinner) return final ? "Won" : "Projected winner";
    return c.isLeading && uniqueLeader ? "Leading" : null;
  };
  const leftShare = hasResults ? (left.votes / total) * 100 : 0;
  const margin = left.votes - right.votes;
  const winner = race.candidates.find((c) => c.isWinner) ?? null;

  const summary = !hasResults
    ? now === null
      ? ""
      : awaitingLabel(now)
    : winner
      ? `${splitTicket(winner.name).lead} ${final ? "won" : "is the projected winner"} by ${int(Math.abs(margin))} votes.`
      : margin === 0
        ? "Tied."
        : `${lastName(margin > 0 ? left.name : right.name)} leads by ${int(Math.abs(margin))} votes.`;

  return (
    <article aria-label={`${title ?? race.name} results`} className="border-t border-line-strong pt-5">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className={final ? "h3" : "h2"}>{title ?? race.name}</h3>
        <span className="num text-sm text-muted">
          {int(race.precinctsReporting)} of {int(race.totalPrecincts)} precincts reporting
        </span>
      </header>

      <div className="mt-8 grid grid-cols-2 gap-6 sm:gap-12">
        <Side candidate={left} style={ls} align="left" hasResults={hasResults} status={statusFor(left)} />
        <Side candidate={right} style={rs} align="right" hasResults={hasResults} status={statusFor(right)} />
      </div>

      <div className="track track-lg mt-6" aria-hidden>
        {hasResults ? (
          <>
            <div className="fill left-0" style={{ width: `${leftShare}%`, background: toneFill(ls), borderRadius: "999px 0 0 999px" }} />
            <div className="fill right-0" style={{ width: `${100 - leftShare}%`, background: toneFill(rs), borderRadius: "0 999px 999px 0" }} />
          </>
        ) : null}
        <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-bg" />
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>{lastName(left.name)}</span>
        <span>50%</span>
        <span>{lastName(right.name)}</span>
      </div>

      <p className="mt-5 mb-0 min-h-[1.6em] text-base text-fg-soft" aria-live="polite">
        {summary}
      </p>
    </article>
  );
}
