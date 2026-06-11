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

## Запуск локально

```bash
npm install
npm run dev       # дев-сервер: / (холмы), /quiz.html, /germany.html
npm run build     # прод-сборка в dist/
npm run site      # самодостаточная сборка в docs/ (то, что публикуется)
```

## Публикуемый сайт

`node build-site.mjs` собирает папку `docs/`:

- `docs/index.html` — лендинг со ссылками на приложения;
- `docs/quiz.html` — тренажёр районов **(самодостаточный: CSS, JS и данные встроены)**;
- `docs/hills.html` — карта холмов Берлина **(самодостаточный)**;
- `docs/germany.html` — карта Германии. Сама страница лёгкая (~16 КБ), а данные
  грузятся отдельно и по требованию из `docs/germany/`:
  - `states.json` — границы 16 земель + счётчики (грузится сразу);
  - `hills/<slug>.json` — вершины земли (грузится при клике по земле);
  - `arms/<slug>.png` — герб земли (грузится при клике).

  Эти файлы генерируются из `src/data/` скриптом `scripts/build-germany-data.mjs`
  (его запускает и `build-site.mjs`, и `npm run dev` через `predev`).

GitHub Pages настроен на ветку `main`, папка `/docs`.

## Данные и скрипты

Скрипты подготовки данных в `scripts/` (источник — OpenStreetMap, ODbL):

| Скрипт | Что делает |
|---|---|
| `scripts/fetch-berlin-and-hills.mjs` | контур города (`berlin.json`) + холмы внутри границы (`hills.json`) |
| `scripts/fetch-boroughs.mjs` | контуры 12 округов (`boroughs.json`) по их OSM relation ID |
| `scripts/build-arms-json.mjs` | упаковка гербов `arms/*.png` → `arms.json` (data-URI) |
| `scripts/fetch-germany.mjs` | границы 16 земель (`germany.json`) + вершины по землям (`germany-hills.json`) |
| `scripts/build-germany-data.mjs` | разбивка данных в `public/germany/` (`states.json` + `hills/<slug>.json` + копии гербов) для ленивой загрузки |
| `scripts/test-quiz-logic.mjs` | headless-смоук-тест логики тренажёра |

Данные в `src/data/`:

- `berlin.json` — контур Берлина (GeoJSON Feature, MultiPolygon);
- `hills.json` — вершины `{ name, lat, lon, ele }`, 46–122 м;
- `boroughs.json` — 12 округов (FeatureCollection);
- `arms/*.png`, `arms.json` — гербы округов (Wikimedia Commons, общественное достояние);
- `arms-credits.json` — источники и лицензии гербов;
- `germany.json` — 16 федеральных земель (id, name, slug, geometry);
- `germany-hills.json` — вершины по землям `{ slug: [{ name, lat, lon, ele }] }`;
- `state-arms/*.png` — гербы земель; `state-arms/credits.json` — источники и лицензии.

`public/germany/` генерируется из этих файлов (см. выше) и не хранится в гите.

## Источники

- Границы и вершины: © OpenStreetMap contributors, [ODbL](https://opendatacommons.org/licenses/odbl/).
- Гербы округов: Wikimedia Commons, общественное достояние (официальные символы, §5 UrhG).
