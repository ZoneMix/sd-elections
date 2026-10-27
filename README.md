# sd-elections

An unofficial results site for South Dakota's November 3, 2026 general election. It reads
the South Dakota Secretary of State's public results service and presents it as a cleaner,
faster page that works on phones and in light or dark mode.

Live at https://elections.zonemix.tech.

## Features

- **Live results** for Governor, U.S. Senate, U.S. House and every statewide race, with
  precincts reporting and turnout. Before polls close the page shows candidates only; vote
  counts appear once results start posting.
- **ZIP code ballot lookup.** Type a ZIP code to see what is on that ballot: statewide and
  federal races, the state senate and state house district races, county races and
  referendums, local contests, and the constitutional amendments with a neutral one-line
  summary of each. When a ZIP code crosses a county or district line, every area is listed
  and the visitor picks one. The ZIP code stays in the browser: it is matched against a
  table bundled with the site, kept in sessionStorage until the tab closes, and never sent
  to the server. Contests are requested by race number only.
- **County map** of the featured race, shaded by margin of lead, with stripes and a labeled
  key so it reads without relying on color.
- **Party colors with labels.** Republican red and Democratic blue at clearly different
  lightness, always paired with an R or D badge and a written party label.
- **The July 28, 2026 Republican runoff for Governor**, final results from the state archive.
- **Light election-night load.** The page loads once, refreshes every 15 seconds only on
  election night, and the Worker caches the state service at the edge.

## How it works

- `src/` is a Next.js static export (React, Tailwind CSS). `src/lib/` holds the pure data
  code shared by the page and the Worker.
- `worker/index.ts` is a Cloudflare Worker. It serves the static files and proxies the state
  results service under `/api/*`, normalizing and caching responses. Ballot lookup contests
  are served only if they are listed in `src/data/ballot-refs.json`.
- `src/data/sd-zips.json` maps each South Dakota ZIP Code Tabulation Area to the county,
  state senate district and state house district combinations its residents live in, with
  each combination's share of residents.

## Data sources

- **South Dakota Secretary of State** election results service (`electionresults.sd.gov`
  and its data service) for candidates, results, turnout and the list of contests.
- **U.S. Census Bureau** 2020 ZCTA relationship files (ZCTA to county, ZCTA to census block)
  and 2024 TIGER/Line files for South Dakota census blocks and state legislative districts
  (the 2021 district plan, including House districts 26A, 26B, 28A and 28B).
- County boundaries for the map from the Census Bureau, prepared by `scripts/build-geo.mjs`.

ZIP codes are not the same as Census ZIP Code Tabulation Areas, and both can cross district
lines. The site always tells visitors to confirm their exact ballot with the Secretary of
State's voter information portal.

## Build and run

```
npm ci
npm run dev        # page only, at http://localhost:3000
npm run cf:dev     # full app with the Worker and /api, at http://localhost:8787
npm run build      # static export to ./out
```

## Deploy your own copy

See [DEPLOY.md](DEPLOY.md). In short: `npx wrangler login`, then `npm run deploy`. It runs on
your workers.dev subdomain unless you set a custom domain in `wrangler.toml`.

## Rebuilding the data

The ZIP and contest tables are committed, so you only need this for a new election or new
district maps.

1. Download the Census files listed at the top of `scripts/build-zip-table.mjs` into one
   folder (the ZCTA to block file is large; keep only South Dakota rows as the script
   describes).
2. `node scripts/build-zip-table.mjs <folder>` writes `src/data/sd-zips.json`.
3. `node scripts/build-ballot-refs.mjs <folder>` reads the state results site and writes
   `src/data/ballot-refs.json`.
4. `node scripts/check-ballot-data.mjs` cross-checks the two against the state's own
   county lists for each district.

## License

Source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE).

In plain words: you may use, copy and change this project for free for personal and other
noncommercial purposes, and share it with others on the same terms. You may not sell it or
use it for commercial purposes. This is not an OSI-approved open source license. The license
text in [LICENSE](LICENSE) is what governs; this summary is only a guide.

This project is not affiliated with the State of South Dakota, any government agency or any
campaign. Results are unofficial until the state canvass.
