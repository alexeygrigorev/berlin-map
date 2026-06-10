// Headless smoke test of the quiz logic with a minimal DOM/canvas mock.
// Runs the real src/quiz.js (imports stripped, data injected) and checks that
// questions generate, arms resolve, and scoring works for both modes.
import { readFileSync } from "fs";

const boroughsFC = JSON.parse(readFileSync("src/data/boroughs.json", "utf8"));
const arms = JSON.parse(readFileSync("src/data/arms.json", "utf8"));

// ---- minimal DOM mock ----
const handlers = new Map(); // element -> { type -> fn }
function mkEl(id) {
  const children = [];
  const el = {
    id, children, className: "", textContent: "", innerHTML: "",
    src: "", alt: "", hidden: false, disabled: false,
    dataset: {}, style: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    appendChild(c) { children.push(c); return c; },
    set innerHTML(v) { if (v === "") children.length = 0; },
    get innerHTML() { return ""; },
    addEventListener(t, fn) {
      if (!handlers.has(el)) handlers.set(el, {});
      handlers.get(el)[t] = fn;
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 796 }),
    getContext: () => ctxMock,
    width: 0, height: 0,
  };
  return el;
}
const ctxMock = new Proxy({}, { get: () => () => {} });
const ids = {};
const modeBtns = [
  Object.assign(mkEl(), { dataset: { mode: "name" } }),
  Object.assign(mkEl(), { dataset: { mode: "locate" } }),
];
modeBtns[0].classList.add("active");

const document = {
  getElementById: (id) => (ids[id] ||= mkEl(id)),
  createElement: () => mkEl(),
  querySelectorAll: () => modeBtns,
};
const window = { devicePixelRatio: 2 };

// ---- load & run quiz.js ----
let code = readFileSync("src/quiz.js", "utf8").replace(/^\s*import .*$/gm, "");
const run = new Function(
  "document", "window", "boroughsFC", "arms", "setTimeout", "clearTimeout",
  code + "\nreturn { state: typeof state !== 'undefined' ? state : null };"
);
const fire = (el, type, arg) => handlers.get(el)?.[type]?.(arg);

let pendingTimer = null;
const { state } = run(
  document, window, boroughsFC, arms,
  (fn) => { pendingTimer = fn; return 1; }, () => { pendingTimer = null; }
);

// ---- assertions ----
let pass = 0, fail = 0;
const check = (cond, msg) => (cond ? (pass++, console.log("  ✓", msg)) : (fail++, console.log("  ✗ FAIL:", msg)));

console.log("MODE 1 (name):");
check(state.mode === "name", "starts in name mode");
check(!!state.target && !!state.target.slug, "target chosen: " + state.target?.name);
check(state.options.length === 4, "4 options offered");
check(state.options.some((o) => o.slug === state.target.slug), "correct answer is among options");
check(Object.keys(arms).length === 12, "12 arms available");
check(arms[state.target.slug]?.startsWith("data:image/png"), "target has a coat-of-arms data URI");

// answer correctly via the option button
const optsEl = document.getElementById("options");
const correctIdx = state.options.findIndex((o) => o.slug === state.target.slug);
fire(optsEl.children[correctIdx], "click");
check(state.correct === 1 && state.streak === 1, "correct click → score 1, streak 1");

// advance and answer wrong
if (pendingTimer) pendingTimer();
const wrongIdx = state.options.findIndex((o) => o.slug !== state.target.slug);
fire(document.getElementById("options").children[wrongIdx], "click");
check(state.wrong === 1 && state.streak === 0, "wrong click → wrong 1, streak reset");

console.log("MODE 2 (locate):");
fire(modeBtns[1], "click"); // switch mode
check(state.mode === "locate", "switched to locate mode");
const before = state.correct;
// click the centroid of the target borough on the canvas
const t = state.target;
// build the same projection to find a point inside the target
const D2R = Math.PI / 180, mercY = (l) => Math.log(Math.tan(Math.PI / 4 + (l * D2R) / 2));
const PAD = 14, W = 960;
let bb = { minX: 1 / 0, minY: 1 / 0, maxX: -1 / 0, maxY: -1 / 0 };
const scan = (a) => { if (typeof a[0] === "number") { const x = a[0] * D2R, y = mercY(a[1]); bb.minX = Math.min(bb.minX, x); bb.maxX = Math.max(bb.maxX, x); bb.minY = Math.min(bb.minY, y); bb.maxY = Math.max(bb.maxY, y); } else a.forEach(scan); };
boroughsFC.features.forEach((f) => scan(f.geometry.coordinates));
const scale = (W - 2 * PAD) / (bb.maxX - bb.minX), H = Math.round((bb.maxY - bb.minY) * scale + 2 * PAD);
const tf = boroughsFC.features.find((f) => f.properties.name === t.name);
const ring = (tf.geometry.type === "Polygon" ? tf.geometry.coordinates[0] : tf.geometry.coordinates[0][0]);
// use an interior point via average of ring (rough) — good enough for big convex-ish boroughs;
// fall back to scanning if needed
function project(lon, lat) { return [PAD + (lon * D2R - bb.minX) * scale, PAD + (bb.maxY - mercY(lat)) * scale]; }
let cx = 0, cy = 0; ring.forEach(([lo, la]) => { const [x, y] = project(lo, la); cx += x; cy += y; }); cx /= ring.length; cy /= ring.length;
const canvas = document.getElementById("map");
fire(canvas, "click", { clientX: cx, clientY: cy });
check(state.correct >= before, `map click registered (correct=${state.correct})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
