// The room: a 15x10 grid of 16px tiles. Rows 0-1 are wall, 2-9 floor.

import { OUT, drawHeart } from './sprites.js';
import { localHour } from './state.js';

export const T = 16, COLS = 15, ROWS = 10;

// x, y, w, h in tiles. `wall` objects hang on the wall and are used from the floor below.
export const OBJECTS = [
  { id: 'board',    x: 3,  y: 1, w: 2, h: 1, wall: true },
  { id: 'window',   x: 6,  y: 1, w: 3, h: 1, wall: true },
  { id: 'clock',    x: 10, y: 1, w: 1, h: 1, wall: true },
  { id: 'calendar', x: 11, y: 1, w: 1, h: 1, wall: true },
  { id: 'bed',      x: 0,  y: 2, w: 2, h: 3 },
  { id: 'lamp',     x: 2,  y: 2, w: 1, h: 1 },
  { id: 'cattree',  x: 9,  y: 2, w: 1, h: 1 },
  { id: 'counter',  x: 12, y: 2, w: 2, h: 1 },
  { id: 'fridge',   x: 14, y: 2, w: 1, h: 1 },
  { id: 'food',     x: 12, y: 4, w: 1, h: 1 },
  { id: 'water',    x: 13, y: 4, w: 1, h: 1 },
  { id: 'catbed',   x: 3,  y: 5, w: 1, h: 1, catOk: true },
  { id: 'plant',    x: 0,  y: 6, w: 1, h: 1 },
  { id: 'table',    x: 10, y: 6, w: 2, h: 1 },
  { id: 'sofa',     x: 1,  y: 8, w: 3, h: 2 },
  { id: 'litter',   x: 14, y: 9, w: 1, h: 1 },
];

export const RUG = { x: 5, y: 4, w: 5, h: 3 };
export const DOOR = { x: 7, y: 9 };      // step off the bottom edge here

export function objectAt(tx, ty) {
  return OBJECTS.find(o => tx >= o.x && tx < o.x + o.w && ty >= o.y && ty < o.y + o.h);
}

// true = blocked
export function solidFor(who) {
  const g = [];
  for (let y = 0; y < ROWS; y++) {
    g.push([]);
    for (let x = 0; x < COLS; x++) {
      const o = objectAt(x, y);
      g[y].push(y < 2 || (!!o && !(who === 'cat' && o.catOk)));
    }
  }
  return g;
}

// ------------------------------------------------------------------ drawing helpers

const r = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
function box(c, x, y, w, h, fill, line = OUT) {
  r(c, x, y, w, h, line);
  r(c, x + 1, y + 1, w - 2, h - 2, fill);
}

function floorTile(c, tx, ty) {
  const x = tx * T, y = ty * T;
  r(c, x, y, T, T, '#d9a56b');
  for (let row = 0; row < 4; row++) {
    const py = y + row * 4;
    r(c, x, py + 3, T, 1, '#b97f47');
    r(c, x, py, T, 1, '#e4b47d');
    const seam = (tx * 7 + ty * 5 + row * 11) % 16;
    r(c, x + seam, py, 1, 3, '#b97f47');
  }
}

function wall(c) {
  r(c, 0, 0, 240, 32, '#f3e1bf');
  for (let x = 0; x < 240; x += 6) r(c, x, 2, 2, 24, '#ecd3a5');
  r(c, 0, 0, 240, 2, '#c49a6c');
  r(c, 0, 26, 240, 1, '#e3c292');
  r(c, 0, 27, 240, 5, '#9c6a3c');
  r(c, 0, 27, 240, 1, '#c28b57');
  r(c, 0, 31, 240, 1, '#6e4524');
}

function rug(c) {
  const x = RUG.x * T + 2, y = RUG.y * T + 3, w = RUG.w * T - 4, h = RUG.h * T - 6;
  r(c, x, y, w, h, '#b44d6a');
  r(c, x + 2, y + 2, w - 4, h - 4, '#e7859c');
  r(c, x + 4, y + 4, w - 8, h - 8, '#f4c1cc');
  for (let i = 0; i < 5; i++) drawHeart(c, x + 10 + i * 14, y + 17, i % 2 ? '#e7859c' : '#d8637f');
  for (let i = x; i < x + w; i += 3) { r(c, i, y - 2, 1, 2, '#f4c1cc'); r(c, i, y + h, 1, 2, '#f4c1cc'); }
}

function bed(c) {
  const x = 0, y = 2 * T;
  box(c, x + 1, y - 6, 30, 10, '#8b5a3c');           // headboard
  r(c, x + 2, y - 5, 28, 2, '#a8734e');
  box(c, x + 1, y + 2, 30, 45, '#f7f1e6');            // mattress
  box(c, x + 3, y + 4, 12, 7, '#ffffff', '#b9aebf');  // pillows
  box(c, x + 17, y + 4, 12, 7, '#ffffff', '#b9aebf');
  box(c, x + 1, y + 14, 15, 33, '#6f9fe0');           // his half of the blanket
  box(c, x + 16, y + 14, 15, 33, '#f09bbd');          // her half
  r(c, x + 2, y + 15, 13, 2, '#9cc1f0');
  r(c, x + 17, y + 15, 13, 2, '#f7c3d7');
  drawHeart(c, x + 14, y + 28, '#fff');
  r(c, x + 1, y + 46, 30, 2, '#6e4524');
}

function lamp(c) {
  const x = 2 * T, y = 2 * T;
  box(c, x + 2, y + 6, 12, 10, '#a8734e');
  r(c, x + 3, y + 10, 10, 1, '#6e4524');
  r(c, x + 7, y - 1, 2, 7, OUT);
  box(c, x + 3, y - 7, 10, 7, '#ffd98e');
  r(c, x + 4, y - 6, 8, 2, '#fff1c7');
}

function catTree(c) {
  const x = 9 * T, y = 2 * T;
  box(c, x + 6, y - 8, 4, 22, '#d7b98a');
  for (let i = y - 6; i < y + 13; i += 3) r(c, x + 7, i, 2, 1, '#b3925f');
  box(c, x + 1, y - 12, 14, 5, '#8f6fc4');
  box(c, x + 2, y + 12, 12, 4, '#8f6fc4');
  r(c, x + 12, y - 7, 1, 5, OUT);
  r(c, x + 11, y - 2, 3, 3, '#f2b544');
}

function counter(c) {
  const x = 12 * T, y = 2 * T;
  box(c, x, y - 12, 32, 5, '#e9e4dc');                // top
  box(c, x, y - 8, 32, 24, '#8fb8a8');                // cabinets
  r(c, x + 15, y - 7, 1, 22, '#5d8475');
  r(c, x + 11, y + 2, 2, 3, '#e9e4dc'); r(c, x + 19, y + 2, 2, 3, '#e9e4dc');
  box(c, x + 4, y - 12, 10, 4, '#b8c4cc');            // sink
  r(c, x + 8, y - 16, 2, 4, '#8a969e');
  box(c, x + 21, y - 17, 7, 6, '#f2f2f2');            // cat food bag
  r(c, x + 22, y - 15, 5, 2, '#e0476c');
}

function fridge(c) {
  const x = 14 * T, y = 2 * T;
  box(c, x + 1, y - 22, 15, 38, '#e8eef2');
  r(c, x + 2, y - 8, 13, 1, '#9aa6ae');
  r(c, x + 12, y - 18, 1, 6, '#9aa6ae'); r(c, x + 12, y - 4, 1, 8, '#9aa6ae');
  // magnets: the two flags
  r(c, x + 4, y - 19, 2, 3, '#2f9e5b'); r(c, x + 6, y - 19, 2, 3, '#fff'); r(c, x + 8, y - 19, 2, 3, '#d8404b');
  r(c, x + 4, y - 14, 6, 1, '#d8404b'); r(c, x + 4, y - 13, 6, 1, '#fff'); r(c, x + 4, y - 12, 6, 2, '#2d3a8c'); r(c, x + 4, y - 10, 6, 1, '#fff'); r(c, x + 4, y - 9, 6, 1, '#d8404b');
}

function water(c) {
  const x = 13 * T, y = 4 * T;
  box(c, x + 3, y + 8, 10, 6, '#5b8fd9');
  r(c, x + 4, y + 9, 8, 2, '#a9d4ff');
}

function catBed(c) {
  const x = 3 * T, y = 5 * T;
  box(c, x, y + 4, 16, 12, '#8f6fc4');
  r(c, x + 2, y + 6, 12, 8, '#c7b2ec');
  r(c, x + 3, y + 7, 10, 2, '#dccdf5');
}

function plant(c) {
  const x = 0, y = 6 * T;
  box(c, x + 3, y + 8, 10, 8, '#c86b3c');
  r(c, x + 4, y + 9, 8, 1, '#e08a58');
  const leaf = '#4f9b5b', dark = '#357341';
  r(c, x + 7, y - 4, 2, 12, dark);
  r(c, x + 2, y - 2, 5, 3, leaf); r(c, x + 9, y - 6, 5, 3, leaf);
  r(c, x + 3, y + 3, 5, 3, leaf); r(c, x + 9, y + 1, 5, 3, leaf);
  r(c, x + 6, y - 9, 3, 4, leaf);
}

function table(c) {
  const x = 10 * T, y = 6 * T;
  box(c, x + 1, y + 1, 30, 11, '#b07a4a');
  r(c, x + 2, y + 2, 28, 2, '#c99466');
  r(c, x + 3, y + 12, 2, 4, '#6e4524'); r(c, x + 27, y + 12, 2, 4, '#6e4524');
  // two cups
  box(c, x + 7, y - 1, 5, 5, '#ffffff'); box(c, x + 20, y - 1, 5, 5, '#ffffff');
  r(c, x + 8, y, 3, 1, '#7b4b2a'); r(c, x + 21, y, 3, 1, '#7b4b2a');
}

function sofa(c) {
  const x = 1 * T, y = 8 * T;
  box(c, x, y + 2, 48, 30, '#5f7bc4');                // body
  box(c, x + 3, y + 4, 42, 10, '#7f9ae0');            // seat cushions
  r(c, x + 23, y + 4, 1, 10, '#4a64a8');
  box(c, x, y + 1, 5, 20, '#4a64a8'); box(c, x + 43, y + 1, 5, 20, '#4a64a8');
  r(c, x + 5, y + 17, 38, 12, '#4a64a8');             // backrest seen from the front
  box(c, x + 8, y + 5, 7, 7, '#f2b544');               // pillow
}

function doorMat(c) {
  const x = DOOR.x * T, y = DOOR.y * T;
  r(c, x + 1, y + 9, 14, 7, '#7a8c4a');
  r(c, x + 2, y + 10, 12, 5, '#98ab60');
  r(c, x + 5, y + 12, 6, 1, '#7a8c4a');
}

// Everything that never changes, baked once.
export function bakeStatic() {
  const cv = document.createElement('canvas');
  cv.width = COLS * T; cv.height = ROWS * T;
  const c = cv.getContext('2d');
  for (let y = 2; y < ROWS; y++) for (let x = 0; x < COLS; x++) floorTile(c, x, y);
  wall(c);
  rug(c);
  doorMat(c);
  catBed(c);
  bed(c); lamp(c); catTree(c); counter(c); fridge(c); water(c); plant(c); table(c); sofa(c);
  return cv;
}

// ------------------------------------------------------------------ things that change

// The window shows the sky where your partner is.
export function drawWindow(c, tz, now) {
  const x = 6 * T + 2, y = 3, w = 44, h = 21;
  const hr = localHour(tz, now);
  let sky, sky2, body = null;
  if (hr >= 7 && hr < 17) { sky = '#8fd3ff'; sky2 = '#c9ecff'; body = 'sun'; }
  else if (hr >= 17 && hr < 19.5) { sky = '#f08a6b'; sky2 = '#ffc27a'; body = 'sun'; }
  else if (hr >= 5.5 && hr < 7) { sky = '#b58fd9'; sky2 = '#f7b39a'; body = 'sun'; }
  else { sky = '#1f2352'; sky2 = '#2f3572'; body = 'moon'; }
  box(c, x - 2, y - 2, w + 4, h + 4, '#fbf7ee');
  r(c, x, y, w, h, sky);
  r(c, x, y + h - 7, w, 7, sky2);
  // sun/moon crosses the window through the day
  const t = body === 'sun' ? (hr - 5.5) / 14 : ((hr + 24 - 19.5) % 24) / 11.5;
  const bx = x + 3 + Math.round(Math.max(0, Math.min(1, t)) * (w - 10));
  const by = y + 3 + Math.round(Math.abs(t - 0.5) * 12);
  if (body === 'sun') { r(c, bx, by, 5, 5, '#ffe066'); r(c, bx + 1, by - 1, 3, 7, '#ffe066'); r(c, bx - 1, by + 1, 7, 3, '#ffe066'); }
  else {
    r(c, bx, by, 5, 5, '#f5f0d8'); r(c, bx + 2, by - 1, 4, 5, sky);
    for (const [sx, sy] of [[4, 4], [15, 8], [27, 3], [36, 10], [21, 13], [9, 12]]) r(c, x + sx, y + sy, 1, 1, '#fff6c9');
  }
  // palm tree silhouette: it's Thailand out there
  const p = hr >= 7 && hr < 19.5 ? '#3f7a4a' : '#141633';
  r(c, x + 34, y + 8, 2, 13, p);
  r(c, x + 29, y + 7, 12, 2, p); r(c, x + 28, y + 9, 3, 2, p); r(c, x + 39, y + 9, 3, 2, p); r(c, x + 33, y + 5, 4, 2, p);
  r(c, x + 21, y, 2, h, '#fbf7ee');                  // frame cross
  r(c, x, y + 10, w, 1, '#fbf7ee');
  // curtains
  r(c, x - 5, y - 3, 5, h + 7, '#e0476c'); r(c, x + w, y - 3, 5, h + 7, '#e0476c');
  r(c, x - 4, y - 3, 1, h + 7, '#f07f9c'); r(c, x + w + 1, y - 3, 1, h + 7, '#f07f9c');
  r(c, x - 7, y - 5, w + 14, 2, '#8b5a3c');
}

export function drawClock(c, now) {
  const cx = 10 * T + 8, cy = 13;
  r(c, cx - 6, cy - 5, 12, 11, OUT); r(c, cx - 5, cy - 6, 10, 13, OUT);
  r(c, cx - 5, cy - 4, 10, 9, '#fbf7ee'); r(c, cx - 4, cy - 5, 8, 11, '#fbf7ee');
  const d = new Date(now);
  const hA = ((d.getHours() % 12) + d.getMinutes() / 60) / 12 * Math.PI * 2;
  const mA = d.getMinutes() / 60 * Math.PI * 2;
  for (let i = 1; i <= 3; i++) r(c, Math.round(cx + Math.sin(hA) * i * 0.9) - 0, Math.round(cy - Math.cos(hA) * i * 0.9), 1, 1, OUT);
  for (let i = 1; i <= 4; i++) r(c, Math.round(cx + Math.sin(mA) * i), Math.round(cy - Math.cos(mA) * i), 1, 1, '#d8404b');
  r(c, cx, cy, 1, 1, OUT);
}

export function drawCalendar(c, hasDate) {
  const x = 11 * T + 2, y = 5;
  box(c, x, y, 12, 15, '#fbf7ee');
  r(c, x + 1, y + 1, 10, 4, '#d8404b');
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r(c, x + 2 + j * 3, y + 7 + i * 3, 2, 2, '#c7bfd1');
  if (hasDate) drawHeart(c, x + 4, y + 9, '#e0476c');
}

export function drawBoard(c, notes, unread) {
  const x = 3 * T + 1, y = 5;
  box(c, x, y, 30, 20, '#c9955d');
  r(c, x + 2, y + 2, 26, 16, '#dcae78');
  const n = Math.min(notes, 4);
  const cols = ['#fff3a8', '#ffc9da', '#c9ecff', '#d7f5c8'];
  for (let i = 0; i < n; i++) {
    const nx = x + 3 + (i % 2) * 13 + (i > 1 ? 2 : 0), ny = y + 3 + Math.floor(i / 2) * 7;
    r(c, nx, ny, 10, 6, cols[i]);
    r(c, nx + 2, ny + 2, 6, 1, '#9a8f7a');
    r(c, nx + 4, ny, 2, 1, '#d8404b');
  }
  if (unread) {
    r(c, x + 25, y - 3, 7, 7, '#d8404b');
    r(c, x + 28, y - 2, 1, 3, '#fff'); r(c, x + 28, y + 2, 1, 1, '#fff');
  }
}

export function drawFood(c, level) {
  const x = 12 * T, y = 4 * T;
  box(c, x + 3, y + 8, 10, 6, '#e0476c');
  r(c, x + 4, y + 9, 8, 2, '#6e4524');
  if (level > 0.05) {
    const n = Math.ceil(level * 4);
    for (let i = 0; i < n; i++) r(c, x + 4 + i * 2, y + 7 - (i % 2), 2, 2, '#b8753d');
  }
}

export function drawLitter(c, dirt) {
  const x = 14 * T, y = 9 * T;
  box(c, x + 1, y + 4, 14, 12, '#9aa6ae');
  r(c, x + 2, y + 6, 12, 8, '#efe3c3');
  const spots = [[3, 7], [8, 11], [11, 8], [5, 12], [9, 7]];
  const n = Math.round(dirt * spots.length);
  for (let i = 0; i < n; i++) r(c, x + spots[i][0], y + spots[i][1], 2, 2, '#8a6a3c');
}
