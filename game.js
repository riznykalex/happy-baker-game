/**
 * Match-3 RPG «Кафе: Торти за часом» — MVP Core
 * Phaser 3 implementation following the final TZ
 */

const TILE_SIZE = 128;          // спрайти 128×128
const GRID_SIZE = 7;
const BOARD_W = GRID_SIZE * TILE_SIZE; // 896
const BOARD_H = GRID_SIZE * TILE_SIZE; // 896
const BOARD_OFFSET_X = 32;
const BOARD_OFFSET_Y = 96;      // місце під HUD зверху
const GAME_W = BOARD_OFFSET_X * 2 + BOARD_W; // 960
const GAME_H = BOARD_OFFSET_Y + BOARD_H + 130; // ~1122 (хелпери знизу)

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

// Tile types — оновлений сет з маслом і лохиною
const TILE = {
  FLOUR: 0,       // 🌾 Борошно — заряд Сови
  MILK: 1,        // 🥛 Молоко — заряд Дракончика
  SPICE: 2,       // ✨ Спеції — заряд Лисички
  BUTTER: 3,      // 🧈 Масло — базовий (багатша випічка)
  STRAWBERRY: 4,  // 🍓 Полуниця — бонус (+час)
  BLUEBERRY: 5,   // 🫐 Лохина — бонус (+час, +заряд)
  CROISSANT: 6,   // 🥐 Match-3
  CUPCAKE: 7,     // 🧁 Match-4
  CAKE: 8,        // 🎂 Match-5
  COFFEE: 9,      // ☕️ Спец
  BURNT: 10,      // 🍪 Блокатор
  EMPTY: -1
};

// Основні інгредієнти → спавнять випічку
const BASIC_TILES = [TILE.FLOUR, TILE.MILK, TILE.SPICE, TILE.BUTTER];
// Бонусні ягоди
const BONUS_TILES = [TILE.STRAWBERRY, TILE.BLUEBERRY];

const TILE_TEXTURE = {
  [TILE.FLOUR]: 'flour',
  [TILE.MILK]: 'milk',
  [TILE.SPICE]: 'spice',
  [TILE.BUTTER]: 'butter',
  [TILE.STRAWBERRY]: 'strawberry',
  [TILE.BLUEBERRY]: 'blueberry',
  [TILE.CROISSANT]: 'croissant',
  [TILE.CUPCAKE]: 'cupcake',
  [TILE.CAKE]: 'cake',
  [TILE.COFFEE]: 'coffee',
  [TILE.BURNT]: 'cookie'
};

const TILE_COLORS = {
  [TILE.FLOUR]: 0xF4C430,
  [TILE.MILK]: 0x87CEEB,
  [TILE.SPICE]: 0x9B59B6,
  [TILE.BUTTER]: 0xF5D76E,
  [TILE.STRAWBERRY]: 0xE74C3C,
  [TILE.BLUEBERRY]: 0x5B2C6F,
  [TILE.CROISSANT]: 0xE67E22,
  [TILE.CUPCAKE]: 0xFF69B4,
  [TILE.CAKE]: 0xFFD700,
  [TILE.COFFEE]: 0x6F4E37,
  [TILE.BURNT]: 0x3D2B1F
};

class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    this.load.image('bg', 'assets/bg.jpg');
    this.load.image('sprites', 'assets/sprites.png');
    this.load.json('levels', 'levels.json');

    // Individual tiles from sprites.png (128×128 sheet)
    const tiles = [
      'flour', 'milk', 'spice', 'butter',
      'strawberry', 'blueberry',
      'croissant', 'cupcake', 'cake',
      'coffee', 'cookie',
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
    
    this.add.text(width/2, 120, '🥐 Кафе: Торти за часом 🎂', {
      fontSize: '36px', fontFamily: 'Segoe UI', color: '#5D4037',
      stroke: '#fff', strokeThickness: 4
    }).setOrigin(0.5);

    this.add.text(width/2, 180, 'Cozy Match-3 • Борошно, масло, ягоди', {
      fontSize: '18px', color: '#8D6E63'
    }).setOrigin(0.5);

    const startBtn = this.add.rectangle(width/2, 320, 220, 60, 0xE67E22)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('Game', { levelIndex: 0 }))
      .on('pointerover', () => startBtn.setFillStyle(0xF39C12))
      .on('pointerout', () => startBtn.setFillStyle(0xE67E22));

    this.add.text(width/2, 320, 'Почати гру', {
      fontSize: '24px', color: '#fff', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(width/2, height - 40, 'MVP • 10 рівнів • Phaser 3', {
      fontSize: '14px', color: '#A1887F'
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
    this.moveCount = 0;
    this.matchCount = 0;
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

    // ── LOG: початок рівня ──
    window.gameLog.log('level_start', {
      level: this.levelData.level,
      targetType: this.targetType,
      targetCount: this.targetCount,
      timer: this.timer,
      obstacles: this.levelData.obstacle_tiles || 0
    });

    const { width, height } = this.cameras.main;

    // Background
    this.add.image(width/2, height/2, 'bg').setDisplaySize(width, height);

    // Semi-transparent board panel
    this.add.rectangle(
      BOARD_OFFSET_X + (GRID_SIZE * TILE_SIZE)/2,
      BOARD_OFFSET_Y + (GRID_SIZE * TILE_SIZE)/2,
      GRID_SIZE * TILE_SIZE + 20,
      GRID_SIZE * TILE_SIZE + 20,
      0x5D4037, 0.35
    ).setStrokeStyle(4, 0x8D6E63);

    // HUD
    this.createHUD();

    // Init grid
    this.initGrid();
    this.drawGrid();

    // Input
    this.input.on('pointerdown', this.onPointerDown, this);

    // Timer
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.tickTimer,
      callbackScope: this,
      loop: true
    });

    // Auto-reshuffle check after short delay
    this.time.delayedCall(500, () => this.checkPossibleMoves());
  }

  createHUD() {
    const { width, height } = this.cameras.main;

    // Top bar background
    this.add.rectangle(width/2, 40, width - 20, 70, 0xFFFFFF, 0.85)
      .setStrokeStyle(2, 0xD7CCC8);

    // Level
    this.levelText = this.add.text(30, 25, `Рівень ${this.levelData.level}`, {
      fontSize: '18px', color: '#5D4037', fontStyle: 'bold'
    });

    // Target
    let targetLabel = '🎂';
    if (this.targetType === 'coffee') targetLabel = '☕';
    if (this.targetType === 'clean_burnt') targetLabel = '🍪';
    this.targetText = this.add.text(width/2, 25, `${targetLabel} 0 / ${this.targetCount}`, {
      fontSize: '22px', color: '#5D4037', fontStyle: 'bold'
    }).setOrigin(0.5, 0);

    // Timer
    this.timerText = this.add.text(width - 30, 25, this.formatTime(this.timer), {
      fontSize: '22px', color: '#C62828', fontStyle: 'bold'
    }).setOrigin(1, 0);

    // Helpers panel (bottom)
    this.helperTexts = {};
    const helpers = ['owl', 'fox', 'dragon'];
    const helpersY = BOARD_OFFSET_Y + BOARD_H + 55;
    helpers.forEach((key, i) => {
      const x = BOARD_OFFSET_X + 80 + i * 160;
      const y = helpersY;
      this.add.circle(x, y, 36, 0xFFFFFF).setStrokeStyle(3, 0x8D6E63);
      this.add.image(x, y - 2, key).setDisplaySize(56, 56);
      this.helperTexts[key] = this.add.text(x, y + 44, '0%', {
        fontSize: '14px', color: '#5D4037', fontStyle: 'bold'
      }).setOrigin(0.5);

      // Clickable for activation (when charged)
      this.add.circle(x, y, 36, 0x000000, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.activateHelper(key));
    });

    // Кнопка експорту логу (правий нижній кут)
    const logBtn = this.add.text(width - 20, height - 20, '📋 Log', {
      fontSize: '14px', color: '#8D6E63', backgroundColor: '#FFFFFF88',
      padding: { x: 8, y: 4 }
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
    this.timerText.setText(this.formatTime(this.timer));
    if (this.timer <= 10) this.timerText.setColor('#FF1744');
    // Лог кожні 15 секунд + критичні моменти
    if (this.timer % 15 === 0 || this.timer <= 5) {
      window.gameLog.log('timer', {
        remaining: this.timer,
        cakes: this.cakesCollected,
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
   * Пул тайлів на полі:
   * 22% борошно / молоко / спеції / масло  → основні
   *  6% полуниця,  6% лохина             → бонусні ягоди
   */
  randomBasic() {
    const roll = Math.random();
    if (roll < 0.22) return TILE.FLOUR;
    if (roll < 0.44) return TILE.MILK;
    if (roll < 0.66) return TILE.SPICE;
    if (roll < 0.88) return TILE.BUTTER;
    if (roll < 0.94) return TILE.STRAWBERRY;
    return TILE.BLUEBERRY;
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
    if (!(BASIC_TILES.includes(t) || BONUS_TILES.includes(t))) return false;
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

    groups.forEach(group => {
      const type = group[0].type;
      const size = group.length;
      let matchKind = size >= 5 ? 5 : (size >= 4 ? 4 : 3);

      // Зарядка помічників (повільніше — повний заряд ≈ 15–20 тайлів)
      if (type === TILE.FLOUR) group.forEach(() => this.addCharge('owl', 6));
      if (type === TILE.MILK) group.forEach(() => this.addCharge('dragon', 6));
      if (type === TILE.SPICE) group.forEach(() => this.addCharge('fox', 6));
      if (type === TILE.BUTTER) {
        group.forEach(() => {
          this.addCharge('owl', 3);
          this.addCharge('fox', 3);
          this.addCharge('dragon', 3);
        });
      }
      if (type === TILE.STRAWBERRY) {
        this.timer = Math.min(this.timer + size, this.levelData.timer_seconds + 40);
        this.timerText.setText(this.formatTime(this.timer));
        this.addCharge('owl', 3 * size);
        this.addCharge('fox', 3 * size);
        this.addCharge('dragon', 3 * size);
      }
      if (type === TILE.BLUEBERRY) {
        this.timer = Math.min(this.timer + size * 2, this.levelData.timer_seconds + 50);
        this.timerText.setText(this.formatTime(this.timer));
        this.addCharge('owl', 4 * size);
        this.addCharge('fox', 4 * size);
        this.addCharge('dragon', 4 * size);
      }

      let spawnType = null;
      let cakesGained = 0;

      if (BASIC_TILES.includes(type)) {
        // Основні інгредієнти → випічка
        if (size >= 5) {
          spawnType = TILE.CAKE;
          cakesGained = 1;
          this.addCharge('owl', 12);
          this.addCharge('fox', 12);
          this.addCharge('dragon', 12);
        } else if (size >= 4) {
          spawnType = TILE.CUPCAKE;
          this.timer = Math.min(this.timer + 2, this.levelData.timer_seconds + 30);
          this.timerText.setText(this.formatTime(this.timer));
        } else {
          spawnType = TILE.CROISSANT;
        }
      } else if (BONUS_TILES.includes(type)) {
        // Ягоди не спавнять випічку — лише бонуси вище
      } else if (type === TILE.CAKE) {
        cakesGained = size;
      } else if (type === TILE.CUPCAKE) {
        cakesGained = 1;
        this.timer = Math.min(this.timer + 2, this.levelData.timer_seconds + 30);
        this.timerText.setText(this.formatTime(this.timer));
      } else if (type === TILE.CROISSANT) {
        if (size >= 5) {
          spawnType = TILE.CAKE;
          cakesGained = 1;
        } else if (size >= 4) {
          spawnType = TILE.CUPCAKE;
        }
      }

      if (cakesGained > 0) {
        this.cakesCollected += cakesGained;
      }

      this.matchCount++;
      window.gameLog.log('match', {
        size,
        kind: matchKind,
        tileType: TILE_TEXTURE[type] || type,
        spawn: spawnType != null ? (TILE_TEXTURE[spawnType] || spawnType) : null,
        cakesGained,
        cakesNow: this.cakesCollected,
        matchN: this.matchCount
      });

      if (spawnType != null) {
        // Ставимо spawn у центр групи
        const mid = group[Math.floor(group.length / 2)];
        spawns.push({ r: mid.r, c: mid.c, type: spawnType });
      }
    });

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
    let hasMove = false;
    for (let r = 0; r < GRID_SIZE && !hasMove; r++) {
      for (let c = 0; c < GRID_SIZE && !hasMove; c++) {
        // Try right
        if (c + 1 < GRID_SIZE) {
          this.swapData(r, c, r, c + 1);
          if (this.findAllMatches().length > 0) hasMove = true;
          this.swapData(r, c, r, c + 1); // revert
        }
        // Try down
        if (r + 1 < GRID_SIZE) {
          this.swapData(r, c, r + 1, c);
          if (this.findAllMatches().length > 0) hasMove = true;
          this.swapData(r, c, r + 1, c);
        }
      }
    }
    if (!hasMove) {
      this.autoReshuffle();
    }
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
    this.add.text(
      BOARD_OFFSET_X + (GRID_SIZE * TILE_SIZE)/2,
      BOARD_OFFSET_Y + (GRID_SIZE * TILE_SIZE)/2,
      '🔄 Перемішування...',
      { fontSize: '20px', color: '#fff', backgroundColor: '#5D4037' }
    ).setOrigin(0.5).setDepth(10).setName('reshuffleText');

    // Перемішуємо лише інгредієнти та ягоди (не випічку/перешкоди)
    const isShuffleable = (t) => BASIC_TILES.includes(t) || BONUS_TILES.includes(t);
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
      // Find a cupcake and turn to cake
      let found = false;
      for (let r = 0; r < GRID_SIZE && !found; r++) {
        for (let c = 0; c < GRID_SIZE && !found; c++) {
          if (this.grid[r][c] === TILE.CUPCAKE) {
            this.grid[r][c] = TILE.CAKE;
            this.cakesCollected++;
            this.updateTargetUI();
            this.drawGrid();
            found = true;
            this.showToast('🐉 Капкейк → Торт!');
          }
        }
      }
      if (!found) this.showToast('🐉 Немає капкейків на полі');
    }
  }

  updateTargetUI() {
    let label = '🎂';
    if (this.targetType === 'coffee') label = '☕';
    if (this.targetType === 'clean_burnt') label = '🍪';
    this.targetText.setText(`${label} ${this.cakesCollected} / ${this.targetCount}`);
  }

  checkVictory() {
    if (this.cakesCollected >= this.targetCount) {
      this.timerEvent.remove();
      this.showVictory();
    }
  }

  showToast(msg) {
    const t = this.add.text(
      this.cameras.main.width / 2,
      100,
      msg,
      { fontSize: '18px', color: '#fff', backgroundColor: '#5D4037', padding: { x: 12, y: 6 } }
    ).setOrigin(0.5).setDepth(20);
    this.tweens.add({
      targets: t, alpha: 0, y: 70, duration: 1500, delay: 800,
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
    this.add.text(width/2, height/2 - 40, '🎉 Level Complete! 🎉', {
      fontSize: '36px', color: '#FFD700', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(31);

    const nextBtn = this.add.rectangle(width/2, height/2 + 40, 200, 50, 0x4CAF50)
      .setInteractive({ useHandCursor: true })
      .setDepth(31)
      .on('pointerdown', () => {
        if (this.levelIndex < 9) {
          this.scene.restart({ levelIndex: this.levelIndex + 1 });
        } else {
          this.scene.start('Menu');
        }
      });
    this.add.text(width/2, height/2 + 40, this.levelIndex < 9 ? 'Наступний рівень' : 'В меню', {
      fontSize: '18px', color: '#fff'
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
    this.add.text(width/2, height/2 - 40, '⏰ Time\'s Up!', {
      fontSize: '36px', color: '#FF5252', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(31);

    const retryBtn = this.add.rectangle(width/2, height/2 + 40, 180, 50, 0xE67E22)
      .setInteractive({ useHandCursor: true })
      .setDepth(31)
      .on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));
    this.add.text(width/2, height/2 + 40, 'Try Again', {
      fontSize: '18px', color: '#fff'
    }).setOrigin(0.5).setDepth(32);
  }
}

const config = {
  type: Phaser.AUTO,
  width: GAME_W,   // 960
  height: GAME_H,  // ~1122
  parent: 'game-container',
  backgroundColor: '#f5e6c8',
  scene: [BootScene, MenuScene, GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

const game = new Phaser.Game(config);
