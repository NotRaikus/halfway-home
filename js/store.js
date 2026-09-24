// Where the shared state lives.
// LocalStore keeps it in this browser: two tabs (?as=a and ?as=b) play the two of you.
// CloudStore keeps it in Firebase, so the home syncs Italy <-> Thailand.
// Both expose the same methods: get(), update(fn), subscribe(cb), reset(), ready.

import { newState } from './state.js';
import { FIREBASE } from './config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

// Firebase drops empty arrays/objects: put the missing pieces back.
function normalize(s) {
  if (!s) return null;
  const d = newState(s.created || Date.now());
  const out = { ...d, ...s, cat: { ...d.cat, ...(s.cat || {}) } };
  for (const k of ['players', 'pos']) out[k] = s[k] || {};
  for (const k of ['notes', 'log']) out[k] = Object.values(s[k] || {});
  for (const k of ['care', 'lastPetXp', 'daily', 'stats']) out.cat[k] = { ...d.cat[k], ...(s.cat?.[k] || {}) };
  out.cat.together = Object.values(s.cat?.together || {});
  for (const [day, who] of Object.entries(out.cat.daily)) out.cat.daily[day] = Object.values(who || {});
  return out;
}

class Base {
  constructor() { this.subs = new Set(); }
  get() { return this.state; }
  subscribe(cb) { this.subs.add(cb); return () => this.subs.delete(cb); }
  emit() { for (const cb of this.subs) cb(this.state); }
}

export class LocalStore extends Base {
  constructor(key = 'halfway-home') {
    super();
    this.key = key;
    this.cloud = false;
    this.state = this.read() || newState();
    this.ready = Promise.resolve();
    window.addEventListener('storage', e => {
      if (e.key !== this.key) return;
      const s = this.read();
      if (s) { this.state = s; this.emit(); }
    });
  }

  read() {
    try { return JSON.parse(localStorage.getItem(this.key)); } catch { return null; }
  }

  // `fn` mutates a copy of the state; whatever it returns is handed back.
  update(fn) {
    const s = structuredClone(this.state);
    const out = fn(s);
    this.state = s;
    try { localStorage.setItem(this.key, JSON.stringify(s)); } catch { /* storage full or blocked */ }
    this.emit();
    return out;
  }

  reset() { localStorage.removeItem(this.key); this.state = newState(); this.emit(); }
}

export class CloudStore extends Base {
  constructor(home) {
    super();
    this.home = home;
    this.cloud = true;
    this.state = newState();
    this.ready = this.connect();
  }

  async connect() {
    const [{ initializeApp }, db] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-database.js`),
    ]);
    this.db = db;
    this.ref = db.ref(db.getDatabase(initializeApp(FIREBASE)), `homes/${this.home}`);
    await new Promise(first => {
      db.onValue(this.ref, snap => {
        const s = normalize(snap.val());
        if (s) this.state = s;
        this.emit();
        first();
      }, err => { console.error('sync', err); first(); });
    });
  }

  // Applied here straight away (so the game feels instant), then replayed on the
  // server copy in a transaction, so two phones writing at once never lose each other's changes.
  update(fn) {
    const s = structuredClone(this.state);
    const out = fn(s);
    this.state = s;
    this.emit();
    this.db.runTransaction(this.ref, cur => {
      const c = normalize(cur) || newState();
      fn(c);
      return JSON.parse(JSON.stringify(c));
    }).catch(err => console.error('save', err));
    return out;
  }

  reset() { this.db.set(this.ref, null); }
}

// ------------------------------------------------------------------ which home, which player

const HOME_KEY = 'halfway-home:home';

export const newHomeId = () => {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), b => abc[b % abc.length]).join('');
};

// The home id travels in the link (?home=...), so "Add to Home Screen" keeps it.
export function homeId() {
  const q = new URLSearchParams(location.search).get('home');
  if (q) { try { localStorage.setItem(HOME_KEY, q); } catch { /* ignore */ } return q; }
  try { return localStorage.getItem(HOME_KEY); } catch { return null; }
}

export function setHomeId(id) {
  try { localStorage.setItem(HOME_KEY, id); } catch { /* ignore */ }
  const u = new URL(location.href);
  u.searchParams.set('home', id);
  history.replaceState(null, '', u);
}

export const inviteLink = id => {
  const u = new URL(location.href);
  u.search = '';
  u.searchParams.set('home', id);
  return u.toString();
};

export const cloudEnabled = () => !!FIREBASE;

export function openStore(home) {
  return FIREBASE && home ? new CloudStore(home) : new LocalStore();
}

// Which of the two players is holding this phone.
export function whoAmI() {
  const q = new URLSearchParams(location.search).get('as');
  if (q === 'a' || q === 'b') return q;
  try { return localStorage.getItem('halfway-home:me'); } catch { return null; }
}

export function setMe(id) {
  if (new URLSearchParams(location.search).get('as')) return;
  try { localStorage.setItem('halfway-home:me', id); } catch { /* ignore */ }
}
