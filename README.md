# Берлин 🐻 — карты и тренажёр

Два маленьких веб-приложения на чистом JavaScript + Canvas (без фреймворков),
с географически точными данными из OpenStreetMap.

🌐 **Онлайн:** https://alexeygrigorev.com/berlin-map/

- **🧠 Районы Берлина** — тренажёр на запоминание 12 округов (Bezirke):
  - «Что это за район?» — округ подсвечен на карте, выбери название из 4 вариантов (с гербами);
  - «Найди на карте» — показывается герб и название, нужно кликнуть нужный округ.
  - Счёт верных/неверных ответов и серия подряд.
- **🏔️ Горы и холмы** — контур Берлина и его вершины (треугольники), слайдер
  фильтрации по высоте и кнопка экспорта в PNG.
- **🇩🇪 Горы и холмы Германии** — карта всех 16 федеральных земель: кликаешь по
  земле → открывается её контур со всеми именованными вершинами (29 928 штук),
  герб земли в углу, слайдер фильтрации по высоте и экспорт в PNG.
- **🇫🇷 Горы и холмы Франции** — то же самое для 13 регионов метрополии (17 344
  вершины), герб региона в углу. Та же логика, общий модуль `src/hills-explorer.js`.

## Запуск локально

```bash
npm install
npm run dev       # дев-сервер: / (холмы), /quiz.html, /germany.html, /france.html
npm run build     # прод-сборка в dist/
npm run site      # самодостаточная сборка в docs/ (то, что публикуется)
```

## Публикуемый сайт

`node build-site.mjs` собирает папку `docs/`:

- `docs/index.html` — лендинг со ссылками на приложения;
- `docs/quiz.html` — тренажёр районов **(самодостаточный: CSS, JS и данные встроены)**;
- `docs/hills.html` — карта холмов Берлина **(самодостаточный)**;
- `docs/germany.html` и `docs/france.html` — карты Германии и Франции. Сама
  страница лёгкая (~18 КБ), а данные грузятся отдельно и по требованию из
  `docs/germany/` (и `docs/france/`):
  - `states.json` — границы регионов + счётчики (грузится сразу);
  - `hills/<slug>.json` — вершины региона (грузится при клике);
  - `arms/<slug>.png` — герб региона (грузится при клике).

  Эти файлы генерируются из `src/data/` скриптом `scripts/build-country-data.mjs`
  (его запускает и `build-site.mjs`, и `npm run dev` через `predev`). Обе карты
  используют один общий модуль `src/hills-explorer.js` — тонкие обёртки
  `src/germany.js` / `src/france.js` лишь задают заголовок и папку данных.

GitHub Pages настроен на ветку `main`, папка `/docs`.

## Данные и скрипты

Скрипты подготовки данных в `scripts/` (источник — OpenStreetMap, ODbL):

| Скрипт | Что делает |
|---|---|
| `scripts/fetch-berlin-and-hills.mjs` | контур города (`berlin.json`) + холмы внутри границы (`hills.json`) |
| `scripts/fetch-boroughs.mjs` | контуры 12 округов (`boroughs.json`) по их OSM relation ID |
| `scripts/build-arms-json.mjs` | упаковка гербов `arms/*.png` → `arms.json` (data-URI) |
| `scripts/fetch-germany.mjs` | границы 16 земель (`germany.json`) + вершины (`germany-hills.json`) |
| `scripts/fetch-france.mjs` | границы 13 регионов (`france.json`) + вершины (`france-hills.json`) |
| `scripts/build-country-data.mjs` | разбивка данных в `public/<country>/` (`states.json` + `hills/<slug>.json` + копии гербов) для ленивой загрузки |
| `scripts/test-quiz-logic.mjs` | headless-смоук-тест логики тренажёра |

Данные в `src/data/`:

- `berlin.json` — контур Берлина (GeoJSON Feature, MultiPolygon);
- `hills.json` — вершины `{ name, lat, lon, ele }`, 46–122 м;
- `boroughs.json` — 12 округов (FeatureCollection);
- `arms/*.png`, `arms.json` — гербы округов (Wikimedia Commons, общественное достояние);
- `arms-credits.json` — источники и лицензии гербов;
- `germany.json` / `france.json` — регионы (id, name, slug, geometry);
- `germany-hills.json` / `france-hills.json` — вершины по регионам `{ slug: [{ name, lat, lon, ele }] }`;
- `state-arms/*.png` — гербы земель ФРГ; `france-arms/*.png` — блазоны регионов Франции;
  рядом `credits.json` — источники и лицензии.

`public/germany/` и `public/france/` генерируются из этих файлов (см. выше) и не хранятся в гите.

## Источники

- Границы и вершины: © OpenStreetMap contributors, [ODbL](https://opendatacommons.org/licenses/odbl/).
- Гербы округов и земель ФРГ: Wikimedia Commons, общественное достояние (официальные символы, §5 UrhG).
- Блазоны регионов Франции: Wikimedia Commons (см. `src/data/france-arms/credits.json` — PD / CC BY-SA).
