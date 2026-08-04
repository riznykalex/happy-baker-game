# Architecture — «Кафе: Торти за часом»

Cozy Match-3 RPG (MVP). Web-гра на **Phaser 3** + HTML5 Canvas.

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
| Game logic | Vanilla JS у `game.js` | Match-3, гравітація, помічники, HUD |
| Data | `levels.json` | Конфіг 10 рівнів |
| Assets | PNG 128×128 + bg.jpg | Тайли, персонажі, фон |
| Dev server | `server.py` (stdlib http) | Локальна роздача + no-cache |

---

## 2. Структура файлів

```
game/
├── index.html          # Точка входу, CDN Phaser 3.80
├── game.js             # Уся ігрова логіка (~1000 рядків)
├── levels.json         # 10 рівнів MVP
├── server.py           # Локальний HTTP-сервер :8080
├── architecture.md     # Цей документ
└── assets/
    ├── bg.jpg          # Ізометричний інтер'єр пекарні
    ├── sprites.png     # Sheet 512×512 (4×4 × 128px)
    └── tiles/          # Нарізані спрайти 128×128
        ├── flour.png, milk.png, spice.png, butter.png
        ├── strawberry.png, blueberry.png
        ├── croissant.png, cupcake.png, cake.png
        ├── coffee.png, cookie.png
        └── owl.png, fox.png, dragon.png
```

---

## 3. Сцени Phaser

```
BootScene  →  preload assets + levels.json
     │
     ▼
MenuScene  →  фон, кнопка «Почати гру»
     │
     ▼
GameScene  →  основний геймплей (levelIndex 0..9)
     │
     ├─ Victory → restart(levelIndex+1) або Menu
     └─ Defeat  → restart(same level)
```

### BootScene
- Завантажує `bg`, `sprites`, `levels.json`, усі `tiles/*`.
- Одразу переходить у `Menu`.

### MenuScene
- Статичний екран з фоном і start-кнопкою.
- Передає `{ levelIndex: 0 }` у Game.

### GameScene
- Єдине місце з ігровою логікою.
- Життєвий цикл: `init` → `create` → input/timer loop → victory/defeat.

---

## 4. Ігрове поле (Match-3 Core)

### Константи розміру

| Константа | Значення | Опис |
|-----------|----------|------|
| `TILE_SIZE` | 128 | Оригінальний розмір спрайта (без scale) |
| `GRID_SIZE` | 7 | Сітка 7×7 |
| `BOARD_W/H` | 896 | 7 × 128 |
| `GAME_W` | 960 | Поле + бокові відступи |
| `GAME_H` | ~1122 | HUD + поле + панель помічників |

### Модель даних

```
grid[r][c]  : number   // TILE.* або TILE.EMPTY (-1)
tiles[r][c] : Container // { sprite, glow } — візуал Phaser
```

Логіка завжди йде від `grid`; `tiles` лише відображає стан (після гравітації — повний `drawGrid()`).

### Типи тайлів

```
BASIC (спавнять випічку):
  FLOUR(0)  MILK(1)  SPICE(2)  BUTTER(3)

BONUS (час / заряд, без spawn випічки):
  STRAWBERRY(4)  BLUEBERRY(5)

BAKERY (результати матчів):
  CROISSANT(6)  CUPCAKE(7)  CAKE(8)

SPECIAL:
  COFFEE(9)  BURNT(10)

EMPTY: -1
```

### Цикл ходу

```
pointerdown → select / trySwap
    │
    ├─ swap data + tween
    │
    ├─ findAllMatches()        // прямі рядки/стовпці ≥3
    │     └─ splitIntoGroups() // зв'язані компоненти одного типу
    │
    ├─ resolveMatches(groups)
    │     ├─ charge helpers / timer bonuses
    │     ├─ spawn CROISSANT / CUPCAKE / CAKE (для BASIC)
    │     ├─ cakesCollected += …
    │     └─ pop-анімація → EMPTY
    │
    └─ applyGravity()
          ├─ падіння вниз + fill randomBasic()
          ├─ drawGrid()
          └─ cascade (delayed findAllMatches) або idle
                ├─ checkPossibleMoves() → autoReshuffle?
                └─ checkVictory()
```

### Правила матчів

| Група | Ефект |
|-------|--------|
| BASIC size 3 | → CROISSANT |
| BASIC size 4 | → CUPCAKE, +2 сек |
| BASIC size ≥5 | → CAKE, +1 до цілі, бонус заряду |
| CUPCAKE ≥3 | +1 торт, +час |
| CROISSANT 4 | → CUPCAKE |
| CROISSANT ≥5 | → CAKE, +1 до цілі |
| CAKE ≥3 | кожен торт → +1 до цілі |
| STRAWBERRY | +1 сек/тайл, малий заряд усім |
| BLUEBERRY | +2 сек/тайл, більший заряд усім |
| BUTTER | малий заряд усім помічникам |

`findAllMatches` шукає **прямі** горизонтальні/вертикальні лінії.  
`splitIntoGroups` об'єднує сусідні клітинки **одного типу** (T/L-форми дають більший size).

### Auto-Reshuffle

Якщо після каскаду немає жодного валідного ходу (перебір усіх сусідніх swap) — перемішуються лише BASIC+BONUS тайли, випічка й перешкоди лишаються.

---

## 5. Помічники (RPG-lite)

| Персонаж | Ресурс | Ефект |
|----------|--------|--------|
| 🦉 Сова | FLOUR | Freeze timer 10 с |
| 🦊 Лисичка | SPICE | Reshuffle з гарантією ходів |
| 🐉 Дракончик | MILK | Обраний CUPCAKE → CAKE |

- Заряд 0…100. Повний заряд ≈ 15–20 відповідних тайлів.
- UI: іконка + відсоток; клік активує, якщо `charge >= 100`.

---

## 6. HUD і екрани

```
┌──────────────────────────────────────┐
│ Рівень N    🎂 2/5         01:30     │  ← top bar
├──────────────────────────────────────┤
│                                      │
│           7×7 board (896×896)        │
│                                      │
├──────────────────────────────────────┤
│  [🦉 45%]  [🦊 12%]  [🐉 80%]   Log │  ← helpers + export
└──────────────────────────────────────┘
```

- **Victory**: пауза, «Level Complete», next level / menu.
- **Defeat**: «Time's Up», retry.
- Тости для здібностей помічників.

---

## 7. Рівні (`levels.json`)

```json
{
  "level": 1,
  "timer_seconds": 120,
  "target_type": "cakes",
  "target_count": 5,
  "obstacle_tiles": 0,
  "allowed_helpers": ["owl", "fox", "dragon"],
  "description": "…"
}
```

MVP зараз повноцінно реалізує `target_type: "cakes"` (лічильник `cakesCollected`).  
Інші типи (`guests`, `clean_burnt`, `coffee`, …) закладені в JSON і HUD-лейблах; повна логіка — наступні ітерації.

---

## 8. Логування геймплею

Клас `GameLogger` (глобально `window.gameLog`):

| Подія | Коли |
|-------|------|
| `level_start` | старт рівня |
| `swap` | спроба обміну (valid true/false) |
| `match` | кожна група після split |
| `helper` | активація здібності |
| `reshuffle` | auto-reshuffle |
| `timer` | кожні 15 с + residual ≤5 |
| `level_end` | victory / defeat + підсумок |

- Кнопка **📋 Log** → `summary()` + download JSON.
- З консолі: `gameLog.getLog()`, `gameLog.download()`.

Призначення: баланс, QA, відтворення багів («тайли не склалися»).

---

## 9. Ассети

- Sheet **512×512**, сітка **4×4 × 128px**.
- Нарізка: точні комірки 128×128 **без trim** → без розтягування на полі.
- Рендер тайлів: `this.add.image(x, y, key)` на нативному розмірі (scale 1).
- Виділення: glow + `setScale(1.04)`.

---

## 10. Запуск

```bash
cd game
python3 server.py
# → http://localhost:8080
```

`server.py` віддає файли з `Cache-Control: no-store` для зручної ітерації.

---

## 11. Відомі обмеження MVP

1. Не всі `target_type` з JSON мають окрему win-логіку (лише `cakes`).
2. `obstacle_tiles` / BURNT поки не спавняться на старті рівня.
3. Гравітація — миттєвий `drawGrid()`, без tween падіння по клітинках.
4. Немає звуку / частинок (juice частково: scale pop, glow).
5. Один файл `game.js` — при рості варто розбити на модулі (`Board`, `Matchers`, `Helpers`, `HUD`).

---

## 12. Рекомендований roadmap

| Спринт | Фокус |
|--------|--------|
| **A** | Tween-гравітація, частинки, звук |
| **B** | Повна логіка рівнів 2–10 (burnt, coffee, guests) |
| **C** | Модульність (ES modules / bundler), atlas замість окремих PNG |
| **D** | Метрики з логів → баланс таймера/заряду/ваг спавну |

---

*Документ відповідає стану коду на момент написання. При зміні контрактів (TILE enum, JSON levels, API логера) — оновлювати цей файл.*
