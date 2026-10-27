// Build src/data/sd-zips.json: every South Dakota ZIP Code Tabulation Area
// (ZCTA) mapped to the county / state senate / state house combinations its
// residents live in, with each combination's share of the ZIP's population.
//
//   node scripts/build-zip-table.mjs <census-data-dir>
//
// The data dir holds these official U.S. Census Bureau files (downloaded by
// hand, not committed):
//   zcta_block_sd.txt   "ZCTA|block GEOID" rows for SD blocks, filtered from
//     https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_tabblock20_natl.txt
//     (2020 ZCTA to 2020 tabulation block relationship file, vintage 2020)
//   tl_2024_46_tabblock20/  TIGER/Line 2024, 2020 blocks for SD (POP20 + internal point)
//     https://www2.census.gov/geo/tiger/TIGER2024/TABBLOCK20/tl_2024_46_tabblock20.zip
//   tl_2024_46_sldu/  TIGER/Line 2024 state senate districts (2021 plan)
//     https://www2.census.gov/geo/tiger/TIGER2024/SLDU/tl_2024_46_sldu.zip
//   tl_2024_46_sldl/  TIGER/Line 2024 state house districts (26A/26B, 28A/28B)
//     https://www2.census.gov/geo/tiger/TIGER2024/SLDL/tl_2024_46_sldl.zip
//
// Each populated block is placed in a district by its internal point. ZIP
// codes are not ZCTAs exactly; the UI says so and links the state lookup.
import { open, openDbf } from "shapefile";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: node scripts/build-zip-table.mjs <census-data-dir>");
  process.exit(1);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "..", "src", "data", "sd-zips.json");
const MIN_SHARE = 0.001; // drop slivers under 0.1% of a ZIP's people

async function readAll(source) {
  const rows = [];
  for (let r = await source.read(); !r.done; r = await source.read()) rows.push(r.value);
  return rows;
}

/** Ray casting over every ring (even-odd), so holes need no special case. */
function inRings(rings, x, y) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

function toDistricts(features, codeKey) {
  return features.map((f) => {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    const rings = polys.flat();
    const xs = rings.flat().map((p) => p[0]);
    const ys = rings.flat().map((p) => p[1]);
    return {
      code: String(f.properties[codeKey]).replace(/^0+/, ""),
      rings,
      bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    };
  });
}

function locate(districts, x, y) {
  for (const d of districts) {
    const [x0, y0, x1, y1] = d.bbox;
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1 && inRings(d.rings, x, y)) return d.code;
  }
  return null;
}

async function main() {
  const senate = toDistricts(await readAll(await open(path.join(dir, "tl_2024_46_sldu/tl_2024_46_sldu.shp"))), "SLDUST");
  const house = toDistricts(await readAll(await open(path.join(dir, "tl_2024_46_sldl/tl_2024_46_sldl.shp"))), "SLDLST");

  const blocks = new Map();
  for (const b of await readAll(await openDbf(path.join(dir, "tl_2024_46_tabblock20/tl_2024_46_tabblock20.dbf")))) {
    blocks.set(b.GEOID20, { pop: b.POP20, county: b.COUNTYFP20, x: Number(b.INTPTLON20), y: Number(b.INTPTLAT20) });
  }

  const byZip = new Map(); // zip -> Map(comboKey -> {pop, blocks})
  let unplaced = 0;
  const lines = (await readFile(path.join(dir, "zcta_block_sd.txt"), "utf8")).split("\n").filter(Boolean);
  for (const line of lines) {
    const [zip, geoid] = line.split("|");
    const b = blocks.get(geoid);
    if (!b) continue;
    const su = locate(senate, b.x, b.y);
    const sl = locate(house, b.x, b.y);
    if (!su || !sl) {
      unplaced += 1;
      continue;
    }
    const key = `${b.county}|${su}|${sl}`;
    const combos = byZip.get(zip) ?? new Map();
    const cur = combos.get(key) ?? { pop: 0, blocks: 0 };
    combos.set(key, { pop: cur.pop + b.pop, blocks: cur.blocks + 1 });
    byZip.set(zip, combos);
  }

  // Compact output: { zip: [[countyFips, senate, house, share], ...] }, biggest first.
  const out = {};
  for (const [zip, combos] of [...byZip].sort(([a], [b]) => a.localeCompare(b))) {
    const totalPop = [...combos.values()].reduce((s, c) => s + c.pop, 0);
    const weight = (c) => (totalPop > 0 ? c.pop / totalPop : c.blocks / [...combos.values()].reduce((s, v) => s + v.blocks, 0));
    const rows = [...combos]
      .map(([key, c]) => [...key.split("|"), Math.round(weight(c) * 1000) / 1000])
      .filter((r) => r[3] >= MIN_SHARE)
      .sort((a, b) => b[3] - a[3]);
    if (rows.length > 0) out[zip] = rows;
  }

  await writeFile(OUT, JSON.stringify(out));
  const multi = Object.values(out).filter((r) => r.length > 1).length;
  console.log(`zips=${Object.keys(out).length} multi-option=${multi} unplaced-blocks=${unplaced} -> ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
