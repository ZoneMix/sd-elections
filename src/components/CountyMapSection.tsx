"use client";

import { useMemo, useState } from "react";
import type { RaceDetail } from "@/lib/types";
import type { CandidateStyle } from "@/lib/party";
import { splitTicket, stripeOver, styleCandidates } from "@/lib/party";
import { CountyMap, MARGIN_BANDS, bandFill } from "./CountyMap";
import { CountyDetail } from "./CountyDetail";
import { PartyBadge, Section } from "./ui";

/** Legend swatch: the band color, striped the same way as the map. */
function swatchBg(style: CandidateStyle, mix: number): string {
  return stripeOver(bandFill(style, mix), style.striped);
}

export function CountyMapSection({ race }: { race: RaceDetail | undefined }) {
  const [county, setCounty] = useState<string | null>(null);

  const styles = useMemo(() => styleCandidates(race?.candidates ?? []), [race]);

  const selected = useMemo(
    () =>
      race && county
        ? race.counties.find((c) => c.name.toLowerCase() === county.toLowerCase())
        : undefined,
    [race, county],
  );

  const legend = useMemo(() => {
    if (!race) return { rows: [], empty: 0 };
    const leading = new Map<string, number>();
    let empty = 0;
    for (const c of race.counties) {
      if (c.leaderId && c.totalVotes > 0) leading.set(c.leaderId, (leading.get(c.leaderId) ?? 0) + 1);
      else empty += 1;
    }
    const rows = [...race.candidates]
      .sort((a, b) => a.ballotOrder - b.ballotOrder)
      .map((c) => ({ id: c.id, name: splitTicket(c.name).lead, style: styles.get(c.id)!, count: leading.get(c.id) ?? 0 }));
    return { rows, empty };
  }, [race, styles]);

  return (
    <Section
      id="counties"
      title="Counties"
      note={
        <>
          Who leads each county in the {race?.name ?? "featured race"}. Fuller color means a wider lead, and the key below shows each candidate’s pattern.
        </>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0">
          {race ? (
            <CountyMap counties={race.counties} styles={styles} selected={county} onSelect={setCounty} />
          ) : (
            <div className="skeleton aspect-[820/480] w-full" />
          )}

          <div className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {legend.rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3">
                <PartyBadge style={r.style} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{r.name} leads</span>
                    <span className="num text-muted">
                      {r.count} {r.count === 1 ? "county" : "counties"}
                    </span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-0.5" aria-hidden>
                    {MARGIN_BANDS.map((b) => (
                      <span key={b.label} className="h-2.5 rounded-sm" style={{ background: swatchBg(r.style, b.mix) }} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3">
              <span className="badge border border-line-strong" style={{ background: "var(--empty)" }} aria-hidden />
              <div className="flex flex-1 items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">No results yet</span>
                <span className="num text-muted">
                  {legend.empty} {legend.empty === 1 ? "county" : "counties"}
                </span>
              </div>
            </div>
          </div>
          <p className="small mt-3 mb-0">
            Each bar runs from a narrow lead to a wide one: {MARGIN_BANDS.map((b) => b.label.toLowerCase()).join(", ")}.
          </p>
        </div>

        <CountyDetail county={selected} styles={styles} />
      </div>
    </Section>
  );
}
