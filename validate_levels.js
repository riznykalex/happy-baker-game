// Валідатор levels.json за ТЗ (TZ_LEVELS.md, розділ 7).
// Запуск: node validate_levels.js levels.json
// Zero-dependency, працює в будь-якому Node 12+.

const fs = require('fs');
const path = require('path');

const file = process.argv[2] || 'levels.json';
const EXPECTED = 53;
const BOARD = 7; // 7x7, клітинки 0..6

const TARGET_TYPES = ['cakes', 'coffee', 'guests', 'combo_target', 'layered_cake', 'clear_obstacles'];
const OBSTACLE_TYPES = ['burnt', 'ice', 'box'];
const TOOLS = ['rollingpin', 'spatula'];
const HELPERS = ['owl', 'fox', 'dragon'];
const WEIGHT_KEYS = ['flour', 'milk', 'spice', 'butter', 'coffee', 'rollingpin', 'spatula', 'strawberry', 'blueberry'];
const LEVEL_KEYS = ['level', 'name', 'description', 'timer_seconds', 'moves_limit', 'target_type', 'target_count',
  'target_details', 'obstacles', 'tile_weights', 'tools', 'berry_type', 'allowed_helpers', 'ingredient_goals'];
const OBSTACLE_KEYS = ['type', 'count', 'cells'];
const GOAL_KEYS = ['flour', 'milk', 'spice', 'butter', 'berries'];

let data;
try {
  data = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
} catch (e) {
  console.error(`✖ Не вдалося прочитати/розпарсити ${file}: ${e.message}`);
  process.exit(1);
}

const errors = [];
const warnings = [];
const fail = (level, msg) => errors.push(`L${level}: ${msg}`);
const warn = (level, msg) => warnings.push(`L${level}: ${msg}`);

// 1. Загальні перевірки масиву
if (!Array.isArray(data)) fail(0, 'корінь має бути масивом');
if (data.length !== EXPECTED) fail(0, `очікується ${EXPECTED} рівнів, отримано ${data.length}`);

const seen = new Set();
for (const lv of data) {
  const n = lv.level;
  if (typeof n !== 'number' || !Number.isInteger(n)) { fail('?', 'level має бути цілим числом'); continue; }
  if (n < 1 || n > EXPECTED) fail(n, `level поза діапазоном 1..${EXPECTED}`);
  if (seen.has(n)) fail(n, 'level дублюється');
  seen.add(n);

  // 2. Обов'язкові поля та типи
  for (const k of Object.keys(lv)) {
    if (!LEVEL_KEYS.includes(k)) fail(n, `невідоме поле "${k}"`);
  }
  if (typeof lv.timer_seconds !== 'number' || lv.timer_seconds < 60 || lv.timer_seconds > 180)
    fail(n, 'timer_seconds має бути числом 60..180');
  if (lv.moves_limit !== undefined && lv.moves_limit !== null)
    fail(n, 'moves_limit має бути null');
  if (!TARGET_TYPES.includes(lv.target_type)) fail(n, `target_type має бути одним із ${TARGET_TYPES.join(', ')}`);

  // 3. target_count / target_details узгодженість
  const tt = lv.target_type;
  const needsCount = ['cakes', 'coffee', 'layered_cake'].includes(tt);
  if (needsCount && (typeof lv.target_count !== 'number' || lv.target_count < 1))
    fail(n, `${tt}: target_count обов'язковий, ≥ 1`);
  if (tt === 'guests') {
    if (!lv.target_details || typeof lv.target_details !== 'object') fail(n, 'guests: target_details обов\'язковий');
    else {
      const keys = Object.keys(lv.target_details);
      const allowed = ['flour', 'milk', 'spice', 'butter', 'berries'];
      let any = false;
      for (const k of keys) {
        if (!allowed.includes(k)) fail(n, `guests: невідомий інгредієнт "${k}"`);
        if (typeof lv.target_details[k] !== 'number' || lv.target_details[k] < 0 || lv.target_details[k] > 50)
          fail(n, `guests: ${k} має бути 0..50`);
        if (lv.target_details[k] > 0) any = true;
      }
      if (!any) fail(n, 'guests: принаймні один інгредієнт > 0');
    }
  }
  if (tt === 'combo_target') {
    const d = lv.target_details || {};
    if (typeof d.cakes !== 'number' || d.cakes < 1) fail(n, 'combo_target: target_details.cakes ≥ 1');
    if (typeof d.cupcakes !== 'number' || d.cupcakes < 1) fail(n, 'combo_target: target_details.cupcakes ≥ 1');
  }
  if (tt === 'layered_cake') {
    const d = lv.target_details || {};
    if (d.cupcakes_needed !== 3) fail(n, 'layered_cake: target_details.cupcakes_needed = 3');
  }
  if (tt === 'clear_obstacles') {
    const d = lv.target_details || {};
    for (const k of Object.keys(d)) {
      if (!OBSTACLE_TYPES.includes(k)) fail(n, `clear_obstacles: невідомий тип "${k}"`);
      if (typeof d[k] !== 'number' || d[k] < 1) fail(n, `clear_obstacles: ${k} ≥ 1`);
    }
  }

  // 4. tile_weights
  if (lv.tile_weights !== undefined) {
    const w = lv.tile_weights;
    const keys = Object.keys(w);
    if (keys.length !== WEIGHT_KEYS.length) fail(n, `tile_weights: очікується ${WEIGHT_KEYS.length} ключів, отримано ${keys.length}`);
    let sum = 0;
    for (const k of WEIGHT_KEYS) {
      if (typeof w[k] !== 'number' || !(w[k] > 0)) { fail(n, `tile_weights.${k} > 0`); continue; }
      sum += w[k];
    }
    if (Math.abs(sum - 1.0) > 0.01) fail(n, `tile_weights: сума ${sum.toFixed(3)} ≠ 1.00`);
    const vals = WEIGHT_KEYS.filter(k => typeof w[k] === 'number').map(k => w[k]);
    if (vals.length === WEIGHT_KEYS.length) {
      const max = Math.max(...vals), min = Math.min(...vals);
      if (n >= 26 && max / min > 3.5) warn(n, `tile_weights: max/min = ${(max / min).toFixed(2)} > 3.5 (хвиля 6+)`);
    }
    for (const t of (lv.tools || [])) {
      if (w[t] !== undefined && w[t] < 0.03) fail(n, `tile_weights.${t} ≥ 0.03, бо інструмент у tools`);
    }
  }

  // 5. Перешкоди
  if (lv.obstacles !== undefined) {
    let total = 0;
    for (const o of lv.obstacles) {
      for (const k of Object.keys(o)) if (!OBSTACLE_KEYS.includes(k)) fail(n, `obstacle: невідоме поле "${k}"`);
      if (!OBSTACLE_TYPES.includes(o.type)) fail(n, `obstacle.type "${o.type}" поза переліком`);
      if (o.count !== undefined) {
        if (typeof o.count !== 'number' || o.count < 1) fail(n, `obstacle ${o.type}: count ≥ 1`);
        total += o.count;
      }
      if (o.cells !== undefined) {
        for (const c of o.cells) {
          if (!Array.isArray(c) || c.length !== 2 || !c.every(v => Number.isInteger(v) && v >= 0 && v < BOARD))
            fail(n, `obstacle ${o.type}: cells мають бути [r,c] у межах 0..${BOARD - 1}`);
        }
        total += o.cells.length;
      }
      if (o.count === undefined && o.cells === undefined)
        fail(n, `obstacle ${o.type}: потрібен count або cells`);
    }
    if (total > 16) fail(n, `перешкод забагато: ${total} > 16`);
    if (lv.target_type === 'clear_obstacles') {
      for (const k of Object.keys(lv.target_details || {})) {
        const ob = (lv.obstacles || []).filter(o => o.type === k).reduce((s, o) => s + (o.count || o.cells.length), 0);
        if (lv.target_details[k] !== ob)
          fail(n, `clear_obstacles: ${k} у цілі (${lv.target_details[k]}) ≠ в obstacles (${ob})`);
      }
    }
  }

  // 6. Підмножини
  if (lv.tools !== undefined && !(lv.tools.every(t => TOOLS.includes(t)))) fail(n, 'tools: невідомі інструменти');
  if (lv.allowed_helpers !== undefined && !(lv.allowed_helpers.every(h => HELPERS.includes(h))))
    fail(n, 'allowed_helpers: невідомі помічники');
  if (lv.berry_type !== undefined && lv.berry_type !== null && !['strawberry', 'blueberry'].includes(lv.berry_type))
    fail(n, 'berry_type: strawberry | blueberry | null');
  if (typeof lv.name === 'string' && lv.name.length > 40) warn(n, `name довше 40 символів`);
}

// Відсутні рівні
for (let i = 1; i <= EXPECTED; i++) if (!seen.has(i)) fail(i, 'рівень відсутній');

console.log(`— Файл: ${file}`);
console.log(`— Рівнів: ${seen.size}/${EXPECTED}`);
if (warnings.length) {
  console.log(`\n! Попередження (${warnings.length}):`);
  for (const w of warnings) console.log('  ' + w);
}
if (errors.length) {
  console.log(`\n✖ Помилки (${errors.length}):`);
  for (const e of errors) console.log('  ' + e);
  process.exit(1);
}
console.log('\n✔ Валідація пройдена: 0 помилок.');
