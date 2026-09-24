import { openStore, whoAmI, setMe, homeId, setHomeId, newHomeId, inviteLink, cloudEnabled } from './store.js';
import {
  newState, applyCare, addNote, catStats, stageOf, pointLevel, mood, otherId, STAGES, STATS, STAT_LABEL,
  localTime, localHour, isNight, ago, daysUntil, togetherStreak,
} from './state.js';
import { personFrames, catFrames, drawBubble, drawHeart } from './sprites.js';
import {
  T, COLS, ROWS, DOOR, objectAt, solidFor, bakeStatic,
  drawWindow, drawClock, drawCalendar, drawBoard, drawFood, drawLitter,
} from './room.js';
import { say, choose, panel, toast, ask, uiBusy, uiKey } from './ui.js';

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome';
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');

let store = null;
let S = newState();
let me = whoAmI();
const other = () => otherId(me);
const nameOf = id => S.players[id]?.name || (id === 'a' ? 'Player 1' : 'Player 2');
const catName = () => S.cat.name || 'the kitten';
const CatName = () => S.cat.name || 'The kitten';
const place = tz => (tz || '').split('/').pop().replace(/_/g, ' ') || 'far away';

// ------------------------------------------------------------------ screen size

// The short side of the screen always shows 10 tiles; the camera follows you along the long side.
const view = { w: 240, h: 160, s: 2 };
function fit() {
  const W = innerWidth, H = innerHeight;
  const s = Math.min(W, H) / 160;
  view.s = s;
  view.w = Math.ceil(W / s);
  view.h = Math.ceil(H / s);
  cv.width = view.w; cv.height = view.h;
  cv.style.width = view.w * s + 'px';
  cv.style.height = view.h * s + 'px';
  document.documentElement.style.setProperty('--u', s + 'px');
}
addEventListener('resize', fit);
addEventListener('orientationchange', () => setTimeout(fit, 200));
fit();

// ------------------------------------------------------------------ input

const held = { up: false, down: false, left: false, right: false };
const DIRS = ['up', 'down', 'left', 'right'];
let lastDirPressed = null;

function press(k) {
  if (DIRS.includes(k)) lastDirPressed = k;
  if (uiKey(k)) return;
  if (onTitle) { if (k === 'a' || k === 'start') onTitle(); return; }
  if (busy) return;
  if (k === 'a') run(interact);
  if (k === 'start' || k === 'select') run(startMenu);
}

const KEYMAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  z: 'a', ' ': 'a', x: 'b', Escape: 'b', Backspace: 'b', Enter: 'start', Shift: 'select',
};
addEventListener('keydown', e => {
  if (e.target.closest?.('input,textarea,select')) return;
  const k = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase?.()];
  if (!k) return;
  e.preventDefault();
  if (DIRS.includes(k)) { if (!held[k]) press(k); held[k] = true; }
  else if (!e.repeat) press(k);
});
addEventListener('keyup', e => {
  const k = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase?.()];
  if (k && DIRS.includes(k)) held[k] = false;
});
addEventListener('blur', () => DIRS.forEach(d => (held[d] = false)));

// Floating joystick: put a thumb down anywhere and drag. A quick tap is the A button.
const screenEl = document.getElementById('screen');
const joy = document.getElementById('joy'), knob = joy.querySelector('.knob');
let stick = null;   // { id, x, y, t, moved }
let stickDir = null;
function setStick(dir) {
  if (dir === stickDir) return;
  DIRS.forEach(d => { held[d] = d === dir; });
  stickDir = dir;
  if (dir) press(dir);
}
screenEl.addEventListener('pointerdown', e => {
  if (stick || onTitle || e.target.closest('#dialog,#choices,#panel,#menu-btn,#title')) return;
  e.preventDefault();
  try { screenEl.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
  stick = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
  joy.style.left = e.clientX + 'px';
  joy.style.top = e.clientY + 'px';
  knob.style.transform = '';
});
screenEl.addEventListener('pointermove', e => {
  if (!stick || e.pointerId !== stick.id) return;
  const dx = e.clientX - stick.x, dy = e.clientY - stick.y, d = Math.hypot(dx, dy);
  if (d > 14) { stick.moved = true; joy.classList.add('on'); }
  if (!stick.moved) return;
  const k = Math.min(d, 42) / (d || 1);
  knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  setStick(d < 14 ? null : Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'));
});
function endStick(e) {
  if (!stick || e.pointerId !== stick.id) return;
  const tap = !stick.moved && performance.now() - stick.t < 350;
  stick = null;
  joy.classList.remove('on');
  setStick(null);
  if (tap) press(!document.getElementById('choices').hidden ? 'b' : 'a');
}
for (const ev of ['pointerup', 'pointercancel']) screenEl.addEventListener(ev, endStick);

document.getElementById('menu-btn').addEventListener('pointerdown', e => {
  e.preventDefault();
  e.stopPropagation();
  press(uiBusy() ? 'b' : 'start');
});

// iOS Safari ignores "user-scalable=no": stop double-tap and pinch zoom by hand (forms excepted).
document.addEventListener('touchstart', e => { if (!e.target.closest('#modal')) e.preventDefault(); }, { passive: false });
document.addEventListener('touchmove', e => { if (!e.target.closest('#modal')) e.preventDefault(); }, { passive: false });
for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', e => e.preventDefault());

// ------------------------------------------------------------------ world

const bg = bakeStatic();
const solid = solidFor('player');
const catSolid = solidFor('cat');
const SPAWN = { a: { x: 6, y: 7 }, b: { x: 8, y: 7 } };

let busy = false;
async function run(fn) {
  if (busy) return;
  busy = true;
  try { await fn(); } finally { busy = false; }
}

const looks = {};
function looksOf(id) {
  const p = S.players[id];
  const hair = p?.hair || (id === 'a' ? 'short' : 'long');
  if (!looks[id] || looks[id].hair !== hair) looks[id] = { hair, f: personFrames(hair) };
  return looks[id].f;
}

const player = { tx: 6, ty: 7, x: 96, y: 112, dir: 'down', moving: false, t: 0, fx: 0, fy: 0, step: 0, turn: 0 };
const buddy = { x: 128, y: 112, dir: 'down' };   // the other player, smoothed

function placePlayer() {
  const p = S.pos[me] || SPAWN[me];
  player.tx = p.x; player.ty = p.y; player.x = p.x * T; player.y = p.y * T; player.dir = p.dir || 'down';
}

function buddyTarget() {
  const p = S.pos[other()] || SPAWN[other()];
  return { x: p.x * T, y: p.y * T, dir: p.dir || 'down', tx: p.x, ty: p.y };
}
const buddyAsleep = () => {
  const tz = S.players[other()]?.tz;
  return !!tz && isNight(localHour(tz));
};

function tileFree(x, y, forCat = false) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
  if ((forCat ? catSolid : solid)[y][x]) return false;
  if (!forCat) {
    if (catTile().x === x && catTile().y === y) return false;
    if (!buddyAsleep()) { const b = buddyTarget(); if (b.tx === x && b.ty === y) return false; }
  }
  return true;
}

const STEP = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const heldDir = () => (held[lastDirPressed] ? lastDirPressed : DIRS.find(d => held[d]));

function updatePlayer(dt) {
  if (player.moving) {
    player.t += dt / 0.24;
    if (player.t >= 1) {
      player.moving = false;
      player.tx += player.fx; player.ty += player.fy;
      player.x = player.tx * T; player.y = player.ty * T;
      player.step ^= 1;
    } else {
      player.x = (player.tx + player.fx * player.t) * T;
      player.y = (player.ty + player.fy * player.t) * T;
      return;
    }
  }
  const d = busy || uiBusy() || onTitle ? null : heldDir();
  if (!d) { syncPos(); return; }
  if (d !== player.dir) { player.dir = d; player.turn = 0.09; return; }
  if (player.turn > 0) { player.turn -= dt; return; }
  const [fx, fy] = STEP[d];
  const nx = player.tx + fx, ny = player.ty + fy;
  if (ny === ROWS && player.tx === DOOR.x && d === 'down') { run(useDoor); return; }
  if (!tileFree(nx, ny)) return;
  Object.assign(player, { moving: true, t: 0, fx, fy });
}

let syncedAt = '';
function syncPos() {
  const key = `${player.tx},${player.ty},${player.dir}`;
  if (key === syncedAt || !S.players[me]) return;
  syncedAt = key;
  store.update(s => { s.pos[me] = { x: player.tx, y: player.ty, dir: player.dir, t: Date.now() }; });
}

function updateBuddy(dt) {
  const b = buddyTarget();
  const dx = b.x - buddy.x, dy = b.y - buddy.y, dist = Math.hypot(dx, dy);
  if (dist > 64 || dist < 0.5) { buddy.x = b.x; buddy.y = b.y; buddy.moving = false; buddy.dir = b.dir; return; }
  const v = Math.min(dist, 66 * dt);
  buddy.x += dx / dist * v; buddy.y += dy / dist * v;
  buddy.moving = true;
  buddy.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
  buddy.walkT = (buddy.walkT || 0) + dt;
}

// ------------------------------------------------------------------ the cat

const cat = { x: 7 * T, y: 5 * T, path: [], state: 'idle', timer: 1.5, face: 0, walkT: 0, hop: 0 };
let catArt = null, catArtKey = '';
function catSprites() {
  const key = `${Math.round(pointLevel(S.cat.xp) * 20)}:${stageOf(S.cat.xp)}`;
  if (key !== catArtKey) { catArt = catFrames(pointLevel(S.cat.xp), stageOf(S.cat.xp)); catArtKey = key; }
  return catArt;
}
const catTile = () => ({ x: Math.round(cat.x / T), y: Math.round(cat.y / T) });

function pathTo(tx, ty) {
  const start = catTile();
  const key = (x, y) => y * COLS + x;
  const prev = new Map([[key(start.x, start.y), null]]);
  const q = [[start.x, start.y]];
  while (q.length) {
    const [x, y] = q.shift();
    if (x === tx && y === ty) {
      const path = [];
      let k = key(x, y);
      while (k !== null && k !== key(start.x, start.y)) { path.unshift({ x: k % COLS, y: Math.floor(k / COLS) }); k = prev.get(k); }
      return path;
    }
    for (const [dx, dy] of Object.values(STEP)) {
      const nx = x + dx, ny = y + dy;
      if (tileFree(nx, ny, true) && !prev.has(key(nx, ny))) { prev.set(key(nx, ny), key(x, y)); q.push([nx, ny]); }
    }
  }
  return null;
}

function catGo(tx, ty, then = 'idle', timer = 2) {
  const p = pathTo(tx, ty);
  if (!p) return false;
  Object.assign(cat, { path: p, state: 'walk', then, thenTimer: timer });
  return true;
}

function catDecide() {
  const st = catStats(S.cat);
  const r = Math.random();
  if (st.full < 30 && Math.random() < 0.6) { if (catGo(12, 5, 'beg', 6)) return; }
  if (r < 0.14) { if (catGo(3, 5, 'sleep', 14 + Math.random() * 16)) return; }
  if (r < 0.34) {
    const [fx, fy] = STEP[['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)]];
    if (catGo(player.tx + fx, player.ty + fy, 'idle', 4)) return;
  }
  if (r < 0.75) {
    for (let i = 0; i < 10; i++) {
      const x = Math.floor(Math.random() * COLS), y = 2 + Math.floor(Math.random() * (ROWS - 2));
      if (tileFree(x, y, true) && catGo(x, y, 'idle', 2 + Math.random() * 3)) return;
    }
  }
  Object.assign(cat, { state: 'idle', timer: 2 + Math.random() * 4 });
}

function updateCat(dt) {
  cat.walkT += dt;
  if (cat.state === 'walk') {
    const n = cat.path[0];
    if (!n) { cat.state = cat.then; cat.timer = cat.thenTimer; return; }
    const tx = n.x * T, ty = n.y * T, dx = tx - cat.x, dy = ty - cat.y, dist = Math.hypot(dx, dy);
    if (dx) cat.face = dx < 0 ? 0 : 1;
    const v = 34 * dt;
    if (dist <= v) { cat.x = tx; cat.y = ty; cat.path.shift(); }
    else { cat.x += dx / dist * v; cat.y += dy / dist * v; }
    return;
  }
  cat.hop = cat.state === 'play' ? Math.abs(Math.sin(cat.walkT * 9)) * 5 : 0;
  cat.timer -= dt;
  if (cat.timer <= 0) catDecide();
}

// What the cat is asking for, if anything.
function catNeed() {
  if (cat.state === 'sleep') return 'z';
  const st = catStats(S.cat);
  if (st.full < 30) return 'fish';
  if (st.litter < 30) return 'stink';
  if (st.fun < 30) return 'ball';
  if (st.clean < 30) return 'brush';
  if (missesBuddy()) return 'heart';
  return null;
}
const missesBuddy = () => S.players[other()]?.tz && Date.now() - (S.cat.care[other()] || 0) > 36 * 3600e3;

// ------------------------------------------------------------------ effects

const particles = [];
function hearts(x, y, n = 4) {
  for (let i = 0; i < n; i++) particles.push({ x: x + Math.random() * 12 - 2, y: y + Math.random() * 4, vy: -12 - Math.random() * 8, life: 1.2 + Math.random() * 0.6, kind: 'heart', delay: i * 0.15 });
}
function sparkles(x, y, n = 6) {
  for (let i = 0; i < n; i++) particles.push({ x: x + Math.random() * 16, y: y + Math.random() * 12, vy: -6, life: 0.8 + Math.random() * 0.5, kind: 'spark', delay: i * 0.08 });
}
function updateParticles(dt) {
  for (const p of particles) {
    if (p.delay > 0) { p.delay -= dt; continue; }
    p.y += p.vy * dt; p.life -= dt;
  }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
}

// ------------------------------------------------------------------ drawing

function drawPerson(frames, x, y, dir, frame, bob) {
  ctx.drawImage(frames[dir][frame], Math.round(x), Math.round(y) - 4 + bob);
}

const cam = { x: 0, y: 0 };
function updateCamera() {
  const axis = (p, size, room) => (size >= room ? -Math.floor((size - room) / 2) : Math.round(Math.max(0, Math.min(room - size, p - size / 2))));
  cam.x = axis(player.x + 8, view.w, COLS * T);
  cam.y = axis(player.y + 8, view.h, ROWS * T);
}

// The space around the room: a night sky between Italy and Thailand, drifting slowly.
const STARS = Array.from({ length: 70 }, (_, i) => ({
  x: (i * 97) % 256, y: (i * 61 + (i * i) % 37) % 256, big: i % 9 === 0, phase: i * 0.7,
}));
function drawSky(now) {
  ctx.fillStyle = '#15102b';
  ctx.fillRect(0, 0, cv.width, cv.height);
  const drift = now / 4000;
  for (let ox = 0; ox < cv.width + 256; ox += 256) {
    for (let oy = 0; oy < cv.height + 256; oy += 256) {
      for (const st of STARS) {
        const x = Math.floor((st.x + drift + cam.x * -0.3) % 256 + 256) % 256 + ox - 256 / 2;
        const y = Math.floor((st.y + cam.y * -0.3) % 256 + 256) % 256 + oy - 256 / 2;
        const on = Math.sin(now / 700 + st.phase) > -0.6;
        ctx.fillStyle = on ? '#fff6c9' : '#6b5fa8';
        ctx.fillRect(x, y, 1, 1);
        if (st.big && on) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
      }
    }
  }
}

function render(now) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  updateCamera();
  drawSky(now);
  ctx.setTransform(1, 0, 0, 1, -cam.x, -cam.y);
  ctx.fillStyle = '#000';
  ctx.fillRect(-2, -2, COLS * T + 4, ROWS * T + 4);
  ctx.drawImage(bg, 0, 0);
  const tzOther = S.players[other()]?.tz || (TZ.includes('Bangkok') ? 'Europe/Rome' : 'Asia/Bangkok');
  drawWindow(ctx, tzOther, now);
  drawClock(ctx, now);
  drawCalendar(ctx, !!S.meet);
  drawBoard(ctx, S.notes.length, unreadNotes().length > 0);
  const st = catStats(S.cat, now);
  drawFood(ctx, st.full / 100);
  drawLitter(ctx, 1 - st.litter / 100);

  const sprites = [];
  if (S.players[other()]) {
    if (buddyAsleep()) {
      const bx = other() === 'a' ? 0 : 16;
      ctx.drawImage(looksOf(other()).sleep, bx, 31);
      if (Math.floor(now / 1000) % 3 !== 0) drawBubble(ctx, bx + 8, 14, 'z');
    } else {
      const f = buddy.moving ? (Math.floor(buddy.walkT * 8) % 2) + 1 : 0;
      sprites.push({ y: buddy.y, draw: () => drawPerson(looksOf(other()), buddy.x, buddy.y, buddy.dir, f, 0) });
    }
  }
  const pf = player.moving && player.t < 0.5 ? 1 + player.step : 0;
  sprites.push({ y: player.y, draw: () => drawPerson(looksOf(me), player.x, player.y, player.dir, pf, pf ? -1 : 0) });

  const art = catSprites();
  sprites.push({
    y: cat.y - 1,
    draw: () => {
      let img;
      if (cat.state === 'walk') img = art.walk[cat.face][Math.floor(cat.walkT * 6) % 2];
      else if (cat.state === 'sleep') img = art.sleep[cat.face];
      else img = (now % 3700 < 160 ? art.blink : art.sit)[cat.face];
      ctx.drawImage(img, Math.round(cat.x), Math.round(cat.y - cat.hop) - 3);
    },
  });

  sprites.sort((a, b) => a.y - b.y).forEach(s => s.draw());

  const need = catNeed();
  if (need && (need === 'z' || now % 6000 < 2600)) drawBubble(ctx, Math.round(cat.x) + 9, Math.round(cat.y) - 16, need);

  for (const p of particles) {
    if (p.delay > 0) continue;
    if (p.kind === 'heart') drawHeart(ctx, Math.round(p.x), Math.round(p.y), p.life < 0.3 ? '#f7a8bd' : '#e0476c');
    else { ctx.fillStyle = p.life > 0.4 ? '#fff6c9' : '#ffd98e'; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) + 1, 3, 1); ctx.fillRect(Math.round(p.x), Math.round(p.y) + 2, 1, 1); }
  }

  // night where you are: dim the room, the lamp keeps a warm corner
  if (isNight(localHour(TZ, now))) {
    ctx.fillStyle = 'rgba(30, 30, 90, 0.28)';
    ctx.fillRect(0, 0, COLS * T, ROWS * T);
    const g = ctx.createRadialGradient(40, 30, 2, 40, 30, 46);
    g.addColorStop(0, 'rgba(255, 217, 142, 0.35)');
    g.addColorStop(1, 'rgba(255, 217, 142, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 100, 90);
  }
}

// ------------------------------------------------------------------ interactions

function frontTile() {
  const [fx, fy] = STEP[player.dir];
  return { x: player.tx + fx, y: player.ty + fy };
}

async function interact() {
  if (player.moving) return;
  const f = frontTile();
  const ct = catTile();
  if (ct.x === f.x && ct.y === f.y) return catMenu();
  const b = buddyTarget();
  if (!buddyAsleep() && b.tx === f.x && b.ty === f.y && S.players[other()]) return talkToBuddy();
  if (f.y === ROWS && f.x === DOOR.x) return useDoor();
  const o = objectAt(f.x, f.y);
  if (o && HANDLERS[o.id]) return HANDLERS[o.id]();
}

async function care(kind) {
  const res = store.update(s => applyCare(s, me, kind));
  if (res.xp) toast(`+${res.xp} XP${res.together ? '  ♥ together bonus' : ''}`);
  if (res.grew !== null) {
    await say([`${CatName()} grew into a ${STAGES[res.grew].name}!`, 'Look: the colour on the ears, face and paws is getting darker.']);
  }
  return res;
}

async function catMenu() {
  if (!S.cat.name) await nameCat();
  const opts = ['PET', 'PLAY', 'BRUSH', 'STATUS'];
  const i = await choose([...opts, 'BACK'], `${CatName()} looks at you.`);
  const st = catStats(S.cat);
  const cx = cat.x, cy = cat.y;
  if (opts[i] === 'PET') {
    hearts(cx + 2, cy - 4);
    if (cat.state === 'sleep') await say(`${CatName()} is sleeping... you pet very gently. Prrr...`);
    else await say(`You pet ${catName()}. Prrrrr...`);
    if (missesBuddy()) await say(`${CatName()} keeps looking at the door. Missing ${nameOf(other())}...`);
    await care('pet');
  } else if (opts[i] === 'PLAY') {
    if (st.fun > 92) return say(`${CatName()} is too tired to play. Maybe later!`);
    Object.assign(cat, { state: 'play', timer: 3, path: [] });
    hearts(cx + 2, cy - 4, 3);
    await say(`You wave the feather toy. ${CatName()} pounces!`);
    await care('play');
  } else if (opts[i] === 'BRUSH') {
    if (st.clean > 92) return say(`${CatName()}'s fur is already shiny.`);
    sparkles(cx, cy);
    await say(`Brush, brush... ${catName()}'s fur is soft and shiny.`);
    await care('brush');
  } else if (opts[i] === 'STATUS') {
    await catStatus();
  }
}

async function nameCat() {
  const p = S.cat.proposal;
  const o = nameOf(other());
  if (!p) {
    await say(["This little kitten doesn't have a name yet!", `You choose one, then ${o} says yes... or suggests another.`]);
    return suggestName();
  }
  if (p.by === me) {
    const i = await choose(['WAIT', 'CHANGE IDEA'], `You suggested "${p.name}". Waiting for ${o} to say yes...`);
    if (i === 1) return suggestName();
    return;
  }
  const i = await choose([`YES!`, 'OTHER NAME'], `${o} wants to call the kitten "${p.name}". Do you like it?`);
  if (i === 0) {
    store.update(s => { s.cat.name = p.name; s.cat.proposal = null; });
    hearts(cat.x + 2, cat.y - 4, 6);
    await say(`It's decided: the kitten is called ${p.name}! ♥`);
  } else if (i === 1) return suggestName();
}

async function suggestName() {
  const v = await ask('Name the kitten', [{ name: 'n', label: 'Your idea', max: 14, required: true }], 'Suggest');
  if (!v?.n) return;
  store.update(s => { s.cat.proposal = { by: me, name: v.n }; });
  await say(`You suggested "${v.n}". Now ${nameOf(other())} has to agree!`);
}

async function catStatus() {
  const st = catStats(S.cat);
  const stage = stageOf(S.cat.xp);
  const next = STAGES[stage + 1];
  await panel(el => {
    const h = document.createElement('h3');
    h.innerHTML = `<span></span><span class="muted"></span>`;
    h.children[0].textContent = CatName();
    h.children[1].textContent = STAGES[stage].name;
    const cols = document.createElement('div');
    cols.className = 'cols';
    const pic = document.createElement('canvas');
    pic.width = 16; pic.height = 16;
    pic.getContext('2d').drawImage(catSprites().sit[0], 0, 0);
    const bars = document.createElement('div');
    bars.className = 'bars';
    for (const k of STATS) {
      const v = st[k];
      const row = document.createElement('div');
      row.className = 'bar';
      const col = v > 50 ? '#58c878' : v > 20 ? '#f2c14e' : '#e0476c';
      row.innerHTML = `<span>${STAT_LABEL[k]}</span><div class="track"><div class="fill" style="width:${v.toFixed(0)}%;background:${col}"></div></div>`;
      bars.appendChild(row);
    }
    cols.append(pic, bars);
    const info = document.createElement('div');
    const streak = togetherStreak(S.cat);
    const last = id => (S.cat.care[id] ? ago(S.cat.care[id]) : 'not yet');
    info.innerHTML = '<div></div><div></div><div class="muted"></div>';
    info.children[0].textContent = next ? `XP ${S.cat.xp}  ·  grows at ${next.from}` : `XP ${S.cat.xp}  ·  all grown up`;
    info.children[1].textContent = `Cared for together: ${streak} day${streak === 1 ? '' : 's'} in a row ♥`;
    info.children[2].textContent = `${nameOf('a')}: ${last('a')}  ·  ${nameOf('b')}: ${last('b')}`;
    const foot = document.createElement('div');
    foot.className = 'foot';
    foot.textContent = `mood ${Math.round(mood(st))}%  ·  A to close`;
    el.append(h, cols, info, foot);
  });
}

async function talkToBuddy() {
  const o = other(), tz = S.players[o]?.tz;
  const t = tz ? `It's ${localTime(tz)} in ${place(tz)}.` : `${nameOf(o)} hasn't opened the game yet!`;
  hearts(buddy.x + 2, buddy.y - 8, 3);
  await say([`${nameOf(o)} is here with you. ♥`, t]);
}

async function useDoor() {
  await say(['Outside there is the Game Park...', 'It is still being built! Minigames arrive in the next update.']);
  if (player.dir === 'down') { player.dir = 'up'; }
}

function unreadNotes() {
  const seen = +(localStorage.getItem(`halfway-home:seen:${me}`) || 0);
  return S.notes.filter(n => n.by !== me && n.t > seen);
}

async function readNotes() {
  if (!S.notes.length) return say('The board is empty. Leave the first note!');
  const list = [...S.notes].reverse().slice(0, 8);
  await say(list.map(n => `${nameOf(n.by)} · ${ago(n.t)}:\n${n.text}`));
  localStorage.setItem(`halfway-home:seen:${me}`, String(Date.now()));
}

async function writeNote(title = 'Leave a note') {
  const v = await ask(title, [{ name: 'text', type: 'textarea', label: `For ${nameOf(other())}`, max: 280, required: true }], 'Pin it');
  if (!v?.text) return;
  store.update(s => addNote(s, me, v.text));
  await say(`You pinned the note on the board. ${nameOf(other())} will see it next time!`);
}

const HANDLERS = {
  async board() {
    const n = unreadNotes().length;
    const i = await choose(['READ', 'WRITE', 'BACK'], n ? `The note board. ${n} new note${n > 1 ? 's' : ''}!` : 'The note board.');
    if (i === 0) return readNotes();
    if (i === 1) return writeNote();
  },
  async window() {
    const o = other(), tz = S.players[o]?.tz;
    if (!tz) return say(`Through this window you will see ${nameOf(o)}'s sky, once ${nameOf(o)} opens the game.`);
    const h = localHour(tz);
    const mood = isNight(h) ? 'The stars are out.' : h < 12 ? 'The morning sun is up.' : h < 17 ? 'A bright afternoon.' : 'The sun is going down.';
    await say([`Through this window you see ${nameOf(o)}'s sky.`, `It's ${localTime(tz)} in ${place(tz)}. ${mood}`]);
  },
  async clock() {
    const o = other(), tz = S.players[o]?.tz;
    const pages = [`Your time: ${localTime(TZ)}.`];
    if (tz) {
      const diff = Math.round(Math.abs(localHour(tz) - localHour(TZ) + 24) % 24);
      const gap = Math.min(diff, 24 - diff);
      pages[0] += `\n${nameOf(o)}'s time: ${localTime(tz)}.`;
      pages.push(`${gap} hours apart... but the same home.`);
    }
    await say(pages);
  },
  async calendar() {
    const d = daysUntil(S.meet);
    let msg = 'No date circled yet. When will you see each other?';
    if (d !== null) msg = d > 1 ? `${d} days until you see each other!` : d === 1 ? 'TOMORROW!!' : d === 0 ? 'TODAY! ♥ ♥ ♥' : 'That day has passed... circle the next one!';
    const i = await choose(['CHANGE DATE', 'OK'], msg);
    if (i !== 0) return;
    const v = await ask('Next time together', [{ name: 'date', type: 'date', label: 'Date', value: S.meet || '' }], 'Circle it');
    if (!v?.date) return;
    store.update(s => { s.meet = v.date; });
    const n = daysUntil(v.date);
    await say(n > 0 ? `Circled! ${n} day${n > 1 ? 's' : ''} to go.` : 'Circled!');
  },
  async bed() {
    if (buddyAsleep()) {
      const tz = S.players[other()].tz;
      return say(`${nameOf(other())} is sleeping... it's ${localTime(tz)} there. Shh!`);
    }
    const i = await choose(['GOODNIGHT NOTE', 'NOT NOW'], 'A cozy bed for two. Going to sleep?');
    if (i === 0) return writeNote('Goodnight note');
  },
  async food() {
    const st = catStats(S.cat);
    if (st.full > 90) return say(`${CatName()} isn't hungry right now.`);
    await care('feed');
    catGo(12, 5, 'eat', 4);
    await say(`You fill the bowl. ${CatName()} comes running!`);
  },
  async litter() {
    const st = catStats(S.cat);
    if (st.litter > 85) return say('The litter box is already clean!');
    await care('litter');
    sparkles(14 * T, 9 * T);
    await say('All clean. Fresh sand!');
  },
  water: () => say(`Fresh water. ${CatName()} drinks it one tiny lick at a time.`),
  counter: () => say('The cat food lives up here. Fill the bowl on the floor to feed the cat.'),
  fridge: () => say('An Italian magnet and a Thai magnet, side by side.'),
  lamp: () => say('A little lamp. It stays on for whoever comes home late.'),
  cattree: () => say(`${CatName()}'s scratching post. Very well scratched.`),
  catbed: () => say(`${CatName()}'s bed. It smells like a warm cat.`),
  plant: () => say('A plant. It is doing its best.'),
  table: () => say('Two cups. One for each of you.'),
  sofa: () => say('A comfy sofa. Movie nights are coming soon!'),
};

// ------------------------------------------------------------------ menus

async function startMenu() {
  const local = !store.cloud;
  const i = await choose([catName().toUpperCase(), 'NOTES', 'US TWO', 'OPTIONS', 'EXIT']);
  if (i === 0) return catStatus();
  if (i === 1) {
    const j = await choose(['READ', 'WRITE', 'BACK']);
    if (j === 0) return readNotes();
    if (j === 1) return writeNote();
  }
  if (i === 2) return usPanel();
  if (i === 3) {
    const opts = ['CHANGE MY LOOK'];
    if (!local) opts.push('INVITE');
    if (local) opts.push('PLAY AS ' + nameOf(other()).toUpperCase(), 'RESET HOME');
    const j = await choose([...opts, 'BACK']);
    if (j === 0) return changeLook();
    if (opts[j] === 'INVITE') return invite();
    if (opts[j]?.startsWith('PLAY AS')) {
      me = other(); setMe(me);
      const u = new URL(location.href); u.searchParams.delete('as'); history.replaceState(null, '', u);
      placePlayer(); syncedAt = '';
      return say(`You are now ${nameOf(me)}.`);
    }
    if (opts[j] === 'RESET HOME') {
      const k = await choose(['NO', 'YES, RESET'], 'Delete the whole home and start again?');
      if (k === 1) { store.reset(); localStorage.removeItem('halfway-home:me'); location.reload(); }
    }
  }
}

async function changeLook() {
  const v = await ask('Your look', [
    { name: 'hair', type: 'radio', label: 'Hair', value: S.players[me].hair, options: [['short', 'Short'], ['long', 'Long']] },
  ], 'Save');
  if (!v) return;
  store.update(s => { s.players[me].hair = v.hair; });
}

async function usPanel() {
  const a = S.players[me], b = S.players[other()];
  const d = daysUntil(S.meet);
  await panel(el => {
    const h = document.createElement('h3');
    h.textContent = `${a.name} ♥ ${b.name}`;
    const lines = [
      `${a.name}: ${localTime(TZ)} in ${place(TZ)}`,
      b.tz ? `${b.name}: ${localTime(b.tz)} in ${place(b.tz)}` : `${b.name}: hasn't moved in yet`,
      d === null ? 'Next date: not circled yet' : d >= 0 ? `Next date: ${d} day${d === 1 ? '' : 's'} to go` : 'Next date: circle a new one!',
      `Days caring for ${catName()} together: ${S.cat.together.length}`,
      `Notes on the board: ${S.notes.length}`,
    ];
    el.append(h, ...lines.map(t => { const p = document.createElement('div'); p.textContent = t; return p; }));
    const foot = document.createElement('div');
    foot.className = 'foot';
    foot.textContent = 'A to close';
    el.appendChild(foot);
  });
}

// ------------------------------------------------------------------ start-up

let onTitle = null;
function titleScreen() {
  const el = document.getElementById('title');
  el.hidden = false;
  return new Promise(done => {
    onTitle = () => { onTitle = null; el.hidden = true; done(); };
    el.addEventListener('pointerdown', () => onTitle?.(), { once: true });
  });
}

async function setup() {
  if (!S.players.a) {
    await say(['Welcome to HALFWAY HOME!', 'A little home halfway between Italy and Thailand...', '...and a kitten waiting for both of you.']);
    let v = null;
    while (!v) {
      v = await ask('Who lives here?', [
        { name: 'me', label: 'Your name', max: 12, required: true },
        { name: 'hairMe', type: 'radio', label: 'Your hair', options: [['short', 'Short'], ['long', 'Long']] },
        { name: 'you', label: "Your partner's name", max: 12, required: true },
        { name: 'hairYou', type: 'radio', label: 'Their hair', options: [['long', 'Long'], ['short', 'Short']] },
      ], 'Move in!');
    }
    store.update(s => {
      s.players.a = { name: v.me, hair: v.hairMe, tz: TZ };
      s.players.b = { name: v.you, hair: v.hairYou, tz: null };
    });
    me = 'a'; setMe('a');
    return true;
  }
  if (!me || !S.players[me]) {
    const i = await choose([S.players.a.name, S.players.b.name], 'Welcome home! Who are you?', { cancel: false });
    me = i === 1 ? 'b' : 'a'; setMe(me);
  }
  if (S.players[me].tz !== TZ) store.update(s => { s.players[me].tz = TZ; });
  return false;
}

// What happened while you were away.
async function welcome(first) {
  const o = other();
  if (first) {
    await say([`There's a kitten on the rug! It doesn't have a name yet.`, 'Walk up to it and press A.']);
    if (store.cloud) {
      await say(`Now let's invite ${nameOf(o)}, so they can move in too!`);
      await invite();
      await say('You can find the link again in START > OPTIONS > INVITE.');
    }
    return;
  }
  const key = `halfway-home:visit:${me}`;
  const last = +(localStorage.getItem(key) || 0);
  localStorage.setItem(key, String(Date.now()));
  const theirs = S.log.filter(e => e.by === o && e.t > last && e.kind !== 'pet');
  const lines = [];
  if (theirs.length) {
    const did = { feed: 'fed', play: 'played with', brush: 'brushed', litter: 'cleaned the litter of' };
    const e = theirs[theirs.length - 1];
    lines.push(`While you were away, ${nameOf(o)} ${did[e.kind]} ${catName()} (${ago(e.t)}).`);
  }
  const unread = unreadNotes().length;
  if (unread) lines.push(`${nameOf(o)} left you ${unread === 1 ? 'a note' : unread + ' notes'} on the board!`);
  if (S.cat.proposal && S.cat.proposal.by === o && !S.cat.name) lines.push(`${nameOf(o)} has an idea for the kitten's name! Go and see.`);
  if (lines.length) await say(lines);
}

// Pick the home (new, or the one in the invite link) and start listening to it.
async function connectHome() {
  let home = null;
  if (cloudEnabled()) {
    home = homeId();
    while (!home) {
      const i = await choose(['NEW HOME', 'I HAVE A LINK'], 'Welcome! Is this a new home, or were you invited?', { cancel: false });
      if (i === 0) home = newHomeId();
      else {
        const v = await ask('Join a home', [{ name: 'code', label: 'Paste the invite link or code', required: true }], 'Join');
        const m = v?.code.match(/home=([a-z0-9]+)/i) || v?.code.match(/^([a-z0-9]{8,})$/i);
        if (m) home = m[1];
        else if (v) await say("Hmm, that doesn't look like an invite link.");
      }
    }
    setHomeId(home);
  }
  store = openStore(home);
  await store.ready;
  S = store.get();
  let prevNotes = S.notes.length;
  store.subscribe(s => {
    S = s;
    if (S.notes.length > prevNotes && S.notes[S.notes.length - 1].by !== me && me) toast(`New note from ${nameOf(S.notes[S.notes.length - 1].by)}!`);
    prevNotes = S.notes.length;
  });
}

async function invite() {
  const link = inviteLink(store.home);
  const o = nameOf(other());
  if (navigator.share) {
    try { await navigator.share({ title: 'Halfway Home', text: `${nameOf(me)} invites you to our little home 🏠🐱`, url: link }); return; } catch { /* closed */ }
  }
  try { await navigator.clipboard.writeText(link); await say(`Link copied! Send it to ${o}.`); }
  catch { await say([`Send this link to ${o}:`, link]); }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (me && S.players[me]) {
    updatePlayer(dt);
    updateBuddy(dt);
    updateCat(dt);
    updateParticles(dt);
  }
  render(Date.now());
  requestAnimationFrame(frame);
}

async function main() {
  requestAnimationFrame(frame);
  await titleScreen();
  busy = true;
  await connectHome();
  const first = await setup();
  placePlayer();
  const b = buddyTarget(); buddy.x = b.x; buddy.y = b.y; buddy.dir = b.dir;
  await welcome(first);
  busy = false;
}

main();

if (['localhost', '127.0.0.1'].includes(location.hostname)) {
  // tick(s): advance the game by hand (requestAnimationFrame pauses in a hidden tab)
  const tick = (s = 1) => {
    for (let i = 0; i < s * 60; i++) { updatePlayer(1 / 60); updateBuddy(1 / 60); updateCat(1 / 60); updateParticles(1 / 60); }
    render(Date.now());
  };
  window.__hh = { player, cat, get store() { return store; }, held, press, tick, get S() { return S; }, catGo };
}

if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  navigator.serviceWorker.register('sw.js');
}
