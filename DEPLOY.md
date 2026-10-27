# Deploy

The app is a Cloudflare Worker that serves the static Next.js export (`./out`) and a small
`/api/*` proxy to South Dakota's public election results service. Configuration lives in
`wrangler.toml`; wrangler is pinned in `package.json`.

## Build

```
npm ci
npm run build        # next build -> ./out
```

## Deploy to your own Cloudflare account

```
npx wrangler login   # one-time browser sign-in
npm run deploy       # next build && wrangler deploy
```

For CI, set `CLOUDFLARE_API_TOKEN` (Workers Scripts edit, plus Workers Routes and DNS edit
if you use a custom domain) and, if your login can see more than one account,
`CLOUDFLARE_ACCOUNT_ID`. Never commit either value.

To serve it on your own hostname, uncomment `routes` in `wrangler.toml` and set the pattern to
a hostname in a zone on your account. Add the hostname through wrangler only, not also in the
dashboard at the same time, or the two can race and leave the domain without a DNS record.

Before deploying under your own name, change `SITE_URL` in `src/app/layout.tsx` (used for the
link preview tags) and the header and footer wordmark in `src/components/Masthead.tsx` and
`src/app/page.tsx`.

## Verify

1. Full app locally (assets and `/api`): `npm run cf:dev`, then open http://localhost:8787
   - `curl -s localhost:8787/api/turnout | jq .data.statewide`
   - `curl -s localhost:8787/api/races | jq .data`
2. After deploying, open your Worker's URL and check the hero figures, the Governor race,
   the county map, the statewide races, the ZIP code ballot lookup and the turnout table.
3. On election night, cross-check a race against the official https://electionresults.sd.gov page.

## Notes

- No secrets or environment variables are needed at runtime: the results service is public
  and read-only.
- The Worker caches upstream responses at the edge (about 15 seconds for live results), so
  the state service is hit at most once per cache window per Cloudflare location.
- Before polls close (7 PM CT on November 3, 2026) the state feed carries pre-election test
  numbers. The Worker hides every vote and turnout count until then
  (`ELECTION.resultsOpenAt` in `src/lib/sdapi.ts`).
