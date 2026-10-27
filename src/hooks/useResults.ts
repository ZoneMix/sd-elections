"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ApiEnvelope,
  RaceRef,
  RaceDetail,
  TurnoutData,
} from "@/lib/types";
import { ELECTION, FALLBACK_RACES, POLL_MS, inPollWindow } from "@/lib/sdapi";

export interface ResultsState {
  races: RaceRef[];
  details: Record<number, RaceDetail>;
  turnout: TurnoutData | null;
  runoff: RaceDetail | null; // July runoff final results (archive)
  loading: boolean; // before first successful load
  error: string | null; // last fetch/upstream problem
  stale: boolean; // serving last-good after an upstream hiccup
  lastUpdated: number | null; // epoch ms of last successful poll
  refresh: () => void;
}

async function getEnvelope<T>(path: string, signal: AbortSignal): Promise<ApiEnvelope<T>> {
  // `no-store` bypasses the browser HTTP cache so live numbers are never served
  // stale (some browsers, e.g. Arc, hold cached responses through hard refresh).
  // The Cloudflare edge cache still shields the upstream SD API.
  const res = await fetch(path, {
    signal,
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`request failed: ${res.status}`);
  return (await res.json()) as ApiEnvelope<T>;
}

/**
 * Single data source for the whole dashboard. Loads the race list, turnout,
 * every race detail and the archived runoff once. Auto-refresh (every
 * POLL_MS) runs only inside the election-night window (inPollWindow); a page
 * opened earlier arms a timer for the window's start. `refresh` re-fetches on
 * demand. Keeps the last good data on transient failures (never blanks).
 */
export function useResults(): ResultsState {
  const [races, setRaces] = useState<RaceRef[]>([]);
  const [details, setDetails] = useState<Record<number, RaceDetail>>({});
  const [turnout, setTurnout] = useState<TurnoutData | null>(null);
  const [runoff, setRunoff] = useState<RaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const racesRef = useRef<RaceRef[]>([]);
  const inFlight = useRef<AbortController | null>(null);

  const poll = useCallback(async () => {
    const active = racesRef.current;
    if (active.length === 0) return;
    inFlight.current?.abort();
    const ac = new AbortController();
    inFlight.current = ac;

    try {
      const [turnoutEnv, ...raceEnvs] = await Promise.all([
        getEnvelope<TurnoutData>("/api/turnout", ac.signal),
        ...active.map((r) => getEnvelope<RaceDetail>(`/api/race/${r.raceId}`, ac.signal)),
      ]);

      const nextDetails: Record<number, RaceDetail> = {};
      let anyStale = Boolean(turnoutEnv.stale);
      raceEnvs.forEach((env, i) => {
        if (env.data) nextDetails[active[i].raceId] = env.data;
        if (env.stale) anyStale = true;
      });

      if (turnoutEnv.data) setTurnout(turnoutEnv.data);
      setDetails((prev) => ({ ...prev, ...nextDetails }));
      setStale(anyStale);
      setError(anyStale ? "Showing the last available data while the source catches up." : null);
      setLastUpdated(Date.now());
      setLoading(false);
    } catch (err) {
      if (ac.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Network error");
      setLoading(false);
    }
  }, []);

  // Discover races once, then load results once.
  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    (async () => {
      try {
        const env = await getEnvelope<RaceRef[]>("/api/races", ac.signal);
        if (cancelled) return;
        const list = env.data && env.data.length > 0 ? env.data : [...FALLBACK_RACES];
        racesRef.current = list;
        setRaces(list);
        poll();
      } catch {
        if (cancelled) return;
        const list = [...FALLBACK_RACES];
        racesRef.current = list;
        setRaces(list);
        poll();
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [poll]);

  // Archived runoff: final, so fetched once and never polled.
  useEffect(() => {
    const ac = new AbortController();
    getEnvelope<RaceDetail>("/api/runoff", ac.signal)
      .then((env) => {
        if (env.data) setRunoff(env.data);
      })
      .catch((err: unknown) => {
        if (!ac.signal.aborted) {
          setError(err instanceof Error ? err.message : "Network error");
        }
      });
    return () => ac.abort();
  }, []);

  // Election-night auto-refresh only. Before the window, arm one timer for its
  // start (if within setTimeout's ~24.8-day limit); after it, nothing runs.
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      poll();
      interval = setInterval(() => {
        if (inPollWindow()) poll();
        else clearInterval(interval);
      }, POLL_MS);
    };
    const untilOpen = Date.parse(ELECTION.resultsOpenAt) - Date.now();
    if (inPollWindow()) start();
    else if (untilOpen > 0 && untilOpen < 2 ** 31 - 1) timer = setTimeout(start, untilOpen);
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [poll]);

  return { races, details, turnout, runoff, loading, error, stale, lastUpdated, refresh: poll };
}
