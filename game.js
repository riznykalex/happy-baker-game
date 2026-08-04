/**
 * Match-3 RPG «Кафе чарівних тортів» — MVP Core
 * Phaser 3 implementation following the final TZ
 */

const TILE_SIZE = 128;          // спрайти 128×128
const GRID_SIZE = 7;
const BOARD_W = GRID_SIZE * TILE_SIZE; // 896
const BOARD_H = GRID_SIZE * TILE_SIZE; // 896
const BOARD_OFFSET_X = 32;
const BOARD_OFFSET_Y = 376;     // місце під HUD зверху
const GAME_W = BOARD_OFFSET_X * 2 + BOARD_W; // 960
const GAME_H = BOARD_OFFSET_Y + BOARD_H + 250; // ~1522 (хелпери знизу)

// Ігровий шрифт (кирилиця) — Balsamiq Sans із Google Fonts
const FONT = "'Balsamiq Sans', 'Comfortaa', 'Segoe UI', sans-serif";
function makeText(scene, x, y, str, style) {
  return scene.add.text(x, y, str, Object.assign({}, style, { fontFamily: FONT }));
}

// Анонс інструментів показуємо лише один раз (кожен інструмент — при першій появі)
const announcedTools = new Set();

// ──────────────────────────────────────────────
// Game Logger — для аналізу геймплею та балансу
// ──────────────────────────────────────────────
class GameLogger {
  constructor() {
    this.sessionId = 's_' + Date.now().toString(36);
    this.events = [];
    this.startTs = performance.now();
    this.enabled = true;
  }

  log(type, data = {}) {
    if (!this.enabled) return;
    const entry = {
      t: Math.round((performance.now() - this.startTs) * 10) / 10, // ms → 0.1s precision
      type,
      ...data
    };
    this.events.push(entry);
    // Дублюємо в консоль для швидкого перегляду
    console.log(`[LOG ${entry.t}s] ${type}`, data);
  }

  getLog() {
    return {
      sessionId: this.sessionId,
      exportedAt: new Date().toISOString(),
      eventCount: this.events.length,
      events: this.events
    };
  }

  /** Завантажити JSON-лог як файл */
  download() {
    const blob = new Blob([JSON.stringify(this.getLog(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cafe-log-${this.sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    console.log('Лог збережено:', a.download);
  }

  /** Вивести підсумок у консоль */
  summary() {
    const types = {};
    this.events.forEach(e => { types[e.type] = (types[e.type] || 0) + 1; });
    console.table(types);
    console.log('Повний лог:', this.getLog());
  }
}

// Глобальний логер (доступний з консолі браузера)
window.gameLog = new GameLogger();

// Tile types — повний сет (інґредієнти → корж → … → торт + інструменти)
const TILE = {
  FLOUR: 0,        // 🌾 Борошно — заряд Сови
  MILK: 1,         // 🥛 Молоко — заряд Дракончика
  SPICE: 2,        // ✨ Спеції — заряд Лисички
  BUTTER: 3,       // 🧈 Масло
  STRAWBERRY: 4,   // 🍓 Полуниця
  BLUEBERRY: 5,    // 🫐 Лохина
  COFFEE: 6,       // ☕️ Розріджувач (+час)
  ROLLINGPIN: 7,   // 🥖 Скалка: 3+ → усе борошно → печиво
  SPATULA: 8,      // 🍳 Лопатка: 3+ → усе печиво → капкейк
  COOKIE: 9,       // 🍪 Корж / печиво
  CROISSANT: 10,   // 🥐
  CUPCAKE: 11,     // 🧁
  CAKE: 12,        // 🎂
  EMPTY: -1
};

const BASIC_TILES = [TILE.FLOUR, TILE.MILK, TILE.SPICE, TILE.BUTTER];
const BONUS_TILES = [TILE.STRAWBERRY, TILE.BLUEBERRY];
const TOOL_TILES  = [TILE.ROLLINGPIN, TILE.SPATULA];
const FILLER_TILES = [TILE.COFFEE, TILE.ROLLINGPIN, TILE.SPATULA];

const TILE_TEXTURE = {
  [TILE.FLOUR]: 'flour',
  [TILE.MILK]: 'milk',
  [TILE.SPICE]: 'spice',
  [TILE.BUTTER]: 'butter',
  [TILE.STRAWBERRY]: 'strawberry',
  [TILE.BLUEBERRY]: 'blueberry',
  [TILE.COFFEE]: 'coffee',
  [TILE.ROLLINGPIN]: 'rollingpin',
  [TILE.SPATULA]: 'spatula',
  [TILE.COOKIE]: 'cookie',
  [TILE.CROISSANT]: 'croissant',
  [TILE.CUPCAKE]: 'cupcake',
  [TILE.CAKE]: 'cake'
};

class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    this.load.image('bg', 'assets/bg.jpg');
    this.load.image('sprites', 'assets/sprites.png');
    this.load.json('levels', 'levels.json');

    const tiles = [
      'flour', 'milk', 'spice', 'butter',
      'strawberry', 'blueberry',
      'coffee', 'rollingpin', 'spatula',
      'cookie', 'croissant', 'cupcake', 'cake',
      'owl', 'fox', 'dragon'
    ];
    tiles.forEach(name => {
      this.load.image(name, `assets/tiles/${name}.png`);
    });
  }
  create() {
    this.scene.start('Menu');
  }
}

class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }
  create() {
    const { width, height } = this.cameras.main;
    this.add.image(width/2, height/2, 'bg').setDisplaySize(width, height).setAlpha(0.7);
    
    makeText(this, width/2, 120, '🥐 Кафе чарівних тортів 🎂', {
      fontSize: '54px', color: '#5D4037',
      stroke: '#fff', strokeThickness: 5
    }).setOrigin(0.5);

    const startBtn = this.add.rectangle(width/2, 340, 375, 105, 0xE67E22)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('Game', { levelIndex: 0 }))
      .on('pointerover', () => startBtn.setFillStyle(0xF39C12))
      .on('pointerout', () => startBtn.setFillStyle(0xE67E22));

    makeText(this, width/2, 340, 'Почати гру', {
      fontSize: '42px', color: '#fff', fontStyle: 'bold'
    }).setOrigin(0.5);

    makeText(this, width/2, height - 40, 'MVP • 10 рівнів • Phaser 3', {
      fontSize: '24px', color: '#A1887F'
    }).setOrigin(0.5);
  }
}

class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    this.levelIndex = data.levelIndex || 0;
    this.grid = [];
    this.tiles = []; // visual sprites
    this.selected = null;
    this.isAnimating = false;
    this.score = 0;
    this.cakesCollected = 0;
    this.timer = 120;
    this.timerEvent = null;
    this.idleEvent = null;
    this.moveCount = 0;
    this.matchCount = 0;
    this.lastMoveTime = 0;
    this.hintActive = false;
    this.hintTiles = [];
    // Лічильники зібраних інгредієнтів (матч BASIC/BONUS)
    this.ingredients = { flour: 0, milk: 0, butter: 0, berries: 0 };
    this.ingredientGoals = { flour: 10, milk: 3, butter: 5, berries: 5 };
    this.allIngredientsComplete = false;
    this.allowedTools = [];
    this.helpers = {
      owl: { charge: 0, max: 100, name: 'Сова', emoji: '🦉' },
      fox: { charge: 0, max: 100, name: 'Лисичка', emoji: '🦊' },
      dragon: { charge: 0, max: 100, name: 'Дракончик', emoji: '🐉' }
    };
  }

  create() {
    const levels = this.cache.json.get('levels');
    this.levelData = levels[this.levelIndex] || levels[0];
    this.timer = this.levelData.timer_seconds;
    this.targetCount = this.levelData.target_count;
    this.targetType = this.levelData.target_type;
    this.allowedTools = (this.levelData.tools || []).map(n => TILE[n.toUpperCase()]);
    this.berryType = this.levelData.berry_type || null;
    if (this.levelData.ingredient_goals) {
      this.ingredientGoals = { ...this.ingredientGoals, ...this.levelData.ingredient_goals };
    }

    // ── LOG: початок рівня ──
    window.gameLog.log('level_start', {
      level: this.levelData.level,
      targetType: this.targetType,
      targetCount: this.targetCount,
      timer: this.timer,
      obstacles: this.levelData.obstacle_tiles || 0
    });

    const { width, height } = this.cameras.main;

    // Без фонового зображення — нейтральний колір (зручніше на мобілці)
    this.cameras.main.setBackgroundColor(0xf5e6c8);

    // Рамка поля
    this.add.rectangle(
      BOARD_OFFSET_X + (GRID_SIZE * TILE_SIZE)/2,
      BOARD_OFFSET_Y + (GRID_SIZE * TILE_SIZE)/2,
      GRID_SIZE * TILE_SIZE + 16,
      GRID_SIZE * TILE_SIZE + 16,
      0xFFFFFF, 0.5
    ).setStrokeStyle(4, 0xA1887F);

    // HUD
    this.createHUD();

    // Init grid
    this.initGrid();
    this.drawGrid();

    // Input
    this.input.on('pointerdown', this.onPointerDown, this);

    // Стартові оверлеї: знайомство з новими інструментами (один раз), потім завдання
    this.isAnimating = true; // блокуємо поле, поки показуються оверлеї
    const overlays = [];
    const newTools = (this.levelData.tools || []).filter(n => !announcedTools.has(n));
    if (newTools.length) {
      newTools.forEach(n => announcedTools.add(n));
      overlays.push({ type: 'tools', tools: newTools });
    }
    overlays.push({ type: 'task' });
    this.showNextOverlay(overlays);
  }

  startTimer() {
    this.isAnimating = false;
    this.lastMoveTime = this.time.now;
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.tickTimer,
      callbackScope: this,
      loop: true
    });
    // Підказка, якщо гравець не ходить > 5 сек
    this.idleEvent = this.time.addEvent({
      delay: 1000,
      callback: this.checkIdleHint,
      callbackScope: this,
      loop: true
    });
    // Auto-reshuffle check after short delay
    this.time.delayedCall(500, () => this.checkPossibleMoves());
  }

  createHUD() {
    const { width, height } = this.cameras.main;
    const g = this.ingredientGoals;

    // Окремий блок HUD (0..376)
    this.add.rectangle(width/2, 188, width - 16, 376, 0xFFFFFF, 0.95)
      .setStrokeStyle(5, 0xD7CCC8);

    // Рядок 1: рівень
    this.levelText = makeText(this, width/2, 4, `Рівень ${this.levelData.level}`, {
      fontSize: '50px', color: '#5D4037', fontStyle: 'bold'
    }).setOrigin(0.5, 0);

    // Рядок 2: ціль тортів (великий)
    this.targetText = makeText(this, width/2, 58, `🎂 0 / ${this.targetCount}`, {
      fontSize: '80px', color: '#5D4037', fontStyle: 'bold'
    }).setOrigin(0.5, 0);

    // Рядок 3: таймер
    this.timerText = makeText(this, width/2, 142, `⏱ ${this.formatTime(this.timer)}`, {
      fontSize: '64px', color: '#C62828', fontStyle: 'bold'
    }).setOrigin(0.5, 0);

    // Рядок 4: лічильники інгредієнтів — один рядок 1×4 (іконки 96px)
    const ingItems = [
      { key: 'flour',      tex: 'flour',      field: 'flour' },
      { key: 'milk',       tex: 'milk',       field: 'milk' },
      { key: 'butter',     tex: 'butter',     field: 'butter' },
      { key: 'berries',    tex: this.berryType === 'blueberry' ? 'blueberry' : 'strawberry', field: 'berries' }
    ];
    const colX = [144, 368, 592, 816];
    this.ingTexts = {};
    this.ingIcons = {};
    this.ingChecks = {};
    ingItems.forEach((item, i) => {
      const x = colX[i];
      const icon = this.add.image(x, 260, item.tex).setDisplaySize(96, 96);
      this.ingIcons[item.field] = icon;
      this.ingTexts[item.field] = makeText(this, x, 340,
        `${this.ingredients[item.field]}/${g[item.field]}`,
        { fontSize: '48px', color: '#6D4C41', fontStyle: 'bold' }
      ).setOrigin(0.5);
      this.ingChecks[item.field] = makeText(this, x + 58, 340, '✓', {
        fontSize: '48px', color: '#2E7D32', fontStyle: 'bold'
      }).setOrigin(0, 0.5).setVisible(false);
    });

    // Helpers panel (bottom)
    this.helperTexts = {};
    const helpers = ['owl', 'fox', 'dragon'];
    const helpersY = BOARD_OFFSET_Y + BOARD_H + 70;
    helpers.forEach((key, i) => {
      const x = BOARD_OFFSET_X + 150 + i * 240;
      const y = helpersY;
      this.add.circle(x, y, 68, 0xFFFFFF).setStrokeStyle(4, 0x8D6E63);
      this.add.image(x, y - 3, key).setDisplaySize(122, 122);
      this.helperTexts[key] = makeText(this, x, y + 80, '0%', {
        fontSize: '28px', color: '#5D4037', fontStyle: 'bold'
      }).setOrigin(0.5);

      // Clickable for activation (when charged)
      this.add.circle(x, y, 68, 0x000000, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.activateHelper(key));
    });

    // Кнопка експорту логу (правий нижній кут)
    const logBtn = makeText(this, width - 20, height - 20, '📋 Log', {
      fontSize: '18px', color: '#8D6E63', backgroundColor: '#FFFFFF88',
      padding: { x: 12, y: 6 }
    }).setOrigin(1, 1).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        window.gameLog.summary();
        window.gameLog.download();
      })
      .on('pointerover', () => logBtn.setColor('#5D4037'))
      .on('pointerout', () => logBtn.setColor('#8D6E63'));
  }

  formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  tickTimer() {
    if (this.isAnimating) return;
    this.timer--;
    this.timerText.setText(`⏱ ${this.formatTime(this.timer)}`);
    if (this.timer <= 10) this.timerText.setColor('#FF1744');
    if (this.timer % 15 === 0 || this.timer <= 5) {
      window.gameLog.log('timer', {
        remaining: this.timer,
        cakes: this.cakesCollected,
        ingredients: { ...this.ingredients },
        moves: this.moveCount,
        matches: this.matchCount
      });
    }
    if (this.timer <= 0) {
      this.timerEvent.remove();
      this.showDefeat();
    }
  }

  /**
   * Random fill — інґредієнти, ягоди, кава та інструменти рівня.
   * Інструменти з'являються лише якщо дозволені рівнем (allowedTools).
   * Випічка лише зі матчів. Ягоди ~14% сумарно (реалістична ціль 5).
   */
  randomBasic() {
    const useRolling = this.allowedTools.includes(TILE.ROLLINGPIN);
    const useSpatula = this.allowedTools.includes(TILE.SPATULA);
    const entries = [
      { type: TILE.FLOUR,       p: 0.16 },
      { type: TILE.MILK,        p: 0.16 },
      { type: TILE.SPICE,       p: 0.14 },
      { type: TILE.BUTTER,      p: 0.14 },
      { type: TILE.COFFEE,      p: 0.10 },
      { type: TILE.ROLLINGPIN,  p: useRolling ? 0.08 : 0 },
      { type: TILE.SPATULA,     p: useSpatula ? 0.08 : 0 },
      { type: TILE.STRAWBERRY,  p: 0.07 },
      { type: TILE.BLUEBERRY,   p: 0.07 }
    ];
    const total = entries.reduce((s, e) => s + e.p, 0);
    const roll = Math.random() * total;
    let acc = 0;
    for (const e of entries) {
      acc += e.p;
      if (roll < acc) return e.type;
    }
    return TILE.FLOUR;
  }

  initGrid() {
    this.grid = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      this.grid[r] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        this.grid[r][c] = this.randomBasic();
      }
    }
    // Ensure no initial matches
    this.removeInitialMatches();
  }

  removeInitialMatches() {
    let changed = true;
    while (changed) {
      changed = false;
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (this.hasMatchAt(r, c)) {
            this.grid[r][c] = this.randomBasic();
            changed = true;
          }
        }
      }
    }
  }

  hasMatchAt(r, c) {
    const t = this.grid[r][c];
    // Усі тайли, що можуть з'явитись з random fill
    const ok = BASIC_TILES.includes(t) || BONUS_TILES.includes(t) || FILLER_TILES.includes(t);
    if (!ok) return false;
    // horizontal
    let count = 1;
    for (let i = c - 1; i >= 0 && this.grid[r][i] === t; i--) count++;
    for (let i = c + 1; i < GRID_SIZE && this.grid[r][i] === t; i++) count++;
    if (count >= 3) return true;
    // vertical
    count = 1;
    for (let i = r - 1; i >= 0 && this.grid[i][c] === t; i--) count++;
    for (let i = r + 1; i < GRID_SIZE && this.grid[i][c] === t; i++) count++;
    return count >= 3;
  }

  drawGrid() {
    // Clear old tiles
    this.tiles.forEach(row => row.forEach(t => t && t.destroy()));
    this.tiles = [];

    for (let r = 0; r < GRID_SIZE; r++) {
      this.tiles[r] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        const type = this.grid[r][c];
        if (type === TILE.EMPTY) {
          this.tiles[r][c] = null;
          continue;
        }
        const x = BOARD_OFFSET_X + c * TILE_SIZE + TILE_SIZE / 2;
        const y = BOARD_OFFSET_Y + r * TILE_SIZE + TILE_SIZE / 2;

        const texKey = TILE_TEXTURE[type] || 'flour';
        // Оригінальний розмір 128×128 — без setDisplaySize / розтягування
        const sprite = this.add.image(x, y, texKey)
          .setInteractive({ useHandCursor: true })
          .setData('row', r)
          .setData('col', c)
          .setData('type', type);

        // Легке підсвічування під тайлом
        const glow = this.add.circle(x, y, TILE_SIZE / 2 - 4, 0xFFFFFF, 0.25);

        const container = this.add.container(0, 0, [glow, sprite]);
        container.setData('row', r);
        container.setData('col', c);
        container.setData('type', type);
        container.sprite = sprite;
        container.glow = glow;

        this.tiles[r][c] = container;
      }
    }
  }

  onPointerDown(pointer) {
    if (this.isAnimating) return;

    this.lastMoveTime = this.time.now;
    this.hideHint();

    // Find which tile was clicked
    let clicked = null;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const t = this.tiles[r][c];
        if (!t) continue;
        const bounds = t.sprite.getBounds();
        if (bounds.contains(pointer.x, pointer.y)) {
          clicked = { r, c, tile: t };
          break;
        }
      }
      if (clicked) break;
    }
    if (!clicked) return;

    if (!this.selected) {
      this.selected = clicked;
      clicked.tile.glow.setFillStyle(0xFFEB3B, 0.7);
      clicked.tile.sprite.setScale(1.04);
    } else {
      const { r: r1, c: c1 } = this.selected;
      const { r: r2, c: c2 } = clicked;

      // Same tile → deselect
      if (r1 === r2 && c1 === c2) {
        this.selected.tile.glow.setFillStyle(0xFFFFFF, 0.35);
        this.selected.tile.sprite.setScale(1);
        this.selected = null;
        return;
      }

      // Adjacent?
      const dist = Math.abs(r1 - r2) + Math.abs(c1 - c2);
      if (dist === 1) {
        this.trySwap(r1, c1, r2, c2);
      } else {
        // Select new
        this.selected.tile.glow.setFillStyle(0xFFFFFF, 0.35);
        this.selected.tile.sprite.setScale(1);
        this.selected = clicked;
        clicked.tile.glow.setFillStyle(0xFFEB3B, 0.7);
        clicked.tile.sprite.setScale(1.04);
      }
    }
  }

  trySwap(r1, c1, r2, c2) {
    this.isAnimating = true;
    if (this.selected) {
      this.selected.tile.glow.setFillStyle(0xFFFFFF, 0.35);
      this.selected.tile.sprite.setScale(1);
    }
    this.selected = null;

    // Swap in data
    const tmp = this.grid[r1][c1];
    this.grid[r1][c1] = this.grid[r2][c2];
    this.grid[r2][c2] = tmp;

    // Animate swap
    const t1 = this.tiles[r1][c1];
    const t2 = this.tiles[r2][c2];
    const x1 = BOARD_OFFSET_X + c1 * TILE_SIZE + TILE_SIZE / 2;
    const y1 = BOARD_OFFSET_Y + r1 * TILE_SIZE + TILE_SIZE / 2;
    const x2 = BOARD_OFFSET_X + c2 * TILE_SIZE + TILE_SIZE / 2;
    const y2 = BOARD_OFFSET_Y + r2 * TILE_SIZE + TILE_SIZE / 2;

    // Move both sprite and glow
    this.tweens.add({
      targets: [t1.sprite, t1.glow],
      x: x2, y: y2,
      duration: 150,
      ease: 'Sine.easeInOut'
    });
    this.tweens.add({
      targets: [t2.sprite, t2.glow],
      x: x1, y: y1,
      duration: 150,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        // Swap tile references
        this.tiles[r1][c1] = t2;
        this.tiles[r2][c2] = t1;
        t1.setData('row', r2); t1.setData('col', c2);
        t2.setData('row', r1); t2.setData('col', c1);

        // Check matches
        const matches = this.findAllMatches();
        if (matches.length > 0) {
          this.moveCount++;
          window.gameLog.log('swap', {
            from: [r1, c1], to: [r2, c2],
            valid: true,
            moveN: this.moveCount
          });
          this.resolveMatches(matches);
        } else {
          // Revert
          window.gameLog.log('swap', {
            from: [r1, c1], to: [r2, c2],
            valid: false
          });
          const tmp2 = this.grid[r1][c1];
          this.grid[r1][c1] = this.grid[r2][c2];
          this.grid[r2][c2] = tmp2;
          this.tiles[r1][c1] = t1;
          this.tiles[r2][c2] = t2;
          t1.setData('row', r1); t1.setData('col', c1);
          t2.setData('row', r2); t2.setData('col', c2);

          this.tweens.add({ targets: [t1.sprite, t1.glow], x: x1, y: y1, duration: 150 });
          this.tweens.add({
            targets: [t2.sprite, t2.glow], x: x2, y: y2, duration: 150,
            onComplete: () => { this.isAnimating = false; }
          });
        }
      }
    });
  }

  findAllMatches() {
    const matched = new Set();
    // Horizontal — будь-які однакові тайли (базові + випічка)
    for (let r = 0; r < GRID_SIZE; r++) {
      let c = 0;
      while (c < GRID_SIZE) {
        const t = this.grid[r][c];
        if (t < 0) { c++; continue; } // тільки EMPTY пропускаємо
        let len = 1;
        while (c + len < GRID_SIZE && this.grid[r][c + len] === t) len++;
        if (len >= 3) {
          for (let i = 0; i < len; i++) matched.add(`${r},${c + i}`);
        }
        c += len;
      }
    }
    // Vertical
    for (let c = 0; c < GRID_SIZE; c++) {
      let r = 0;
      while (r < GRID_SIZE) {
        const t = this.grid[r][c];
        if (t < 0) { r++; continue; }
        let len = 1;
        while (r + len < GRID_SIZE && this.grid[r + len][c] === t) len++;
        if (len >= 3) {
          for (let i = 0; i < len; i++) matched.add(`${r + i},${c}`);
        }
        r += len;
      }
    }
    return Array.from(matched).map(s => {
      const [r, c] = s.split(',').map(Number);
      return { r, c, type: this.grid[r][c] };
    });
  }

  resolveMatches(matches) {
    // Розбиваємо на окремі групи за типом + зв'язністю (ряд/колонка)
    // щоб каскад з кількох Match-3 не вважався одним Match-5
    const groups = this.splitIntoGroups(matches);

    // Місця, куди ставити spawn (лише для базових груп)
    const spawns = []; // { r, c, type }

    // Масові конвертації від інструментів (після очищення груп)
    let convertFlourToCookie = false;
    let convertCookieToCupcake = false;

    groups.forEach(group => {
      const type = group[0].type;
      const size = group.length;
      const matchKind = size >= 5 ? 5 : (size >= 4 ? 4 : 3);

      // —— Лічильники інгредієнтів + зарядка ——
      if (type === TILE.FLOUR) {
        this.ingredients.flour += size;
        group.forEach(() => this.addCharge('owl', 6));
      }
      if (type === TILE.MILK) {
        this.ingredients.milk += size;
        group.forEach(() => this.addCharge('dragon', 6));
      }
      if (type === TILE.SPICE) {
        group.forEach(() => this.addCharge('fox', 6));
      }
      if (type === TILE.BUTTER) {
        this.ingredients.butter += size;
        group.forEach(() => {
          this.addCharge('owl', 3);
          this.addCharge('fox', 3);
          this.addCharge('dragon', 3);
        });
      }
      if (type === TILE.STRAWBERRY || type === TILE.BLUEBERRY) {
        // Якщо рівень задає конкретну ягоду — рахуємо лише її
        if (this.berryType === 'blueberry') {
          if (type === TILE.BLUEBERRY) this.ingredients.berries += size;
        } else if (this.berryType === 'strawberry') {
          if (type === TILE.STRAWBERRY) this.ingredients.berries += size;
        } else {
          this.ingredients.berries += size;
        }
        const timeBonus = type === TILE.BLUEBERRY ? size * 2 : size;
        const charge = type === TILE.BLUEBERRY ? 4 * size : 3 * size;
        this.timer = Math.min(this.timer + timeBonus, this.levelData.timer_seconds + 50);
        this.timerText.setText(`⏱ ${this.formatTime(this.timer)}`);
        this.addCharge('owl', charge);
        this.addCharge('fox', charge);
        this.addCharge('dragon', charge);
      }
      if (type === TILE.COFFEE) {
        this.timer = Math.min(this.timer + size, this.levelData.timer_seconds + 30);
        this.timerText.setText(`⏱ ${this.formatTime(this.timer)}`);
      }
      if (type === TILE.ROLLINGPIN || type === TILE.SPATULA) {
        this.timer = Math.min(this.timer + Math.floor(size / 2), this.levelData.timer_seconds + 20);
        this.timerText.setText(`⏱ ${this.formatTime(this.timer)}`);
      }

      let spawnType = null;
      let cakesGained = 0;
      let special = null;

      // —— Ланцюжок: BASIC → COOKIE → CROISSANT → CUPCAKE → CAKE ——
      if (type === TILE.MILK && size >= 4) {
        spawnType = TILE.BUTTER; // 4+ молока → масло
        special = 'milk_to_butter';
      } else if (BASIC_TILES.includes(type)) {
        if (size >= 5) {
          spawnType = TILE.CUPCAKE;
          this.addCharge('owl', 12);
          this.addCharge('fox', 12);
          this.addCharge('dragon', 12);
        } else if (size >= 4) {
          spawnType = TILE.CROISSANT;
        } else {
          spawnType = TILE.COOKIE; // корж
        }
      } else if (type === TILE.COOKIE) {
        if (size >= 4) spawnType = TILE.CUPCAKE;
        else spawnType = TILE.CROISSANT;
      } else if (type === TILE.CROISSANT) {
        if (size >= 4) {
          cakesGained = 1; // торт не лишається на полі — одразу летить на лічильник
        } else {
          spawnType = TILE.CUPCAKE;
        }
      } else if (type === TILE.CUPCAKE) {
        cakesGained = 1; // торт не лишається на полі — одразу летить на лічильник
      } else if (type === TILE.CAKE) {
        cakesGained = size;
      } else if (type === TILE.STRAWBERRY) {
        spawnType = TILE.BLUEBERRY; // 3+ полуниці → лохина на полі
        special = 'berry_convert';
      } else if (type === TILE.BLUEBERRY) {
        spawnType = TILE.STRAWBERRY; // 3+ лохини → полуниця на полі
        special = 'berry_convert';
      } else if (type === TILE.ROLLINGPIN && size >= 3) {
        convertFlourToCookie = true;
        special = 'rollingpin_convert';
      } else if (type === TILE.SPATULA && size >= 3) {
        convertCookieToCupcake = true;
        special = 'spatula_convert';
      }

      if (cakesGained > 0) {
        const mid = group[Math.floor(group.length / 2)];
        this.gainCakes(cakesGained, {
          x: BOARD_OFFSET_X + mid.c * TILE_SIZE + TILE_SIZE / 2,
          y: BOARD_OFFSET_Y + mid.r * TILE_SIZE + TILE_SIZE / 2
        });
      }

      this.matchCount++;
      window.gameLog.log('match', {
        size,
        kind: matchKind,
        tileType: TILE_TEXTURE[type] || type,
        spawn: spawnType != null ? (TILE_TEXTURE[spawnType] || spawnType) : null,
        special,
        cakesGained,
        cakesNow: this.cakesCollected,
        matchN: this.matchCount
      });

      if (spawnType != null) {
        const mid = group[Math.floor(group.length / 2)];
        spawns.push({ r: mid.r, c: mid.c, type: spawnType });
      }
    });

    // Запам'ятовуємо конвертації для onComplete (після EMPTY)
    this._pendingConvert = { flourToCookie: convertFlourToCookie, cookieToCupcake: convertCookieToCupcake };

    this.updateTargetUI();

    // Animate destruction
    const toDestroy = [];
    matches.forEach(({ r, c }) => {
      const t = this.tiles[r][c];
      if (t) {
        toDestroy.push(t);
        this.grid[r][c] = TILE.EMPTY;
        this.tiles[r][c] = null;
      }
    });

    const animTargets = [];
    toDestroy.forEach(t => {
      if (t.sprite) animTargets.push(t.sprite);
      if (t.glow) animTargets.push(t.glow);
    });
    this.tweens.add({
      targets: animTargets,
      scale: 0,
      alpha: 0,
      duration: 150,
      ease: 'Back.easeIn',
      onComplete: () => {
        toDestroy.forEach(t => t.destroy());
        // Ставимо spawn-и
        spawns.forEach(s => {
          if (this.grid[s.r][s.c] === TILE.EMPTY) {
            this.grid[s.r][s.c] = s.type;
          }
        });
        // Інструменти: масова конвертація поля
        const conv = this._pendingConvert || {};
        if (conv.flourToCookie) {
          let n = 0;
          for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
              if (this.grid[r][c] === TILE.FLOUR) {
                this.grid[r][c] = TILE.COOKIE;
                n++;
              }
            }
          }
          window.gameLog.log('convert', { tool: 'rollingpin', from: 'flour', to: 'cookie', count: n });
          this.showToast(`🥖 Борошно → печиво (${n})`);
        }
        if (conv.cookieToCupcake) {
          let n = 0;
          for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
              if (this.grid[r][c] === TILE.COOKIE) {
                this.grid[r][c] = TILE.CUPCAKE;
                n++;
              }
            }
          }
          window.gameLog.log('convert', { tool: 'spatula', from: 'cookie', to: 'cupcake', count: n });
          this.showToast(`🍳 Печиво → капкейк (${n})`);
        }
        this._pendingConvert = null;
        this.applyGravity();
      }
    });
  }

  /** Розбиває список matched-тайлів на окремі групи (однакові тип + сусідство) */
  splitIntoGroups(matches) {
    if (!matches.length) return [];
    const key = (m) => `${m.r},${m.c}`;
    const set = new Set(matches.map(key));
    const byPos = {};
    matches.forEach(m => { byPos[key(m)] = m; });

    const visited = new Set();
    const groups = [];

    matches.forEach(start => {
      const k = key(start);
      if (visited.has(k)) return;

      const group = [];
      const stack = [start];
      visited.add(k);

      while (stack.length) {
        const cur = stack.pop();
        group.push(cur);
        // 4-напрямки
        [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dr, dc]) => {
          const nr = cur.r + dr, nc = cur.c + dc;
          const nk = `${nr},${nc}`;
          if (set.has(nk) && !visited.has(nk) && byPos[nk].type === start.type) {
            visited.add(nk);
            stack.push(byPos[nk]);
          }
        });
      }
      if (group.length >= 3) groups.push(group);
    });
    return groups;
  }

  applyGravity() {
    let moved = false;
    for (let c = 0; c < GRID_SIZE; c++) {
      let emptyRow = GRID_SIZE - 1;
      for (let r = GRID_SIZE - 1; r >= 0; r--) {
        if (this.grid[r][c] !== TILE.EMPTY) {
          if (r !== emptyRow) {
            this.grid[emptyRow][c] = this.grid[r][c];
            this.grid[r][c] = TILE.EMPTY;
            moved = true;
          }
          emptyRow--;
        }
      }
      // Fill top with new basic tiles
      for (let r = emptyRow; r >= 0; r--) {
        this.grid[r][c] = this.randomBasic();
        moved = true;
      }
    }

    this.drawGrid(); // redraw after gravity (simple for MVP)

    // Check for new matches (cascades)
    this.time.delayedCall(220, () => {
      const newMatches = this.findAllMatches();
      if (newMatches.length > 0) {
        this.resolveMatches(newMatches);
      } else {
        // Фінальна перевірка на випадок «завислих» комбінацій
        this.time.delayedCall(80, () => {
          const leftover = this.findAllMatches();
          if (leftover.length > 0) {
            this.resolveMatches(leftover);
          } else {
            this.isAnimating = false;
            this.checkPossibleMoves();
            this.checkVictory();
          }
        });
      }
    });
  }

  checkPossibleMoves() {
    // Simple check: if no possible match after any swap, reshuffle
    if (!this.findHintMove()) {
      this.autoReshuffle();
    }
  }

  /** Перший-ліпший своп, що дає матч; повертає {r1,c1,r2,c2} або null */
  findHintMove() {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        // Try right
        if (c + 1 < GRID_SIZE) {
          this.swapData(r, c, r, c + 1);
          if (this.findAllMatches().length > 0) {
            this.swapData(r, c, r, c + 1); // revert
            return { r1: r, c1: c, r2: r, c2: c + 1 };
          }
          this.swapData(r, c, r, c + 1); // revert
        }
        // Try down
        if (r + 1 < GRID_SIZE) {
          this.swapData(r, c, r + 1, c);
          if (this.findAllMatches().length > 0) {
            this.swapData(r, c, r + 1, c); // revert
            return { r1: r, c1: c, r2: r + 1, c2: c };
          }
          this.swapData(r, c, r + 1, c); // revert
        }
      }
    }
    return null;
  }

  /** Підказка при простої > 5 сек: підсвічуємо пару тайлів для ходу */
  checkIdleHint() {
    if (this.isAnimating || this.hintActive) return;
    if (this.time.now - this.lastMoveTime > 5000) {
      this.showHint();
    }
  }

  showHint() {
    const mv = this.findHintMove();
    if (!mv) {
      this.checkPossibleMoves();
      return;
    }
    const a = this.tiles[mv.r1][mv.c1];
    const b = this.tiles[mv.r2][mv.c2];
    if (!a || !b) return;
    this.hintActive = true;
    this.hintTiles = [a, b];
    a.glow.setFillStyle(0xFFEB3B, 0.85);
    b.glow.setFillStyle(0xFFEB3B, 0.85);
    a.sprite.setScale(1.08);
    b.sprite.setScale(1.08);
    window.gameLog.log('hint', { timer: this.timer });
  }

  hideHint() {
    if (!this.hintActive) return;
    this.hintActive = false;
    this.hintTiles.forEach(t => {
      if (t.glow) t.glow.setFillStyle(0xFFFFFF, 0.25);
      if (t.sprite) t.sprite.setScale(1);
    });
    this.hintTiles = [];
  }

  swapData(r1, c1, r2, c2) {
    const tmp = this.grid[r1][c1];
    this.grid[r1][c1] = this.grid[r2][c2];
    this.grid[r2][c2] = tmp;
  }

  autoReshuffle() {
    window.gameLog.log('reshuffle', {
      reason: 'no_moves',
      timer: this.timer,
      cakes: this.cakesCollected
    });

    // Visual feedback
    makeText(this, 
      BOARD_OFFSET_X + (GRID_SIZE * TILE_SIZE)/2,
      BOARD_OFFSET_Y + (GRID_SIZE * TILE_SIZE)/2,
      '🔄 Перемішування...',
      { fontSize: '45px', color: '#fff', backgroundColor: '#5D4037', padding: { x: 22, y: 14 } }
    ).setOrigin(0.5).setDepth(10).setName('reshuffleText');

    // Перемішуємо всі комірки включно з випічкою користувача
    const isShuffleable = (t) => t !== TILE.EMPTY;
    const basics = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (isShuffleable(this.grid[r][c])) {
          basics.push(this.grid[r][c]);
        }
      }
    }
    Phaser.Utils.Array.Shuffle(basics);
    let idx = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (isShuffleable(this.grid[r][c])) {
          this.grid[r][c] = basics[idx++];
        }
      }
    }
    this.removeInitialMatches();
    this.time.delayedCall(600, () => {
      const txt = this.children.getByName('reshuffleText');
      if (txt) txt.destroy();
      this.drawGrid();
      this.isAnimating = false;
    });
  }

  addCharge(helper, amount) {
    const h = this.helpers[helper];
    h.charge = Math.min(h.charge + amount, h.max);
    this.helperTexts[helper].setText(Math.floor(h.charge) + '%');
    if (h.charge >= h.max) {
      this.helperTexts[helper].setColor('#4CAF50');
    }
  }

  activateHelper(key) {
    const h = this.helpers[key];
    if (h.charge < h.max || this.isAnimating) return;

    h.charge = 0;
    this.helperTexts[key].setText('0%').setColor('#5D4037');

    window.gameLog.log('helper', {
      which: key,
      timer: this.timer,
      cakes: this.cakesCollected
    });

    if (key === 'owl') {
      // Freeze timer 10s
      this.timerText.setColor('#2196F3');
      this.timerEvent.paused = true;
      this.time.delayedCall(10000, () => {
        this.timerEvent.paused = false;
        this.timerText.setColor(this.timer <= 10 ? '#FF1744' : '#C62828');
      });
      this.showToast('🦉 Час заморожено на 10 сек!');
    } else if (key === 'fox') {
      // Guaranteed good reshuffle
      this.autoReshuffle();
      this.showToast('🦊 Поле перемішано з бонусом!');
    } else if (key === 'dragon') {
      // Капкейк → торт одразу на лічильник (на полі не лишається)
      let found = false;
      for (let r = 0; r < GRID_SIZE && !found; r++) {
        for (let c = 0; c < GRID_SIZE && !found; c++) {
          if (this.grid[r][c] === TILE.CUPCAKE) {
            const pos = {
              x: BOARD_OFFSET_X + c * TILE_SIZE + TILE_SIZE / 2,
              y: BOARD_OFFSET_Y + r * TILE_SIZE + TILE_SIZE / 2
            };
            this.grid[r][c] = TILE.EMPTY;
            found = true;
            this.showToast('🐉 Капкейк → Торт!');
            this.applyGravity();
            this.gainCakes(1, pos);
          }
        }
      }
      if (!found) this.showToast('🐉 Немає капкейків на полі');
    }
  }

  updateTargetUI() {
    this.targetText.setText(`🎂 ${this.cakesCollected} / ${this.targetCount}`);
    this.updateIngredientsUI();
  }

  updateIngredientsUI() {
    if (!this.ingTexts) return;
    const g = this.ingredientGoals;
    const i = this.ingredients;
    ['flour', 'milk', 'butter', 'berries'].forEach(field => {
      const t = this.ingTexts[field];
      if (!t) return;
      const done = i[field] >= g[field];
      t.setText(`${Math.min(i[field], g[field])}/${g[field]}`);
      t.setColor('#6D4C41');
      if (this.ingChecks[field]) this.ingChecks[field].setVisible(done);
      if (this.ingIcons[field]) {
        this.ingIcons[field].setTint(done ? 0x9E9E9E : 0xFFFFFF);
      }
    });
    this.checkIngredientCompletion();
  }

  /** Чи зібрано всі інгредієнти лічильника → +1 торт з анімацією */
  checkIngredientCompletion() {
    const g = this.ingredientGoals;
    const i = this.ingredients;
    const allDone = ['flour', 'milk', 'butter', 'berries'].every(f => i[f] >= g[f]);
    if (allDone && !this.allIngredientsComplete) {
      this.allIngredientsComplete = true;
      this.rewardCakeFromIngredients();
    }
  }

  /** Торт у центрі екрана → зменшується → летить на лічильник тортів */
  rewardCakeFromIngredients() {
    const { width, height } = this.cameras.main;
    const target = this.targetText;

    window.gameLog.log('ingredient_cake', { ingredients: { ...this.ingredients } });

    const cake = this.add.image(width / 2, height / 2 - 40, 'cake')
      .setScale(0.9).setDepth(25).setAlpha(0);

    this.tweens.add({ targets: cake, alpha: 1, y: height / 2 - 120, duration: 250, ease: 'Sine.easeOut' });

    this.tweens.add({
      targets: cake,
      x: target.x,
      y: target.y + 20,
      scale: 0.16,
      alpha: 0.4,
      delay: 400,
      duration: 900,
      ease: 'Sine.easeIn',
      onComplete: () => {
        cake.destroy();
        this.cakesCollected++;
        this.updateTargetUI();
        this.onCakeGained(1);
        this.tweens.add({ targets: target, scale: 1.3, duration: 120, yoyo: true });
        this.showToast('🎂 Інгредієнти зібрано! +1 торт');
        this.resetIngredients();
        this.checkVictory();
      }
    });
  }

  resetIngredients() {
    this.ingredients = { flour: 0, milk: 0, butter: 0, berries: 0 };
    this.allIngredientsComplete = false;
    this.updateIngredientsUI();
  }

  /** Кожен спечений торт → повний перезапуск таймера */
  onCakeGained(count) {
    this.timer = this.levelData.timer_seconds;
    this.timerText.setText(`⏱ ${this.formatTime(this.timer)}`);
    this.timerText.setColor(this.timer <= 10 ? '#FF1744' : '#C62828');
    window.gameLog.log('timer_reset', {
      count,
      cakesNow: this.cakesCollected,
      resetTo: this.timer
    });
    this.showToast('⏱ Час оновлено!');
  }

  /** Торт не лишається на полі — одразу летить на лічильник тортів */
  gainCakes(count, source) {
    this.cakesCollected += count;
    const target = this.targetText;
    const { width, height } = this.cameras.main;
    const fromX = source ? source.x : width / 2;
    const fromY = source ? source.y : height / 2 - 40;
    for (let i = 0; i < count; i++) {
      const cake = this.add.image(fromX, fromY, 'cake')
        .setScale(0.5).setDepth(25).setAlpha(0.9);
      this.tweens.add({
        targets: cake,
        x: target.x,
        y: target.y + 20,
        scale: 0.14,
        alpha: 0.4,
        delay: i * 150,
        duration: 700,
        ease: 'Sine.easeIn',
        onComplete: () => cake.destroy()
      });
    }
    this.updateTargetUI();
    this.onCakeGained(count);
    this.tweens.add({ targets: target, scale: 1.3, duration: 120, yoyo: true });
  }

  // ──────────────────────────────────────────────
  // Стартові оверлеї: інструменти → завдання
  // ──────────────────────────────────────────────
  showNextOverlay(queue) {
    if (!queue.length) {
      this.startTimer();
      return;
    }
    const next = queue.shift();
    if (next.type === 'tools') {
      this.showToolsOverlay(next.tools, () => this.showNextOverlay(queue));
    } else {
      this.showTaskOverlay(() => this.showNextOverlay(queue));
    }
  }

  showToolsOverlay(tools, done) {
    const { width, height } = this.cameras.main;
    const objs = [];
    const addObj = (o) => { objs.push(o); return o; };

    addObj(this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.6).setDepth(30));

    const N = tools.length;
    addObj(makeText(this, width/2, height/2 - (N === 1 ? 390 : 510), 'Новий інструмент!', {
      fontSize: '75px', color: '#FFD700', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(31));

    const firstY = N === 1 ? height/2 - 45 : height/2 - 315;
    tools.forEach((name, i) => {
      const y = firstY + i * 350;
      const tileId = TILE[name.toUpperCase()];
      addObj(this.add.rectangle(width/2, y, 285, 285, 0xFFFFFF, 0.15)
        .setStrokeStyle(3, 0xFFFFFF).setDepth(31));
      addObj(this.add.image(width/2, y, name).setDisplaySize(270, 270).setDepth(32));
      const desc = tileId === TILE.ROLLINGPIN
        ? '3+ скалки:\nусе борошно → печиво'
        : '3+ лопатки:\nусе печиво → капкейк';
      addObj(makeText(this, width/2, y + 180, desc, {
        fontSize: '30px', color: '#fff', align: 'center'
      }).setOrigin(0.5).setDepth(32));
    });

    const btnY = N === 1 ? height/2 + 285 : height/2 + 330;
    const btn = addObj(this.add.rectangle(width/2, btnY, 495, 120, 0xE67E22)
      .setInteractive({ useHandCursor: true }).setDepth(31));
    addObj(makeText(this, width/2, btnY, 'Далі', {
      fontSize: '50px', color: '#fff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(32));
    btn.on('pointerdown', () => {
      objs.forEach(o => o.destroy());
      done();
    });
  }

  showTaskOverlay(done) {
    const { width, height } = this.cameras.main;
    const objs = [];
    const addObj = (o) => { objs.push(o); return o; };

    addObj(this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.6).setDepth(30));
    addObj(makeText(this, width/2, height/2 - 330, `Рівень ${this.levelData.level}`, {
      fontSize: '68px', color: '#FFD700', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(31));
    addObj(this.add.image(width/2, height/2 - 135, 'cake').setDisplaySize(315, 315).setDepth(31));
    addObj(makeText(this, width/2, height/2 + 75, `Спечіть ${this.targetCount} 🎂`, {
      fontSize: '80px', color: '#fff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(31));
    addObj(makeText(this, width/2, height/2 + 170, 'Збирайте інгредієнти та складайте комбінації', {
      fontSize: '36px', color: '#ddd'
    }).setOrigin(0.5).setDepth(31));

    const btn = addObj(this.add.rectangle(width/2, height/2 + 285, 495, 120, 0x4CAF50)
      .setInteractive({ useHandCursor: true }).setDepth(31));
    addObj(makeText(this, width/2, height/2 + 285, 'Почати', {
      fontSize: '50px', color: '#fff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(32));
    btn.on('pointerdown', () => {
      objs.forEach(o => o.destroy());
      done();
    });
  }

  checkVictory() {
    if (this.cakesCollected >= this.targetCount) {
      this.timerEvent.remove();
      this.showVictory();
    }
  }

  showToast(msg) {
    const t = makeText(this, 
      this.cameras.main.width / 2,
      BOARD_OFFSET_Y + 40,
      msg,
      { fontSize: '40px', color: '#fff', backgroundColor: '#5D4037', padding: { x: 22, y: 12 } }
    ).setOrigin(0.5).setDepth(20);
    this.tweens.add({
      targets: t, alpha: 0, y: BOARD_OFFSET_Y - 20, duration: 1500, delay: 800,
      onComplete: () => t.destroy()
    });
  }

  showVictory() {
    this.isAnimating = true;

    window.gameLog.log('level_end', {
      result: 'victory',
      level: this.levelData.level,
      cakes: this.cakesCollected,
      target: this.targetCount,
      timeLeft: this.timer,
      moves: this.moveCount,
      matches: this.matchCount,
      helpers: {
        owl: this.helpers.owl.charge,
        fox: this.helpers.fox.charge,
        dragon: this.helpers.dragon.charge
      }
    });
    window.gameLog.summary(); // швидкий огляд у консолі

    const { width, height } = this.cameras.main;
    this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.6).setDepth(30);
    makeText(this, width/2, height/2 - 100, '🎉 Level Complete! 🎉', {
      fontSize: '80px', color: '#FFD700', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(31);

    const nextBtn = this.add.rectangle(width/2, height/2 + 100, 450, 112, 0x4CAF50)
      .setInteractive({ useHandCursor: true })
      .setDepth(31)
      .on('pointerdown', () => {
        if (this.levelIndex < 9) {
          this.scene.restart({ levelIndex: this.levelIndex + 1 });
        } else {
          this.scene.start('Menu');
        }
      });
    makeText(this, width/2, height/2 + 100, this.levelIndex < 9 ? 'Наступний рівень' : 'В меню', {
      fontSize: '50px', color: '#fff'
    }).setOrigin(0.5).setDepth(32);
  }

  showDefeat() {
    this.isAnimating = true;

    window.gameLog.log('level_end', {
      result: 'defeat',
      level: this.levelData.level,
      cakes: this.cakesCollected,
      target: this.targetCount,
      timeLeft: 0,
      moves: this.moveCount,
      matches: this.matchCount,
      helpers: {
        owl: this.helpers.owl.charge,
        fox: this.helpers.fox.charge,
        dragon: this.helpers.dragon.charge
      }
    });
    window.gameLog.summary();

    const { width, height } = this.cameras.main;
    this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.6).setDepth(30);
    makeText(this, width/2, height/2 - 100, '⏰ Time\'s Up!', {
      fontSize: '80px', color: '#FF5252', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(31);

    const retryBtn = this.add.rectangle(width/2, height/2 + 100, 405, 112, 0xE67E22)
      .setInteractive({ useHandCursor: true })
      .setDepth(31)
      .on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));
    makeText(this, width/2, height/2 + 100, 'Try Again', {
      fontSize: '50px', color: '#fff'
    }).setOrigin(0.5).setDepth(32);
  }
}

const config = {
  type: Phaser.AUTO,
  width: GAME_W,   // 960
  height: GAME_H,  // ~1522
  parent: 'game-container',
  backgroundColor: '#f5e6c8',
  scene: [BootScene, MenuScene, GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.NO_CENTER
  }
};

const game = new Phaser.Game(config);
