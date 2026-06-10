import "./style.css";
import berlin from "./data/berlin.json";
import hills from "./data/hills.json";

// ---- render resolution (internal canvas pixels) ----
const W = 1600;
const H = 1400;
const MAP_TOP = 168;     // space reserved for the title
const MAP_BOTTOM = 56;   // bottom padding
const MAP_PAD_X = 48;

const canvas = document.getElementById("map");
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext("2d");

// ---- custom Web-Mercator projection fitted to the Berlin bbox ----
// (OSM polygons have inconsistent ring winding, which breaks d3-geo's
//  spherical fitExtent — a planar Mercator fit is exact at city scale.)
const D2R = Math.PI / 180;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2));

function bounds(geom) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const walk = (a) => {
    if (typeof a[0] === "number") {
      const x = a[0] * D2R, y = mercY(a[1]);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    } else a.forEach(walk);
  };
  walk(geom.coordinates);
  return { minX, minY, maxX, maxY };
}

const b = bounds(berlin.geometry);
const availW = W - 2 * MAP_PAD_X;
const availH = H - MAP_TOP - MAP_BOTTOM;
const scale = Math.min(availW / (b.maxX - b.minX), availH / (b.maxY - b.minY));
const offX = MAP_PAD_X + (availW - (b.maxX - b.minX) * scale) / 2;
const offY = MAP_TOP + (availH - (b.maxY - b.minY) * scale) / 2;

function project(lon, lat) {
  return [
    offX + (lon * D2R - b.minX) * scale,
    offY + (b.maxY - mercY(lat)) * scale, // flip Y
  ];
}

// trace the Berlin MultiPolygon onto the canvas context
function tracePolygons(geom) {
  ctx.beginPath();
  for (const poly of geom.coordinates) {
    for (const ring of poly) {
      ring.forEach(([lon, lat], i) => {
        const [x, y] = project(lon, lat);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
    }
  }
}

// pre-project hills once
const points = hills.map((h) => {
  const [x, y] = project(h.lon, h.lat);
  return { ...h, x, y };
});

const eleMin = Math.min(...hills.map((h) => h.ele));
const eleMax = Math.max(...hills.map((h) => h.ele));

function triSize(ele) {
  const t = (ele - eleMin) / (eleMax - eleMin || 1);
  return 8 + t * 10; // half-width in px
}

function drawTriangle(x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y - s * 1.15);
  ctx.lineTo(x - s, y + s * 0.75);
  ctx.lineTo(x + s, y + s * 0.75);
  ctx.closePath();
  ctx.fillStyle = "#2b2b2b";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#000";
  ctx.stroke();
}

function rectsOverlap(a, b) {
  return !(a.x2 < b.x1 || b.x2 < a.x1 || a.y2 < b.y1 || b.y2 < a.y1);
}

function render(minEle) {
  // white background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // --- title block ---
  ctx.fillStyle = "#111";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "700 46px Georgia, 'Times New Roman', serif";
  ctx.fillText("ГОРЫ И ХОЛМЫ БЕРЛИНА", MAP_PAD_X, 70);

  const shown = points.filter((p) => p.ele >= minEle);
  ctx.font = "italic 22px Georgia, serif";
  ctx.fillStyle = "#555";
  ctx.fillText(
    `высота ≥ ${minEle} м · показано ${shown.length} из ${points.length}`,
    MAP_PAD_X,
    104
  );

  // legend
  drawTriangle(MAP_PAD_X + 12, 138, 10);
  ctx.font = "20px Georgia, serif";
  ctx.fillStyle = "#333";
  ctx.textBaseline = "middle";
  ctx.fillText("— холм / гора", MAP_PAD_X + 32, 139);
  ctx.textBaseline = "alphabetic";

  // --- Berlin outline ---
  tracePolygons(berlin.geometry);
  ctx.fillStyle = "#fbfbfb";
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#1a1a1a";
  ctx.stroke();

  // --- hills (tallest first so big ones sit on top) ---
  const placed = [];
  const ordered = [...shown].sort((a, b) => b.ele - a.ele);
  for (const p of ordered) {
    drawTriangle(p.x, p.y, triSize(p.ele));
  }

  // labels with simple collision skipping
  ctx.font = "600 15px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const p of ordered) {
    const s = triSize(p.ele);
    const label = p.name;
    const w = ctx.measureText(label).width;
    const lx = p.x;
    const ly = p.y + s * 0.75 + 3;
    const rect = { x1: lx - w / 2, x2: lx + w / 2, y1: ly, y2: ly + 17 };
    if (placed.some((r) => rectsOverlap(rect, r))) continue;
    placed.push(rect);

    // halo for readability
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.strokeText(label, lx, ly);
    ctx.fillStyle = "#111";
    ctx.fillText(label, lx, ly);

    // elevation in lighter grey under the name
    ctx.font = "13px Arial, sans-serif";
    const elT = `${p.ele} м`;
    const er = { x1: lx - 20, x2: lx + 20, y1: ly + 17, y2: ly + 32 };
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.strokeText(elT, lx, ly + 17);
    ctx.fillStyle = "#777";
    ctx.fillText(elT, lx, ly + 17);
    placed.push(er);
    ctx.font = "600 15px Arial, sans-serif";
  }

  // reset
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  return shown.length;
}

// ---- UI wiring ----
const slider = document.getElementById("ele");
const eleVal = document.getElementById("ele-val");
const countHint = document.getElementById("count-hint");
slider.min = 0;
slider.max = eleMax;

function update() {
  const v = +slider.value;
  eleVal.textContent = v;
  const n = render(v);
  countHint.textContent = `Видно вершин: ${n} из ${points.length} (диапазон высот ${eleMin}–${eleMax} м)`;
}

slider.addEventListener("input", update);

document.getElementById("save").addEventListener("click", () => {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `berlin-hills-${slider.value}m.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
});

update();
