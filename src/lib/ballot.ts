// "What's on my ballot": ZIP lookup and contest selection. Pure and
// client-side: the ZIP is only ever matched against the bundled table, and
// contests are then fetched by race ID, never by ZIP.
// Relative paths: the Worker bundles this file too and has no "@/" alias.
import zipsRaw from "../data/sd-zips.json";
import refsRaw from "../data/ballot-refs.json";

export type ContestType = "LEG" | "CTY" | "BQ" | "MUN";

export interface ContestRef {
  raceId: number;
  osn: string;
  party: string;
  voteFor?: number;
}
export interface LegRef extends ContestRef {
  office: "senate" | "house";
  district: string;
  counties: string[];
}
export interface NamedRef extends ContestRef {
  name: string;
}
export interface LocalRef extends NamedRef {
  area: string;
  counties: string[];
}
export interface BallotRefs {
  generatedAt: string;
  counties: Record<string, { id: string; name: string }>; // keyed by FIPS
  leg: LegRef[];
  questions: NamedRef[];
  county: Record<string, NamedRef[]>; // keyed by feed county id
  local: LocalRef[];
}

export const REFS = refsRaw as BallotRefs;
// zip -> [countyFips, senateDistrict, houseDistrict, shareOfResidents][]
const ZIPS = zipsRaw as unknown as Record<string, [string, string, string, number][]>;

export const VOTER_LOOKUP_URL = "https://vip.sdsos.gov/VIPLogin.aspx";
export const QUESTIONS_URL =
  "https://sdsos.gov/elections-voting/upcoming-elections/general-information/2026%20Election%20Information/2026-ballot-questions.aspx";

// Neutral one-line summaries of the official ballot titles. No positions.
export const QUESTION_SUMMARIES: Record<string, string> = {
  I: "Would end expanded Medicaid coverage if the federal share of its cost drops below 90%.",
  J: "Would state in the constitution that only U.S. citizens are eligible to vote.",
  K: "Would create a constitutional trust fund for unclaimed property money.",
  L: "Would require future constitutional amendments to get 60% of the votes cast to pass.",
};

/** "Constitutional Amendment I: ..." -> "I" */
export function questionLetter(name: string): string | null {
  return /Amendment\s+([A-Z])\b/.exec(name)?.[1] ?? null;
}

export interface BallotOption {
  key: string; // stable id for the choice, e.g. "099|15|15"
  countyFips: string;
  countyId: string;
  countyName: string;
  senate: string;
  house: string;
  share: number; // 0–1 share of the ZIP's residents
}

export type ZipLookup =
  | { status: "invalid" }
  | { status: "outside" }
  // crossState: a neighboring state's ZIP whose area reaches into SD; the
  // options cover only its South Dakota part.
  | { status: "ok"; options: BallotOption[]; crossState: boolean };

export function lookupZip(input: string): ZipLookup {
  const zip = input.trim();
  if (!/^\d{5}$/.test(zip)) return { status: "invalid" };
  const rows = ZIPS[zip];
  if (!rows) return { status: "outside" };
  return {
    status: "ok",
    crossState: !zip.startsWith("57"),
    options: rows.map(([fips, senate, house, share]) => {
      const county = REFS.counties[fips];
      return {
        key: `${fips}|${senate}|${house}`,
        countyFips: fips,
        countyId: county.id,
        countyName: county.name,
        senate,
        house,
        share,
      };
    }),
  };
}

export interface BallotContests {
  senate: LegRef | undefined;
  house: LegRef | undefined;
  county: NamedRef[];
  local: LocalRef[];
  questions: NamedRef[];
}

export function contestsFor(option: BallotOption): BallotContests {
  return {
    senate: REFS.leg.find((r) => r.office === "senate" && r.district === option.senate),
    house: REFS.leg.find((r) => r.office === "house" && r.district === option.house),
    county: REFS.county[option.countyId] ?? [],
    local: REFS.local.filter((r) => r.counties.includes(option.countyId)),
    questions: REFS.questions,
  };
}

/** Allowlist lookup used by the Worker: only contests on this ballot. */
export function findContest(
  type: ContestType,
  raceId: number,
): { ref: ContestRef; county: string } | null {
  if (type === "LEG") {
    const ref = REFS.leg.find((r) => r.raceId === raceId);
    return ref ? { ref, county: "0" } : null;
  }
  if (type === "BQ") {
    const ref = REFS.questions.find((r) => r.raceId === raceId);
    return ref ? { ref, county: "0" } : null;
  }
  if (type === "MUN") {
    const ref = REFS.local.find((r) => r.raceId === raceId);
    return ref ? { ref, county: "0" } : null;
  }
  for (const [county, list] of Object.entries(REFS.county)) {
    const ref = list.find((r) => r.raceId === raceId);
    if (ref) return { ref, county };
  }
  return null;
}
