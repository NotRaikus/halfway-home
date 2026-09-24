// GBA-style text boxes. Every function returns a promise, so interactions read like a script:
//   await say('Hello!'); const i = await choose(['Yes', 'No']);

const $ = id => document.getElementById(id);
const dialog = $('dialog'), dialogText = $('dialog-text'), arrow = $('dialog-arrow');
const choices = $('choices'), panelEl = $('panel'), toastEl = $('toast');

// The widget currently eating button presses (null = the game gets them).
let active = null;
export const uiBusy = () => !!active || !$('modal').hidden;
export function uiKey(k) { if (active) { active(k); return true; } return !$('modal').hidden; }

function typeText(text) {
  return new Promise(done => {
    dialog.hidden = false;
    arrow.hidden = true;
    let i = 0, full = false;
    const chars = [...text];
    const finish = () => { full = true; dialogText.textContent = text; arrow.hidden = false; };
    const tick = setInterval(() => {
      if (full) return clearInterval(tick);
      i += 2;
      dialogText.textContent = chars.slice(0, i).join('');
      if (i >= chars.length) { clearInterval(tick); finish(); }
    }, 28);
    active = k => {
      if (k !== 'a' && k !== 'b') return;
      if (!full) { clearInterval(tick); finish(); return; }
      active = null;
      done();
    };
  });
}

dialog.addEventListener('pointerdown', e => { e.preventDefault(); if (active) active('a'); });

// Show one or more pages of text; waits for A on each.
export async function say(pages) {
  for (const p of [].concat(pages)) await typeText(p);
  dialog.hidden = true;
}

// Question in the text box + a choice list. Resolves to the index, or -1 on B.
export async function choose(options, question = null, { cancel = true } = {}) {
  if (question) {
    await new Promise(done => {
      dialog.hidden = false;
      arrow.hidden = true;
      dialogText.textContent = question;
      done();
    });
  }
  choices.className = 'box' + (question ? '' : ' solo');
  choices.hidden = false;
  let sel = 0;
  const draw = () => {
    choices.innerHTML = '';
    options.forEach((o, i) => {
      const d = document.createElement('div');
      d.textContent = o;
      if (i === sel) d.className = 'on';
      d.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); sel = i; draw(); pick(i); });
      choices.appendChild(d);
    });
  };
  let pick;
  const result = await new Promise(done => {
    pick = i => { active = null; done(i); };
    active = k => {
      if (k === 'up') { sel = (sel + options.length - 1) % options.length; draw(); }
      if (k === 'down') { sel = (sel + 1) % options.length; draw(); }
      if (k === 'a') pick(sel);
      if (k === 'b' && cancel) pick(-1);
    };
    draw();
  });
  choices.hidden = true;
  dialog.hidden = true;
  return result;
}

// A full-screen info panel (built by the caller). Closes on A or B.
export function panel(build) {
  return new Promise(done => {
    panelEl.className = 'box';
    panelEl.innerHTML = '';
    build(panelEl);
    panelEl.hidden = false;
    const close = () => { active = null; panelEl.hidden = true; done(); };
    active = k => { if (k === 'a' || k === 'b') close(); };
    panelEl.onpointerdown = e => { e.preventDefault(); close(); };
  });
}

let toastTimer;
export function toast(text, ms = 2200) {
  toastEl.textContent = text;
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('on'), ms);
}

// Real HTML form for typing (so the iPhone keyboard works). Resolves to values or null.
// fields: [{ name, label, type: 'text'|'textarea'|'date'|'radio', value, options, max }]
export function ask(title, fields, okLabel = 'OK') {
  const modal = $('modal'), form = $('modal-form'), box = $('modal-fields');
  $('modal-title').textContent = title;
  $('modal-ok').textContent = okLabel;
  box.innerHTML = '';
  for (const f of fields) {
    const label = document.createElement('label');
    if (f.label) { const s = document.createElement('span'); s.textContent = f.label; label.appendChild(s); }
    if (f.type === 'radio') {
      const opts = document.createElement('div');
      opts.className = 'opts';
      f.options.forEach(([val, text], i) => {
        const l = document.createElement('label');
        const inp = document.createElement('input');
        inp.type = 'radio'; inp.name = f.name; inp.value = val;
        if (val === f.value || (!f.value && i === 0)) inp.checked = true;
        l.append(inp, document.createTextNode(text));
        opts.appendChild(l);
      });
      label.appendChild(opts);
    } else {
      const inp = document.createElement(f.type === 'textarea' ? 'textarea' : 'input');
      if (f.type !== 'textarea') inp.type = f.type || 'text';
      inp.name = f.name;
      inp.value = f.value || '';
      if (f.max) inp.maxLength = f.max;
      if (f.required) inp.required = true;
      label.appendChild(inp);
    }
    box.appendChild(label);
  }
  modal.hidden = false;
  setTimeout(() => box.querySelector('input:not([type=radio]),textarea')?.focus(), 50);
  return new Promise(done => {
    const finish = v => {
      modal.hidden = true;
      form.onsubmit = null;
      $('modal-cancel').onclick = null;
      document.activeElement?.blur();
      done(v);
    };
    form.onsubmit = e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      for (const k in data) if (typeof data[k] === 'string') data[k] = data[k].trim();
      finish(data);
    };
    $('modal-cancel').onclick = () => finish(null);
  });
}
