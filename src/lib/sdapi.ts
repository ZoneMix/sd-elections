// Constants + small pure helpers for talking to South Dakota's election
// service. Kept dependency-free so the Worker and client can both import it.
import type { Party, RaceRef } from "./types";

export const SD_SVC_BASE =
  "https://sdresws.azurewebsites.us/ResultsAjax.svc/";

// The official statewide results page — parsed to auto-discover race refs.
export const SD_RESULTS_PAGE =
  "https://electionresults.sd.gov/resultsSW.aspx?type=SWR&map=CTY";

export const ELECTION = {
  name: "General Election",
  date: "November 3, 2026",
  jurisdiction: "South Dakota",
  // First polls close 7 PM CT on Nov 3 (CST, UTC−6). Before this the state
  // feed carries pre-election TEST counts, so the Worker blanks every vote and
  // turnout number until then.
  resultsOpenAt: "2026-11-04T01:00:00Z",
  // Election-night auto-refresh window: from first poll close to the morning
  // after. Outside it the page loads once.
  pollUntil: "2026-11-05T12:00:00Z",
  featuredOsn: "205", // Governor and Lieutenant Governor
} as const;

export const POLL_MS = 15_000;

export function resultsOpen(now: number = Date.now()): boolean {
  return now >= Date.parse(ELECTION.resultsOpenAt);
}

export function inPollWindow(now: number = Date.now()): boolean {
  return resultsOpen(now) && now < Date.parse(ELECTION.pollUntil);
}

export type Phase = "before" | "live" | "after";

export function phaseAt(now: number): Phase {
  if (!resultsOpen(now)) return "before";
  return inPollWindow(now) ? "live" : "after";
}

/** Status line for a race with no votes counted yet. */
export function awaitingLabel(now: number = Date.now()): string {
  return resultsOpen(now)
    ? "Waiting for the first precincts to report."
    : "Results post after polls close at 7 PM CT on November 3.";
}

// The Nov 3 statewide races, from the official page's
// CreateMap('SWR', raceID, osn, party) button handlers (party is blank in a
// general election). Fallback if page auto-discovery fails, and the source of
// display names for discovered race IDs.
export const FALLBACK_RACES: readonly RaceRef[] = [
  { raceId: 14412, osn: "110", party: "", name: "United States Senator" },
  { raceId: 14869, osn: "120", party: "", name: "United States Representative" },
  { raceId: 14896, osn: "205", party: "", name: "Governor and Lieutenant Governor" },
  { raceId: 14441, osn: "210", party: "", name: "Secretary of State" },
  { raceId: 14882, osn: "220", party: "", name: "Attorney General" },
  { raceId: 14462, osn: "230", party: "", name: "State Auditor" },
  { raceId: 14463, osn: "240", party: "", name: "State Treasurer" },
  { raceId: 14464, osn: "250", party: "", name: "Commissioner of School and Public Lands" },
  { raceId: 14465, osn: "260", party: "", name: "Public Utilities Commissioner" },
] as const;

// The July 28 Republican gubernatorial runoff, final results. The state
// archives past elections under an electionID (801 = this runoff) and serves
// them from GetMapDataArchive.
export const RUNOFF = {
  electionId: 801,
  date: "July 28, 2026",
  race: { raceId: 14452, osn: "200", party: "REP", name: "Governor" } as RaceRef,
  sourceUrl:
    "https://electionresults.sd.gov/resultsSW.aspx?type=SWR&map=CTY&eid=801",
} as const;

// Candidate colors and badges live in party.ts.

// Collapse the API's doubled/trailing spaces in candidate + race names.
export function cleanName(name: string): string {
  return String(name ?? "").replace(/\s+/g, " ").trim();
}

// Canonical county name: drop the API's " (Vote Center)" suffix and map the
// renamed Shannon County → Oglala Lakota (FIPS 46113). MUST match the logic in
// scripts/build-geo.mjs so API rows join the committed geometry exactly.
export function canonCounty(name: string): string {
  let n = cleanName(String(name ?? "").replace(/\s*\(vote center\)\s*/i, ""));
  if (n.toLowerCase() === "shannon") n = "Oglala Lakota";
  return n;
}

export const countyKey = (name: string): string => canonCounty(name).toLowerCase();

// ── URL builders ──

export function mapDataUrl(
  category: "SW" | "CTY",
  race: Pick<RaceRef, "raceId" | "osn" | "party">,
): string {
  const p = new URLSearchParams({
    type: "SWR",
    category,
    raceID: String(race.raceId),
    osn: race.osn,
    county: "0",
    // The service returns d:null for an empty party; general-election races
    // (no party) need "0".
    party: race.party || "0",
  });
  return `${SD_SVC_BASE}GetMapData?${p.toString()}`;
}

/** GetMapData for any contest type (LEG, CTY, BQ, MUN); county is the feed's
 * county number for county races, "0" otherwise. */
export function contestUrl(
  type: string,
  category: "SW" | "CTY",
  race: Pick<RaceRef, "raceId" | "osn" | "party">,
  county: string,
): string {
  const p = new URLSearchParams({
    type,
    category,
    raceID: String(race.raceId),
    osn: race.osn,
    county,
    party: race.party || "0",
  });
  return `${SD_SVC_BASE}GetMapData?${p.toString()}`;
}

export function mapDataArchiveUrl(
  category: "SW" | "CTY",
  race: Pick<RaceRef, "raceId" | "osn" | "party">,
  electionId: number,
): string {
  const live = new URL(mapDataUrl(category, race));
  live.searchParams.set("electionID", String(electionId));
  return `${SD_SVC_BASE}GetMapDataArchive?${live.searchParams.toString()}`;
}

export function turnoutUrl(): string {
  return `${SD_SVC_BASE}GetVoterTurnoutData?`;
}

// Parse CreateMap('SWR', '14082', '110', 'REP') calls out of the results page
// HTML to discover the live statewide race refs (raceId/osn/party). Names are
// filled from FALLBACK_RACES where known. Party-agnostic (blank in a general
// election).
const CREATE_MAP_RE =
  /CreateMap\(\s*'([^']*)'\s*,\s*'(\d+)'\s*,\s*'(\d+)'\s*,\s*'([^']*)'\s*\)/g;

export function parseRaceRefs(html: string): RaceRef[] {
  const nameById = new Map<number, string>(
    FALLBACK_RACES.map((r) => [r.raceId, r.name]),
  );
  const seen = new Set<number>();
  const refs: RaceRef[] = [];
  for (const m of html.matchAll(CREATE_MAP_RE)) {
    const raceId = Number(m[2]);
    if (seen.has(raceId)) continue;
    seen.add(raceId);
    refs.push({
      raceId,
      osn: m[3],
      party: m[4] as Party,
      name: nameById.get(raceId) ?? `Statewide Race ${raceId}`,
    });
  }
  return refs;
}
