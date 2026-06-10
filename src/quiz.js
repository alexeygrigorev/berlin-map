import "./quiz.css";
import boroughsFC from "./data/boroughs.json";
import arms from "./data/arms.json";

// ---------- helpers ----------
const slugOf = (name) =>
  name
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const initials = (name) =>
  name.split(/[-\s]/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();

// ---------- projection (planar Web-Mercator fit to the boroughs bbox) ----------
const D2R = Math.PI / 180;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2));

const PAD = 14;
const W = 960;
let bb = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
const scan = (a) => {
  if (typeof a[0] === "number") {
    const x = a[0] * D2R, y = mercY(a[1]);
    bb.minX = Math.min(bb.minX, x); bb.maxX = Math.max(bb.maxX, x);
    bb.minY = Math.min(bb.minY, y); bb.maxY = Math.max(bb.maxY, y);
  } else a.forEach(scan);
};
boroughsFC.features.forEach((f) => scan(f.geometry.coordinates));
const scale = (W - 2 * PAD) / (bb.maxX - bb.minX);
const H = Math.round((bb.maxY - bb.minY) * scale + 2 * PAD);
const project = (lon, lat) => [
  PAD + (lon * D2R - bb.minX) * scale,
  PAD + (bb.maxY - mercY(lat)) * scale,
];

// normalise each borough to { slug, name, polys } where polys = [[ring,...], ...]
// ring = array of [x, y] in canvas-logical coords.
const boroughs = boroughsFC.features.map((f) => {
  const raw =
    f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const polys = raw.map((poly) =>
    poly.map((ring) => ring.map(([lo, la]) => project(lo, la)))
  );
  return { slug: slugOf(f.properties.name), name: f.properties.name, polys };
});

// ---------- canvas ----------
const canvas = document.getElementById("map");
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * dpr;
canvas.height = H * dpr;
canvas.style.aspectRatio = `${W} / ${H}`;
const ctx = canvas.getContext("2d");
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

function pointInRing([px, py], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
function hitBorough(pt) {
  for (const b of boroughs) {
    for (const poly of b.polys) {
      if (pointInRing(pt, poly[0])) {
        let hole = false;
        for (let k = 1; k < poly.length; k++) if (pointInRing(pt, poly[k])) hole = true;
        if (!hole) return b;
      }
    }
  }
  return null;
}

function fillColor(b) {
  if (state.answered) {
    if (b.slug === state.target.slug) return "#bdf0bd"; // correct one — green
    if (b.slug === state.clickedSlug) return "#f4bcbc"; // wrong click — red
  } else {
    if (state.mode === "name" && b.slug === state.target.slug) return "#ffd95e"; // ask-about
    if (state.mode === "locate" && b.slug === state.hoverSlug) return "#bcd9ff";
  }
  return "#f1f3f5";
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  for (const b of boroughs) {
    ctx.beginPath();
    for (const poly of b.polys)
      for (const ring of poly) {
        ring.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
      }
    ctx.fillStyle = fillColor(b);
    ctx.fill("evenodd");
    const emphasised =
      (state.mode === "name" && b.slug === state.target?.slug) ||
      (state.answered && (b.slug === state.target?.slug || b.slug === state.clickedSlug));
    ctx.lineWidth = emphasised ? 2.6 : 1.2;
    ctx.strokeStyle = emphasised ? "#1a1a1a" : "#9aa0a6";
    ctx.lineJoin = "round";
    ctx.stroke();
  }
}

// ---------- game state ----------
const state = {
  mode: "name",
  target: null,
  options: [],
  answered: false,
  clickedSlug: null,
  hoverSlug: null,
  last: null,
  correct: 0,
  wrong: 0,
  streak: 0,
};

const el = {
  app: document.getElementById("app"),
  prompt: document.getElementById("prompt"),
  options: document.getElementById("options"),
  feedback: document.getElementById("feedback"),
  next: document.getElementById("next"),
  correct: document.getElementById("correct"),
  wrong: document.getElementById("wrong"),
  streak: document.getElementById("streak"),
};

const sample = (arr, n) => {
  const c = [...arr];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c.slice(0, n);
};

function armImg(slug, cls) {
  if (arms[slug]) {
    const img = document.createElement("img");
    img.src = arms[slug];
    img.alt = "";
    if (cls) img.className = cls;
    return img;
  }
  return null;
}

function nextQuestion() {
  clearTimeout(state.timer);
  state.answered = false;
  state.clickedSlug = null;
  state.hoverSlug = null;
  el.feedback.textContent = "";
  el.feedback.className = "";
  el.next.hidden = true;

  let target;
  do {
    target = sample(boroughs, 1)[0];
  } while (boroughs.length > 1 && target.slug === state.last);
  state.last = target.slug;
  state.target = target;

  if (state.mode === "name") {
    const distractors = sample(boroughs.filter((b) => b.slug !== target.slug), 3);
    state.options = sample([target, ...distractors], 4);
    renderOptions();
    el.prompt.innerHTML =
      "Какой район <b>подсвечен</b> на карте? Выбери правильный вариант:";
  } else {
    el.options.innerHTML = "";
    el.prompt.innerHTML = "";
    const img = armImg(target.slug);
    if (img) el.prompt.appendChild(img);
    const span = document.createElement("span");
    span.innerHTML = `Найди на карте: <span class="target-name">${target.name}</span>`;
    el.prompt.appendChild(span);
  }
  draw();
}

function renderOptions() {
  el.options.innerHTML = "";
  for (const opt of state.options) {
    const btn = document.createElement("button");
    btn.className = "opt";
    const img = armImg(opt.slug);
    if (img) btn.appendChild(img);
    else {
      const ph = document.createElement("div");
      ph.className = "ph";
      ph.textContent = initials(opt.name);
      btn.appendChild(ph);
    }
    const label = document.createElement("span");
    label.textContent = opt.name;
    btn.appendChild(label);
    btn.addEventListener("click", () => answer(opt.slug, btn));
    el.options.appendChild(btn);
  }
}

function answer(slug, btn) {
  if (state.answered) return;
  state.answered = true;
  state.clickedSlug = slug;
  const ok = slug === state.target.slug;

  if (ok) {
    state.correct++;
    state.streak++;
    el.feedback.textContent = "✅ Верно!";
    el.feedback.className = "ok";
  } else {
    state.wrong++;
    state.streak = 0;
    el.feedback.textContent = `❌ Это ${nameOf(slug)}. Правильно — ${state.target.name}.`;
    el.feedback.className = "no";
  }
  el.correct.textContent = state.correct;
  el.wrong.textContent = state.wrong;
  el.streak.textContent = state.streak;

  if (state.mode === "name") {
    [...el.options.children].forEach((b) => {
      b.disabled = true;
      const s = state.options[[...el.options.children].indexOf(b)].slug;
      if (s === state.target.slug) b.classList.add("correct");
      else if (s === slug && !ok) b.classList.add("wrong");
    });
  }
  draw();

  el.next.hidden = false;
  if (ok) state.timer = setTimeout(nextQuestion, 900);
}

const nameOf = (slug) => boroughs.find((b) => b.slug === slug)?.name ?? "?";

// ---------- interaction ----------
function eventPoint(e) {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
}

canvas.addEventListener("click", (e) => {
  if (state.mode !== "locate" || state.answered) return;
  const b = hitBorough(eventPoint(e));
  if (b) answer(b.slug);
});

canvas.addEventListener("mousemove", (e) => {
  if (state.mode !== "locate" || state.answered) return;
  const b = hitBorough(eventPoint(e));
  const s = b ? b.slug : null;
  if (s !== state.hoverSlug) {
    state.hoverSlug = s;
    canvas.style.cursor = b ? "pointer" : "default";
    draw();
  }
});

el.next.addEventListener("click", nextQuestion);

document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.classList.contains("active")) return;
    document.querySelectorAll(".mode-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.mode = btn.dataset.mode;
    el.app.dataset.mode = state.mode;
    state.last = null;
    nextQuestion();
  });
});

// ---------- go ----------
el.app.dataset.mode = state.mode;
nextQuestion();
