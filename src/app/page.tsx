"use client";

import type { ReactNode } from "react";
import { useResults } from "@/hooks/useResults";
import { Masthead } from "@/components/Masthead";
import { FeaturedRace } from "@/components/FeaturedRace";
import { RaceCard } from "@/components/RaceCard";
import { CountyMapSection } from "@/components/CountyMapSection";
import { TurnoutPanel } from "@/components/TurnoutPanel";
import { BallotLookup } from "@/components/BallotLookup";
import { Section } from "@/components/ui";
import { ELECTION, RUNOFF } from "@/lib/sdapi";

function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="m-0 mt-10 border-l-2 border-accent py-1 pl-4 text-base text-fg-soft">
      {children}
    </p>
  );
}

export default function Home() {
  const { races, details, turnout, runoff, loading, error, stale, lastUpdated, refresh } =
    useResults();

  const featuredRef = races.find((r) => r.osn === ELECTION.featuredOsn) ?? races[0];
  const featured = featuredRef ? details[featuredRef.raceId] : undefined;
  const extraRaces = races.filter((r) => r !== featuredRef);

  const showSkeleton = loading && !featured;
  const hardError = Boolean(error) && !stale && !turnout && !featured;

  return (
    <>
      <Masthead turnout={turnout} lastUpdated={lastUpdated} onRefresh={refresh} />

      <main className="shell">
        {stale && error ? (
          <Notice>The state feed is catching up, so these are the last numbers it sent.</Notice>
        ) : null}
        {hardError ? (
          <Notice>The state results feed didn’t answer. Use Refresh to try again in a minute.</Notice>
        ) : null}

        <BallotLookup races={races} details={details} refreshKey={lastUpdated} />

        <div className="pt-[clamp(3.5rem,7vw,6rem)]">
          {showSkeleton || featured ? (
            <FeaturedRace race={featured} />
          ) : (
            <Notice>The Governor race didn’t load. Use Refresh to try again.</Notice>
          )}
        </div>

        <CountyMapSection race={featured} />

        {extraRaces.length > 0 ? (
          <Section id="races" title="Statewide races" note="Every other race on the statewide ballot.">
            <div className="grid gap-x-10 gap-y-10 md:grid-cols-2">
              {extraRaces.map((r) => (
                <RaceCard key={r.raceId} race={details[r.raceId]} name={r.name} loading={loading} />
              ))}
            </div>
          </Section>
        ) : null}

        <TurnoutPanel turnout={turnout} />

        <Section
          id="runoff"
          title="The July runoff"
          note={`Final results of the Republican runoff for Governor on ${RUNOFF.date}.`}
        >
          <FeaturedRace race={runoff ?? undefined} title="Governor, Republican runoff" final />
          <p className="small mt-4 mb-0">
            Source:{" "}
            <a href={RUNOFF.sourceUrl} className="link" rel="noopener noreferrer" target="_blank">
              South Dakota Secretary of State election archive
            </a>
          </p>
        </Section>
      </main>

      <footer className="shell mt-[clamp(5rem,10vw,7rem)]">
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3 border-t border-line pt-7 pb-11">
          <a href="https://zonemix.tech" className="text-base font-semibold tracking-tight no-underline">
            zonemix
          </a>
          <p className="small m-0 max-w-[44rem]">
            Unofficial results, mirrored from the South Dakota Secretary of State. The page loads once
            and refreshes every 15 seconds on election night only. Figures are preliminary until the
            official canvass. Not affiliated with any government agency or campaign.
          </p>
        </div>
      </footer>
    </>
  );
}
