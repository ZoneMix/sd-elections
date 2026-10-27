"use client";

import { useMemo, useState } from "react";
import type { CountyTurnout, TurnoutData } from "@/lib/types";
import { int, pct } from "@/lib/format";
import { Meter, Section } from "./ui";

type SortKey = "name" | "reporting" | "turnout" | "registered";

const COLUMNS: { key: SortKey; label: string; right: boolean }[] = [
  { key: "name", label: "County", right: false },
  { key: "reporting", label: "Reporting", right: false },
  { key: "turnout", label: "Turnout", right: true },
  { key: "registered", label: "Registered", right: true },
];

function valueOf(c: CountyTurnout, key: SortKey): number | string {
  switch (key) {
    case "name":
      return c.name;
    case "reporting":
      return c.reportingPct;
    case "turnout":
      return c.turnoutPct;
    case "registered":
      return c.registered;
  }
}

export function TurnoutPanel({ turnout }: { turnout: TurnoutData | null }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });

  const rows = useMemo(() => {
    if (!turnout) return [];
    return [...turnout.counties].sort((a, b) => {
      const av = valueOf(a, sort.key);
      const bv = valueOf(b, sort.key);
      if (typeof av === "string" || typeof bv === "string")
        return String(av).localeCompare(String(bv)) * sort.dir;
      return (av - bv) * sort.dir || a.name.localeCompare(b.name);
    });
  }, [turnout, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "name" ? 1 : -1 },
    );

  const sw = turnout?.statewide;
  const counted = Boolean(sw && sw.ballots > 0);

  return (
    <Section
      id="turnout"
      title="Turnout"
      note="Ballots counted as a share of registered voters, county by county."
    >
      <p className="m-0 max-w-[38rem] text-[clamp(1.1875rem,2vw,1.375rem)] leading-normal">
        {!sw
          ? "Loading turnout."
          : counted
            ? `${int(sw.ballots)} ballots counted so far, ${pct(sw.turnoutPct)} of ${int(sw.registered)} registered voters.`
            : `${int(sw.registered)} South Dakotans are registered to vote. Turnout fills in as counties report.`}
      </p>

      <div className="mt-8 max-h-[30rem] overflow-auto border-t border-line-strong">
        <table className="table">
          <thead className="sticky top-0 z-10 bg-bg">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={col.right ? "r" : ""}
                  aria-sort={sort.key === col.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                >
                  <button type="button" onClick={() => toggle(col.key)}>
                    {col.label}
                    <span aria-hidden className={sort.key === col.key ? "text-fg" : "opacity-0"}>
                      {sort.dir === 1 ? "↑" : "↓"}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="hidden w-20 shrink-0 sm:block">
                      <Meter value={c.reportingPct} label={`${c.name} County precincts reporting`} />
                    </div>
                    <span className="num text-sm text-muted">{pct(c.reportingPct, 0)}</span>
                  </div>
                </td>
                <td className="num r">{c.turnoutPct > 0 ? pct(c.turnoutPct) : "None yet"}</td>
                <td className="num r">{int(c.registered)}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-muted">
                  Loading county turnout.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
