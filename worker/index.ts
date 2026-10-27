/**
 * Cloudflare Worker for the South Dakota election results site.
 *
 * Two jobs:
 *  1. Serve the static Next.js export (./out) via the ASSETS binding.
 *  2. Proxy + normalize + edge-cache South Dakota's live election service
 *     under /api/*, so the browser only ever talks to our own origin
 *     (no CORS issues) and the state API is hit at most once per cache
 *     window per colo (we are polite — Cache-Control: private upstream).
 */
import {
  SD_RESULTS_PAGE,
  FALLBACK_RACES,
  RUNOFF,
  mapDataUrl,
  mapDataArchiveUrl,
  contestUrl,
  turnoutUrl,
  parseRaceRefs,
  resultsOpen,
} from "../src/lib/sdapi";
import { findContest, type ContestType } from "../src/lib/ballot";
import {
  normalizeRaceDetail,
  normalizeRaceSummary,
  normalizeTurnout,
  blankMapRows,
  blankTurnoutRows,
} from "../src/lib/normalize";
import type {
  RawMapData,
  RawTurnout,
  RaceRef,
  ApiEnvelope,
} from "../src/lib/types";

interface Env {
  ASSETS: Fetcher;
}

const TTL = {
  races: 300, // race list changes ~never during an election
  race: 15, // live results — matches the client's 15s battle-feed poll
  turnout: 15,
  runoff: 3600, // archived final results never change
} as const;

const UPSTREAM_TIMEOUT_MS = 8000;

// Bump whenever the normalized /api response SHAPE changes. caches.default
// persists across deploys per-colo, so without this an old-schema response
// (e.g. missing `ballots`) can be served after a deploy. The version is folded
// into the cache key, so a bump instantly orphans every stale entry.
const CACHE_VERSION = "5";

const JSON_HEADERS = (ttl: number): HeadersInit => ({
  "content-type": "application/json; charset=utf-8",
  // max-age=0 → browsers never serve a cached copy (live data); s-maxage keeps
  // the Cloudflare edge cache so the upstream SD API is hit at most once per TTL.
  "cache-control": `public, max-age=0, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`,
  "access-control-allow-origin": "*",
});

function envelope<T>(data: T | null, extra: Partial<ApiEnvelope<T>> = {}): ApiEnvelope<T> {
  return { ok: data !== null, data, fetchedAt: new Date().toISOString(), ...extra };
}

/** Fetch JSON from the SD service and return its `d` array. Throws on failure. */
async function fetchD<T>(url: string): Promise<T[]> {
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`upstream ${res.status} for ${url}`);
  const body = (await res.json()) as { d?: T[] };
  if (!body || !Array.isArray(body.d)) throw new Error(`malformed upstream payload for ${url}`);
  return body.d;
}

/**
 * Edge-cache wrapper. On producer success, caches the JSON for `ttl` seconds.
 * On producer failure, serves the last cached copy (flagged stale) if one
 * exists, otherwise an ok:false envelope — never a 500.
 */
async function cached<T>(
  request: Request,
  ctx: ExecutionContext,
  ttl: number,
  produce: () => Promise<T>,
): Promise<Response> {
  const cache = caches.default;
  const keyUrl = new URL(request.url);
  keyUrl.searchParams.set("__v", CACHE_VERSION);
  const cacheKey = new Request(keyUrl.toString(), { method: "GET" });

  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  try {
    const data = await produce();
    const res = new Response(JSON.stringify(envelope(data)), { headers: JSON_HEADERS(ttl) });
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown upstream error";
    const stale = await cache.match(cacheKey);
    if (stale) {
      const body = (await stale.json()) as ApiEnvelope<T>;
      return new Response(
        JSON.stringify({ ...body, stale: true, error: reason }),
        { headers: JSON_HEADERS(ttl) },
      );
    }
    return new Response(JSON.stringify(envelope<T>(null, { error: reason })), {
      headers: { ...JSON_HEADERS(5), "cache-control": "no-store" },
      status: 200,
    });
  }
}

/** Discover live statewide race refs from the official page; fall back to the
 * hardcoded marquee set. Ordered by office sequence (Senate, House, Governor). */
async function discoverRaces(): Promise<RaceRef[]> {
  let refs: RaceRef[] = [];
  try {
    const res = await fetch(SD_RESULTS_PAGE, {
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (res.ok) refs = parseRaceRefs(await res.text());
  } catch {
    refs = [];
  }
  const byId = new Map<number, RaceRef>();
  for (const r of [...refs, ...FALLBACK_RACES]) {
    if (!byId.has(r.raceId)) byId.set(r.raceId, r);
  }
  return [...byId.values()].sort((a, b) => Number(a.osn) - Number(b.osn));
}

async function handleApi(request: Request, ctx: ExecutionContext): Promise<Response | null> {
  const { pathname } = new URL(request.url);

  if (pathname === "/api/races") {
    return cached(request, ctx, TTL.races, discoverRaces);
  }

  // Before polls close the state feed carries pre-election test counts, so
  // every vote/turnout number is blanked until ELECTION.resultsOpenAt.
  if (pathname === "/api/turnout") {
    return cached(request, ctx, TTL.turnout, async () => {
      const rows = await fetchD<RawTurnout>(turnoutUrl());
      return normalizeTurnout(resultsOpen() ? rows : blankTurnoutRows(rows));
    });
  }

  if (pathname === "/api/runoff") {
    return cached(request, ctx, TTL.runoff, async () => {
      const ref = RUNOFF.race;
      const [sw, cty] = await Promise.all([
        fetchD<RawMapData>(mapDataArchiveUrl("SW", ref, RUNOFF.electionId)),
        fetchD<RawMapData>(mapDataArchiveUrl("CTY", ref, RUNOFF.electionId)),
      ]);
      return normalizeRaceDetail(sw, cty, ref);
    });
  }

  // Ballot lookup contests, by type and race ID only (the visitor's ZIP never
  // reaches the Worker). Only contests listed in ballot-refs.json are served.
  const contestMatch = pathname.match(/^\/api\/contest\/(LEG|CTY|BQ|MUN)\/(\d+)$/);
  if (contestMatch) {
    const type = contestMatch[1] as ContestType;
    const found = findContest(type, Number(contestMatch[2]));
    if (!found) return null;
    return cached(request, ctx, TTL.race, async () => {
      const { ref, county } = found;
      const raceRef: RaceRef = { raceId: ref.raceId, osn: ref.osn, party: ref.party, name: "" };
      const rows = await fetchD<RawMapData>(contestUrl(type, "SW", raceRef, county));
      return normalizeRaceSummary(resultsOpen() ? rows : blankMapRows(rows), raceRef);
    });
  }

  const raceMatch = pathname.match(/^\/api\/race\/(\d+)$/);
  if (raceMatch) {
    const raceId = Number(raceMatch[1]);
    return cached(request, ctx, TTL.race, async () => {
      // Known races skip the slow results-page scrape.
      const ref =
        FALLBACK_RACES.find((r) => r.raceId === raceId) ??
        (await discoverRaces()).find((r) => r.raceId === raceId);
      if (!ref) throw new Error(`unknown raceId ${raceId}`);
      const [sw, cty] = await Promise.all([
        fetchD<RawMapData>(mapDataUrl("SW", ref)),
        fetchD<RawMapData>(mapDataUrl("CTY", ref)),
      ]);
      const open = resultsOpen();
      return normalizeRaceDetail(
        open ? sw : blankMapRows(sw),
        open ? cty : blankMapRows(cty),
        ref,
      );
    });
  }

  return null; // not an /api route we own
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-max-age": "86400",
        },
      });
    }

    if (pathname.startsWith("/api/")) {
      const res = await handleApi(request, ctx);
      if (res) return res;
      return new Response(JSON.stringify(envelope(null, { error: "not found" })), {
        status: 404,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    // Everything else → static assets (Next export). not_found_handling in
    // wrangler.toml serves index.html for unknown paths (SPA fallback).
    return env.ASSETS.fetch(request);
  },
};

export default worker;
