"use client";

import type { ReactNode } from "react";
import type { TurnoutData } from "@/lib/types";
import { ELECTION, phaseAt, type Phase } from "@/lib/sdapi";
import { int } from "@/lib/format";
import { useNow } from "@/hooks/useNow";
import { LiveClock } from "./LiveClock";
import { ThemeToggle } from "./ThemeToggle";

const STATUS: Record<Phase, string> = {
  before: "Polls close at 7 PM CT on November 3. Results will appear here as counties report.",
  live: "Results are coming in. This page refreshes every 15 seconds.",
  after: "Counting is done for the night. Every figure stays unofficial until the state canvass.",
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 border-t border-line pt-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="num m-0 mt-1 text-xl font-semibold tracking-tight">{children}</dd>
    </div>
  );
}

export function Masthead({
  turnout,
  lastUpdated,
  onRefresh,
}: {
  turnout: TurnoutData | null;
  lastUpdated: number | null;
  onRefresh: () => void;
}) {
  const now = useNow();
  const phase = now === null ? null : phaseAt(now);
  const sw = turnout?.statewide;
  const counted = Boolean(sw && sw.ballots > 0);

  return (
    <>
      <header className="shell flex items-center gap-4 py-6">
        <a href="https://zonemix.tech" className="text-base font-semibold tracking-tight no-underline">
          zonemix
        </a>
        <span className="text-base text-muted">Elections</span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="btn-quiet" onClick={onRefresh}>
            Refresh
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div className="shell pt-[clamp(2.5rem,7vw,5.5rem)]">
        <p className="m-0 mb-5 text-base text-muted">
          {ELECTION.jurisdiction} general election, {ELECTION.date}
        </p>
        <h1 className="display">South Dakota votes</h1>
        <p className="lede mt-6">
          Unofficial results for Governor, U.S. Senate, U.S. House and every
          statewide race, county by county.
        </p>
        <p className="mt-6 mb-0 flex min-h-[1.6em] items-baseline gap-2.5 text-base text-fg-soft" aria-live="polite">
          {phase ? (
            <>
              <span className={`dot ${phase === "live" ? "dot-live" : ""}`} aria-hidden />
              {STATUS[phase]}
            </>
          ) : null}
        </p>

        <dl className="mt-10 mb-0 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
          <Fact label="Precincts reporting">
            {sw ? `${int(sw.precinctsReporting)} of ${int(sw.totalPrecincts)}` : "Loading"}
          </Fact>
          <Fact label="Counties reporting">
            {sw ? `${sw.countiesReporting} of ${sw.totalCounties}` : "Loading"}
          </Fact>
          <Fact label="Ballots counted">{sw ? (counted ? int(sw.ballots) : "None yet") : "Loading"}</Fact>
          <Fact label="Registered voters">{sw ? int(sw.registered) : "Loading"}</Fact>
          <Fact label="Last checked">
            <LiveClock at={lastUpdated} />
          </Fact>
        </dl>
      </div>
    </>
  );
}
