// Reproduces src/data/berlin.json (city outline) and src/data/hills.json
// (named hills/peaks inside the city border, with elevation).
//
//   node scripts/fetch-berlin-and-hills.mjs
//
// Sources: OpenStreetMap via Nominatim (outline) + Overpass (peaks). © OSM, ODbL.
import { writeFileSync, mkdirSync } from "fs";

const UA = { "User-Agent": "berlin-map/1.0 (data prep)" };
const OUT = "src/data";
mkdirSync(OUT, { recursive: true });

// --- 1. Berlin city outline (OSM relation 62422) ---
async function fetchOutline() {
  const url =
    "https://nominatim.openstreetmap.org/search?q=Berlin,Germany&format=json&polygon_geojson=1&limit=1";
  const data = await (await fetch(url, { headers: UA })).json();
  const feature = {
    type: "Feature",
    properties: { name: "Berlin" },
    geometry: data[0].geojson,
  };
  writeFileSync(`${OUT}/berlin.json`, JSON.stringify(feature));
  console.log("berlin.json written:", data[0].geojson.type);
  return feature;
}

// --- 2. Named hills/peaks, clipped to the Berlin polygon ---
function pointInRing(pt, ring) {
  let [x, y] = pt, inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
function inBerlin(geom, lon, lat) {
  for (const poly of geom.coordinates) {
    if (pointInRing([lon, lat], poly[0])) {
      let hole = false;
      for (let k = 1; k < poly.length; k++)
        if (pointInRing([lon, lat], poly[k])) hole = true;
      if (!hole) return true;
    }
  }
  return false;
}
async function fetchHills(outline) {
  const query = `[out:json][timeout:90][bbox:52.33,13.08,52.68,13.77];
(node["natural"="peak"]["name"];node["natural"="hill"]["name"];);
out body;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: UA,
    body: "data=" + encodeURIComponent(query),
  });
  const data = await res.json();
  const hills = data.elements
    .filter((e) => e.tags?.name && e.tags.ele && !isNaN(parseFloat(e.tags.ele)))
    .filter((e) => inBerlin(outline.geometry, e.lon, e.lat))
    .map((e) => ({
      name: e.tags.name,
      lat: +e.lat.toFixed(5),
      lon: +e.lon.toFixed(5),
      ele: Math.round(parseFloat(e.tags.ele)),
    }))
    .sort((a, b) => b.ele - a.ele);
  writeFileSync(`${OUT}/hills.json`, JSON.stringify(hills, null, 1));
  console.log("hills.json written:", hills.length, "hills");
}

const outline = await fetchOutline();
await new Promise((r) => setTimeout(r, 1500)); // be polite to OSM
await fetchHills(outline);
