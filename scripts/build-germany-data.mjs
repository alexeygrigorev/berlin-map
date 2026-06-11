// Splits the Germany data into separately-loadable files under public/germany/
// so the map page stays small and fetches only what a view needs:
//   public/germany/states.json        – borders + per-state hill counts (loaded once)
//   public/germany/hills/<slug>.json   – that state's hills (loaded on click)
//   public/germany/arms/<slug>.png     – that state's coat of arms (loaded on click)
//
// Source of truth stays in src/data/ (germany.json, germany-hills.json,
// state-arms/*.png). vite serves public/ at /, and build-site.mjs copies
// public/germany/ into docs/germany/.
//
//   node scripts/build-germany-data.mjs
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  existsSync,
} from "fs";

const SRC = "src/data";
const OUT = "public/germany";
mkdirSync(`${OUT}/hills`, { recursive: true });
mkdirSync(`${OUT}/arms`, { recursive: true });

const germany = JSON.parse(readFileSync(`${SRC}/germany.json`, "utf8"));
const hillsBySlug = JSON.parse(readFileSync(`${SRC}/germany-hills.json`, "utf8"));

// states.json — borders + counts only (no hills, keeps the initial load lean)
const states = germany.states.map((s) => ({
  id: s.id,
  name: s.name,
  slug: s.slug,
  geometry: s.geometry,
  count: (hillsBySlug[s.slug] || []).length,
}));
writeFileSync(`${OUT}/states.json`, JSON.stringify({ type: "states", states }));
console.log(`states.json: ${states.length} states`);

// per-state hills
let total = 0;
for (const s of germany.states) {
  const hills = hillsBySlug[s.slug] || [];
  writeFileSync(`${OUT}/hills/${s.slug}.json`, JSON.stringify(hills));
  total += hills.length;
}
console.log(`hills/<slug>.json: ${total} hills across ${germany.states.length} files`);

// coats of arms (copy the PNGs as-is)
let arms = 0;
for (const s of germany.states) {
  const src = `${SRC}/state-arms/${s.slug}.png`;
  if (existsSync(src)) {
    copyFileSync(src, `${OUT}/arms/${s.slug}.png`);
    arms++;
  } else {
    console.warn(`  missing arm: ${src}`);
  }
}
console.log(`arms/<slug>.png: ${arms} copied`);
