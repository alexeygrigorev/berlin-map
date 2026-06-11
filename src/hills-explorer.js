// Generic "click a region → see its hills with an elevation slider" explorer,
// shared by the Germany and France maps (src/germany.js, src/france.js).
//
// Data is loaded on demand from a sibling folder (see build-country-data.mjs):
//   <base>/states.json        – region borders + counts (once, up front)
//   <base>/hills/<slug>.json   – a region's hills (on click)
//   <base>/arms/<slug>.png     – a region's coat of arms (on click)
// Relative paths resolve against the page URL, so this works in dev (vite
// serves public/ at /), in docs/ and under the GitHub Pages subpath alike.
//
// createHillsExplorer({ dataBase, title, pickSubtitle })
export function createHillsExplorer(config) {
  const DATA = config.dataBase; // e.g. "germany/" or "france/"
  const fileTag = DATA.replace(/\/$/, "");

  // ---- render resolution (internal canvas pixels) ----
  const W = 1600;
  const H = 1400;
  const MAP_TOP = 168;
  const MAP_BOTTOM = 56;
  const MAP_PAD_X = 48;

  const canvas = document.getElementById("map");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const D2R = Math.PI / 180;
  const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2));

  // ---- fit a Web-Mercator projection to a set of geometries ----
  function makeProjection(geoms) {
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
    geoms.forEach((g) => walk(g.coordinates));
    const availW = W - 2 * MAP_PAD_X;
    const availH = H - MAP_TOP - MAP_BOTTOM;
    const scale = Math.min(availW / (maxX - minX), availH / (maxY - minY));
    const offX = MAP_PAD_X + (availW - (maxX - minX) * scale) / 2;
    const offY = MAP_TOP + (availH - (maxY - minY) * scale) / 2;
    return (lon, lat) => [
      offX + (lon * D2R - minX) * scale,
      offY + (maxY - mercY(lat)) * scale,
    ];
  }

  function tracePolygons(geom, project) {
    ctx.beginPath();
    const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
    for (const poly of polys) {
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

  function pointInRing(px, py, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
        inside = !inside;
    }
    return inside;
  }

  // ---------- state (populated once states.json loads) ----------
  let states = [];
  let overviewProject = null;
  let overviewShapes = [];
  const hillsCache = {}; // slug -> hills[]

  const STATE_FILL = "#eef1f4";
  const STATE_FILL_HOVER = "#d9e6f2";
  const STATE_LINE = "#6b7785";
  let hoverSlug = null;

  function buildOverview() {
    overviewProject = makeProjection(states.map((s) => s.geometry));
    overviewShapes = states.map((s) => {
      const polys =
        s.geometry.type === "Polygon" ? [s.geometry.coordinates] : s.geometry.coordinates;
      const screenPolys = polys.map((poly) =>
        poly.map((ring) => ring.map(([lon, lat]) => overviewProject(lon, lat)))
      );
      let cx = 0, cy = 0, n = 0;
      screenPolys.forEach((poly) => poly[0].forEach(([x, y]) => { cx += x; cy += y; n++; }));
      return { state: s, screenPolys, label: [cx / n, cy / n], count: s.count };
    });
  }

  function stateAt(px, py) {
    for (const sh of overviewShapes) {
      for (const poly of sh.screenPolys) {
        if (pointInRing(px, py, poly[0])) {
          let hole = false;
          for (let k = 1; k < poly.length; k++)
            if (pointInRing(px, py, poly[k])) hole = true;
          if (!hole) return sh.state.slug;
        }
      }
    }
    return null;
  }

  function renderOverview() {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#111";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "700 46px Georgia, 'Times New Roman', serif";
    ctx.fillText(config.title, MAP_PAD_X, 70);
    ctx.font = "italic 22px Georgia, serif";
    ctx.fillStyle = "#555";
    ctx.fillText(config.pickSubtitle, MAP_PAD_X, 104);

    for (const sh of overviewShapes) {
      ctx.beginPath();
      for (const poly of sh.screenPolys) {
        for (const ring of poly) {
          ring.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
          ctx.closePath();
        }
      }
      ctx.fillStyle = sh.state.slug === hoverSlug ? STATE_FILL_HOVER : STATE_FILL;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.strokeStyle = STATE_LINE;
      ctx.stroke();
    }

    ctx.textAlign = "center";
    for (const sh of overviewShapes) {
      const [lx, ly] = sh.label;
      const name = sh.state.name;
      ctx.font = "700 19px Arial, sans-serif";
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.textBaseline = "alphabetic";
      ctx.strokeText(name, lx, ly);
      ctx.fillStyle = "#1a2733";
      ctx.fillText(name, lx, ly);

      ctx.font = "15px Arial, sans-serif";
      const sub = `▲ ${sh.count}`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.strokeText(sub, lx, ly + 19);
      ctx.fillStyle = "#5a6675";
      ctx.fillText(sub, lx, ly + 19);
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  // ---------- DETAIL (one region) ----------
  let detailState = null;
  let detailProject = null;
  let detailPoints = [];
  let detailEle = { min: 0, max: 0 };

  function triSize(ele) {
    const t = (ele - detailEle.min) / (detailEle.max - detailEle.min || 1);
    return 7 + t * 11;
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

  async function loadHills(slug) {
    if (hillsCache[slug]) return hillsCache[slug];
    const res = await fetch(DATA + "hills/" + slug + ".json");
    if (!res.ok) throw new Error(`hills ${slug}: HTTP ${res.status}`);
    const hills = await res.json();
    hillsCache[slug] = hills;
    return hills;
  }

  function detailHeader(subtitle) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#111";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "700 46px Georgia, 'Times New Roman', serif";
    ctx.fillText(`ГОРЫ И ХОЛМЫ · ${detailState.name.toUpperCase()}`, MAP_PAD_X, 70);
    ctx.font = "italic 22px Georgia, serif";
    ctx.fillStyle = "#555";
    ctx.fillText(subtitle, MAP_PAD_X, 104);
    tracePolygons(detailState.geometry, detailProject);
    ctx.fillStyle = "#fbfbfb";
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1a1a1a";
    ctx.stroke();
  }

  async function enterDetail(slug) {
    detailState = states.find((s) => s.slug === slug);
    detailProject = makeProjection([detailState.geometry]);
    view = "detail";
    document.body.classList.add("in-detail");
    canvas.style.cursor = "default";
    hoverSlug = null;
    backBtn.hidden = false;
    controls.hidden = true;
    saveBtn.hidden = true;
    emptyNote.hidden = true;
    armBadge.src = DATA + "arms/" + slug + ".png";
    armBadge.hidden = false;

    detailHeader("загрузка вершин…");

    let hills;
    try {
      hills = await loadHills(slug);
    } catch (e) {
      if (view === "detail" && detailState.slug === slug)
        detailHeader("не удалось загрузить вершины — попробуйте ещё раз");
      return;
    }
    if (view !== "detail" || detailState.slug !== slug) return;

    detailPoints = hills.map((h) => {
      const [x, y] = detailProject(h.lon, h.lat);
      return { ...h, x, y };
    });
    if (hills.length) {
      detailEle.min = Math.min(...hills.map((h) => h.ele));
      detailEle.max = Math.max(...hills.map((h) => h.ele));
    } else {
      detailEle.min = 0;
      detailEle.max = 0;
    }
    controls.hidden = hills.length === 0;
    saveBtn.hidden = hills.length === 0;
    emptyNote.hidden = hills.length > 0;
    slider.min = detailEle.min;
    slider.max = detailEle.max;
    slider.value = detailEle.min;
    update();
  }

  function renderDetail(minEle) {
    const shown = detailPoints.filter((p) => p.ele >= minEle);
    detailHeader(
      `высота ≥ ${minEle} м · показано ${shown.length} из ${detailPoints.length}`
    );

    drawTriangle(MAP_PAD_X + 12, 138, 10);
    ctx.font = "20px Georgia, serif";
    ctx.fillStyle = "#333";
    ctx.textBaseline = "middle";
    ctx.fillText("— холм / гора", MAP_PAD_X + 32, 139);
    ctx.textBaseline = "alphabetic";

    const placed = [];
    const ordered = [...shown].sort((a, b) => b.ele - a.ele);
    for (const p of ordered) drawTriangle(p.x, p.y, triSize(p.ele));

    ctx.font = "600 15px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    let budget = 90; // cap labels so the densest regions stay readable
    for (const p of ordered) {
      if (budget <= 0) break;
      const s = triSize(p.ele);
      const w = ctx.measureText(p.name).width;
      const lx = p.x, ly = p.y + s * 0.75 + 3;
      const rect = { x1: lx - w / 2, x2: lx + w / 2, y1: ly, y2: ly + 17 };
      if (placed.some((r) => rectsOverlap(rect, r))) continue;
      placed.push(rect);
      budget--;

      ctx.font = "600 15px Arial, sans-serif";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.strokeText(p.name, lx, ly);
      ctx.fillStyle = "#111";
      ctx.fillText(p.name, lx, ly);

      ctx.font = "13px Arial, sans-serif";
      const elT = `${p.ele} м`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.strokeText(elT, lx, ly + 17);
      ctx.fillStyle = "#777";
      ctx.fillText(elT, lx, ly + 17);
      placed.push({ x1: lx - 20, x2: lx + 20, y1: ly + 17, y2: ly + 32 });
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    return shown.length;
  }

  // ---------- UI ----------
  let view = "overview";
  const slider = document.getElementById("ele");
  const eleVal = document.getElementById("ele-val");
  const countHint = document.getElementById("count-hint");
  const backBtn = document.getElementById("back");
  const saveBtn = document.getElementById("save");
  const controls = document.getElementById("controls");
  const emptyNote = document.getElementById("empty-note");
  const armBadge = document.getElementById("arm-badge");

  function update() {
    if (view === "overview") {
      renderOverview();
      return;
    }
    const v = +slider.value;
    eleVal.textContent = v;
    const n = renderDetail(v);
    countHint.textContent =
      detailPoints.length === 0
        ? ""
        : `Видно вершин: ${n} из ${detailPoints.length} (диапазон высот ${detailEle.min}–${detailEle.max} м)`;
  }

  function goOverview() {
    view = "overview";
    document.body.classList.remove("in-detail");
    backBtn.hidden = true;
    saveBtn.hidden = true;
    controls.hidden = true;
    emptyNote.hidden = true;
    armBadge.hidden = true;
    renderOverview();
  }

  slider.addEventListener("input", update);
  backBtn.addEventListener("click", goOverview);

  function toCanvas(ev) {
    const r = canvas.getBoundingClientRect();
    return [((ev.clientX - r.left) / r.width) * W, ((ev.clientY - r.top) / r.height) * H];
  }

  canvas.addEventListener("mousemove", (ev) => {
    if (view !== "overview") return;
    const [x, y] = toCanvas(ev);
    const slug = stateAt(x, y);
    canvas.style.cursor = slug ? "pointer" : "default";
    if (slug !== hoverSlug) {
      hoverSlug = slug;
      renderOverview();
    }
  });

  canvas.addEventListener("click", (ev) => {
    if (view !== "overview") return;
    const [x, y] = toCanvas(ev);
    const slug = stateAt(x, y);
    if (slug) enterDetail(slug);
  });

  saveBtn.addEventListener("click", () => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileTag}-hills-${detailState ? detailState.slug : "map"}-${slider.value}m.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  });

  // ---------- boot ----------
  function bootMessage(text) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#555";
    ctx.font = "italic 26px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText(text, W / 2, H / 2);
    ctx.textAlign = "left";
  }

  bootMessage("загрузка карты…");
  fetch(DATA + "states.json")
    .then((r) => {
      if (!r.ok) throw new Error(`states.json: HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      states = data.states;
      buildOverview();
      goOverview();
    })
    .catch(() => bootMessage("не удалось загрузить данные карты"));
}
