"use client";

import { useMemo } from "react";
import { geoAlbers, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import sdGeoRaw from "@/data/sd-counties.geo.json";
import type { CountyResult } from "@/lib/types";
import type { CandidateStyle } from "@/lib/party";
import { toneVar } from "@/lib/party";

const sdGeo = sdGeoRaw as unknown as FeatureCollection<Geometry, { name: string; fips: string }>;

const W = 820;
const H = 480;
const PAD = 12;
const STRIPES_ID = "county-stripes";

/** Margin bands for the lightness ramp, weakest first. */
export const MARGIN_BANDS = [
  { label: "Under 10 points", max: 10, mix: 52 },
  { label: "10 to 25 points", max: 25, mix: 76 },
  { label: "Over 25 points", max: Infinity, mix: 100 },
] as const;

export function bandFill(style: CandidateStyle, mix: number): string {
  return `color-mix(in oklab, ${toneVar(style.tone)} ${mix}%, var(--bg))`;
}

function shade(
  county: CountyResult | undefined,
  styles: Map<string, CandidateStyle>,
): { fill: string; striped: boolean; leader: string | null } {
  if (!county || county.totalVotes <= 0 || !county.leaderId) {
    return { fill: "var(--empty)", striped: false, leader: null };
  }
  const style = styles.get(county.leaderId);
  if (!style) return { fill: "var(--empty)", striped: false, leader: county.leaderName };
  const band = MARGIN_BANDS.find((b) => county.margin < b.max) ?? MARGIN_BANDS[2];
  return { fill: bandFill(style, band.mix), striped: style.striped, leader: county.leaderName };
}

/** SVG stripe overlay, shared with the legend swatches. */
export function StripeDefs() {
  return (
    <defs>
      <pattern id={STRIPES_ID} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="2.5" height="7" style={{ fill: "var(--stripe)" }} />
      </pattern>
    </defs>
  );
}
export const STRIPES_URL = `url(#${STRIPES_ID})`;

export function CountyMap({
  counties,
  styles,
  selected,
  onSelect,
}: {
  counties: CountyResult[];
  styles: Map<string, CandidateStyle>;
  selected: string | null;
  onSelect: (name: string | null) => void;
}) {
  const path = useMemo(() => {
    const projection = geoAlbers().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], sdGeo);
    return geoPath(projection);
  }, []);

  const shapes = useMemo(
    () =>
      sdGeo.features.map((f: Feature<Geometry, { name: string; fips: string }>) => ({
        name: f.properties.name,
        d: path(f) ?? "",
        centroid: path.centroid(f),
      })),
    [path],
  );

  const byName = useMemo(() => {
    const m = new Map<string, CountyResult>();
    for (const c of counties) m.set(c.name.toLowerCase(), c);
    return m;
  }, [counties]);

  const sel = selected ? shapes.find((s) => s.name.toLowerCase() === selected.toLowerCase()) : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full select-none"
      role="group"
      aria-label="Map of South Dakota counties, shaded by who leads"
      onMouseLeave={() => onSelect(null)}
    >
      <StripeDefs />
      {shapes.map((s) => {
        const county = byName.get(s.name.toLowerCase());
        const { fill, striped, leader } = shade(county, styles);
        const isSel = selected?.toLowerCase() === s.name.toLowerCase();
        return (
          <g key={s.name}>
            <path
              d={s.d}
              className="county"
              style={{ fill, stroke: isSel ? "var(--fg)" : "var(--bg)" }}
              strokeWidth={isSel ? 2 : 0.8}
              tabIndex={0}
              role="button"
              aria-label={`${s.name} County${leader ? `, ${leader} leads` : ", no results yet"}`}
              onMouseEnter={() => onSelect(s.name)}
              onFocus={() => onSelect(s.name)}
              onClick={() => onSelect(s.name)}
            />
            {striped ? <path d={s.d} fill={STRIPES_URL} className="pointer-events-none" /> : null}
          </g>
        );
      })}
      {sel && Number.isFinite(sel.centroid[0]) ? (
        <text
          x={sel.centroid[0]}
          y={sel.centroid[1]}
          textAnchor="middle"
          dominantBaseline="middle"
          className="pointer-events-none"
          style={{ fill: "var(--fg)", stroke: "var(--bg)", fontSize: 15, fontWeight: 600, paintOrder: "stroke" }}
          strokeWidth={4}
        >
          {sel.name}
        </text>
      ) : null}
    </svg>
  );
}
