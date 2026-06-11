// Builds src/data/france.json (13 metropolitan régions outlines) and
// src/data/france-hills.json (named peaks/hills with elevation, bucketed per
// region). Borders from gregoiredavid/france-geojson, peaks via Overpass.
// © OpenStreetMap, ODbL.
//
//   node scripts/fetch-france.mjs
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "fs";

const UA = { "User-Agent": "france-hills-map/1.0 (data prep)" };
const OUT = "src/data";
mkdirSync(OUT, { recursive: true });

const BORDERS_URL =
  "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/regions-version-simplifiee.geojson";

// région INSEE code -> filename slug (matches src/data/france-arms/*.png)
const SLUG = {
  "84": "auvergne-rhone-alpes",
  "27": "bourgogne-franche-comte",
  "53": "bretagne",
  "24": "centre-val-de-loire",
  "94": "corse",
  "44": "grand-est",
  "32": "hauts-de-france",
  "11": "ile-de-france",
  "28": "normandie",
  "75": "nouvelle-aquitaine",
  "76": "occitanie",
  "52": "pays-de-la-loire",
  "93": "provence-alpes-cote-d-azur",
};

const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pointInRing(pt, ring) {
  let [x, y] = pt, inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
function inGeom(geom, lon, lat) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  for (const poly of polys) {
    if (pointInRing([lon, lat], poly[0])) {
      let hole = false;
      for (let k = 1; k < poly.length; k++)
        if (pointInRing([lon, lat], poly[k])) hole = true;
      if (!hole) return true;
    }
  }
  return false;
}
function bbox(geom) {
  let s = 90, w = 180, n = -90, e = -180;
  const walk = (a) => {
    if (typeof a[0] === "number") {
      if (a[1] < s) s = a[1];
      if (a[1] > n) n = a[1];
      if (a[0] < w) w = a[0];
      if (a[0] > e) e = a[0];
    } else a.forEach(walk);
  };
  walk(geom.coordinates);
  return [s, w, n, e];
}

async function overpass(query) {
  let lastErr;
  for (const ep of OVERPASS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(ep, {
          method: "POST",
          headers: UA,
          body: "data=" + encodeURIComponent(query),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (text.trimStart().startsWith("<")) throw new Error("non-JSON (busy)");
        return JSON.parse(text);
      } catch (e) {
        lastErr = e;
        console.log(`   retry (${ep.split("/")[2]}): ${e.message}`);
        await sleep(3000);
      }
    }
  }
  throw lastErr;
}

async function fetchRegionHills(feature) {
  const [s, w, n, e] = bbox(feature.geometry).map((v, i) =>
    i < 2 ? v - 0.02 : v + 0.02
  );
  const query = `[out:json][timeout:120][bbox:${s},${w},${n},${e}];
(node["natural"="peak"]["name"]["ele"];node["natural"="hill"]["name"]["ele"];);
out body;`;
  const data = await overpass(query);
  const seen = new Set();
  const hills = [];
  for (const el of data.elements) {
    const ele = parseFloat(el.tags?.ele);
    if (!el.tags?.name || isNaN(ele)) continue;
    if (!inGeom(feature.geometry, el.lon, el.lat)) continue;
    if (seen.has(el.id)) continue;
    seen.add(el.id);
    hills.push({
      name: el.tags.name,
      lat: +el.lat.toFixed(5),
      lon: +el.lon.toFixed(5),
      ele: Math.round(ele),
    });
  }
  hills.sort((a, b) => b.ele - a.ele);
  return hills;
}

async function main() {
  console.log("Fetching régions borders…");
  const fc = await (await fetch(BORDERS_URL, { headers: UA })).json();

  const states = fc.features.map((f) => ({
    id: f.properties.code,
    name: f.properties.nom,
    slug: SLUG[f.properties.code],
    geometry: f.geometry,
  }));
  writeFileSync(`${OUT}/france.json`, JSON.stringify({ type: "states", states }));
  console.log("france.json written:", states.length, "régions");

  const hillsPath = `${OUT}/france-hills.json`;
  const byState = existsSync(hillsPath)
    ? JSON.parse(readFileSync(hillsPath, "utf8"))
    : {};

  for (const st of states) {
    if (byState[st.slug]?.length) {
      console.log(`= ${st.name}: cached (${byState[st.slug].length})`);
      continue;
    }
    process.stdout.write(`… ${st.name}: fetching… `);
    try {
      const hills = await fetchRegionHills(st);
      byState[st.slug] = hills;
      console.log(`${hills.length} hills`);
      writeFileSync(hillsPath, JSON.stringify(byState));
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
    }
    await sleep(2000);
  }

  const total = Object.values(byState).reduce((a, b) => a + b.length, 0);
  console.log(`\nfrance-hills.json written: ${total} hills across régions`);
}

main();
