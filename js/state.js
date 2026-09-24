// Shared game state and the rules that change it.
// Everything here is pure: the store decides where the state lives.

export const STATS = ['full', 'fun', 'clean', 'litter'];
export const STAT_LABEL = { full: 'FOOD', fun: 'FUN', clean: 'FUR', litter: 'LITTER' };

// Points lost per hour. Food runs out in ~20h, so one meal from each of you a day is enough.
const RATE = { full: 5, fun: 6, clean: 2.5, litter: 4 };

const XP = { feed: 10, play: 12, brush: 8, litter: 8, pet: 2 };
const DAY = 24 * 3600e3;

export const STAGES = [
  { name: 'kitten', from: 0 },
  { name: 'young cat', from: 150 },
  { name: 'grown-up cat', from: 500 },
];

export function newState(now = Date.now()) {
  return {
    v: 1,
    created: now,
    players: {},            // { a: {name, hair, tz}, b: {...} }
    pos: {},                // { a: {x, y, dir, t} }
    cat: {
      name: null,
      proposal: null,       // { by, name }
      xp: 0,
      stats: { full: 70, fun: 60, clean: 80, litter: 100 },
      t: now,               // when stats were last materialised
      care: {},             // { a: timestamp of last care }
      lastPetXp: {},        // pets only give XP every 10 minutes
      together: [],         // UTC day keys when both of you took care of the cat
      daily: {},            // { '2026-09-24': ['a', 'b'] }
    },
    notes: [],              // { by, text, t }
    meet: null,             // 'YYYY-MM-DD'
    log: [],                // { by, kind, t }
  };
}

export const otherId = id => (id === 'a' ? 'b' : 'a');

export function catStats(cat, now = Date.now()) {
  const h = Math.max(0, (now - cat.t) / 3600e3);
  const out = {};
  for (const k of STATS) out[k] = Math.max(0, Math.min(100, cat.stats[k] - RATE[k] * h));
  return out;
}

export function stageOf(xp) {
  let i = 0;
  while (i + 1 < STAGES.length && xp >= STAGES[i + 1].from) i++;
  return i;
}

// How dark the siamese points are: born almost white, darker as the cat grows.
export const pointLevel = xp => 0.12 + 0.88 * Math.min(1, xp / 600);

export const mood = stats => STATS.reduce((a, k) => a + stats[k], 0) / STATS.length;

const dayKey = t => new Date(t).toISOString().slice(0, 10);

// Mutates `s`. Returns what happened so the UI can celebrate it.
export function applyCare(s, by, kind, now = Date.now()) {
  const cat = s.cat;
  const st = catStats(cat, now);
  if (kind === 'feed') st.full = 100;
  if (kind === 'play') { st.fun = Math.min(100, st.fun + 40); st.full = Math.max(0, st.full - 3); }
  if (kind === 'brush') st.clean = Math.min(100, st.clean + 45);
  if (kind === 'litter') st.litter = 100;
  cat.stats = st;
  cat.t = now;

  let xp = XP[kind] || 0;
  if (kind === 'pet') {
    if (now - (cat.lastPetXp[by] || 0) < 10 * 60e3) xp = 0;
    else cat.lastPetXp[by] = now;
  }
  const other = cat.care[otherId(by)] || 0;
  const together = xp > 0 && now - other < DAY;
  if (together) xp = Math.round(xp * 1.5);

  const before = stageOf(cat.xp);
  cat.xp += xp;
  cat.care[by] = now;

  const key = dayKey(now);
  const today = cat.daily[key] || [];
  if (!today.includes(by)) today.push(by);
  cat.daily[key] = today;
  if (today.length === 2 && !cat.together.includes(key)) cat.together.push(key);
  for (const k of Object.keys(cat.daily).sort().slice(0, -14)) delete cat.daily[k];

  s.log.push({ by, kind, t: now });
  if (s.log.length > 60) s.log.splice(0, s.log.length - 60);

  const after = stageOf(cat.xp);
  return { xp, together, grew: after > before ? after : null };
}

export function addNote(s, by, text, now = Date.now()) {
  s.notes.push({ by, text: text.slice(0, 280), t: now });
  if (s.notes.length > 40) s.notes.splice(0, s.notes.length - 40);
}

// Consecutive days (ending today or yesterday) when both of you cared for the cat.
export function togetherStreak(cat, now = Date.now()) {
  const set = new Set(cat.together);
  let d = new Date(dayKey(now));
  if (!set.has(dayKey(d))) d = new Date(d - DAY);
  let n = 0;
  while (set.has(dayKey(d))) { n++; d = new Date(d - DAY); }
  return n;
}

// ---------- time zones ----------

export function localTime(tz, now = Date.now()) {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  } catch { return '--:--'; }
}

export function localHour(tz, now = Date.now()) {
  const [h, m] = localTime(tz, now).split(':').map(Number);
  return h + m / 60;
}

export const isNight = h => h >= 23 || h < 7;

export function ago(t, now = Date.now()) {
  const m = Math.round((now - t) / 60e3);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export function daysUntil(dateStr, now = Date.now()) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / DAY);
}
