// Packs the borough coat-of-arms PNGs from src/data/arms/<slug>.png into
// src/data/arms.json as { slug: "data:image/png;base64,..." } so the quiz
// page (dev and standalone) can use them without external files.
//
//   node scripts/build-arms-json.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";

const DIR = "src/data/arms";
if (!existsSync(DIR)) {
  console.error(`No ${DIR} directory yet — run scripts/fetch... first.`);
  process.exit(1);
}

const out = {};
for (const file of readdirSync(DIR).sort()) {
  if (!file.endsWith(".png")) continue;
  const slug = file.replace(/\.png$/, "");
  const b64 = readFileSync(`${DIR}/${file}`).toString("base64");
  out[slug] = `data:image/png;base64,${b64}`;
}

writeFileSync("src/data/arms.json", JSON.stringify(out));
const kb = (JSON.stringify(out).length / 1024).toFixed(0);
console.log(`arms.json written: ${Object.keys(out).length} arms, ${kb} KB`);
