// Shared types for the SD primary results app. Used by both the Cloudflare
// Worker (proxy/normalize) and the React client, so this file stays pure —
// no React, no Node, no browser APIs.

export type Party = "REP" | "DEM" | string;

// ── Raw shapes returned by the SD ResultsAjax.svc service (the `d` array) ──

export interface RawMapData {
  CandidateID: string;
  PartyCode: string;
  PartyName: string;
  BallotOrder: number;
  calcCandidate: string;
  calcCandidateVotes: number;
  calcCandidatePercentage: number;
  PrecinctsReporting: number;
  PrecinctsPartial: number;
  TotalPrecincts: number;
  RaceID: number;
  RaceName: string;
  OfficeSeqNo: string;
  VoteFor: number;
  Winner: boolean;
  IsReported: boolean;
  CountyID: string;
  CountyName: string;
  CurrentDateTime: string | null;
}

export interface RawTurnout {
  CountyID: string;
  CountyName: string;
  CountyPercent: number;
  CurrentDateTime: string | null;
  IsReported: boolean;
  PartialPrecincts: number;
  PrecinctName: string;
  PrecinctsReporting: number;
  TotalPrecincts: number;
  Voters: number;
  calcVoterTurnout: number;
}

// ── Normalized shapes the client consumes ──

export interface Candidate {
  id: string;
  name: string;
  party: Party;
  partyName: string;
  votes: number;
  pct: number; // 0–100
  ballotOrder: number;
  isWinner: boolean;
  isLeading: boolean;
  colorIndex: number; // stable color slot, by ballot order
}

export interface RaceSummary {
  raceId: number;
  osn: string;
  party: Party;
  name: string;
  voteFor: number;
  totalPrecincts: number;
  precinctsReporting: number;
  precinctsPartial: number;
  reportingPct: number; // 0–100
  totalVotes: number;
  candidates: Candidate[];
  leaderId: string | null;
  isComplete: boolean;
  updatedAt: string | null;
}

export interface CountyCandidate {
  id: string;
  name: string;
  party: Party;
  votes: number;
  pct: number;
  colorIndex: number;
}

export interface CountyResult {
  id: string; // SD CountyID
  name: string; // canonical name (joins to geometry)
  rawName: string; // original API name (may include "(Vote Center)")
  totalPrecincts: number;
  precinctsReporting: number;
  reportingPct: number;
  totalVotes: number;
  leaderId: string | null;
  leaderName: string | null;
  margin: number; // leader pct − runner-up pct
  candidates: CountyCandidate[];
}

export interface RaceDetail extends RaceSummary {
  counties: CountyResult[];
}

export interface CountyTurnout {
  id: string;
  name: string; // canonical
  rawName: string;
  registered: number;
  ballots: number; // ballots cast so far (counted precincts)
  turnoutPct: number; // ballots / registered, 0–100
  precinctsReporting: number;
  totalPrecincts: number;
  reportingPct: number;
  reported: boolean;
}

export interface TurnoutData {
  statewide: {
    registered: number;
    ballots: number;
    turnoutPct: number;
    precinctsReporting: number;
    totalPrecincts: number;
    reportingPct: number;
    countiesReporting: number;
    totalCounties: number;
  };
  counties: CountyTurnout[];
  updatedAt: string | null;
}

export interface RaceRef {
  raceId: number;
  osn: string;
  party: Party;
  name: string;
}

// Envelope every /api/* route returns. `stale` flags last-good data served
// after an upstream failure; `error` carries a human-readable reason.
export interface ApiEnvelope<T> {
  ok: boolean;
  data: T | null;
  error?: string;
  stale?: boolean;
  fetchedAt: string; // ISO timestamp the Worker produced the payload
}
