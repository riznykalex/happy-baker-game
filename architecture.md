# Architecture — «Кафе: Торти за часом»

Cozy Match-3 RPG (MVP). Web-гра на **Phaser 3** + HTML5 Canvas.

Останнє оновлення: хелпери −25%, таймер 120 с на всіх рівнях, анонс інструментів один раз, лохина в цілях на рівнях 6/8/9, шрифт Balsamiq Sans.

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
| Data | `levels.json` | Конфіг 10 рівнів |
| Assets | PNG 128×128 + bg.jpg | Тайли, персонажі (bg лише в Menu) |
| Dev server | `server.py` | Локальна роздача + no-cache |

---

## 2. Структура файлів

```
game/
├── index.html
├── game.js                 # уся логіка
├── levels.json             # 10 рівнів
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
| `GAME_H` | ~1472 (BOARD_OFFSET_Y 376 + поле 896 + хелпери 200) |
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

```
flour 16% | milk 16% | spice 14% | butter 14%
coffee 10% | rollingpin 8% | spatula 8%
strawberry 7% | blueberry 7%
```

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

**Auto-Reshuffle**: якщо немає валідного ходу — перемішуються BASIC+BONUS+FILLER; випічка лишається.

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
│          🎂 2/5        (80px)         │
│          ⏱ 01:24      (64px)           │
│  🌾10/10✓ 🥛3/3✓ 🧈5/5 🍓5/5          │
│  (один рядок 1×4, іконки 96px)        │
├────────────────────────────────────────┤
│          поле 896×896                  │
│      (рамка, без bg.jpg)               │
├────────────────────────────────────────┤
│  🦉 %    🦊 %    🐉 %           Log   │
│  (кола r=68, зображення 122px)        │
└────────────────────────────────────────┘
```

HUD — білий блок зверху (висота 376px), лічильники інгредієнтів оновлюються з матчів FLOUR/MILK/BUTTER/ягід. Квоти беруться з `levels.json → ingredient_goals` (за замовчуванням: flour 10, milk 3, butter 5, berries 5). Якщо рівень задає `berry_type: "blueberry"` (рівні 6/8/9) — лічильник ягід вважає лише лохину (іконка змінюється на лохину), інакше — будь-яку ягоду. Лічичник, що досягнув квоти: іконка сіріє (tint), поруч з'являється зелена `✓`.

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

```json
{
  "level": 1,
  "timer_seconds": 120,
  "target_type": "cakes",
  "target_count": 5,
  "obstacle_tiles": 0,
  "allowed_helpers": ["owl", "fox", "dragon"],
  "ingredient_goals": { "flour": 10, "milk": 3, "butter": 5, "berries": 5 },
  "tools": ["rollingpin", "spatula"],
  "description": "…"
}
```

`ingredient_goals` та `tools` опціональні: без `ingredient_goals` діють дефолти (flour 10, milk 3, butter 5, berries 5), без `tools` інструменти не спавняться. `berry_type` (опційно, рівні 6/8/9 = `blueberry`) — яка саме ягода йде в ціль збору.

MVP win-condition: `cakesCollected >= target_count` (тип `cakes`).
Інші `target_type` — заготовки під наступні ітерації.

---

## 13. Запуск

```bash
cd game
python3 server.py
# http://localhost:8080
```

---

## 14. Обмеження MVP

1. Не всі `target_type` мають окрему логіку перемоги.
2. Немає tween-падіння по клітинках (миттєвий `drawGrid` після гравітації).
3. Немає звуку / частинок.
4. Лічильники інгредієнтів (flour/milk/butter/berries) відображаються в HUD, але поки не впливають на win/lose-умови.
5. Монолітний `game.js` — при рості розбити на модулі.

---

## 15. Roadmap

| Крок | Зміст |
|------|--------|
| A | ✅ Лічильники інгредієнтів у HUD + квоти в levels.json |
| B | Інгредієнти як win/lose-умова на рівнях 2–10 |
| C | Tween-гравітація, juice, звук |
| D | Повна логіка рівнів 2–10 (coffee, clean_burnt, guests…) |
| E | ES modules / atlas |

---

*Документ відповідає стану коду з ланцюжком корж→торт, інструментами скалка/лопатка та мобільним HUD.*
