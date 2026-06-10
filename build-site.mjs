// Builds the publishable static site into docs/ as fully self-contained HTML
// files (all CSS, JS and data inlined — no external requests, no build step
// needed to serve). docs/ is what GitHub Pages serves.
//
//   node build-site.mjs
import { readFileSync, writeFileSync, mkdirSync } from "fs";

mkdirSync("docs", { recursive: true });
const read = (p) => readFileSync(p, "utf8");
const stripImports = (js) => js.replace(/^\s*import .*$/gm, "").trimStart();

const page = ({ title, css, head = "", body, dataScript, appJs }) => `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
${css}
${head}
    </style>
  </head>
  <body>
${body}
    <script>
${dataScript}
    </script>
    <script>
${appJs}
    </script>
  </body>
</html>
`;

// ---------- 1. Hills map (index of the two apps lives separately) ----------
const hillsHtml = page({
  title: "Горы и холмы Берлина",
  css: read("src/style.css") + NAV_CSS(),
  body: `${nav("hills")}
    <div id="app">
      <div id="canvas-wrap"><canvas id="map"></canvas></div>
      <div id="controls">
        <div class="ctl">
          <label for="ele">Минимальная высота: <strong id="ele-val">0</strong> м</label>
          <input type="range" id="ele" min="0" max="125" step="1" value="0" />
          <div class="hint" id="count-hint"></div>
        </div>
        <button id="save">💾 Сохранить PNG</button>
      </div>
    </div>`,
  dataScript: `const berlin = ${read("src/data/berlin.json")};
const hills = ${read("src/data/hills.json")};`,
  appJs: stripImports(read("src/main.js")),
});
writeFileSync("docs/hills.html", hillsHtml);

// ---------- 2. Districts quiz ----------
const quizHtml = page({
  title: "Районы Берлина — тренажёр",
  css: read("src/quiz.css") + NAV_CSS(),
  body: `${nav("quiz")}
    <div id="app">
      <header>
        <h1>Районы Берлина</h1>
        <div id="modes">
          <button class="mode-btn active" data-mode="name">Что это за район?</button>
          <button class="mode-btn" data-mode="locate">Найди на карте</button>
        </div>
        <div id="score">
          <span>✅ <strong id="correct">0</strong></span>
          <span>❌ <strong id="wrong">0</strong></span>
          <span>🔥 <strong id="streak">0</strong></span>
        </div>
      </header>
      <p id="prompt"></p>
      <div id="board">
        <div id="map-wrap"><canvas id="map"></canvas></div>
        <div id="options"></div>
      </div>
      <div id="footer">
        <div id="feedback"></div>
        <button id="next" hidden>Дальше →</button>
      </div>
    </div>`,
  dataScript: `const boroughsFC = ${read("src/data/boroughs.json")};
const arms = ${read("src/data/arms.json")};`,
  appJs: stripImports(read("src/quiz.js")),
});
writeFileSync("docs/quiz.html", quizHtml);

// ---------- 3. Landing ----------
const landing = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Берлин — карты и тренажёр</title>
    <style>
      body { margin: 0; background: #f0f1f3; font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1a1a1a; }
      .wrap { max-width: 720px; margin: 0 auto; padding: 56px 20px; }
      h1 { font-size: 30px; margin: 0 0 8px; }
      p.sub { color: #555; margin: 0 0 32px; }
      .cards { display: grid; gap: 18px; grid-template-columns: 1fr 1fr; }
      @media (max-width: 560px) { .cards { grid-template-columns: 1fr; } }
      a.card { display: block; text-decoration: none; color: inherit; background: #fff; border-radius: 16px; padding: 26px; box-shadow: 0 2px 14px rgba(0,0,0,.08); transition: transform .12s, box-shadow .12s; }
      a.card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,.12); }
      a.card .emoji { font-size: 40px; }
      a.card h2 { font-size: 20px; margin: 12px 0 6px; }
      a.card p { margin: 0; color: #555; font-size: 14px; }
      footer { margin-top: 40px; color: #888; font-size: 12px; }
      footer a { color: #888; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>Берлин 🐻</h1>
      <p class="sub">Интерактивные карты и тренажёр по географии города.</p>
      <div class="cards">
        <a class="card" href="quiz.html">
          <div class="emoji">🧠</div>
          <h2>Районы Берлина</h2>
          <p>Тренажёр на запоминание 12 округов: угадай по карте или найди район по гербу.</p>
        </a>
        <a class="card" href="hills.html">
          <div class="emoji">🏔️</div>
          <h2>Горы и холмы</h2>
          <p>Карта вершин Берлина с фильтром по высоте и экспортом в PNG.</p>
        </a>
      </div>
      <footer>Данные: © OpenStreetMap (ODbL). Гербы округов — Wikimedia Commons (общественное достояние).</footer>
    </div>
  </body>
</html>
`;
writeFileSync("docs/index.html", landing);

// shared little top-nav for the two app pages
function nav(active) {
  const link = (href, label, key) =>
    `<a href="${href}"${active === key ? ' class="active"' : ""}>${label}</a>`;
  return `<nav class="topnav">
      ${link("index.html", "← Берлин", "home")}
      ${link("quiz.html", "Районы", "quiz")}
      ${link("hills.html", "Горы и холмы", "hills")}
    </nav>`;
}
function NAV_CSS() {
  return `
.topnav { display: flex; gap: 14px; padding: 12px 18px; background: #1a1a1a; }
.topnav a { color: #cfd2d6; text-decoration: none; font-size: 14px; font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
.topnav a.active, .topnav a:hover { color: #fff; }
`;
}

console.log("docs/ built: index.html, quiz.html, hills.html");
