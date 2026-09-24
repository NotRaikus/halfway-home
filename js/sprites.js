// All the pixel art, drawn from code: no image files, nothing borrowed.
// Sprites are 16x16 grids of palette letters; '.' is transparent.

const OUT = '#3b2a2a';

function grid(rows) { return rows.map(r => r.split('')); }

function toCanvas(g, pal, flip = false) {
  const h = g.length, w = g[0].length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  for (let r = 0; r < h; r++) {
    for (let i = 0; i < w; i++) {
      const col = pal[g[r][i]];
      if (!col) continue;
      x.fillStyle = col;
      x.fillRect(flip ? w - 1 - i : i, r, 1, 1);
    }
  }
  return c;
}

// ------------------------------------------------------------------ people

const BODY = {
  down: [
    '................',
    '.....OOOOOO.....',
    '....OHHHHHHO....',
    '...OHHHHHHHhO...',
    '...OHHhHHhHHO...',
    '...OHSSSSSSHO...',
    '...OSSESSESSO...',
    '...OSSESSESSO...',
    '....OSSSSSSO....',
    '....OOCCCCOO....',
    '...OSCCCCCCSO...',
    '...OSCCCCCCSO...',
    '....OCccccCO....',
    '....OPPPPPPO....',
  ],
  up: [
    '................',
    '.....OOOOOO.....',
    '....OHHHHHHO....',
    '...OHHHHHHHHO...',
    '...OHHHHHHHHO...',
    '...OHHHHHHHHO...',
    '...OHHHhhHHHO...',
    '...OSHHHHHHSO...',
    '....OSSSSSSO....',
    '....OOCCCCOO....',
    '...OSCCCCCCSO...',
    '...OSCCCCCCSO...',
    '....OCccccCO....',
    '....OPPPPPPO....',
  ],
  left: [
    '................',
    '.....OOOOOO.....',
    '....OHHHHHHO....',
    '...OHHHHHHHHO...',
    '...OHHHHHHHHO...',
    '...OSSSHHHHHO...',
    '...OSESSHHHHO...',
    '..OSSESSSHHHO...',
    '...OSSSSSSSO....',
    '....OOCCCCO.....',
    '....OCCCSCCO....',
    '....OCCCSCCO....',
    '....OCccccO.....',
    '....OPPPPPO.....',
  ],
};

const LEGS = {
  down: [
    ['....OPPOOPPO....', '....OFFOOFFO....'],
    ['....OPPOOPPO....', '....OFFO.OFFO...'],
    ['....OPPOOPPO....', '...OFFO.OFFO....'],
  ],
  left: [
    ['....OPPOPPO.....', '....OFFOFFO.....'],
    ['...OPPO.OPPO....', '...OFFO.OFFO....'],
    ['....OPPPPO......', '....OFFFFO......'],
  ],
};
LEGS.up = LEGS.down;

function personGrid(dir, frame, hair) {
  const g = grid([...BODY[dir], ...LEGS[dir][frame]]);
  if (hair === 'long') {
    if (dir === 'left') {
      for (let r = 5; r <= 10; r++) { g[r][11] = 'H'; g[r][12] = 'O'; }
      g[9][10] = 'H';
    } else {
      for (let r = 5; r <= 10; r++) { g[r][2] = 'O'; g[r][3] = 'H'; g[r][12] = 'H'; g[r][13] = 'O'; }
    }
  }
  return g;
}

export const LOOKS = {
  short: { H: '#5a3a22', h: '#3f2716', S: '#f1c9a0', E: '#2b2230', C: '#5b8fd9', c: '#3f6db0', P: '#3c4a6b', F: '#2a2233' },
  long:  { H: '#2a1e22', h: '#140e11', S: '#e9bf96', E: '#2b2230', C: '#f28ab2', c: '#cf5f8d', P: '#5b6fa8', F: '#2a2233' },
};

// frames[dir][0..2]: standing, step A, step B
export function personFrames(hair, colors) {
  const pal = { O: OUT, ...LOOKS[hair], ...colors };
  const out = {};
  for (const dir of ['down', 'up', 'left']) {
    out[dir] = [0, 1, 2].map(f => toCanvas(personGrid(dir, f, hair), pal));
  }
  out.right = [0, 1, 2].map(f => toCanvas(personGrid('left', f, hair), pal, true));
  // lying in bed: just the head on the pillow
  out.sleep = toCanvas(personGrid('down', 0, hair).slice(0, 9), { ...pal, E: pal.S === '#e9bf96' ? '#b98e6a' : '#c29a74' });
  return out;
}

// ------------------------------------------------------------------ the cat

const CAT_SIT = [
  '................',
  '................',
  '...O........O...',
  '...OPO....OPO...',
  '...OPPOOOOPPO...',
  '...OBBPPPPBBO...',
  '...OBPEPPEPBO...',
  '...OBPPNNPPBO...',
  '....OBPPPPBO....',
  '....OBBBBBBO....',
  '...OBBBBBBBBO...',
  '...OBBBBBBBbO...',
  '...ObBBBBBBbO...',
  '...ObBBBBBBbOPPO',
  '...OPPbBBbPPOPO.',
  '....OOOOOOOOO...',
];

const CAT_WALK = [
  ['..OPOOPO..OPOOPO', '..OOOOOO..OOOOOO'],
  ['...OPOPO..OPOPO.', '...OOOOO..OOOOO.'],
].map(legs => [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..O.O...........',
  '.OPOPO.......OO.',
  '.OPPPPO......OPO',
  'OPEPPPBO.....OPO',
  'ONPPPBBOOOOOOPO.',
  '.OPPBBBBBBBBBO..',
  '..OBBBBBBBBBBO..',
  '..ObBBBBBBBBbO..',
  ...legs,
]);

const CAT_SLEEP = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '...O.O..........',
  '..OPOPO.OOOOO...',
  '..OPPPPOBBBBBO..',
  '.OPpPPpPBBBBBBO.',
  '.OPPNPPBBBBBPPPO',
  '..OOOOOOOOOOOOO.',
];

function mix(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// Kittens have a shorter body: drop a couple of rows and push the sprite down.
function shrink(rows, stage) {
  const drop = stage === 0 ? [10, 11] : stage === 1 ? [10] : [];
  const kept = rows.filter((_, i) => !drop.includes(i));
  return [...Array(drop.length).fill('................'), ...kept];
}

// level 0..1: how dark the points (ears, mask, paws, tail) are.
export function catFrames(level, stage) {
  const body = '#f4ebdd';
  const point = mix(body, '#4a3026', level);
  const pal = {
    O: OUT, B: body, b: '#dccbb3', P: point, p: mix(point, '#1e1210', 0.5),
    E: '#5fb0ee', N: '#e58a9a',
  };
  const blinkPal = { ...pal, E: pal.p };
  const sit = shrink(CAT_SIT, stage);
  const walk = CAT_WALK.map(w => shrink(w, stage));
  const make = (rows, p, flip) => toCanvas(grid(rows), p, flip);
  return {
    sit: [make(sit, pal), make(sit, pal, true)],
    blink: [make(sit, blinkPal), make(sit, blinkPal, true)],
    walk: [walk.map(w => make(w, pal)), walk.map(w => make(w, pal, true))], // [left][frame], [right][frame]
    sleep: [make(CAT_SLEEP, pal), make(CAT_SLEEP, pal, true)],
  };
}

// ------------------------------------------------------------------ small icons

export function drawBubble(ctx, x, y, icon) {
  // speech bubble 12x11 with a tail, icon drawn inside
  ctx.fillStyle = OUT;
  ctx.fillRect(x + 1, y, 10, 1); ctx.fillRect(x + 1, y + 9, 10, 1);
  ctx.fillRect(x, y + 1, 1, 8); ctx.fillRect(x + 11, y + 1, 1, 8);
  ctx.fillRect(x + 3, y + 10, 2, 1); ctx.fillRect(x + 3, y + 11, 1, 1);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 1, y + 1, 10, 8); ctx.fillRect(x + 4, y + 9, 1, 1);
  const p = (dx, dy, c, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, w, h); };
  if (icon === 'fish') {
    p(3, 4, '#5b8fd9', 5, 2); p(2, 5, '#5b8fd9'); p(8, 3, '#5b8fd9', 1, 4); p(4, 4, '#2a2233');
  } else if (icon === 'heart') {
    p(3, 3, '#e0476c', 2, 1); p(7, 3, '#e0476c', 2, 1); p(2, 4, '#e0476c', 8, 2); p(3, 6, '#e0476c', 6, 1); p(4, 7, '#e0476c', 4, 1); p(5, 8, '#e0476c', 2, 1);
  } else if (icon === 'ball') {
    p(4, 3, '#f2b544', 4, 5); p(3, 4, '#f2b544', 6, 3); p(5, 4, '#fff3c9');
  } else if (icon === 'stink') {
    p(3, 2, '#8a9b3c', 1, 2); p(4, 4, '#8a9b3c', 1, 2); p(3, 6, '#8a9b3c', 1, 2);
    p(7, 2, '#8a9b3c', 1, 2); p(8, 4, '#8a9b3c', 1, 2); p(7, 6, '#8a9b3c', 1, 2);
  } else if (icon === 'brush') {
    p(3, 3, '#b07a4a', 6, 2); p(3, 5, '#2a2233', 1, 2); p(5, 5, '#2a2233', 1, 2); p(7, 5, '#2a2233', 1, 2);
  } else if (icon === 'z') {
    p(3, 2, '#5b6fa8', 4, 1); p(5, 3, '#5b6fa8'); p(4, 4, '#5b6fa8'); p(3, 5, '#5b6fa8', 4, 1);
    p(7, 5, '#8fa3d8', 2, 1); p(8, 6, '#8fa3d8'); p(7, 7, '#8fa3d8', 2, 1);
  } else if (icon === 'note') {
    p(3, 2, '#fff3a8', 6, 6); p(3, 2, '#c9b85a', 6, 1); p(4, 4, '#8a7d3a', 4, 1); p(4, 6, '#8a7d3a', 3, 1);
  }
}

export function drawHeart(ctx, x, y, c = '#e0476c') {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, 2, 1); ctx.fillRect(x + 3, y, 2, 1);
  ctx.fillRect(x - 1, y + 1, 7, 2);
  ctx.fillRect(x, y + 3, 5, 1); ctx.fillRect(x + 1, y + 4, 3, 1); ctx.fillRect(x + 2, y + 5, 1, 1);
}

export { OUT };
