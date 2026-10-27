// Party presentation: color tone, letter badge and label for each candidate.
// Pure (no React) so the map, cards and detail panel all agree.
//
// Color never carries meaning alone: every candidate also gets a letter badge
// and a written party label, and the second tone in a race (Democrats, and any
// later candidate of a party already on the ballot) is drawn striped.

export type Tone = "rep" | "rep-alt" | "dem" | "dem-alt" | "other" | "other-alt";

export interface CandidateStyle {
  tone: Tone;
  striped: boolean;
  letter: string; // "R", "D", "I", "L"
  label: string; // "Republican"
}

const LABELS: Record<string, string> = {
  REP: "Republican",
  DEM: "Democratic",
  IND: "Independent",
  LIB: "Libertarian",
};

function family(party: string): "rep" | "dem" | "other" {
  if (party === "REP") return "rep";
  if (party === "DEM") return "dem";
  return "other";
}

export function partyLabel(party: string, partyName = ""): string {
  return LABELS[party] ?? (partyName.trim() || "Nonpartisan");
}

export function partyLetter(party: string): string {
  return (party.trim()[0] ?? "N").toUpperCase();
}

/** CSS custom property holding a tone's fill color. */
export const toneVar = (tone: Tone): string => `var(--${tone})`;
export const onToneVar = (tone: Tone): string => `var(--on-${tone.replace("-alt", "")})`;

interface StyledInput {
  id: string;
  party: string;
  partyName?: string;
  ballotOrder?: number;
}

/**
 * Style every candidate in one race. The first candidate of each party (by
 * ballot order) gets the solid party tone; later ones get the lighter alt tone.
 * Democrats and alt tones are striped, so two candidates never differ by hue
 * alone.
 */
export function styleCandidates(
  candidates: readonly StyledInput[],
): Map<string, CandidateStyle> {
  const ordered = [...candidates].sort(
    (a, b) => (a.ballotOrder ?? 0) - (b.ballotOrder ?? 0),
  );
  const seen = new Set<string>();
  const out = new Map<string, CandidateStyle>();
  for (const c of ordered) {
    const fam = family(c.party);
    const isAlt = seen.has(fam);
    seen.add(fam);
    const tone = (isAlt ? `${fam}-alt` : fam) as Tone;
    out.set(c.id, {
      tone,
      striped: isAlt || fam === "dem",
      letter: partyLetter(c.party),
      label: partyLabel(c.party, c.partyName),
    });
  }
  return out;
}

/** Stripes (the --stripe token) layered over any fill color. */
export function stripeOver(color: string, striped: boolean): string {
  return striped
    ? `repeating-linear-gradient(135deg, transparent 0 6px, var(--stripe) 6px 9px), ${color}`
    : color;
}

/** Background for a filled bar or swatch, striped where the style says so. */
export function toneFill(style: CandidateStyle): string {
  return stripeOver(toneVar(style.tone), style.striped);
}

/** Split "Larry Rhoden and Tony Venhuizen" into a lead name and running mate. */
export function splitTicket(name: string): { lead: string; mate: string | null } {
  const [lead, ...rest] = name.split(/\s+and\s+/i);
  return { lead: lead.trim(), mate: rest.length > 0 ? rest.join(" and ").trim() : null };
}
