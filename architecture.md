# Architecture — «Кафе чарівних тортів»

Cozy Match-3 RPG (MVP). Web-гра на **Phaser 3** + HTML5 Canvas.

Останнє оновлення: win-умови за `target_type` (cakes/coffee/guests/combo_target/layered_cake/clear_obstacles), `tile_weights`, `allowed_helpers`, `moves_limit`, `obstacles[].count`, показ `name` в оверлеї завдання. Контракт конфігу — `TZ_LEVELS.md`.

---

## 1. Огляд системи

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                             │
│  ┌─────────────┐   ┌──────────────────────────────────┐ │
│  │ index.html  │──▶│  Phaser 3 Game (game.js)          │ │
│  └─────────────┘   │  Boot → Menu → Game scenes        │ │
│                    └───────────┬──────────────────────┘ │
│                                │                         │
│                    ┌───────────▼───────────┐             │
│                    │  assets/ + levels.json │             │
│                    └───────────────────────┘             │
└─────────────────────────────────────────────────────────┘
         ▲
         │  python3 server.py  (localhost:8080)
```

| Шар | Технологія | Призначення |
|-----|------------|-------------|
| Presentation | Phaser 3 (Canvas/WebGL) | Рендер, input, tweens |
| Game logic | Vanilla JS у `game.js` | Match-3, ланцюжок, інструменти, HUD |
| Data | `levels.json` | Конфіг 53 рівнів |
| Assets | PNG 128×128 + bg.jpg | Тайли, персонажі (bg лише в Menu) |
| Dev server | `server.py` | Локальна роздача + no-cache |

---

## 2. Структура файлів

```
game/
├── index.html
├── game.js                 # уся логіка
├── levels.json             # 53 рівні
├── server.py
├── architecture.md
└── assets/
    ├── bg.jpg              # лише MenuScene
    ├── sprites.png         # sheet 512×512 (4×4 × 128)
    └── tiles/              # рівно 128×128, без trim
        ├── flour, milk, spice, butter
        ├── strawberry, blueberry
        ├── coffee, rollingpin, spatula
        ├── cookie, croissant, cupcake, cake
        └── owl, fox, dragon
```

---

## 3. Сцени Phaser

```
BootScene  →  preload
     │
     ▼
MenuScene  →  bg.jpg + «Почати гру»
     │
     ▼
GameScene  →  геймплей (без bg, нейтральний #f5e6c8)
     ├─ Victory → next level / menu
     └─ Defeat  → retry
```

---

## 4. Розміри (мобільний-friendly)

| Константа | Значення |
|-----------|----------|
| `TILE_SIZE` | **128** (нативний розмір спрайта, без setDisplaySize) |
| `GRID_SIZE` | 7 |
| `BOARD_W/H` | **896** (7×128) |
| `GAME_W` | 960 |
| `GAME_H` | ~1522 (BOARD_OFFSET_Y 376 + поле 896 + хелпери 250) |
| HUD | білий блок зверху 376px, лічильники інгредієнтів **в один рядок 1×4** (іконки 96px), шрифти 48–80px |
| Helpers | кола r=68, зображення **122px**, % 28px |

Scale mode: `Phaser.Scale.FIT` + `CENTER_BOTH`.

---

## 5. Типи тайлів

```
BASIC (інґредієнти → старт ланцюжка):
  FLOUR(0)  MILK(1)  SPICE(2)  BUTTER(3)

BONUS (ягоди):
  STRAWBERRY(4)  BLUEBERRY(5)

FILLERS / TOOLS (розрідження + суперходи):
  COFFEE(6)  ROLLINGPIN(7)  SPATULA(8)

BAKERY (лише зі матчів, не з random fill):
  COOKIE(9)      // корж / печиво
  CROISSANT(10)
  CUPCAKE(11)
  CAKE(12)

EMPTY: -1
```

### Random fill (`randomBasic`)

Розподіл тайлів задається рівнем через `tile_weights` (сума = 1.0). Дефолт, якщо поле відсутнє:

```
flour 16% | milk 16% | spice 14% | butter 14%
coffee 10% | rollingpin 8% | spatula 8%
strawberry 7% | blueberry 7%
```

Скалка/лопатка спавняться лише якщо дозволені рівнем (`tools`); інакше їх вага обнуляється.
Випічка **ніколи** не падає згори — лише spawn після матчу.

---

## 6. Ланцюжок випічки

```
BASIC
  Match-3 → COOKIE (корж)
  Match-4 → CROISSANT
  Match-5 → CUPCAKE
  MILK Match-4+ → BUTTER (масло з молока)

COOKIE
  Match-3 → CROISSANT
  Match-4+ → CUPCAKE

CROISSANT
  Match-3 → CUPCAKE
  Match-4+ → CAKE (+1 до цілі)

CUPCAKE
  Match-3+ → CAKE (+1 до цілі)

CAKE
  Match-3+ → кожен торт +1 до цілі

ЯГОДИ (bake-обмін)
  STRAWBERRY Match-3+ → BLUEBERRY (полуниця → лохина)
  BLUEBERRY Match-3+ → STRAWBERRY (лохина → полуниця)

**Торти на полі не лишаються**: щойно CAKE утворюється (CROISSANT/CUPCAKE матч, дракончик) — він одразу летить на лічильник тортів (`gainCakes`) і не може бути поєднаний повторно.
```

### Інгредієнти → торт

Коли **всі 4 лічичники** (flour/milk/butter/berries) досягають квот `ingredient_goals`:

- поверх екрана з'являється торт, зменшується і відлітає на лічильник тортів;
- `cakesCollected +1`, лічильник тортів оновлюється з pop-анімацією;
- лічильники інгредієнтів скидаються до 0 — цикл повторюється.

Кожен лічичник, що досягнув квоти, позначається зеленим `✓`.

> **Таймер**: 120 с (2 хв) на всіх рівнях (`timer_seconds`). Кожен спечений торт (будь-яким шляхом) повністю перезапускає таймер на `timer_seconds` — arcade-режим «встигни спекти торт за час». Логування: `timer_reset`.

---

## 7. Інструменти (суперходи)

| Матч | Ефект |
|------|--------|
| **3+ ROLLINGPIN (скалка)** | Усі FLOUR на полі → COOKIE (+бонус таймера) |
| **3+ SPATULA (лопатка)** | Усі COOKIE на полі → CUPCAKE (+бонус таймера) |
| COFFEE Match-3+ | +час |

Конвертація виконується після очищення групи матчу, **до** `applyGravity`, з тостом і записом у лог (`type: "convert"`).

### Інструменти по рівнях

Квота інструментів — у `levels.json → tools`. `randomBasic` дає скалку/лопатку лише якщо вони дозволені рівнем:

| Рівень | tools |
|--------|-------|
| 1 | немає (тільки класика) |
| 2 | `["rollingpin"]` |
| 3 | `["spatula"]` |
| 4+ | `["rollingpin", "spatula"]` |

На старті рівня послідовно показуються оверлеї: знайомство з новими інструментами (зображення + ефект) показується **лише один раз** (кожен інструмент — при першій появі, трекінг у `announcedTools`), потім завдання (торт + необхідна кількість). Поки оверлеї видно — таймер не запущено, поле заблоковане.

---

## 8. Цикл ходу

```
pointerdown → select / trySwap
    │
    ├─ swap + tween
    ├─ findAllMatches()      // прямі рядки/стовпці ≥3
    ├─ splitIntoGroups()     // зв'язані групи одного типу
    ├─ resolveMatches()
    │     ├─ зарядка / час / spawn ланцюжка
    │     ├─ flags: convertFlourToCookie / convertCookieToCupcake
    │     ├─ pop-анімація → EMPTY
    │     ├─ apply spawns + board-wide convert
    │     └─ applyGravity()
    └─ cascade / checkPossibleMoves / checkVictory
```

**Auto-Reshuffle**: якщо немає валідного ходу — перемішуються **всі** комірки, включно з випічкою користувача (COOKIE/CROISSANT/CUPCAKE/CAKE); кількість кожного типу зберігається.

**Підказка (hint)**: якщо гравець не ходить > 5 сек — `checkIdleHint` знаходить валідний своп через `findHintMove()` і підсвічує жовтим пару тайлів (без тексту). Ховається при будь-якому тапі (`hideHint`).

---

## 9. Помічники

| Персонаж | Ресурс | Ефект |
|----------|--------|--------|
| Сова | FLOUR | Freeze timer 10 с |
| Лисичка | SPICE | Reshuffle |
| Дракончик | MILK | CUPCAKE → CAKE |

Заряд 0…100 (~15–20 тайлів до повного). UI знизу під полем.

---

## 10. HUD (GameScene)

```
┌────────────────────────────────────────┐
│              Рівень N   (50px)         │
│   🎂 2/5 · 🧁 3/8  або  ☕ 5/8 …      │
│   (рядок цілі, 72px / 56px)            │
│   ⏱ 01:24  або  Ходи: 17   (64px)     │
│  🌾10/10✓ 🥛3/3✓ 🧈5/5 🍓5/5          │
│  (один рядок 1×4, іконки 96px)        │
├────────────────────────────────────────┤
│          поле 896×896                  │
│      (рамка, без bg.jpg)               │
├────────────────────────────────────────┤
│  🦉 %    🦊 %    🐉 %           Log   │
│  (лише дозволені помічники)           │
└────────────────────────────────────────┘
```

HUD — білий блок зверху (висота 376px). Рядок цілі залежить від `target_type`:
`cakes` → 🎂 a/N, `coffee` → ☕ a/N, `guests` → «Гості: a/A» (+ інгредієнтні слоти з `target_details`),
`combo_target` → 🎂 a/A · 🧁 b/B, `layered_cake` → 🎂 l/N · 🧁 c/(N×3),
`clear_obstacles` → 🔥 a/A 🧊 b/B 📦 c/C.

Ряд інгредієнтів будується динамічно (`hudIngredientFields`): для `guests` — лише цільові інгредієнти з `target_details` (макс 4), для решти — flour/milk/butter/berries. Для `guests` бонус «+1 торт за лічильники» вимкнено (інакше скидало б прогрес цілі).

Помічники — лише з `allowed_helpers` (без дракончика/лисички їх кола не малюються і заряд не копиться). У режимі `moves_limit` рядок таймера показує лічильник ходів.

Фон ігрової сцени: `#f5e6c8`. `bg.jpg` використовується лише в Menu.

**Шрифт**: `Balsamiq Sans` (Google Fonts, підтримує кирилицю) — задається глобально через хелпер `makeText(scene, x, y, str, style)` у `game.js`.

---

## 11. Логування

`window.gameLog` — події:

| type | Зміст |
|------|--------|
| `level_start` / `level_end` | старт / victory\|defeat |
| `swap` | from/to, valid |
| `match` | size, kind, tileType, spawn, special, cakesGained |
| `convert` | tool, from, to, count |
| `ingredient_cake` | +1 торт за повні лічильники |
| `helper` / `reshuffle` / `timer` | стан |

Кнопка Log → summary + download JSON.

---

## 12. Рівні (`levels.json`)

Повний контракт полів — **`TZ_LEVELS.md` (розділ 2)**. Тут — короткий підсумок:

```json
{
  "level": 31,
  "name": "Весільний заказ",
  "timer_seconds": 110,
  "moves_limit": null,
  "target_type": "layered_cake",
  "target_count": 2,
  "target_details": { "cupcakes_needed": 3 },
  "obstacles": [
    { "type": "burnt", "count": 3 },
    { "type": "ice",   "count": 2 }
  ],
  "tile_weights": {
    "flour": 0.15, "milk": 0.15, "spice": 0.13, "butter": 0.13,
    "coffee": 0.12, "rollingpin": 0.06, "spatula": 0.06,
    "strawberry": 0.10, "blueberry": 0.10
  },
  "berry_type": "strawberry",
  "allowed_helpers": ["owl", "fox"],
  "tools": ["rollingpin", "spatula"],
  "ingredient_goals": { "flour": 20, "milk": 20, "butter": 15, "berries": 10 },
  "description": "…"
}
```

### Win-умови (`target_type`)

| Тип | Умова перемоги |
|-----|----------------|
| `cakes` | `cakesCollected >= target_count` |
| `coffee` | `coffeeCollected >= target_count` (лічиться кожен зібраний тайл кави) |
| `guests` | кожен інгредієнт з `target_details` досягнуто (flour/milk/spice/butter/berries) |
| `combo_target` | `cakesCollected >= details.cakes` **і** `cupcakesCollected >= details.cupcakes` |
| `layered_cake` | `floor(cupcakesCollected / details.cupcakes_needed) >= target_count` (1 багатоярусний = 3 капкейки) |
| `clear_obstacles` | кожен тип у `target_details` прибрано (burnt/ice/box) |

`cupcakesCollected` зростає при матчі CUPCAKE і при дракончику; у `layered_cake` при утворенні чергового ярусу — тост «Багатоярусний торт готовий!».

### Перешкоди (`obstacles`)

Масив; кожен елемент — `{ type, count }` (випадкова розкладка без накладок) або `{ type, cells }` (фіксовані клітинки):

```json
"obstacles": [
  { "type": "ice",   "count": 3 },
  { "type": "box",   "cells": [[1,5],[4,1]] },
  { "type": "burnt", "cells": [[5,5]] }
]
```

- **ice (лід)** — напівпрозоре покриття **поверх звичайного тайла** (кадр 16); тайл заморожений: не бере участі в матчах, свапах і гравітації. Знімається одним сусіднім матчем. `count`-розкладка ставить лід лише на непусті тайли, без інструментів/кави.
- **box (коробка)** — закрита (кадр 17) → 1 хіт → відкрита з капкейком (кадр 18) → 2-й хіт → **капкейк** (справжній тайл, потрапляє в гру).
- **burnt (пригоріле)** — 1 хіт і зникає (кадр 19).

Правила: перешкода отримує **максимум 1 хіт за матч**, якщо будь-який тайл матчу сусідній до неї (4 напрямки). Перешкоди не рухаються, не свапаються, не зникають від інструментів (скалка/лопатка), лишаються на місці при перемішуванні (лід не переставляється). Гравітація **сегментована**: перешкоди ділять колонку на сегменти, тайли падають лише в межах сегмента; після зняття перешкоди верхній сегмент провалюється нижче. Ініціалізація: `initGrid → placeObstacles → drawGrid → applyGravity` (перша гравітація закриває «дірки» від коробок/пригорілих). Умова `clear_obstacles` вважає лише зламані перешкоди (box — лише повністю зняті).

---

## 13. Запуск

```bash
cd game
python3 server.py
# http://localhost:8080
```

---

## 14. Обмеження MVP

1. Немає tween-падіння по клітинках (миттєвий `drawGrid` після гравітації).
2. Немає звуку / частинок (іскри — текстура-частинки, без аудіо).
3. Монолітний `game.js` — при рості розбити на модулі.
4. `levels.json` містить 53 фінальні рівні (вал. 0 помилок).

---

## 15. Roadmap

| Крок | Зміст | Статус |
|------|--------|--------|
| A | Лічильники інгредієнтів у HUD + квоти в levels.json | ✅ |
| B | Win-умови за `target_type` (coffee/guests/combo/layered/clear) | ✅ |
| C | `tile_weights`, `allowed_helpers`, `moves_limit`, `name` | ✅ |
| D | `obstacles[].count` (випадкова розкладка без накладок) | ✅ |
| E | 53 рівні від data-розробника + `validate_levels.js` | ✅ |
| F | Tween-гравітація, juice, звук | ○ |
| G | ES modules / atlas | ○ |

---

*Документ відповідає стану коду з ланцюжком корж→торт, інструментами скалка/лопатка та мобільним HUD.*
