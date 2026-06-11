// Splits a country's data into separately-loadable files under public/<country>/
// so the map page stays small and fetches only what a view needs:
//   public/<country>/states.json        – borders + per-region hill counts (once)
//   public/<country>/hills/<slug>.json   – that region's hills (on click)
//   public/<country>/arms/<slug>.png     – that region's coat of arms (on click)
//
// Source of truth stays in src/data/. vite serves public/ at /, and
// build-site.mjs copies public/<country>/ into docs/<country>/.
//
//   node scripts/build-country-data.mjs            # all countries
//   node scripts/build-country-data.mjs france     # just one
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  existsSync,
} from "fs";

const SRC = "src/data";

const COUNTRIES = {
  germany: { states: "germany.json", hills: "germany-hills.json", arms: "state-arms" },
  france: { states: "france.json", hills: "france-hills.json", arms: "france-arms" },
};

function build(country) {
  const cfg = COUNTRIES[country];
  if (!cfg) throw new Error(`unknown country: ${country}`);
  if (!existsSync(`${SRC}/${cfg.states}`) || !existsSync(`${SRC}/${cfg.hills}`)) {
    console.warn(`${country}: source data not found yet — skipping (run scripts/fetch-${country}.mjs)`);
    return;
  }
  const out = `public/${country}`;
  mkdirSync(`${out}/hills`, { recursive: true });
  mkdirSync(`${out}/arms`, { recursive: true });

  const meta = JSON.parse(readFileSync(`${SRC}/${cfg.states}`, "utf8"));
  const hillsBySlug = JSON.parse(readFileSync(`${SRC}/${cfg.hills}`, "utf8"));

  // states.json — borders + counts only (keeps the initial load lean)
  const states = meta.states.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    geometry: s.geometry,
    count: (hillsBySlug[s.slug] || []).length,
  }));
  writeFileSync(`${out}/states.json`, JSON.stringify({ type: "states", states }));

  let total = 0, arms = 0;
  for (const s of meta.states) {
    const hills = hillsBySlug[s.slug] || [];
    writeFileSync(`${out}/hills/${s.slug}.json`, JSON.stringify(hills));
    total += hills.length;
    const armSrc = `${SRC}/${cfg.arms}/${s.slug}.png`;
    if (existsSync(armSrc)) {
      copyFileSync(armSrc, `${out}/arms/${s.slug}.png`);
      arms++;
    } else {
      console.warn(`  ${country}: missing arm ${armSrc}`);
    }
  }
  console.log(
    `${country}: ${states.length} regions, ${total} hills, ${arms} arms → ${out}/`
  );
}

const wanted = process.argv.slice(2);
const list = wanted.length ? wanted : Object.keys(COUNTRIES);
for (const c of list) build(c);
