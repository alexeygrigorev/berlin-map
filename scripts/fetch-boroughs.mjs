// Fetches the 12 Berlin boroughs (Bezirke) as a GeoJSON FeatureCollection
// into src/data/boroughs.json.
//
//   node scripts/fetch-boroughs.mjs
//
// Source: OpenStreetMap via Nominatim (polygon_geojson). © OSM, ODbL.
import { writeFileSync, mkdirSync } from "fs";

const UA = { "User-Agent": "berlin-map/1.0 (data prep)" };
const OUT = "src/data";
mkdirSync(OUT, { recursive: true });

// The 12 Bezirke. osmId = OSM relation id (admin_level 9) for an exact lookup.
const BOROUGHS = [
  { name: "Mitte", osmId: 16347 },
  { name: "Friedrichshain-Kreuzberg", osmId: 55764 },
  { name: "Pankow", osmId: 164723 },
  { name: "Charlottenburg-Wilmersdorf", osmId: 404538 },
  { name: "Spandau", osmId: 16343 },
  { name: "Steglitz-Zehlendorf", osmId: 55734 },
  { name: "Tempelhof-Schöneberg", osmId: 158437 },
  { name: "Neukölln", osmId: 162902 },
  { name: "Treptow-Köpenick", osmId: 55754 },
  { name: "Marzahn-Hellersdorf", osmId: 164712 },
  { name: "Lichtenberg", osmId: 404554 },
  { name: "Reinickendorf", osmId: 16334 },
];

async function fetchOne(b) {
  const url = `https://nominatim.openstreetmap.org/lookup?osm_ids=R${b.osmId}&format=json&polygon_geojson=1`;
  const data = await (await fetch(url, { headers: UA })).json();
  const rec = data[0];
  if (!rec?.geojson) throw new Error(`no geometry for ${b.name}`);
  return {
    type: "Feature",
    properties: {
      name: b.name,
      osm_id: b.osmId,
      display_name: rec.display_name,
    },
    geometry: rec.geojson,
  };
}

const features = [];
for (const b of BOROUGHS) {
  const f = await fetchOne(b);
  const pts = JSON.stringify(f.geometry).match(/-?\d+\.\d+/g)?.length / 2;
  console.log(`✓ ${b.name.padEnd(28)} ${f.geometry.type} (~${pts | 0} pts)`);
  features.push(f);
  await new Promise((r) => setTimeout(r, 1200)); // Nominatim rate limit
}

const fc = { type: "FeatureCollection", features };
writeFileSync(`${OUT}/boroughs.json`, JSON.stringify(fc));
console.log(`\nboroughs.json written: ${features.length} boroughs`);
