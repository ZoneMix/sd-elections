import type { CountyResult } from "@/lib/types";
import type { CandidateStyle } from "@/lib/party";
import { splitTicket } from "@/lib/party";
import { int, pct } from "@/lib/format";
import { Meter, PartyBadge, ShareTrack } from "./ui";

export function CountyDetail({
  county,
  styles,
}: {
  county: CountyResult | undefined;
  styles: Map<string, CandidateStyle>;
}) {
  if (!county) {
    return (
      <aside className="border-t border-line pt-5">
        <p className="small m-0">Hover over or tap a county to see its numbers.</p>
      </aside>
    );
  }

  return (
    <aside className="border-t border-line pt-5" aria-live="polite">
      <h3 className="h3">{county.name} County</h3>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1">
          <Meter value={county.reportingPct} label={`${county.name} County precincts reporting`} />
        </div>
        <span className="num shrink-0 text-sm text-muted">
          {county.precinctsReporting} of {county.totalPrecincts} precincts
        </span>
      </div>

      {county.totalVotes <= 0 ? (
        <p className="small mt-5 mb-0">No votes counted here yet.</p>
      ) : (
        <ul className="mt-5 mb-0 space-y-4 p-0">
          {county.candidates.map((c) => {
            const style = styles.get(c.id);
            return (
              <li key={c.id} className="list-none">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    {style ? <PartyBadge style={style} /> : null}
                    <span className="truncate font-medium">{splitTicket(c.name).lead}</span>
                  </span>
                  <span className="num shrink-0">
                    {int(c.votes)} <span className="text-muted">{pct(c.pct)}</span>
                  </span>
                </div>
                {style ? (
                  <div className="mt-2">
                    <ShareTrack style={style} pct={c.pct} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <p className="num small mt-5 mb-0">{int(county.totalVotes)} votes counted</p>
    </aside>
  );
}
