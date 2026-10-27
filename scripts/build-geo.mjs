// Build a South Dakota counties GeoJSON keyed by county name, and verify the
// name set matches the live SD election API exactly (so the choropleth join
// is provably correct). Run once: `node scripts/build-geo.mjs`. Output is
// committed at src/data/sd-counties.geo.json so the app build stays offline.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../src/data/sd-counties.geo.json");

const COUNTIES_URL =
  "https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json";
const SD_TURNOUT =
  "https://sdresws.azurewebsites.us/ResultsAjax.svc/GetVoterTurnoutData?";

// Canonical county name: strip the API's " (Vote Center)" suffix and map the
// renamed Shannon County → Oglala Lakota (SD renamed it in 2015; FIPS 46113).
function canonCounty(name) {
  let n = String(name)
    .replace(/\s*\(vote center\)\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (n.toLowerCase() === "shannon") n = "Oglala Lakota";
  return n;
}
const norm = (s) => canonCounty(s).toLowerCase();

async function main() {
  console.log("Fetching national county geometry…");
  const all = await fetch(COUNTIES_URL).then((r) => r.json());
  const sd = all.features.filter((f) => f.properties?.STATE === "46");
  console.log(`  SD geometry features: ${sd.length}`);

  console.log("Fetching live SD county list (turnout endpoint)…");
  const turnout = await fetch(SD_TURNOUT).then((r) => r.json());
  const apiCounties = turnout.d.map((c) => c.CountyName);
  console.log(`  API counties: ${apiCounties.length}`);

  // Normalize geometry into a clean FeatureCollection keyed by the CANONICAL
  // county name (Shannon → Oglala Lakota), so it joins the API rows directly.
  const features = sd.map((f) => ({
    type: "Feature",
    id: f.id,
    properties: { name: canonCounty(f.properties.NAME), fips: f.id },
    geometry: f.geometry,
  }));

  // Verify: every API county must have exactly one geometry match.
  const geoByNorm = new Map(features.map((f) => [norm(f.properties.name), f]));
  const missing = apiCounties.filter((n) => !geoByNorm.has(norm(n)));
  const extra = features
    .map((f) => f.properties.name)
    .filter((n) => !apiCounties.some((a) => norm(a) === norm(n)));

  if (missing.length) {
    console.error("API counties with NO geometry match:", missing);
  }
  if (extra.length) {
    console.error("Geometry counties not in API:", extra);
  }
  if (missing.length || extra.length) {
    throw new Error(
      `County join mismatch (missing=${missing.length}, extra=${extra.length}). Fix before committing.`,
    );
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ type: "FeatureCollection", features }));
  console.log(
    `✓ Wrote ${features.length} counties → ${OUT} (verified 66/66 join to live API)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
