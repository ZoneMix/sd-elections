// Build src/data/ballot-refs.json: every legislative, county, local and ballot
// question contest on the Nov 3, 2026 ballot, from the SD Secretary of State
// results site (electionresults.sd.gov) and its data service. The Worker only
// proxies contests listed here, and the ballot lookup uses it to pick races.
//
//   node scripts/build-ballot-refs.mjs <census-data-dir>
//
// <census-data-dir>/zcta_county.txt is the Census 2020 ZCTA-to-county
// relationship file (tab20_zcta520_county20_natl.txt), used only for county
// FIPS codes and names:
//   https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonCounty, contestUrl, turnoutUrl } from "../src/lib/sdapi.ts";

const PAGE = "https://electionresults.sd.gov/";
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "..", "src", "data", "ballot-refs.json");
const CONCURRENCY = 4;

const dir = process.argv[2];
if (!dir) {
  console.error("usage: node scripts/build-ballot-refs.mjs <census-data-dir>");
  process.exit(1);
}

async function get(url, as = "text") {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return as === "json" ? res.json() : res.text();
}

const refsIn = (html, type) =>
  [...html.matchAll(new RegExp(`CreateMap\\('${type}',\\s*'(\\d+)',\\s*'(\\d+)',\\s*'([^']*)'\\)`, "g"))].map(
    (m) => ({ raceId: Number(m[1]), osn: m[2], party: m[3] }),
  );

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

const dataUrl = (type, category, ref, county = "0") => contestUrl(type, category, ref, county);

async function pool(items, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

async function sw(type, ref, county) {
  const body = await get(dataUrl(type, "SW", ref, county), "json");
  const first = body?.d?.[0];
  if (!first) throw new Error(`no data for ${type} ${ref.raceId}`);
  return { name: clean(first.RaceName), area: clean(first.AreaNum), voteFor: Number(first.VoteFor) || 1 };
}

async function countiesOf(type, ref) {
  const body = await get(dataUrl(type, "CTY", ref), "json");
  return [...new Set((body?.d ?? []).map((r) => String(r.CountyID)).filter(Boolean))].sort();
}

async function main() {
  // Feed county IDs (SD's own numbering) joined to Census FIPS by name.
  const turnout = await get(turnoutUrl(), "json");
  const feedByName = new Map(turnout.d.map((r) => [canonCounty(r.CountyName).toLowerCase(), String(r.CountyID)]));
  const census = (await readFile(path.join(dir, "zcta_county.txt"), "utf8")).split("\n");
  const counties = {};
  for (const line of census) {
    const f = line.split("|");
    const fips = f[9];
    if (!fips?.startsWith("46") || counties[fips.slice(2)]) continue;
    const name = canonCounty(f[10].replace(/ County$/, ""));
    const id = feedByName.get(name.toLowerCase());
    if (!id) throw new Error(`no feed county for ${name}`);
    counties[fips.slice(2)] = { id, name };
  }
  if (Object.keys(counties).length !== 66) throw new Error(`expected 66 counties, got ${Object.keys(counties).length}`);

  // Legislature: district from the feed's AreaNum ("District 26A").
  const legRefs = refsIn(await get(`${PAGE}resultsSW.aspx?type=LEG&map=DIST`), "LEG");
  const leg = await pool(legRefs, async (ref) => {
    const meta = await sw("LEG", ref);
    return {
      ...ref,
      office: /senat/i.test(meta.name) ? "senate" : "house",
      district: meta.area.replace(/^District\s*0*/i, ""),
      voteFor: meta.voteFor,
      counties: await countiesOf("LEG", ref),
    };
  });

  const bqRefs = refsIn(await get(`${PAGE}resultsSW.aspx?type=BQ&map=CTY`), "BQ");
  const questions = await pool(bqRefs, async (ref) => ({ ...ref, name: (await sw("BQ", ref)).name }));

  const countyRaces = {};
  await pool(Object.values(counties), async ({ id, name }) => {
    const html = await get(`${PAGE}resultsSW.aspx?type=CTY&map=CTY&cty=${id}&name=${encodeURIComponent(name)}`);
    countyRaces[id] = await pool(refsIn(html, "CTY"), async (ref) => {
      const meta = await sw("CTY", ref, id);
      return { ...ref, name: meta.name, voteFor: meta.voteFor };
    });
  });

  const munList = await get(`${PAGE}resultsList.aspx?type=mun&map=CTY`);
  const areas = [...new Set([...munList.matchAll(/type=mun&amp;map=CTY&amp;area=([^&"]+)/g)].map((m) => decodeURIComponent(m[1])))];
  const local = (
    await pool(areas, async (area) => {
      const html = await get(`${PAGE}resultsSW.aspx?type=mun&map=CTY&area=${encodeURIComponent(area)}&name=${encodeURIComponent(area)}`);
      return pool(refsIn(html, "MUN"), async (ref) => {
        const meta = await sw("MUN", ref);
        return { ...ref, area, name: meta.name, voteFor: meta.voteFor, counties: await countiesOf("MUN", ref) };
      });
    })
  ).flat();

  const out = { generatedAt: new Date().toISOString(), counties, leg, questions, county: countyRaces, local };
  await writeFile(OUT, JSON.stringify(out));
  console.log(
    `counties=66 leg=${leg.length} questions=${questions.length} countyRaces=${Object.values(countyRaces).flat().length} local=${local.length} -> ${OUT}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
