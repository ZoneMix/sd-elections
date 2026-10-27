# Contributor notes

Guidance for anyone (person or coding agent) changing this project.

## Next.js version

This project uses a recent Next.js with breaking changes from older versions. Read the
relevant guide in `node_modules/next/dist/docs/` before writing Next.js code, and heed
deprecation notices.

## Data rules

- General-election races have no party code; the state service needs `party=0`, not an
  empty value.
- Before `ELECTION.resultsOpenAt` the state feed carries pre-election test numbers. The
  Worker blanks every vote and turnout count until then; keep that rule for any new endpoint.
- County names: the service suffixes vote-center counties ("Brown (Vote Center)") and older
  geometry calls FIPS 46113 "Shannon" (now Oglala Lakota). `canonCounty()` in
  `src/lib/sdapi.ts` reconciles both; `scripts/build-geo.mjs` must match it.
- Bump `CACHE_VERSION` in `worker/index.ts` whenever an `/api` response shape changes.

## Privacy rule for the ballot lookup

A visitor's ZIP code must never leave the browser: no request URL, header or body, no
analytics, no localStorage or cookies. Look it up against `src/data/sd-zips.json` and fetch
contests by type and race number only.

## Design rules

- Never distinguish candidates or states by color alone: keep the party letter badge,
  written party label and stripes.
- Keep light and dark mode working and the layout usable at phone width.

## Checks

```
npx tsc --noEmit -p .
npx eslint src worker scripts
npm run build
node scripts/check-ballot-data.mjs
```
