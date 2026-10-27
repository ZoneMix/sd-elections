"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApiEnvelope, RaceSummary } from "@/lib/types";
import type { BallotContests, ContestType } from "@/lib/ballot";

export const contestKey = (type: ContestType, raceId: number): string => `${type}:${raceId}`;

function wanted(c: BallotContests | null): { type: ContestType; raceId: number }[] {
  if (!c) return [];
  return [
    ...[c.senate, c.house].filter((r) => r !== undefined).map((r) => ({ type: "LEG" as const, raceId: r.raceId })),
    ...c.county.map((r) => ({ type: "CTY" as const, raceId: r.raceId })),
    ...c.local.map((r) => ({ type: "MUN" as const, raceId: r.raceId })),
    ...c.questions.map((r) => ({ type: "BQ" as const, raceId: r.raceId })),
  ];
}

export interface BallotResults {
  results: Record<string, RaceSummary>;
  failed: Set<string>;
  loading: boolean;
}

/**
 * Fetch every contest on the chosen ballot by type and race ID (no ZIP in
 * any request). Re-fetches when `refreshKey` changes, so it follows the
 * page's own load-once / election-night refresh schedule.
 */
export function useBallotContests(contests: BallotContests | null, refreshKey: number | null): BallotResults {
  const list = useMemo(() => wanted(contests), [contests]);
  const listKey = list.map((w) => contestKey(w.type, w.raceId)).join(",");
  const [state, setState] = useState<{ key: string; results: Record<string, RaceSummary>; failed: Set<string> }>({
    key: "",
    results: {},
    failed: new Set(),
  });

  useEffect(() => {
    if (list.length === 0) return;
    const ac = new AbortController();
    Promise.all(
      list.map(async (w) => {
        const key = contestKey(w.type, w.raceId);
        try {
          const res = await fetch(`/api/contest/${w.type}/${w.raceId}`, {
            signal: ac.signal,
            cache: "no-store",
            headers: { accept: "application/json" },
          });
          if (!res.ok) throw new Error(`request failed: ${res.status}`);
          const env = (await res.json()) as ApiEnvelope<RaceSummary>;
          return { key, data: env.data };
        } catch {
          return { key, data: null };
        }
      }),
    ).then((rows) => {
      if (ac.signal.aborted) return;
      const results: Record<string, RaceSummary> = {};
      const failed = new Set<string>();
      for (const r of rows) {
        if (r.data) results[r.key] = r.data;
        else failed.add(r.key);
      }
      setState({ key: listKey, results, failed });
    });
    return () => ac.abort();
  }, [list, listKey, refreshKey]);

  const current = state.key === listKey;
  return {
    results: current ? state.results : {},
    failed: current ? state.failed : new Set(),
    loading: list.length > 0 && !current,
  };
}
