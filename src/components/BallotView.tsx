"use client";

import type { ReactNode } from "react";
import type { RaceDetail, RaceRef, RaceSummary } from "@/lib/types";
import type { BallotContests, BallotOption, NamedRef } from "@/lib/ballot";
import { QUESTIONS_URL, QUESTION_SUMMARIES, questionLetter } from "@/lib/ballot";
import { splitTicket, styleCandidates } from "@/lib/party";
import { int, pct } from "@/lib/format";
import { contestKey, type BallotResults } from "@/hooks/useBallotContests";
import { RaceCard } from "./RaceCard";
import { Meter, PartyBadge } from "./ui";

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="mt-12">
      <h3 className="text-[1.625rem] font-semibold leading-tight tracking-tight">{title}</h3>
      {note ? <p className="small mt-1 mb-0">{note}</p> : null}
      <div className="mt-6">{children}</div>
    </div>
  );
}

/** One line per statewide race: names and party badges only. */
function StatewideList({ races, details }: { races: RaceRef[]; details: Record<number, RaceDetail> }) {
  return (
    <ul className="m-0 grid gap-x-10 gap-y-4 p-0 md:grid-cols-2">
      {races.map((r) => {
        const d = details[r.raceId];
        const styles = d ? styleCandidates(d.candidates) : null;
        const ordered = d ? [...d.candidates].sort((a, b) => a.ballotOrder - b.ballotOrder) : [];
        return (
          <li key={r.raceId} className="list-none border-t border-line pt-3">
            <div className="font-medium">{d?.name ?? r.name}</div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {ordered.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-2">
                  <PartyBadge style={styles!.get(c.id)!} />
                  {splitTicket(c.name).lead}
                </span>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** True for yes/no questions (amendments, referendums, bond issues). */
const isQuestion = (r: RaceSummary | undefined): boolean =>
  Boolean(r && r.candidates.length > 0 && r.candidates.every((c) => /^(yes|no)$/i.test(c.name.trim())));

function QuestionCard({ ref_, result }: { ref_: NamedRef; result: RaceSummary | undefined }) {
  const letter = questionLetter(ref_.name);
  const counted = Boolean(result && result.totalVotes > 0);
  // "Referendum 83: AN ORDINANCE ... - Codington" -> heading + detail, minus the county suffix.
  const [head, ...rest] = ref_.name.replace(/\s+-\s+[^-:]+$/, "").split(/\s*:\s*/);
  return (
    <article className="border-t border-line pt-5">
      {letter ? (
        <>
          <h4 className="h3">Amendment {letter}</h4>
          <p className="mt-2 mb-0">{QUESTION_SUMMARIES[letter]}</p>
          <p className="small mt-2 mb-0">Ballot title: {rest.join(": ")}</p>
        </>
      ) : (
        <>
          <h4 className="h3">{head}</h4>
          {rest.length > 0 ? <p className="small mt-2 mb-0">{rest.join(": ")}</p> : null}
        </>
      )}
      {result ? (
        <ul className="mt-4 mb-0 space-y-3 p-0">
          {[...result.candidates]
            .sort((a, b) => a.ballotOrder - b.ballotOrder)
            .map((c) => (
              <li key={c.id} className="list-none">
                <div className="num flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{c.name}</span>
                  {counted ? (
                    <span>
                      {int(c.votes)} <span className="text-muted">{pct(c.pct)}</span>
                    </span>
                  ) : null}
                </div>
                <div className="mt-1.5">
                  <Meter value={counted ? c.pct : 0} label={`${c.name} share`} />
                </div>
              </li>
            ))}
        </ul>
      ) : null}
    </article>
  );
}

export function BallotView({
  option,
  contests,
  ballot,
  races,
  details,
}: {
  option: BallotOption;
  contests: BallotContests;
  ballot: BallotResults;
  races: RaceRef[];
  details: Record<number, RaceDetail>;
}) {
  const get = (type: "LEG" | "CTY" | "MUN" | "BQ", raceId: number) => ballot.results[contestKey(type, raceId)];
  const legTitle = (office: "senate" | "house", district: string, voteFor?: number) =>
    `State ${office === "senate" ? "Senate" : "House"}, District ${district}${voteFor && voteFor > 1 ? `, vote for ${voteFor}` : ""}`;

  return (
    <div className="mt-4">
      <p className="mt-10 mb-0 text-[clamp(1.1875rem,2vw,1.375rem)] leading-normal">
        Your ballot for {option.countyName} County, legislative District {option.senate}
        {option.house !== option.senate ? ` (House ${option.house})` : ""}.
      </p>

      <Group title="Statewide and federal" note="On every ballot in South Dakota. Full results are further down the page.">
        <StatewideList races={races} details={details} />
      </Group>

      <Group title="State legislature">
        <div className="grid gap-x-10 gap-y-10 md:grid-cols-2">
          {[contests.senate, contests.house].map((ref) =>
            ref ? (
              <RaceCard
                key={ref.raceId}
                race={get("LEG", ref.raceId)}
                name={legTitle(ref.office, ref.district, ref.voteFor)}
                useName
                loading={ballot.loading}
              />
            ) : null,
          )}
        </div>
      </Group>

      <Group title={`${option.countyName} County`}>
        {contests.county.length === 0 ? (
          <p className="small m-0">No county races on the ballot here.</p>
        ) : (
          <div className="grid gap-x-10 gap-y-10 md:grid-cols-2">
            {contests.county.map((ref) =>
              isQuestion(get("CTY", ref.raceId)) ? (
                <QuestionCard key={ref.raceId} ref_={ref} result={get("CTY", ref.raceId)} />
              ) : (
                <RaceCard
                  key={ref.raceId}
                  race={get("CTY", ref.raceId)}
                  // The feed names county races "Sheriff - Perkins"; the heading already says the county.
                  name={ref.name.replace(/\s+-\s+[^-]+$/, "")}
                  useName
                  loading={ballot.loading}
                />
              ),
            )}
          </div>
        )}
      </Group>

      {contests.local.length > 0 ? (
        <Group title="City, town and school" note="These are only on your ballot if you live in that city, ward or school district.">
          <div className="grid gap-x-10 gap-y-10 md:grid-cols-2">
            {contests.local.map((ref) =>
              isQuestion(get("MUN", ref.raceId)) ? (
                <QuestionCard key={ref.raceId} ref_={{ ...ref, name: `${ref.area}: ${ref.name}` }} result={get("MUN", ref.raceId)} />
              ) : (
                <RaceCard
                  key={ref.raceId}
                  race={get("MUN", ref.raceId)}
                  name={`${ref.area}: ${ref.name}`}
                  useName
                  loading={ballot.loading}
                />
              ),
            )}
          </div>
        </Group>
      ) : null}

      <Group title="Constitutional amendments" note="A yes vote approves the change to the state constitution. A no vote rejects it.">
        <div className="grid gap-x-10 gap-y-10 md:grid-cols-2">
          {contests.questions.map((ref) => (
            <QuestionCard key={ref.raceId} ref_={ref} result={get("BQ", ref.raceId)} />
          ))}
        </div>
        <p className="small mt-6 mb-0">
          Read the full text and the official explanations from the{" "}
          <a href={QUESTIONS_URL} className="link" target="_blank" rel="noopener noreferrer">
            Secretary of State
          </a>
          .
        </p>
      </Group>
    </div>
  );
}
