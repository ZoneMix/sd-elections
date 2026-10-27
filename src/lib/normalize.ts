// Pure transforms: raw SD service rows → clean, immutable view models.
// No side effects, no I/O — safe to run in the Worker or in tests.
import type {
  RawMapData,
  RawTurnout,
  RaceRef,
  RaceSummary,
  RaceDetail,
  Candidate,
  CountyResult,
  CountyCandidate,
  TurnoutData,
  CountyTurnout,
} from "./types";
import { cleanName, canonCounty } from "./sdapi";

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const pctOf = (part: number, whole: number): number =>
  whole > 0 ? (part / whole) * 100 : 0;

/** Statewide per-candidate totals for one race (the `category=SW` feed). */
export function normalizeRaceSummary(
  rows: readonly RawMapData[],
  ref: RaceRef,
): RaceSummary {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      raceId: ref.raceId,
      osn: ref.osn,
      party: ref.party,
      name: ref.name,
      voteFor: 1,
      totalPrecincts: 0,
      precinctsReporting: 0,
      precinctsPartial: 0,
      reportingPct: 0,
      totalVotes: 0,
      candidates: [],
      leaderId: null,
      isComplete: false,
      updatedAt: null,
    };
  }

  const first = rows[0];
  const totalPrecincts = num(first.TotalPrecincts);
  const precinctsReporting = num(first.PrecinctsReporting);
  const precinctsPartial = num(first.PrecinctsPartial);
  const reportingPct = pctOf(precinctsReporting, totalPrecincts);
  const isComplete = totalPrecincts > 0 && precinctsReporting >= totalPrecincts;

  const totalVotes = rows.reduce((s, r) => s + num(r.calcCandidateVotes), 0);
  const maxVotes = rows.reduce((m, r) => Math.max(m, num(r.calcCandidateVotes)), 0);
  const uniqueLeader =
    maxVotes > 0 &&
    rows.filter((r) => num(r.calcCandidateVotes) === maxVotes).length === 1;

  const candidates: Candidate[] = rows
    .map((r): Candidate => {
      const votes = num(r.calcCandidateVotes);
      const isLeading = maxVotes > 0 && votes === maxVotes;
      return {
        id: String(r.CandidateID),
        name: cleanName(r.calcCandidate),
        party: r.PartyCode,
        partyName: cleanName(r.PartyName),
        votes,
        pct: totalVotes > 0 ? pctOf(votes, totalVotes) : num(r.calcCandidatePercentage),
        ballotOrder: num(r.BallotOrder),
        colorIndex: Math.max(0, num(r.BallotOrder) - 1),
        isLeading,
        isWinner: Boolean(r.Winner) || (isComplete && uniqueLeader && isLeading),
      };
    })
    .sort((a, b) => b.votes - a.votes || a.ballotOrder - b.ballotOrder);

  const leaderId =
    maxVotes > 0 ? (candidates.find((c) => c.isLeading)?.id ?? null) : null;

  return {
    raceId: ref.raceId,
    osn: ref.osn,
    party: ref.party,
    name: cleanName(first.RaceName) || ref.name,
    voteFor: num(first.VoteFor) || 1,
    totalPrecincts,
    precinctsReporting,
    precinctsPartial,
    reportingPct,
    totalVotes,
    candidates,
    leaderId,
    isComplete,
    updatedAt: first.CurrentDateTime ?? null,
  };
}

/** Per-county per-candidate rows (the `category=CTY` feed). */
export function normalizeCounties(rows: readonly RawMapData[]): CountyResult[] {
  if (!Array.isArray(rows)) return [];

  const byCounty = new Map<string, RawMapData[]>();
  for (const r of rows) {
    const key = String(r.CountyID);
    const list = byCounty.get(key);
    if (list) list.push(r);
    else byCounty.set(key, [r]);
  }

  const out: CountyResult[] = [];
  for (const [id, list] of byCounty) {
    const totalVotes = list.reduce((s, r) => s + num(r.calcCandidateVotes), 0);
    const candidates: CountyCandidate[] = list
      .map((r): CountyCandidate => ({
        id: String(r.CandidateID),
        name: cleanName(r.calcCandidate),
        party: r.PartyCode,
        votes: num(r.calcCandidateVotes),
        pct: pctOf(num(r.calcCandidateVotes), totalVotes),
        colorIndex: Math.max(0, num(r.BallotOrder) - 1),
      }))
      .sort((a, b) => b.votes - a.votes);

    const leader = candidates[0] ?? null;
    const runnerUp = candidates[1] ?? null;
    const totalPrecincts = num(list[0]?.TotalPrecincts);
    const precinctsReporting = num(list[0]?.PrecinctsReporting);

    out.push({
      id,
      name: canonCounty(list[0]?.CountyName ?? ""),
      rawName: cleanName(list[0]?.CountyName ?? ""),
      totalPrecincts,
      precinctsReporting,
      reportingPct: pctOf(precinctsReporting, totalPrecincts),
      totalVotes,
      leaderId: totalVotes > 0 ? (leader?.id ?? null) : null,
      leaderName: totalVotes > 0 ? (leader?.name ?? null) : null,
      margin:
        totalVotes > 0 && leader ? leader.pct - (runnerUp?.pct ?? 0) : 0,
      candidates,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function normalizeRaceDetail(
  sw: readonly RawMapData[],
  cty: readonly RawMapData[],
  ref: RaceRef,
): RaceDetail {
  return { ...normalizeRaceSummary(sw, ref), counties: normalizeCounties(cty) };
}

/** Zero every count but keep candidates and precinct totals. Used before
 * polls close, when the state feed carries pre-election test numbers. */
export function blankMapRows(rows: readonly RawMapData[]): RawMapData[] {
  return rows.map((r) => ({
    ...r,
    calcCandidateVotes: 0,
    calcCandidatePercentage: 0,
    PrecinctsReporting: 0,
    PrecinctsPartial: 0,
    Winner: false,
    IsReported: false,
  }));
}

/** Turnout counterpart of blankMapRows: keeps registered voters only. */
export function blankTurnoutRows(rows: readonly RawTurnout[]): RawTurnout[] {
  return rows.map((r) => ({
    ...r,
    calcVoterTurnout: 0,
    CountyPercent: 0,
    PrecinctsReporting: 0,
    PartialPrecincts: 0,
    IsReported: false,
  }));
}

/** Statewide + per-county turnout / precinct reporting. */
export function normalizeTurnout(rows: readonly RawTurnout[]): TurnoutData {
  if (!Array.isArray(rows)) rows = [];

  // NB: in this feed `Voters` = registered voters, `calcVoterTurnout` = ballots
  // cast so far (NOT a percent), and `CountyPercent` = the turnout fraction.
  const counties: CountyTurnout[] = rows
    .map((r): CountyTurnout => {
      const totalPrecincts = num(r.TotalPrecincts);
      const precinctsReporting = num(r.PrecinctsReporting);
      const registered = num(r.Voters);
      const ballots = num(r.calcVoterTurnout);
      return {
        id: String(r.CountyID),
        name: canonCounty(r.CountyName),
        rawName: cleanName(r.CountyName),
        registered,
        ballots,
        turnoutPct: pctOf(ballots, registered),
        precinctsReporting,
        totalPrecincts,
        reportingPct: pctOf(precinctsReporting, totalPrecincts),
        reported: Boolean(r.IsReported) || precinctsReporting > 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const registered = counties.reduce((s, c) => s + c.registered, 0);
  const ballots = counties.reduce((s, c) => s + c.ballots, 0);
  const precinctsReporting = counties.reduce((s, c) => s + c.precinctsReporting, 0);
  const totalPrecincts = counties.reduce((s, c) => s + c.totalPrecincts, 0);

  return {
    statewide: {
      registered,
      ballots,
      turnoutPct: pctOf(ballots, registered),
      precinctsReporting,
      totalPrecincts,
      reportingPct: pctOf(precinctsReporting, totalPrecincts),
      countiesReporting: counties.filter((c) => c.reported).length,
      totalCounties: counties.length,
    },
    counties,
    updatedAt: rows[0]?.CurrentDateTime ?? null,
  };
}
