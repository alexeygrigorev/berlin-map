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

## Запуск локально

```bash
npm install
npm run dev       # дев-сервер: / (карта холмов) и /quiz.html (тренажёр)
npm run build     # прод-сборка в dist/
```

## Публикуемый сайт

`node build-site.mjs` собирает папку `docs/` — три **самодостаточных** HTML-файла
(весь CSS, JS и данные встроены, никаких внешних запросов):

- `docs/index.html` — лендинг со ссылками на оба приложения;
- `docs/quiz.html` — тренажёр районов;
- `docs/hills.html` — карта холмов.

GitHub Pages настроен на ветку `main`, папка `/docs`.

## Данные и скрипты

Скрипты подготовки данных в `scripts/` (источник — OpenStreetMap, ODbL):

| Скрипт | Что делает |
|---|---|
| `scripts/fetch-berlin-and-hills.mjs` | контур города (`berlin.json`) + холмы внутри границы (`hills.json`) |
| `scripts/fetch-boroughs.mjs` | контуры 12 округов (`boroughs.json`) по их OSM relation ID |
| `scripts/build-arms-json.mjs` | упаковка гербов `arms/*.png` → `arms.json` (data-URI) |
| `scripts/test-quiz-logic.mjs` | headless-смоук-тест логики тренажёра |

Данные в `src/data/`:

- `berlin.json` — контур Берлина (GeoJSON Feature, MultiPolygon);
- `hills.json` — вершины `{ name, lat, lon, ele }`, 46–122 м;
- `boroughs.json` — 12 округов (FeatureCollection);
- `arms/*.png`, `arms.json` — гербы округов (Wikimedia Commons, общественное достояние);
- `arms-credits.json` — источники и лицензии гербов.

## Источники

- Границы и вершины: © OpenStreetMap contributors, [ODbL](https://opendatacommons.org/licenses/odbl/).
- Гербы округов: Wikimedia Commons, общественное достояние (официальные символы, §5 UrhG).
