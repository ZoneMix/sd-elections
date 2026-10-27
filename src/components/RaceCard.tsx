"use client";

import type { RaceSummary } from "@/lib/types";
import { int } from "@/lib/format";
import { awaitingLabel, resultsOpen } from "@/lib/sdapi";
import { styleCandidates } from "@/lib/party";
import { useNow } from "@/hooks/useNow";
import { CandidateRow } from "./CandidateRow";
import { SkeletonBlock } from "./ui";

export function RaceCard({
  race,
  name,
  loading,
  useName = false,
}: {
  race: RaceSummary | undefined;
  name: string; // title; also shown if the race failed to load
  useName?: boolean; // title from `name` instead of the feed
  loading: boolean;
}) {
  const now = useNow();
  if (!race && loading) return <SkeletonBlock />;
  if (!race) {
    return (
      <article className="border-t border-line pt-5">
        <h3 className="h3">{name}</h3>
        <p className="small mt-3 mb-0">This race didn’t load. Use Refresh to try again.</p>
      </article>
    );
  }

  const hasResults = race.totalVotes > 0;
  const styles = styleCandidates(race.candidates);
  // Before polls close the hero already says when results post; repeating it
  // on every race is noise. Once polls close, say what each race is waiting on.
  const footer = hasResults
    ? `${int(race.totalVotes)} votes counted`
    : now !== null && resultsOpen(now)
      ? awaitingLabel(now)
      : "";

  return (
    <article className="flex flex-col border-t border-line pt-5">
      <h3 className="h3">{useName ? name : race.name}</h3>
      <p className="num small mt-1 mb-0">
        {int(race.precinctsReporting)} of {int(race.totalPrecincts)} precincts reporting
        {race.voteFor > 1 ? `, vote for ${race.voteFor}` : ""}
      </p>
      <ul className="mt-5 mb-0 flex-1 space-y-4 p-0">
        {race.candidates.map((c) => (
          <CandidateRow key={c.id} candidate={c} style={styles.get(c.id)!} hasResults={hasResults} />
        ))}
      </ul>
      {footer ? <p className="small mt-5 mb-0">{footer}</p> : null}
    </article>
  );
}
