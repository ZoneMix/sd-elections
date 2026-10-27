import type { Candidate } from "@/lib/types";
import type { CandidateStyle } from "@/lib/party";
import { splitTicket } from "@/lib/party";
import { int, pct } from "@/lib/format";
import { PartyBadge, ShareTrack } from "./ui";

export function CandidateRow({
  candidate,
  style,
  hasResults,
}: {
  candidate: Candidate;
  style: CandidateStyle;
  hasResults: boolean;
}) {
  const { lead, mate } = splitTicket(candidate.name);
  const status = !hasResults
    ? null
    : candidate.isWinner
      ? "Projected winner"
      : candidate.isLeading
        ? "Leading"
        : null;

  return (
    <li className="list-none">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <PartyBadge style={style} />
          <div className="min-w-0 leading-snug">
            <span className="font-medium">{lead}</span>
            {mate ? <span className="text-muted"> with {mate}</span> : null}
            {status ? <span className="ml-2 text-sm font-semibold">{status}</span> : null}
          </div>
        </div>
        <div className="num flex shrink-0 items-baseline gap-3">
          <span className="font-semibold">{int(candidate.votes)}</span>
          <span className="w-14 text-right text-sm text-muted">
            {hasResults ? pct(candidate.pct) : "0%"}
          </span>
        </div>
      </div>
      <div className="mt-2 pl-[2.0625rem]">
        <ShareTrack style={style} pct={hasResults ? candidate.pct : 0} />
      </div>
    </li>
  );
}
