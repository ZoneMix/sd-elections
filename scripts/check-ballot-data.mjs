// Cross-check src/data/sd-zips.json (Census-derived) against the state feed:
// every county the ZIP table places in a legislative district must be one the
// Secretary of State reports results for in that district's race, and every
// district must have a race. Exits non-zero on any mismatch.
//
//   node scripts/check-ballot-data.mjs
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const load = async (f) => JSON.parse(await readFile(path.join(here, "..", "src", "data", f), "utf8"));

const zips = await load("sd-zips.json");
const refs = await load("ballot-refs.json");

const feedCounties = new Map(); // "senate:8" -> Set(feed county ids)
for (const r of refs.leg) {
  const key = `${r.office}:${r.district}`;
  feedCounties.set(key, new Set([...(feedCounties.get(key) ?? []), ...r.counties]));
}

const problems = [];
for (const [zip, rows] of Object.entries(zips)) {
  for (const [fips, senate, house] of rows) {
    const county = refs.counties[fips];
    if (!county) {
      problems.push(`${zip}: unknown county FIPS ${fips}`);
      continue;
    }
    for (const [office, d] of [["senate", senate], ["house", house]]) {
      const set = feedCounties.get(`${office}:${d}`);
      if (!set) problems.push(`${zip}: no ${office} race for district ${d}`);
      else if (!set.has(county.id)) problems.push(`${zip}: ${county.name} not in feed's ${office} district ${d}`);
    }
  }
}

console.log(`checked ${Object.keys(zips).length} zips; ${problems.length} problems`);
for (const p of problems.slice(0, 40)) console.log("  " + p);
process.exit(problems.length ? 1 : 0);
