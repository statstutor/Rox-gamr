// Dig, Hamster, Dig! - main game
'use strict';

// ================= utils =================
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wait = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const BELT_NAMES = ['Yellow', 'Orange', 'Green', 'Black'];

// ================= accounts & saving =================
const DB_KEY = 'hamsterTunnels.v1';
const PREF_KEY = 'hamsterTunnels.music';
function loadDB() {
  try { const d = JSON.parse(localStorage.getItem(DB_KEY)); if (d && d.users) return d; } catch (e) { /* ignore */ }
  return { users: {} };
}
let DB = loadDB();
function saveDB() { try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch (e) { /* storage may be blocked */ } }
let USER = null; // lowercase key
let S = null; // the logged-in player's save

function persist() { if (!USER || !S) return; DB.users[USER].save = S; saveDB(); }
function displayName() { return USER ? DB.users[USER].name : ''; }

async function hashPw(pw, salt, algo) {
  const data = salt + '|' + pw;
  if (algo === 'sha') {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < data.length; i++) {
    const c = data.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 'fb' + (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
}
// No two accounts may share a password: hash the new one with each account's salt and compare.
async function passwordInUse(pw) {
  for (const rec of Object.values(DB.users)) {
    if (rec.algo === 'sha' && !canSha()) continue;
    if (await hashPw(pw, rec.salt, rec.algo) === rec.hash) return true;
  }
  return false;
}
const canSha = () => !!(window.crypto && crypto.subtle && window.isSecureContext !== false);

function newSave(color) {
  return {
    color, equipped: { head: null, face: null, neck: null, back: null }, owned: [],
    level: 1, xp: 0, points: 0, stats: { str: 0, tough: 0, dig: 0, luck: 0 },
    hp: null, snacks: 2, unlocked: 1, beaten: [false, false, false, false], current: 0,
    worlds: [0, 1, 2, 3].map(() => ({ wave: 1, tasks: null, clues: 0, solved: false, intro: false, maxDepth: 0 })),
    usedRiddles: {}, record: { fights: 0, riddles: 0, dug: 0 },
  };
}

// ================= player numbers =================
const maxHp = () => 20 + (S.level - 1) * 6 + S.stats.tough * 6;
const playerAtk = () => 4 + (S.level - 1) * 1.6 + S.stats.str * 2.2;
const playerDef = () => S.stats.tough * 0.6;
const critChance = () => 0.06 + S.stats.luck * 0.03;
const digTime = () => 0.34 / (1 + S.stats.dig * 0.15);
const xpNeed = L => Math.round(15 + L * L * 6);

function gainXP(n) {
  S.xp += n;
  while (S.xp >= xpNeed(S.level)) {
    S.xp -= xpNeed(S.level);
    S.level++; S.points++;
    S.hp = maxHp();
    Sound.sfx('levelup');
    toast(`⭐ LEVEL UP! You are now level ${S.level}! (+1 skill point)`, 'gold');
    const sk = SKILLS.find(s => s.lvl === S.level);
    if (sk) toast(`${sk.icon} New skill learned: <b>${sk.name}</b>!`, 'gold');
  }
  updateHUD();
}

// ================= screens =================
let curScreen = 'auth';
let returnTo = null; // 'game' when a menu screen was opened from inside the game

function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'scr-' + id));
  curScreen = id;
  keys.length = 0;
  if (id !== 'game' && returnTo !== 'game') Sound.play('menu');
  if (id === 'menu') { returnTo = null; G = null; renderMenu(); }
  if (id === 'dress') renderDress();
  if (id === 'worlds') renderWorlds();
  if (id === 'skills') renderSkills();
  if (id === 'journal') renderJournal();
  if (id === 'help') renderHelp();
  if (id === 'game') { resize(); updateHUD(); }
}
$$('.back').forEach(b => b.addEventListener('click', () => show(returnTo || 'menu')));

// ---------- auth ----------
let authMode = 'login';
$$('.tab[data-tab]').forEach(t => t.addEventListener('click', () => {
  authMode = t.dataset.tab;
  $$('.tab[data-tab]').forEach(x => x.classList.toggle('active', x === t));
  $('#authForm').classList.toggle('signup', authMode === 'signup');
  $('#authBtn').textContent = authMode === 'signup' ? 'Create Account' : 'Log In';
  $('#authPass').autocomplete = authMode === 'signup' ? 'new-password' : 'current-password';
  $('#authMsg').textContent = '';
}));

$('#authForm').addEventListener('submit', async e => {
  e.preventDefault();
  Sound.init(); Sound.play('menu');
  const name = $('#authUser').value.trim();
  const pw = $('#authPass').value;
  const key = name.toLowerCase();
  const msg = t => { $('#authMsg').textContent = t; Sound.sfx('wrong'); };
  if (!/^[A-Za-z0-9_ ]{3,16}$/.test(name)) return msg('Usernames need 3-16 letters or numbers.');
  if (pw.length < 4) return msg('Passwords need at least 4 characters.');
  if (authMode === 'signup') {
    if (pw !== $('#authPass2').value) return msg('The two passwords don\'t match!');
    if (DB.users[key]) return msg('That username is taken. Try another!');
    if (await passwordInUse(pw)) return msg('Someone already uses that password. Please pick a different one!');
    const salt = [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join('');
    const algo = canSha() ? 'sha' : 'fb';
    DB.users[key] = { name, salt, algo, hash: await hashPw(pw, salt, algo), save: null };
    saveDB();
    USER = key; S = null;
    Sound.sfx('correct');
    startColorPick();
  } else {
    const rec = DB.users[key];
    if (!rec) return msg('No hamster with that name yet. Make a New Account!');
    if (rec.algo === 'sha' && !canSha()) return msg('This browser can\'t check that password here.');
    if (await hashPw(pw, rec.salt, rec.algo) !== rec.hash) return msg('Oops! Wrong password.');
    USER = key; S = rec.save;
    Sound.sfx('correct');
    if (!S) startColorPick();
    else { if (S.hp == null) S.hp = maxHp(); syncSecretSkin(); show('menu'); toast(`Welcome back, ${esc(rec.name)}! 🐹`, 'good'); }
  }
  $('#authPass').value = ''; $('#authPass2').value = '';
});

// ---------- secret skins ----------
const hasPikaName = () => /pikachu/i.test(displayName());
const colorAllowed = id => !HAM_COLORS[id].secret || (id === 'pikachu' && hasPikaName());
// Called after login, account creation and renaming.
function syncSecretSkin() {
  if (!S) return;
  if (hasPikaName()) {
    if (!S.pikaGiven) { S.pikaGiven = true; S.color = 'pikachu'; }
  } else {
    S.pikaGiven = false;
    if (S.color === 'pikachu') S.color = 'golden';
  }
  persist();
}

// ---------- colour pick ----------
let pickColor = 'golden';
function buildSwatches(el, current, onPick) {
  el.innerHTML = '';
  for (const [id, c] of Object.entries(HAM_COLORS)) {
    if (!colorAllowed(id)) continue;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'swatch' + (id === current ? ' sel' : '');
    b.style.background = c.body; b.style.setProperty('--belly', c.belly); b.title = c.name;
    b.addEventListener('click', () => { onPick(id); el.querySelectorAll('.swatch').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); Sound.sfx('pickup'); });
    el.appendChild(b);
  }
}
function startColorPick() {
  pickColor = hasPikaName() ? 'pikachu' : 'golden';
  $('#colorName').textContent = HAM_COLORS[pickColor].name;
  buildSwatches($('#colorSwatches'), pickColor, id => { pickColor = id; $('#colorName').textContent = HAM_COLORS[id].name; });
  show('color');
}
$('#colorDone').addEventListener('click', () => {
  S = newSave(pickColor);
  S.hp = maxHp();
  if (pickColor === 'pikachu') S.pikaGiven = true;
  syncSecretSkin();
  show('menu');
  toast(`Welcome, ${esc(displayName())}! Let's dig! 🎉`, 'good');
});

// ---------- menu ----------
function renderMenu() {
  if (!S) return;
  $('#menuHello').innerHTML = `Hi, <b>${esc(displayName())}</b>! &nbsp;<span class="lv">Lv ${S.level}</span>`;
}
$('#btnStart').addEventListener('click', () => { returnTo = null; show('help'); });
$('#btnDress').addEventListener('click', () => { returnTo = null; show('dress'); });
$('#btnWorlds').addEventListener('click', () => { returnTo = null; show('worlds'); });
$('#btnSkills').addEventListener('click', () => { returnTo = null; show('skills'); });
$('#btnJournal').addEventListener('click', () => { returnTo = null; show('journal'); });
$('#btnRename').addEventListener('click', () => renameDialog());
function renameDialog(prefill = displayName(), error = '') {
  showModal({
    icon: '✏️', title: 'Change your name',
    body: `<p>Pick a new name for your hamster. You'll use it to log in next time.</p>
      <input id="renameInput" maxlength="16" value="${esc(prefill)}" autocomplete="off">
      ${error ? `<div class="msg">${esc(error)}</div>` : ''}`,
    buttons: [
      { label: 'Save name', cls: 'green', onClick: () => doRename($('#renameInput').value.trim()) },
      { label: 'Cancel', cls: 'ghost' },
    ],
  });
  setTimeout(() => { const i = $('#renameInput'); if (i) { i.focus(); i.select(); } }, 50);
}
function doRename(name) {
  const key = name.toLowerCase();
  if (!/^[A-Za-z0-9_ ]{3,16}$/.test(name)) return renameDialog(name, 'Names need 3-16 letters or numbers.');
  if (key !== USER && DB.users[key]) return renameDialog(name, 'That name is taken. Try another!');
  const rec = DB.users[USER];
  delete DB.users[USER];
  rec.name = name;
  DB.users[key] = rec;
  USER = key;
  saveDB();
  syncSecretSkin();
  Sound.sfx('correct');
  renderMenu();
  toast(`Your name is now <b>${esc(name)}</b>!`, 'good');
}

$('#btnLogout').addEventListener('click', () => {
  persist(); USER = null; S = null; G = null; returnTo = null;
  $('#authUser').value = '';
  $('.tab[data-tab=login]').click();
  show('auth');
});

// ---------- help ----------
function renderHelp() {
  $('#helpSteps').innerHTML = HELP_STEPS.map((s, i) =>
    `<div class="help-step" style="animation-delay:${i * 0.08}s"><div class="ic">${s.icon}</div><b>${s.title}</b><p>${s.text}</p></div>`).join('');
}
$('#helpGo').addEventListener('click', () => enterWorld(S.current || 0));

// ---------- dress up ----------
let dressSlot = 'head';
function renderDress() {
  buildSwatches($('#dressColors'), S.color, id => { S.color = id; persist(); });
  $('#accCount').textContent = `(${S.owned.length}/${Object.keys(ACCESSORIES).length} found)`;
  $('#dressTabs').innerHTML = SLOTS.map(s => `<button type="button" class="tab ${s === dressSlot ? 'active' : ''}" data-slot="${s}">${SLOT_NAMES[s]}</button>`).join('');
  $$('#dressTabs .tab').forEach(t => t.addEventListener('click', () => { dressSlot = t.dataset.slot; renderDress(); }));
  const items = Object.entries(ACCESSORIES).filter(([, a]) => a.slot === dressSlot);
  $('#dressItems').innerHTML = items.map(([id, a]) => {
    const own = S.owned.includes(id);
    const on = S.equipped[dressSlot] === id;
    return own
      ? `<div class="acc ${on ? 'on' : ''}" data-id="${id}"><span class="ic">${a.icon}</span>${a.name}</div>`
      : `<div class="acc locked"><span class="ic">❓</span>???</div>`;
  }).join('') + (items.some(([id]) => S.owned.includes(id)) ? '' : '<p style="grid-column:1/-1">Dig for treasure 🎁 and make friends to find accessories!</p>');
  $$('#dressItems .acc[data-id]').forEach(el => el.addEventListener('click', () => {
    const id = el.dataset.id;
    S.equipped[dressSlot] = S.equipped[dressSlot] === id ? null : id;
    Sound.sfx('pickup'); persist(); renderDress();
  }));
}

// ---------- worlds ----------
function renderWorlds() {
  $('#worldCards').innerHTML = WORLDS.map((w, i) => {
    const open = i < S.unlocked;
    const ws = S.worlds[i];
    let status = '';
    if (!open) status = i === 3 ? '🔒 Beat the Snow boss to unlock this BONUS world' : `🔒 Beat the ${WORLDS[i - 1].short} boss to unlock`;
    else if (S.beaten[i]) status = `✅ Boss beaten! ${BELT_NAMES[i]} belt earned`;
    else if (ws.wave > 3) status = '⚠️ Boss Lair is open!';
    else status = `Wave ${ws.wave} of 3`;
    return `<div class="wcard w${i} ${open ? '' : 'locked'}">
      ${w.bonus ? '<span class="badge">BONUS</span>' : `<span class="badge">World ${i + 1}</span>`}
      <div class="ic">${w.icon}</div><h3>${w.name}</h3><p>${w.desc}</p><p><b>${status}</b></p>
      <button class="btn ${open ? 'green' : 'ghost'} small" data-w="${i}" ${open ? '' : 'disabled'}>${S.current === i && returnTo === 'game' ? 'You are here' : (open ? 'Dig here! ➜' : 'Locked')}</button></div>`;
  }).join('');
  $$('#worldCards button[data-w]').forEach(b => b.addEventListener('click', () => {
    const w = +b.dataset.w;
    if (returnTo === 'game' && G && G.w === w) { show('game'); return; }
    enterWorld(w);
  }));
}

// ---------- skills ----------
const STAT_INFO = {
  str: { icon: '💪', name: 'Strength', desc: 'Hit harder' },
  tough: { icon: '🛡️', name: 'Toughness', desc: 'More health, less damage' },
  dig: { icon: '⛏️', name: 'Digging', desc: 'Dig tunnels faster' },
  luck: { icon: '🍀', name: 'Luck', desc: 'More crits & treasure' },
};
function renderSkills() {
  const need = xpNeed(S.level);
  $('#skillsBody').innerHTML = `
    <div class="lvl-box"><div class="big-lv">Lv ${S.level}</div>
      <div style="min-width:220px"><div class="bar xp"><i style="width:${S.xp / need * 100}%"></i><span>${S.xp} / ${need} XP</span></div>
      <div>❤️ ${maxHp()} health · ⚔️ ${Math.round(playerAtk())} attack</div>
      <div><b>${S.points}</b> skill point${S.points === 1 ? '' : 's'} to spend</div></div></div>
    <div class="stat-grid">${Object.entries(STAT_INFO).map(([k, s]) => `
      <div class="stat"><b>${s.icon} ${s.name}</b><div class="val">${S.stats[k]}</div><small>${s.desc}</small><br>
      <button class="btn small pink" data-stat="${k}" ${S.points > 0 ? '' : 'disabled'}>+1</button></div>`).join('')}</div>
    <h3>Battle skills</h3>
    <div class="skill-list">${SKILLS.map(s => `<div class="skill ${S.level >= s.lvl ? '' : 'locked'}"><span class="ic">${s.icon}</span><div><b>${s.name}</b> ${S.level >= s.lvl ? '' : `<small>🔒 Unlocks at level ${s.lvl}</small>`}<small>${s.desc}${s.pep ? ` (${s.pep} pep)` : ''}</small></div></div>`).join('')}</div>
    <h3>🥋 Karate moves (boss battles)</h3>
    <div class="skill-list">${KARATE_MOVES.map(s => `<div class="skill"><span class="ic">${s.icon}</span><div><b>${s.name}</b><small>${s.desc}${s.pep ? ` (${s.pep} pep)` : ''}</small></div></div>`).join('')}</div>`;
  $$('#skillsBody [data-stat]').forEach(b => b.addEventListener('click', () => {
    if (S.points <= 0) return;
    const k = b.dataset.stat;
    S.stats[k]++; S.points--;
    if (k === 'tough') S.hp = Math.min(maxHp(), S.hp + 6);
    Sound.sfx('task'); persist(); renderSkills();
  }));
}

// ---------- journal ----------
function renderJournal() {
  $('#journalBody').innerHTML = WORLDS.map((w, i) => {
    if (i >= S.unlocked) return `<div class="jworld"><h3>${w.icon} ???</h3><p>🔒 A mystery not yet discovered...</p></div>`;
    const ws = S.worlds[i], m = w.mystery;
    const clues = m.clues.slice(0, ws.clues);
    return `<div class="jworld"><h3>${w.icon} ${m.title}</h3>
      <ol>${clues.map(c => `<li>${esc(c)}</li>`).join('')}${ws.clues < 3 ? `<li style="opacity:.5">??? (${3 - ws.clues} clue${3 - ws.clues > 1 ? 's' : ''} still hidden)</li>` : ''}</ol>
      ${ws.solved ? `<p class="solved">✅ Solved! The culprit was ${esc(m.options[m.answer])}.</p>` : `<p><i>${esc(m.question)}</i></p>`}</div>`;
  }).join('');
}

// ================= modal + toast =================
const modalQ = [];
let modalOpen = false;
function showModal(o) { modalQ.push(o); if (!modalOpen) nextModal(); }
function nextModal() {
  const o = modalQ.shift();
  if (!o) { modalOpen = false; $('#modal').classList.add('hidden'); return; }
  modalOpen = true; keys.length = 0;
  $('#mIcon').textContent = o.icon || '';
  $('#mTitle').textContent = o.title || '';
  const body = $('#mBody');
  body.innerHTML = o.body || '';
  if (o.preview) {
    const cv = document.createElement('canvas'); cv.width = 170; cv.height = 150;
    body.appendChild(cv);
    const eq = { ...S.equipped };
    if (o.preview.acc) eq[ACCESSORIES[o.preview.acc].slot] = o.preview.acc;
    drawHamster(cv.getContext('2d'), 85, 82, 105, { color: S.color, equipped: eq, t: 0 });
  }
  const close = fn => {
    $('#modal').classList.add('hidden'); modalOpen = false;
    if (fn) fn();
    if (!modalOpen) nextModal();
  };
  if (o.choices) {
    const wrap = document.createElement('div'); wrap.className = 'choices';
    o.choices.forEach(c => wrap.appendChild(mkBtn(c.label, c.cls || 'yellow', () => close(c.onClick))));
    body.appendChild(wrap);
  }
  const btns = $('#mBtns'); btns.innerHTML = '';
  (o.buttons || (o.choices ? [] : [{ label: 'OK' }])).forEach(b => btns.appendChild(mkBtn(b.label, b.cls || 'green', () => close(b.onClick))));
  $('#modal').classList.remove('hidden');
}
function mkBtn(label, cls, fn) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'btn ' + cls; b.innerHTML = label;
  b.addEventListener('click', fn, { once: true });
  return b;
}
function toast(msg, cls = '') {
  const d = document.createElement('div');
  d.className = 'toast ' + cls; d.innerHTML = msg;
  const box = $('#toasts');
  box.appendChild(d);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => d.remove(), 2900);
}

// ================= the tunnelling world =================
const MW = 20, MH = 50, HOME = { x: 10, y: 3 }; // a compact map keeps tasks within easy reach
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const SKY = 3, DIRT = 1, STONE = 2, OPEN = 0;
let G = null;

const DECOR = [
  [{ x: 3, e: '🌳', s: 2.2 }, { x: 8, e: '🌷', s: 0.7 }, { x: 11, e: '🌻', s: 1 }, { x: 13, e: '🏡', s: 1.1 }, { x: 19, e: '🌼', s: 0.7 }, { x: 22, e: '🌻', s: 1 }, { x: 26, e: '🌳', s: 2 }],
  [{ x: 2, e: '🌴', s: 2.3 }, { x: 7, e: '🌺', s: 0.8 }, { x: 13, e: '🛖', s: 1.2 }, { x: 18, e: '🌿', s: 1 }, { x: 21, e: '🌴', s: 2.1 }, { x: 27, e: '🦜', s: 0.8 }],
  [{ x: 3, e: '🌲', s: 2.1 }, { x: 8, e: '⛄', s: 1.1 }, { x: 13, e: '🛖', s: 1.2 }, { x: 19, e: '🌲', s: 1.7 }, { x: 25, e: '🌲', s: 2.2 }],
  [{ x: 4, e: '🚀', s: 1.8 }, { x: 9, e: '🪨', s: 0.8 }, { x: 13, e: '🛰️', s: 1 }, { x: 20, e: '🚩', s: 1 }, { x: 26, e: '🌍', s: 1.6, sky: true }],
];

function enterWorld(w) {
  if (!S || w >= S.unlocked) return;
  S.current = w; returnTo = null;
  G = makeGame(w);
  if (S.hp == null || S.hp <= 0) S.hp = maxHp();
  show('game');
  Sound.play('w' + w);
  const ws = S.worlds[w];
  if (!ws.tasks) ws.tasks = makeTasks(w, ws.wave);
  // saves from the old, deeper map: keep depth goals reachable
  ws.maxDepth = Math.min(ws.maxDepth, MH - 6);
  for (const t of ws.tasks) if (t.type === 'depth' && !t.done) { t.need = Math.min(t.need, MH - 6); t.have = Math.min(t.have, t.need - 1); }
  ensureSpawns();
  revealFrom(HOME.x, HOME.y);
  updateHUD(); persist();
  if (!ws.intro) { ws.intro = true; persist(); worldIntro(w); }
}

function worldIntro(w) {
  const wd = WORLDS[w], m = wd.mystery;
  showModal({
    icon: wd.icon, title: `${wd.bonus ? 'BONUS World' : 'World ' + (w + 1)}: ${wd.name}`,
    body: `<p>${wd.desc}</p><div class="speech"><b>${m.giver}:</b> "${esc(m.intro)}"</div>
      <p class="tiny">Mystery: <b>${m.title}</b></p>`,
    buttons: [{ label: 'I\'ll solve it! 🔍' }],
  });
}

function makeGame(w) {
  const W = MW, H = MH, map = new Uint8Array(W * H), wd = WORLDS[w];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let t = y < 3 ? SKY : DIRT;
    if (y >= 3 && (x === 0 || x === W - 1 || y === H - 1)) t = STONE;
    map[y * W + x] = t;
  }
  const blobs = Math.round(W * H * wd.stoneRate / 5);
  for (let i = 0; i < blobs; i++) {
    let x = randi(1, W - 2), y = randi(7, H - 2);
    const n = randi(2, 8);
    for (let j = 0; j < n; j++) {
      if (map[y * W + x] === DIRT && !(Math.abs(x - HOME.x) < 3 && y < 10)) map[y * W + x] = STONE;
      x = clamp(x + randi(-1, 1), 1, W - 2); y = clamp(y + randi(-1, 1), 5, H - 2);
    }
  }
  map[HOME.y * W + HOME.x] = OPEN;
  return {
    w, wd, W, H, map, seen: new Uint8Array(W * H), objs: new Map(), cr: [], parts: [], t: 0, T: 48, cw: 0, ch: 0,
    ham: { x: HOME.x, y: HOME.y, tx: HOME.x, ty: HOME.y, mt: 0, mdur: 0, moving: false, digging: false, dt: 0, ddur: 0, tilt: 0 },
    cam: null, sniff: null, sniffCd: 0, regen: 0, bumpCd: 0, saveT: 0, ambientDone: false,
  };
}

const tileAt = (x, y) => (x < 0 || y < 0 || x >= G.W || y >= G.H) ? STONE : G.map[y * G.W + x];
const isOpen = (x, y) => tileAt(x, y) === OPEN;
const isSeen = (x, y) => x >= 0 && y >= 0 && x < G.W && y < G.H && G.seen[y * G.W + x] === 1;
const seenOpen = (x, y) => isOpen(x, y) && isSeen(x, y);

// Reveal every open tile connected to the hamster (so breaking into a cave shows the whole cave).
function revealFrom(x, y) {
  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    const k = cy * G.W + cx;
    if (G.seen[k] || !isOpen(cx, cy)) continue;
    G.seen[k] = 1;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
}
const crAt = (x, y) => G.cr.find(c => c.x === x && c.y === y);
const countObjs = f => { let n = 0; for (const o of G.objs.values()) if (f(o)) n++; return n; };

function freeSpot(minD, maxD) {
  const h = G.ham;
  for (let i = 0; i < 600; i++) {
    const x = randi(1, G.W - 2), y = randi(5, G.H - 3);
    const d = Math.abs(x - h.x) + Math.abs(y - h.y);
    if (i < 450 && (d < minD || d > maxD)) continue;
    const t = tileAt(x, y);
    if (t === STONE || t === SKY) continue;
    if (G.objs.has(y * G.W + x) || crAt(x, y) || (x === h.x && y === h.y)) continue;
    return { x, y };
  }
  return null;
}
function spawnObj(type, extra = {}, minD = 3, maxD = 16) {
  const p = freeSpot(minD, maxD);
  if (p) G.objs.set(p.y * G.W + p.x, { type, ...extra });
}
function spawnCreature(def, role, minD = 6, maxD = 20) {
  const p = freeSpot(minD, maxD);
  if (!p) return;
  // creatures hide inside the dirt; they only come out into tunnels you dig
  G.cr.push({ def, role, x: p.x, y: p.y, px: p.x, py: p.y, cd: rand(0.5, 2), stun: 0, alert: 0, talkCd: 0, gave: false, done: false, met: false });
}

// ---------- tasks ----------
function makeTasks(w, wave) {
  const wd = WORLDS[w], ws = S.worlds[w];
  let plan;
  if (S.beaten[w]) {
    plan = [{ type: 'collect', n: randi(3, 5) }, { type: 'defeat', n: randi(2, 3 + w) }, { type: 'riddle', n: randi(1, 1 + Math.ceil(w / 2)) }];
    if (Math.random() < 0.5) plan.push({ type: 'chest' });
  } else plan = wd.plan[Math.min(wave, 3) - 1];
  const prev = (ws.tasks || []).filter(t => t.type === 'collect').map(t => t.key);
  const items = shuffle(wd.items.slice()).sort((a, b) => prev.includes(a.id) - prev.includes(b.id));
  let ii = 0;
  return plan.map(p => {
    const t = { type: p.type, need: p.n || 1, have: 0, done: false };
    if (p.type === 'collect') t.key = items[ii++ % items.length].id;
    if (p.type === 'defeat' && p.who) t.key = p.who;
    if (p.type === 'depth') t.need = Math.min(MH - 6, ws.maxDepth + p.n);
    return t;
  });
}

function taskText(t, w = G.w) {
  const wd = WORLDS[w];
  const s = t.need > 1 ? 's' : '';
  switch (t.type) {
    case 'collect': { const it = wd.items.find(i => i.id === t.key); return `${it.e} Find ${t.need} ${it.name}`; }
    case 'defeat': {
      if (t.key) { const c = wd.hostiles.find(h => h.id === t.key); return `${c.e} Defeat ${t.need} ${t.need > 1 ? (c.plural || c.name + 's') : c.name}`; }
      return `⚔️ Defeat ${t.need} creature${s}`;
    }
    case 'riddle': return `🗿 Solve ${t.need} riddle${s}`;
    case 'clue': return '📜 Find a mystery clue';
    case 'chest': return '🎁 Open a treasure';
    case 'depth': return `⛏️ Dig down to ${t.need}m deep`;
    case 'friend': return '💬 Meet a friendly creature';
    case 'boss': return '🌀 Find the Boss Lair!';
  }
  return '';
}

function progress(type, key, n = 1) {
  const ws = S.worlds[G.w];
  if (!ws.tasks) return;
  let changed = false;
  ws.tasks.forEach((t, i) => {
    if (t.done || t.type !== type) return;
    if (type === 'depth') { if (key <= t.have) return; t.have = key; }
    else { if (t.key && t.key !== key) return; t.have += n; }
    changed = true;
    if (t.have >= t.need) {
      t.have = t.need; t.done = true;
      Sound.sfx('task');
      toast(`✅ ${taskText(t)}`, 'good');
      gainXP(5 * (G.w + 1));
      flashTask(i);
    }
  });
  if (changed) { updateHUD(); persist(); checkWave(); }
}

function checkWave() {
  const ws = S.worlds[G.w];
  if (!ws.tasks.every(t => t.done) || ws.tasks[0].type === 'boss') return;
  gainXP(15 * (G.w + 1));
  Sound.sfx('wave');
  if (!S.beaten[G.w] && ws.wave >= 3) {
    ws.wave = 4;
    ws.tasks = [{ type: 'boss', need: 1, have: 0, done: false }];
    ensureSpawns(); updateHUD(); persist();
    showModal({
      icon: '🌀', title: 'All 3 waves complete!',
      body: `<p><b>RUMBLE... RUMBLE...</b></p><p>A swirling <b>Boss Lair 🌀</b> has opened somewhere underground!</p><p>It's buried deep in the dirt. Use your 👃 <b>Sniff</b> to find it, solve the mystery, and get ready for a <b>BOSS BATTLE</b>! 🥋</p>`,
      buttons: [{ label: 'Let\'s go!' }],
    });
  } else {
    ws.wave++;
    ws.tasks = makeTasks(G.w, ws.wave);
    ensureSpawns(); updateHUD(); persist();
    const label = S.beaten[G.w] ? `Bonus Wave ${ws.wave}` : `Wave ${ws.wave} of 3`;
    showModal({
      icon: '🎉', title: 'Wave complete!',
      body: `<p>Great digging! Your task bar has new tasks for <b>${label}</b>:</p><ul class="clue-list">${ws.tasks.map(t => `<li>${taskText(t)}</li>`).join('')}</ul>`,
      buttons: [{ label: 'Keep digging! ⛏️' }],
    });
  }
}

function ensureSpawns() {
  const wd = G.wd, ws = S.worlds[G.w];
  if (!G.ambientDone) {
    G.ambientDone = true;
    for (let i = 0; i < wd.ambient.hostile; i++) spawnCreature(pick(wd.hostiles), 'hostile');
    for (let i = 0; i < wd.ambient.friend; i++) { const f = wd.friends[i % wd.friends.length]; spawnCreature(f, f.role, 4, 30); }
    for (let i = 0; i < wd.ambient.stones; i++) spawnObj('stone', {}, 6, 40);
    for (let i = 0; i < wd.ambient.chests; i++) spawnObj('chest', {}, 6, 60);
    for (let i = 0; i < wd.ambient.snacks; i++) spawnObj('snack', {}, 3, 50);
    for (let i = 0; i < 5; i++) { const it = pick(wd.items); spawnObj('item', { id: it.id, e: it.e }, 3, 40); }
  }
  for (const t of ws.tasks || []) {
    if (t.done) continue;
    const want = t.need - t.have + 1;
    switch (t.type) {
      case 'collect': {
        const it = wd.items.find(i => i.id === t.key);
        for (let i = countObjs(o => o.type === 'item' && o.id === t.key); i < want; i++) spawnObj('item', { id: it.id, e: it.e });
        break;
      }
      case 'defeat': {
        const have = G.cr.filter(c => c.role === 'hostile' && (!t.key || c.def.id === t.key)).length;
        for (let i = have; i < want; i++) spawnCreature(t.key ? wd.hostiles.find(h => h.id === t.key) : pick(wd.hostiles), 'hostile');
        break;
      }
      case 'riddle': {
        const have = countObjs(o => o.type === 'stone') + G.cr.filter(c => (c.role === 'riddler' || c.role === 'mystery') && !c.solved).length;
        for (let i = have; i < want; i++) spawnObj('stone');
        break;
      }
      case 'clue': if (!countObjs(o => o.type === 'clue')) spawnObj('clue', {}, 4, 13); break;
      case 'chest': if (!countObjs(o => o.type === 'chest')) spawnObj('chest'); break;
      case 'friend': if (!G.cr.some(c => c.role !== 'hostile' && !c.met)) { const f = pick(wd.friends.filter(f => f.role === 'helper')); spawnCreature(f, f.role, 5, 18); } break;
      case 'boss': if (!countObjs(o => o.type === 'gate')) spawnObj('gate', {}, 6, 15); break;
    }
  }
}

// ---------- input ----------
const keys = [];
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
function pressDir(d) { if (!keys.includes(d)) keys.push(d); }
function releaseDir(d) { const i = keys.indexOf(d); if (i >= 0) keys.splice(i, 1); }
const battleOpen = () => !$('#battle').classList.contains('hidden');
const tfOpen = () => !$('#transform').classList.contains('hidden');
const blocked = () => modalOpen || battleOpen() || tfOpen() || curScreen !== 'game';

window.addEventListener('keydown', e => {
  if (meter && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); stopMeter(); return; }
  if (modalOpen && e.code === 'Enter' && !$('#mBody .choices')) { const b = $('#mBtns .btn'); if (b) { e.preventDefault(); b.click(); } return; }
  if (curScreen !== 'game' || blocked()) return;
  const d = KEYMAP[e.code];
  if (d) { e.preventDefault(); pressDir(d); return; }
  if (e.code === 'KeyE') eatSnack();
  if (e.code === 'KeyF') sniff();
  if (e.code === 'KeyJ') openFromGame('journal');
  if (e.code === 'Escape' || e.code === 'KeyP') pauseMenu();
});
window.addEventListener('keyup', e => { const d = KEYMAP[e.code]; if (d) releaseDir(d); });
window.addEventListener('blur', () => { keys.length = 0; });

const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) $('#dpad').classList.add('show');
$$('#dpad button').forEach(b => {
  const d = b.dataset.d;
  const on = e => { e.preventDefault(); if (!blocked()) { pressDir(d); b.classList.add('on'); } };
  const off = () => { releaseDir(d); b.classList.remove('on'); };
  b.addEventListener('pointerdown', on);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, off));
});

$('#hbMenu').addEventListener('click', () => pauseMenu());
$('#hbSniff').addEventListener('click', () => sniff());
$('#hbSnack').addEventListener('click', () => eatSnack());
$('#hbJournal').addEventListener('click', () => openFromGame('journal'));
$('#hbWorlds').addEventListener('click', () => openFromGame('worlds'));

function openFromGame(scr) { if (blocked()) return; persist(); returnTo = 'game'; show(scr); }
function pauseMenu() {
  if (blocked()) return;
  persist();
  showModal({
    icon: '⏸️', title: 'Paused',
    body: `<p>Taking a little hamster break!</p>`,
    buttons: [
      { label: '▶ Keep digging' },
      { label: '🎀 Dress Up', cls: 'pink', onClick: () => openFromGame('dress') },
      { label: '⭐ Skills', cls: 'yellow', onClick: () => openFromGame('skills') },
      { label: '🏠 Main Menu', cls: 'ghost', onClick: () => { persist(); show('menu'); } },
    ],
  });
}

function eatSnack() {
  if (!S || blocked()) return;
  if (S.snacks <= 0) return toast('No snacks! Look for 🍓 while digging.');
  if (S.hp >= maxHp()) return toast('You\'re already full of energy! ❤️');
  S.snacks--;
  S.hp = Math.min(maxHp(), S.hp + Math.ceil(maxHp() * 0.35));
  Sound.sfx('heal'); toast('🍓 Nom nom! Health restored.', 'good');
  updateHUD(); persist();
}

function sniffTargets() {
  const ws = S.worlds[G.w], out = [];
  for (const t of ws.tasks || []) {
    if (t.done) continue;
    for (const [k, o] of G.objs) {
      const x = k % G.W, y = Math.floor(k / G.W);
      if ((t.type === 'collect' && o.type === 'item' && o.id === t.key) || (t.type === 'riddle' && o.type === 'stone') ||
        (t.type === 'clue' && o.type === 'clue') || (t.type === 'chest' && o.type === 'chest') || (t.type === 'boss' && o.type === 'gate')) out.push({ x, y });
    }
    for (const c of G.cr) {
      if ((t.type === 'defeat' && c.role === 'hostile' && (!t.key || c.def.id === t.key)) ||
        (t.type === 'riddle' && (c.role === 'riddler' || c.role === 'mystery') && !c.solved) ||
        (t.type === 'friend' && c.role !== 'hostile' && !c.met)) out.push({ x: c.x, y: c.y });
    }
    if (t.type === 'depth') out.push({ x: G.ham.x, y: HOME.y + t.need });
  }
  return out;
}
function sniff() {
  if (!G || blocked()) return;
  if (G.sniffCd > 0) return toast(`👃 Your nose needs a rest (${Math.ceil(G.sniffCd)}s)`);
  const h = G.ham;
  const ts = sniffTargets();
  if (!ts.length) return toast('👃 Sniff sniff... nothing to find right now!');
  ts.sort((a, b) => (Math.abs(a.x - h.x) + Math.abs(a.y - h.y)) - (Math.abs(b.x - h.x) + Math.abs(b.y - h.y)));
  G.sniff = { ...ts[0], t: 3.5 };
  G.sniffCd = 10;
  Sound.sfx('talk');
}

// ---------- update ----------
function update(dt) {
  G.t += dt;
  updateParticles(dt);
  if (G.sniffCd > 0) { G.sniffCd -= dt; $('#hbSniff').classList.toggle('cool', G.sniffCd > 0); }
  if (G.sniff) { G.sniff.t -= dt; if (G.sniff.t <= 0) G.sniff = null; }
  if (G.bumpCd > 0) G.bumpCd -= dt;
  if (blocked()) return;
  const h = G.ham;
  const d = keys[keys.length - 1];
  if (h.moving) {
    h.mt += dt / h.mdur;
    if (h.mt >= 1) { h.moving = false; h.x = h.tx; h.y = h.ty; arrive(); }
  } else if (h.digging) {
    if (!d || DIRS[d][0] !== h.tx - h.x || DIRS[d][1] !== h.ty - h.y) h.digging = false;
    else {
      h.dt += dt;
      if (Math.random() < dt * 30) dirtBits(h.tx, h.ty, 1);
      if (h.dt >= h.ddur) {
        h.digging = false;
        G.map[h.ty * G.W + h.tx] = OPEN;
        revealFrom(h.tx, h.ty);
        S.record.dug++;
        Sound.sfx('dig'); dirtBits(h.tx, h.ty, 6);
        startMove(h.tx, h.ty, 0.12);
      }
    }
  } else if (d) tryMove(DIRS[d][0], DIRS[d][1]);

  const target = h.digging ? Math.sin(G.t * 32) * 0.13 : (h.moving ? (h.tx - h.x) * 0.15 : 0);
  h.tilt += (target - h.tilt) * Math.min(1, dt * 12);

  updateCreatures(dt);

  G.regen += dt;
  const atHome = h.x === HOME.x && h.y === HOME.y;
  if (G.regen >= (atHome ? 0.25 : 2.5)) {
    G.regen = 0;
    if (S.hp < maxHp()) { S.hp++; updateHUD(); }
  }
  G.saveT += dt;
  if (G.saveT > 10) { G.saveT = 0; persist(); }
}

function tryMove(dx, dy) {
  const h = G.ham, nx = h.x + dx, ny = h.y + dy;
  if (ny < HOME.y) return bump();
  const c = crAt(nx, ny);
  if (c && !canPass(c)) { keys.length = 0; return meetCreature(c); }
  const t = tileAt(nx, ny);
  if (t === STONE || t === SKY) return bump();
  if (t === DIRT) { h.digging = true; h.dt = 0; h.ddur = digTime(); h.tx = nx; h.ty = ny; return; }
  startMove(nx, ny, 0.13);
}
// Friends you've already talked to step aside; riddlers only once you've solved their riddle.
function canPass(c) {
  return (c.role === 'helper' && c.met) || (c.role === 'riddler' && c.solved);
}
function bump() { if (G.bumpCd <= 0) { Sound.sfx('bump'); G.bumpCd = 0.35; } }
function startMove(nx, ny, dur) { const h = G.ham; h.moving = true; h.mt = 0; h.mdur = dur; h.tx = nx; h.ty = ny; }

function arrive() {
  const h = G.ham, ws = S.worlds[G.w];
  revealFrom(h.x, h.y);
  const depth = h.y - HOME.y;
  if (depth > ws.maxDepth) ws.maxDepth = depth;
  progress('depth', depth);
  updateHUD();
  const k = h.y * G.W + h.x;
  const o = G.objs.get(k);
  if (o) touchObj(o, k);
}

function updateCreatures(dt) {
  const h = G.ham;
  for (const c of G.cr) {
    if (blocked()) return;
    if (c.talkCd > 0) c.talkCd -= dt;
    if (c.stun > 0) { c.stun -= dt; continue; }
    c.cd -= dt;
    if (c.cd > 0) continue;
    const hostile = c.role === 'hostile';
    const dist = Math.abs(c.x - h.x) + Math.abs(c.y - h.y);
    let step = null;
    if (hostile && dist <= 4 + G.w) {
      // chase through tunnels
      let best = dist;
      for (const [dx, dy] of Object.values(DIRS)) {
        const nx = c.x + dx, ny = c.y + dy;
        if (!isOpen(nx, ny)) continue;
        const nd = Math.abs(nx - h.x) + Math.abs(ny - h.y);
        if (nd < best) { best = nd; step = [nx, ny]; }
      }
      c.alert = step ? 1 : 0;
      c.cd = Math.max(0.3, 0.6 - G.w * 0.07);
    } else {
      c.alert = 0;
      c.cd = rand(0.9, 2);
      if (Math.random() < 0.6) {
        const opts = Object.values(DIRS).map(([dx, dy]) => [c.x + dx, c.y + dy]).filter(([x, y]) => isOpen(x, y) && y > HOME.y);
        if (opts.length) step = pick(opts);
      }
    }
    if (!step) continue;
    const [nx, ny] = step;
    const onHam = (nx === h.x && ny === h.y) || (h.moving && nx === h.tx && ny === h.ty);
    if (onHam) { if (hostile) { startBattle(c); return; } continue; }
    if (!crAt(nx, ny)) { c.x = nx; c.y = ny; }
  }
}

// ---------- objects & creatures ----------
function touchObj(o, k) {
  const wd = G.wd;
  switch (o.type) {
    case 'item': {
      G.objs.delete(k);
      Sound.sfx('pickup');
      floatText(`+1 ${o.e}`);
      progress('collect', o.id);
      break;
    }
    case 'snack': G.objs.delete(k); S.snacks++; Sound.sfx('pickup'); floatText('+1 🍓'); updateHUD(); persist(); break;
    case 'chest': G.objs.delete(k); openChest(); break;
    case 'stone':
      askRiddle({ icon: '🗿', title: 'Riddle Stone', speech: 'The ancient stone glows... and words appear!' }, ok => {
        if (ok) { G.objs.delete(k); riddleSolved(); }
      });
      break;
    case 'clue': {
      G.objs.delete(k);
      const ws = S.worlds[G.w];
      const m = wd.mystery;
      if (ws.clues < m.clues.length) {
        ws.clues++;
        Sound.sfx('chest');
        showModal({
          icon: '📜', title: `Mystery Clue #${ws.clues}`,
          body: `<p><i>${m.title}</i></p><div class="speech">${esc(m.clues[ws.clues - 1])}</div><p class="tiny">Saved in your 📖 Mystery Journal.</p>`,
          buttons: [{ label: 'Hmm, interesting... 🔍' }],
        });
      }
      gainXP(8 * (G.w + 1));
      progress('clue');
      persist();
      break;
    }
    case 'gate': enterGate(); break;
  }
}

function openChest() {
  Sound.sfx('chest');
  const pool = G.wd.accessories.filter(a => !S.owned.includes(a));
  if (pool.length && Math.random() < 0.6 + S.stats.luck * 0.05) giveAcc(pick(pool), '🎁 Treasure!', 'You dug up a treasure box!');
  else if (Math.random() < 0.55) {
    const n = randi(1, 3); S.snacks += n;
    showModal({ icon: '🎁', title: 'Treasure!', body: `<p>You found <b>${n} 🍓 snack${n > 1 ? 's' : ''}</b>!</p>` });
  } else {
    const xp = 12 * (G.w + 1);
    showModal({ icon: '🎁', title: 'Treasure!', body: `<p>An old map with secret digging tips! <b>+${xp} XP</b></p>` });
    gainXP(xp);
  }
  updateHUD(); persist();
  progress('chest');
}

function giveAcc(id, title, line) {
  if (!S.owned.includes(id)) S.owned.push(id);
  persist();
  const a = ACCESSORIES[id];
  showModal({
    icon: a.icon, title, preview: { acc: id },
    body: `<p>${line}</p><p>You got the <b>${a.icon} ${a.name}</b>! Wear it in Dress Up anytime.</p>`,
    buttons: [{ label: 'Wear it now! ✨', cls: 'pink', onClick: () => { S.equipped[a.slot] = id; persist(); } }, { label: 'Cool!', cls: 'ghost' }],
  });
}

function askRiddle(src, onDone, avoid = -1) {
  const wd = G.wd;
  const used = S.usedRiddles[G.w] = S.usedRiddles[G.w] || [];
  // riddles are listed easiest -> hardest, so always serve the next unsolved one;
  // once every riddle is solved, keep repeating the hardest half
  const n = wd.riddles.length;
  let idx = wd.riddles.findIndex((_, i) => !used.includes(i) && i !== avoid);
  if (idx < 0) idx = pick([...Array(n).keys()].slice(Math.floor(n / 2)).filter(i => i !== avoid));
  const r = wd.riddles[idx];
  if (src.who) src.who.lastRiddle = idx;
  const stars = Math.min(5, G.w + 1 + Math.floor((idx / n) * 2));
  showModal({
    icon: src.icon, title: src.title,
    body: `${src.speech ? `<div class="speech">${esc(src.speech)}</div>` : ''}
      <p class="tiny">Riddle ${Math.min(idx + 1, n)} of ${n} · Difficulty ${'⭐'.repeat(stars)}</p><p><b>${esc(r.q)}</b></p>`,
    choices: shuffle([r.a, ...r.w]).map(opt => ({
      label: esc(opt),
      onClick: () => {
        if (opt === r.a) {
          if (!used.includes(idx)) used.push(idx);
          S.record.riddles++;
          Sound.sfx('correct');
          showModal({ icon: '🎉', title: 'Correct!', body: `<p>"<b>${esc(r.a)}</b>" is right! You're one smart hamster!</p>` });
          onDone(true);
        } else {
          Sound.sfx('wrong');
          S.hp = Math.max(1, S.hp - 2); updateHUD();
          showModal({ icon: '🤔', title: 'Not quite!', body: '<p>That\'s not it... (-2 ❤️)</p><p>Come back and try again when you\'re ready!</p>' });
          onDone(false);
        }
        persist();
      },
    })),
    buttons: [{ label: 'Think about it later', cls: 'ghost' }],
  });
}
function riddleSolved() {
  gainXP(10 * (G.w + 1));
  if (Math.random() < 0.3) { S.snacks++; toast('The riddle gave you a bonus 🍓!', 'good'); }
  progress('riddle');
}

const ALIEN_FOE = { id: 'alien', e: '👽', name: 'Tricky Alien', hp: 72, atk: 14, xp: 50, special: 'Brain Beam' };
function meetCreature(c) {
  if (c.role === 'hostile') return startBattle(c);
  if (c.talkCd > 0) return;
  c.talkCd = 2;
  Sound.sfx('talk');
  if (c.role === 'mystery') {
    const r = Math.random();
    c.role = r < 0.4 ? 'hostile' : r < 0.72 ? 'riddler' : 'helper';
    if (c.role === 'hostile') {
      c.def = ALIEN_FOE;
      showModal({ icon: '👽', title: 'Mysterious Alien', body: '<div class="speech">"Greetings, friend... JUST KIDDING! ZAP ZAP!"</div><p>It was a trick! The alien attacks!</p>', buttons: [{ label: '⚔️ Fight!', cls: 'pink', onClick: () => startBattle(c) }] });
      return;
    }
    c.def = c.role === 'riddler'
      ? { id: 'alien', e: '👽', name: 'Puzzling Alien', role: 'riddler', lines: ['Zeep! My brain has 3 lobes. Can yours solve THIS?'] }
      : { id: 'alien', e: '👽', name: 'Friendly Alien', role: 'helper', lines: ['Bloop! Earth creature cute! Take gift!', 'Zorp zorp! You are fluffy. Here!'] };
  }
  if (!c.met) { c.met = true; progress('friend'); }
  const d = c.def;
  if (c.role === 'helper') {
    if (c.gave) return showModal({ icon: d.e, title: d.name, body: `<div class="speech">"Good luck, ${esc(displayName())}! You can do it!"</div>` });
    c.gave = true;
    const line = pick(d.lines);
    const pool = G.wd.accessories.filter(a => !S.owned.includes(a));
    const r = Math.random();
    if (pool.length && r < 0.3) giveAcc(pick(pool), d.name, `<div class="speech">"${esc(line)}"</div>`);
    else if (r < 0.65) {
      const n = randi(1, 3); S.snacks += n;
      showModal({ icon: d.e, title: d.name, body: `<div class="speech">"${esc(line)}"</div><p>${d.name} gave you <b>${n} 🍓 snack${n > 1 ? 's' : ''}</b>!</p>` });
    } else {
      const xp = 8 * (G.w + 1);
      S.hp = maxHp();
      showModal({ icon: d.e, title: d.name, body: `<div class="speech">"${esc(line)}"</div><p>${d.name} healed you all the way and taught you a digging trick! <b>+${xp} XP</b></p>` });
      gainXP(xp);
    }
    updateHUD(); persist();
  } else if (c.role === 'riddler') {
    // a new riddle every time you talk to them
    const speech = c.asked ? 'Back for more? Here\'s a brand new riddle!' : pick(d.lines);
    c.asked = true;
    askRiddle({ icon: d.e, title: d.name, speech, who: c }, ok => { if (ok) { c.solved = true; riddleSolved(); } }, c.lastRiddle ?? -1);
  }
}

function enterGate() {
  const ws = S.worlds[G.w], m = G.wd.mystery;
  if (ws.solved) return bossIntro();
  showModal({
    icon: '🔍', title: 'Solve the Mystery!',
    body: `<p>A voice booms: <i>"Only those who know the TRUTH may enter!"</i></p>
      <p><b>${m.title}</b> - your clues:</p>
      <ol class="clue-list">${m.clues.slice(0, ws.clues).map(c => `<li>${esc(c)}</li>`).join('')}</ol>
      <p><b>${esc(m.question)}</b></p>`,
    choices: m.options.map((opt, i) => ({
      label: esc(opt),
      onClick: () => {
        if (i === m.answer) {
          ws.solved = true; persist();
          Sound.sfx('correct');
          showModal({
            icon: '💡', title: 'Mystery solved!',
            body: `<p>It was <b>${esc(opt)}</b>! The Boss Lair door swings open...</p><p>Get ready... it's time to become <b>KARATE HAMSTER!</b> 🥋</p>`,
            buttons: [{ label: '🥋 FIGHT!', cls: 'pink', onClick: bossIntro }],
          });
        } else {
          Sound.sfx('wrong');
          S.hp = Math.max(1, S.hp - 3); updateHUD(); persist();
          showModal({ icon: '❌', title: 'That doesn\'t match the clues!', body: `<p>The door stays shut. (-3 ❤️)</p><p><b>Hint:</b> ${esc(m.hint)}</p><p>Step off and back onto the 🌀 to try again.</p>` });
        }
      },
    })),
    buttons: [{ label: 'Not yet', cls: 'ghost' }],
  });
}

// ================= karate transformation =================
let TF = null;
function bossIntro() {
  keys.length = 0;
  TF = { t: 0 };
  $('#tfText').textContent = '';
  $('#transform').classList.remove('hidden');
  Sound.stop();
  Sound.sfx('transform');
}
function drawTf(dt) {
  TF.t += dt;
  const t = TF.t;
  const cv = $('#cvTf'), ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  const cx = cv.width / 2, cy = cv.height / 2 + 10;
  // speed lines
  ctx.save(); ctx.translate(cx, cy);
  for (let i = 0; i < 24; i++) {
    ctx.rotate(Math.PI * 2 / 24);
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.35)' : 'rgba(255,200,60,0.3)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(400, -18 - Math.sin(t * 10) * 6); ctx.lineTo(400, 18); ctx.fill();
  }
  ctx.restore();
  const karate = t > 1.8;
  const spin = karate ? 0 : Math.pow(t, 2.5) * 6;
  ctx.save(); ctx.translate(cx, cy);
  ctx.scale(Math.cos(spin) || 0.01, 1);
  drawHamster(ctx, 0, 0, karate ? 230 + Math.max(0, 0.5 - (t - 1.8)) * 120 : 200, {
    color: S.color, equipped: S.equipped, karate, belt: BELTS[G.w], t, punch: karate ? Math.max(0, Math.sin((t - 1.8) * 6)) * 0.6 : 0,
  });
  ctx.restore();
  if (t > 1.75 && t < 2.05) { ctx.fillStyle = `rgba(255,255,255,${1 - (t - 1.75) / 0.3})`; ctx.fillRect(0, 0, cv.width, cv.height); }
  if (karate && !TF.music) { TF.music = true; Sound.play('boss'); $('#tfText').textContent = 'KARATE HAMSTER!'; }
  if (t > 3.6) {
    $('#transform').classList.add('hidden');
    TF = null;
    startBattle(null, true);
  }
}

// ================= battles =================
let B = null;
let meter = null;

// belt worn in normal battles: the best belt earned so far (white to start)
function currentBelt() { const i = S.beaten.lastIndexOf(true); return i >= 0 ? BELTS[i] : '#f4f4f4'; }

function startBattle(c, boss = false) {
  keys.length = 0;
  if (!boss) Sound.play('battle');
  const d = boss ? G.wd.boss : c.def;
  // regular creatures are a bit tougher than their base stats (and give a bit more XP)
  const hp = boss ? d.hp : Math.round(d.hp * 1.35);
  B = {
    c, boss, d, name: d.name, hp, max: hp, atk: boss ? d.atk : d.atk * 1.2, xp: boss ? d.xp : Math.round(d.xp * 1.15),
    pep: boss ? 5 : 3, block: false, dodge: false, sense: false, turn: 0, tele: false, phase: 0,
    busy: false, over: false, t: 0, meLunge: 0, foeLunge: 0, meHurt: 0, foeHurt: 0,
  };
  const box = $('.battle-box');
  box.dataset.w = G.w;
  box.classList.toggle('boss', boss);
  $('#bLog').innerHTML = '';
  $('#bFoeStatus').textContent = '';
  $('#battle').classList.remove('hidden');
  if (boss) blog(`<b>${d.name}</b>: <i>${esc(d.lines[0])}</i>`);
  else blog(`A ${d.name} ${d.e} wants to battle! 🥋 You switch into <b>KARATE MODE!</b>`);
  renderBattle();
}

function blog(html) {
  const el = $('#bLog');
  el.innerHTML = `<div>${html}</div>` + el.innerHTML;
  while (el.children.length > 2) el.lastChild.remove();
}

function renderBattle() {
  if (!B) return;
  const mh = maxHp();
  $('#bMeName').textContent = displayName() + ' 🥋';
  $('#bMeLv').textContent = S.level;
  $('#bMeHp').style.width = (S.hp / mh * 100) + '%';
  $('#bMeHpTxt').textContent = `❤️ ${S.hp} / ${mh}`;
  $('#bMePep').style.width = (B.pep / 10 * 100) + '%';
  $('#bMePepTxt').textContent = `⚡ Pep ${B.pep} / 10`;
  $('#bFoeName').textContent = B.name;
  $('#bFoeHp').style.width = (B.hp / B.max * 100) + '%';
  $('#bFoeHpTxt').textContent = `${B.hp} / ${B.max}`;
  // boss fights use the full karate move set; normal fights use Karate Chop plus your learned skills
  const list = B.boss ? KARATE_MOVES : [KARATE_MOVES[0], ...SKILLS.filter(s => s.id !== 'swipe' && S.level >= s.lvl)];
  const dis = B.busy || B.over;
  const html = list.map(m => `<button class="btn ${m.pep ? 'pink' : ''}" data-act="${m.id}" ${dis || B.pep < m.pep ? 'disabled' : ''}>${m.icon} ${m.name}<small>${m.pep ? m.pep + ' pep' : 'free'}${m.heal ? ' · heal' : ''}</small></button>`).join('')
    + `<button class="btn green" data-act="snackitem" ${dis || S.snacks <= 0 || S.hp >= mh ? 'disabled' : ''}>🍓 Snack<small>you have ${S.snacks}</small></button>`
    + (B.boss ? '' : `<button class="btn ghost" data-act="run" ${dis ? 'disabled' : ''}>🏃 Run<small>scurry away</small></button>`);
  $('#bActions').innerHTML = html;
  $$('#bActions [data-act]').forEach(b => b.addEventListener('click', () => act(b.dataset.act)));
}

function floatNum(side, text, cls = '') {
  const f = document.createElement('div');
  f.className = 'float ' + cls; f.textContent = text;
  $('.fighter.' + side).appendChild(f);
  setTimeout(() => f.remove(), 1000);
}
function shakeEl(side) {
  const el = $('.fighter.' + side);
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
}

async function act(id) {
  if (!B || B.busy || B.over) return;
  B.busy = true;
  renderBattle();
  const mv = [...KARATE_MOVES, ...SKILLS].find(m => m.id === id);
  if (id === 'snackitem') {
    S.snacks--; healPct(0.35, '🍓 You munch a snack.');
  } else if (id === 'run') {
    if (Math.random() < 0.7) { blog('🏃 You scurried away safely!'); await wait(500); return endBattle('run'); }
    blog('You tried to run... but got blocked!');
  } else if (mv) {
    B.pep -= mv.pep;
    renderBattle();
    if (mv.meter) {
      const r = await runMeter();
      blog(`<b>${r.label}</b>`);
      playerHit(mv.mult * r.mult, mv.icon);
    } else if (mv.hits) {
      for (let i = 0; i < mv.hits && B.hp > 0; i++) { playerHit(mv.mult, mv.icon); await wait(280); }
    } else if (mv.mult) playerHit(mv.mult, mv.icon);
    else if (mv.heal) healPct(mv.heal, `${mv.icon} ${mv.name}!`);
    else if (id === 'dodge') blog('🕳️ You dig down and hide! Waiting to pop up...'), B.dodge = true;
    else if (id === 'sense') blog('✨ Your whiskers twitch... you spot a weak spot!'), B.sense = true;
    else if (id === 'block') { B.block = true; B.pep = Math.min(10, B.pep + 3); blog('🛡️ You take a strong karate stance! HUP!'); }
  }
  renderBattle();
  await wait(700);
  if (B.hp <= 0) return winBattle();
  await enemyTurn();
  if (!B) return;
  if (S.hp <= 0) return loseBattle();
  B.pep = Math.min(10, B.pep + 2);
  B.busy = false;
  renderBattle();
}

function healPct(p, msg) {
  const before = S.hp;
  S.hp = Math.min(maxHp(), S.hp + Math.ceil(maxHp() * p));
  Sound.sfx('heal');
  floatNum('me', `+${S.hp - before}`, 'heal');
  blog(`${msg} +${S.hp - before} ❤️`);
}

function playerHit(mult, icon) {
  let dmg = playerAtk() * mult * rand(0.9, 1.1);
  const crit = B.sense || Math.random() < critChance();
  if (crit) { dmg *= 1.5; B.sense = false; }
  dmg = Math.max(1, Math.round(dmg));
  B.hp = Math.max(0, B.hp - dmg);
  B.meLunge = 1; B.foeHurt = 0.5;
  Sound.sfx(crit ? 'crit' : 'hit');
  floatNum('foe', `-${dmg}`, crit ? 'crit' : '');
  shakeEl('foe');
  blog(`${icon} You hit ${B.name} for <b>${dmg}</b>!${crit ? ' <b>CRITICAL! ✨</b>' : ''}`);
  if (B.boss) {
    const frac = B.hp / B.max;
    const ph = frac <= 0.33 ? 2 : frac <= 0.66 ? 1 : 0;
    if (ph > B.phase && B.hp > 0) { B.phase = ph; blog(`<b>${B.name}</b>: <i>${esc(B.d.lines[ph])}</i> <span class="warn">(getting stronger!)</span>`); }
  }
  renderBattle();
}

function runMeter() {
  return new Promise(resolve => {
    $('#bActions').classList.add('hidden');
    const el = $('#bMeter');
    el.classList.remove('hidden');
    const speed = B.boss ? 1.5 + G.w * 0.15 : 1.15 + G.w * 0.1;
    meter = { t: Math.random() * 0.3, speed, pos: 0, resolve, max: 4 };
    el.onpointerdown = e => { e.preventDefault(); stopMeter(); };
  });
}
function tickMeter(dt) {
  meter.t += dt;
  const ph = (meter.t * meter.speed) % 2;
  meter.pos = ph < 1 ? ph : 2 - ph;
  $('#bNeedle').style.left = (meter.pos * 100) + '%';
  if (meter.t > meter.max) stopMeter();
}
function stopMeter() {
  if (!meter) return;
  const d = Math.abs(meter.pos - 0.5);
  const r = d < 0.04 ? { mult: 1.6, label: 'PERFECT!! 🌟' } : d < 0.13 ? { mult: 1.25, label: 'Great hit! 💥' } : d < 0.25 ? { mult: 1, label: 'Good!' } : { mult: 0.6, label: 'Oops, a weak hit...' };
  const res = meter.resolve;
  meter = null;
  $('#bMeter').classList.add('hidden');
  $('#bActions').classList.remove('hidden');
  res(r);
}

async function enemyTurn() {
  B.turn++;
  const d = B.d;
  let mult = 1, name = d.attack || 'Attack', hits = 1, drain = 0, big = false;
  if (B.boss) {
    if (B.tele) { B.tele = false; big = true; mult = 2.2; name = d.big; $('#bFoeStatus').textContent = ''; }
    else {
      const p = B.turn % 4;
      if (p === 3) {
        B.tele = true;
        Sound.sfx('warn');
        blog(`<span class="warn">⚠️ ${d.name} is charging up ${d.big}! Use 🛡️ Block Stance!</span>`);
        $('#bFoeStatus').textContent = `⚠️ Charging ${d.big}!`;
        B.foeHurt = 0;
        B.block = false; B.dodge = false;
        return;
      }
      if (p === 0) {
        name = d.special;
        if (d.style === 'queen') { hits = 3; mult = 0.45; }
        else if (d.style === 'kraken') { hits = 4; mult = 0.38; }
        else { mult = 1.05; drain = 3; }
      }
    }
  } else if (Math.random() < 0.22) { mult = 1.4; name = d.special; }

  let dodged = false;
  for (let i = 0; i < hits; i++) {
    if (B.hp <= 0) break;
    B.foeLunge = 1;
    if (B.dodge) {
      if (!dodged) { dodged = true; blog(`💨 ${B.name} used ${name}... but you were underground! You pop up to counter!`); Sound.sfx('miss'); await wait(400); playerHit(0.8, '🕳️'); }
    } else {
      let dmg = B.atk * (1 + B.phase * 0.12) * mult * rand(0.85, 1.15) - playerDef();
      dmg = Math.max(1, Math.round(dmg));
      let note = '';
      if (B.block) { dmg = Math.max(1, Math.round(dmg * 0.25)); note = ' (blocked! 🛡️)'; }
      S.hp = Math.max(0, S.hp - dmg);
      B.meHurt = 0.5;
      Sound.sfx('hurt'); shakeEl('me'); floatNum('me', `-${dmg}`);
      blog(`${B.d.e || '🐾'} ${B.name} uses <b>${name}</b>! You take ${dmg}${note}.`);
      if (drain) { B.pep = Math.max(0, B.pep - drain); blog(`${name} drains ${drain} pep! 😵`); }
      if (big && B.block && B.hp > 0) { await wait(400); blog('🥋 Perfect block! Counter-chop!'); playerHit(0.7, '🤚'); }
      if (S.hp <= 0) break;
    }
    renderBattle();
    if (hits > 1) await wait(300);
  }
  B.block = false; B.dodge = false;
  renderBattle();
  await wait(300);
  if (B && B.hp <= 0) { await winBattle(); }
}

async function winBattle() {
  if (!B || B.over) return;
  B.over = true;
  renderBattle();
  blog(`🎉 You defeated <b>${B.name}</b>!`);
  Sound.sfx('victory');
  await wait(1100);
  $('#battle').classList.add('hidden');
  const b = B;
  B = null;
  S.record.fights++;
  if (b.boss) return bossWon(b);
  G.cr = G.cr.filter(x => x !== b.c);
  Sound.play('w' + G.w);
  toast(`🏆 +${b.xp} XP`, 'gold');
  gainXP(b.xp);
  if (Math.random() < 0.25 + S.stats.luck * 0.05) { S.snacks++; toast(`${b.d.e} dropped a 🍓 snack!`, 'good'); }
  progress('defeat', b.d.id);
  updateHUD(); persist();
}

async function loseBattle() {
  B.over = true;
  renderBattle();
  blog('😵 You fainted...');
  await wait(1200);
  $('#battle').classList.add('hidden');
  const b = B;
  B = null;
  S.hp = maxHp();
  const h = G.ham;
  h.x = h.tx = HOME.x; h.y = h.ty = HOME.y; h.moving = h.digging = false;
  revealFrom(h.x, h.y);
  if (b.c) b.c.stun = 4;
  const helper = G.wd.friends.find(f => f.role === 'helper');
  if (b.boss) {
    Sound.play('w' + G.w);
    showModal({ icon: '💫', title: `${b.name} was too strong!`, body: `<p>${helper.e} ${helper.name} carried you home to rest.</p><p>Level up, spend your skill points ⭐, and grab some snacks 🍓 - then go back to the 🌀 Boss Lair for a rematch!</p>` });
  } else {
    Sound.play('w' + G.w);
    showModal({ icon: '💫', title: 'You fainted!', body: `<p>Don't worry! ${helper.e} ${helper.name} carried you back home. You're all rested now!</p>` });
  }
  updateHUD(); persist();
}

function endBattle() {
  $('#battle').classList.add('hidden');
  Sound.play('w' + G.w);
  if (B && B.c) B.c.stun = 3;
  B = null;
  updateHUD(); persist();
}

function bossWon(b) {
  const w = G.w, wd = G.wd, ws = S.worlds[w];
  const firstWin = !S.beaten[w];
  S.beaten[w] = true;
  S.unlocked = Math.max(S.unlocked, Math.min(WORLDS.length, w + 2));
  for (const [k, o] of G.objs) if (o.type === 'gate') G.objs.delete(k);
  ws.wave = 1;
  ws.tasks = makeTasks(w, 1);
  ensureSpawns();
  Sound.play('w' + w);
  const reward = ACCESSORIES[wd.boss.reward];
  if (!S.owned.includes(wd.boss.reward)) S.owned.push(wd.boss.reward);
  gainXP(b.xp);
  persist();
  const next = w < WORLDS.length - 1 ? WORLDS[w + 1] : null;
  showModal({
    icon: '🏆', title: 'BOSS DEFEATED!', preview: { acc: wd.boss.reward },
    body: `<div class="speech"><b>${wd.boss.name}:</b> <i>${esc(wd.boss.lines[3])}</i></div>
      <p>You earned the <b>${reward.icon} ${reward.name}</b>, a <b>${BELT_NAMES[w]} karate belt</b> 🥋 and <b>${b.xp} XP</b>!</p>
      ${next ? (firstWin ? `<p>🔓 New world unlocked: <b>${next.icon} ${next.name}</b>${next.bonus ? ' - a BONUS world!' : ''}</p>` : '')
        : '<p>🌟 You saved EVERY world! You are a true <b>TUNNEL LEGEND</b>! 🌟</p>'}
      <p class="tiny">You can come back and dig here for bonus waves anytime.</p>`,
    buttons: next ? [{ label: `Go to ${next.short} ➜`, cls: 'green', onClick: () => enterWorld(w + 1) }, { label: 'Keep digging here', cls: 'ghost' }] : [{ label: 'Hooray! 🎉' }],
  });
  updateHUD();
}

function drawBattle(dt) {
  B.t += dt;
  B.meLunge = Math.max(0, B.meLunge - dt * 3);
  B.foeLunge = Math.max(0, B.foeLunge - dt * 3);
  B.meHurt = Math.max(0, B.meHurt - dt);
  B.foeHurt = Math.max(0, B.foeHurt - dt);
  const t = B.t;
  const c1 = $('#cvBMe'), x1 = c1.getContext('2d');
  x1.clearRect(0, 0, c1.width, c1.height);
  x1.save();
  if (B.meHurt > 0 && Math.floor(t * 20) % 2) x1.globalAlpha = 0.4;
  const lunge = Math.sin(B.meLunge * Math.PI);
  drawHamster(x1, 115 + lunge * 60, 120, 150, {
    color: S.color, equipped: S.equipped, karate: true, belt: B.boss ? BELTS[G.w] : currentBelt(), t, bob: true,
    blink: (t % 3.5) < 0.12, punch: lunge, tilt: lunge * 0.15,
  });
  x1.restore();
  const c2 = $('#cvBFoe'), x2 = c2.getContext('2d');
  x2.clearRect(0, 0, c2.width, c2.height);
  x2.save();
  const fl = Math.sin(B.foeLunge * Math.PI);
  if (B.foeHurt > 0 && Math.floor(t * 20) % 2) x2.globalAlpha = 0.4;
  if (B.boss) drawBoss(x2, B.d, 125 - fl * 60, 115, 210, t, false);
  else {
    x2.fillStyle = 'rgba(0,0,0,0.18)'; ell(x2, 120 - fl * 60, 185, 55, 10); x2.fill();
    drawEmoji(x2, B.d.e, 120 - fl * 60, 115 + Math.sin(t * 4) * 5, 120);
  }
  x2.restore();
  if (meter) tickMeter(dt);
}

// ================= HUD =================
function updateHUD() {
  if (!S || !G || curScreen !== 'game') return;
  const mh = maxHp(), need = xpNeed(S.level), ws = S.worlds[G.w];
  $('#hudName').textContent = displayName();
  $('#hudLv').textContent = S.level;
  $('#hudHp').style.width = (S.hp / mh * 100) + '%';
  $('#hudHpTxt').textContent = `❤️ ${S.hp} / ${mh}`;
  $('#hudXp').style.width = (S.xp / need * 100) + '%';
  $('#hudXpTxt').textContent = `⭐ ${S.xp} / ${need} XP`;
  $('#hudSnacks').textContent = S.snacks;
  $('#hudWorld').textContent = `${G.wd.icon} ${G.wd.short}`;
  $('#hudDepth').textContent = `⛏️ ${G.ham.y - HOME.y}m deep`;
  $('#taskTitle').textContent = ws.wave > 3 && !S.beaten[G.w] ? '⚠️ BOSS TIME!' : S.beaten[G.w] ? `📋 Bonus Wave ${ws.wave}` : `📋 Wave ${ws.wave} of 3`;
  const html = (ws.tasks || []).map(t => `<li class="${t.done ? 'done' : ''}"><span class="chk">${t.done ? '✓' : ''}</span>${taskText(t)}${t.need > 1 && t.type !== 'depth' ? `<span class="prog">${t.have}/${t.need}</span>` : ''}</li>`).join('');
  const list = $('#taskList');
  if (list.dataset.html !== html) { list.innerHTML = html; list.dataset.html = html; }
}
function flashTask(i) {
  requestAnimationFrame(() => { const li = $$('#taskList li')[i]; if (li) li.classList.add('flash'); });
}

// ================= particles =================
function dirtBits(tx, ty, n) {
  const T = G.T, cols = G.wd.c.dirt;
  for (let i = 0; i < n; i++) {
    G.parts.push({ x: (tx + 0.5) * T + rand(-T / 3, T / 3), y: (ty + 0.5) * T + rand(-T / 3, T / 3), vx: rand(-90, 90), vy: rand(-140, -20), life: rand(0.35, 0.7), col: pick(cols), r: rand(2, 5) });
  }
}
function floatText(text) {
  const h = G.ham, T = G.T;
  G.parts.push({ x: (h.x + 0.5) * T, y: h.y * T, vx: 0, vy: -50, life: 1.1, text, g: 0 });
}
function updateParticles(dt) {
  for (const p of G.parts) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (!p.text) p.vy += 420 * dt;
  }
  G.parts = G.parts.filter(p => p.life > 0);
}

// ================= rendering =================
const cvGame = $('#cvGame');
const gctx = cvGame.getContext('2d');
const shadeCv = document.createElement('canvas');
const sctx = shadeCv.getContext('2d');
let DPR = 1;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth, h = window.innerHeight;
  cvGame.width = Math.round(w * DPR); cvGame.height = Math.round(h * DPR);
  shadeCv.width = Math.round(w / 2); shadeCv.height = Math.round(h / 2);
  if (G) { G.cw = w; G.ch = h; G.T = clamp(Math.round(Math.min(w, h) / 10), 38, 64); }
}
window.addEventListener('resize', resize);

function hash(x, y) { let h = x * 374761393 + y * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; }

function render(dt) {
  const ctx = gctx, T = G.T, cw = G.cw, ch = G.ch, wd = G.wd, c = wd.c, h = G.ham;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const e = h.moving ? h.mt * h.mt * (3 - 2 * h.mt) : 0;
  const hx = h.x + (h.tx - h.x) * (h.moving ? e : 0), hy = h.y + (h.ty - h.y) * (h.moving ? e : 0);
  // camera
  const W = G.W * T, H = G.H * T;
  let tx = W < cw ? (W - cw) / 2 : clamp((hx + 0.5) * T - cw / 2, 0, W - cw);
  let ty = clamp((hy + 0.5) * T - ch * 0.45, -ch * 0.3, H - ch);
  if (!G.cam) G.cam = { x: tx, y: ty };
  G.cam.x += (tx - G.cam.x) * Math.min(1, dt * 8);
  G.cam.y += (ty - G.cam.y) * Math.min(1, dt * 8);
  const cx = Math.round(G.cam.x), cy = Math.round(G.cam.y);

  ctx.fillStyle = c.tunnel; ctx.fillRect(0, 0, cw, ch);
  ctx.save(); ctx.translate(-cx, -cy);

  // sky
  const skyTop = Math.min(cy, 0) - 10, skyH = 3 * T - skyTop;
  if (cy < 3 * T) {
    const g = ctx.createLinearGradient(0, skyTop, 0, 3 * T);
    g.addColorStop(0, c.sky1); g.addColorStop(1, c.sky2);
    ctx.fillStyle = g; ctx.fillRect(cx - 2, skyTop, cw + 4, skyH);
    drawSky(ctx, T, cx, cw, skyTop);
  }

  const x0 = Math.max(0, Math.floor(cx / T)), x1 = Math.min(G.W - 1, Math.ceil((cx + cw) / T));
  const y0 = Math.max(3, Math.floor(cy / T)), y1 = Math.min(G.H - 1, Math.ceil((cy + ch) / T));
  // dirt base
  for (let y = y0; y <= y1; y++) {
    const band = c.dirt[y < 17 ? 0 : y < 34 ? 1 : 2];
    ctx.fillStyle = band;
    ctx.fillRect(x0 * T, y * T, (x1 - x0 + 1) * T, T + 1);
  }
  // tunnels (rounded & connected)
  ctx.fillStyle = c.tunnel;
  const r = T * 0.36, ins = T * 0.02;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!seenOpen(x, y)) continue;
    const px = x * T, py = y * T;
    ctx.beginPath(); ctx.roundRect(px + ins, py + ins, T - ins * 2, T - ins * 2, r); ctx.fill();
    if (seenOpen(x + 1, y)) ctx.fillRect(px + T / 2, py + ins, T, T - ins * 2);
    if (seenOpen(x, y + 1)) ctx.fillRect(px + ins, py + T / 2, T - ins * 2, T);
  }
  // specks, stones, grass
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const raw = G.map[y * G.W + x], px = x * T, py = y * T, hs = hash(x, y);
    const near = isSeen(x, y) || isSeen(x + 1, y) || isSeen(x - 1, y) || isSeen(x, y + 1) || isSeen(x, y - 1);
    // unexplored ground is just dirt: hidden caves look like dirt, rocks show once you're beside them
    const t = (raw === OPEN && !G.seen[y * G.W + x]) || (raw === STONE && !near && y < G.H - 1 && x > 0 && x < G.W - 1) ? DIRT : raw;
    if (t === DIRT) {
      ctx.fillStyle = c.speck;
      if (hs % 3 === 0) { ctx.beginPath(); ctx.arc(px + (hs % 7 + 2) / 11 * T, py + ((hs >> 3) % 7 + 2) / 11 * T, T * 0.06, 0, 7); ctx.fill(); }
      if (hs % 5 === 1) { ctx.beginPath(); ctx.arc(px + ((hs >> 5) % 7 + 2) / 11 * T, py + ((hs >> 8) % 7 + 2) / 11 * T, T * 0.04, 0, 7); ctx.fill(); }
    } else if (t === STONE) {
      ctx.fillStyle = shade(c.stone, -0.25);
      ctx.beginPath(); ctx.roundRect(px + 2, py + 3, T - 4, T - 4, T * 0.3); ctx.fill();
      ctx.fillStyle = c.stone;
      ctx.beginPath(); ctx.roundRect(px + 2, py + 1, T - 4, T - 6, T * 0.3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(px + T * 0.35, py + T * 0.3, T * 0.13, T * 0.07, -0.5, 0, 7); ctx.fill();
    }
    if (y === 3 && t !== OPEN) {
      ctx.fillStyle = c.top2; ctx.fillRect(px, py, T, T * 0.26);
      ctx.fillStyle = c.top; ctx.fillRect(px, py, T, T * 0.2);
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(px + (i + 0.5) * T / 4, py + T * 0.2, T * 0.07, 0, Math.PI); ctx.fill(); }
    }
  }
  // objects
  for (const [k, o] of G.objs) {
    const x = k % G.W, y = Math.floor(k / G.W);
    if (x < x0 - 1 || x > x1 + 1 || y < y0 - 1 || y > y1 + 1) continue;
    if (!seenOpen(x, y)) continue; // buried things stay secret until you dig to them
    const px = (x + 0.5) * T, py = (y + 0.5) * T;
    const em = o.type === 'item' ? o.e : { snack: '🍓', chest: '🎁', stone: '🗿', clue: '📜', gate: '🌀' }[o.type];
    if (o.type === 'gate') {
      ctx.save(); ctx.translate(px, py); ctx.rotate(G.t * 3);
      const gg = ctx.createRadialGradient(0, 0, 2, 0, 0, T);
      gg.addColorStop(0, 'rgba(255,80,200,0.8)'); gg.addColorStop(1, 'rgba(120,0,255,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, T, 0, 7); ctx.fill();
      drawEmoji(ctx, em, 0, 0, T * 0.95);
      ctx.restore();
      continue;
    }
    drawEmoji(ctx, em, px, py + Math.sin(G.t * 3 + k) * 3, T * 0.7);
  }
  // creatures
  for (const cr of G.cr) {
    cr.px += (cr.x - cr.px) * Math.min(1, dt * 10); cr.py += (cr.y - cr.py) * Math.min(1, dt * 10);
    if (cr.x < x0 - 1 || cr.x > x1 + 1 || cr.y < y0 - 1 || cr.y > y1 + 1) continue;
    if (!isSeen(cr.x, cr.y)) continue;
    const px = (cr.px + 0.5) * T, py = (cr.py + 0.5) * T + Math.sin(G.t * 5 + cr.x) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(px, (cr.py + 0.88) * T, T * 0.28, T * 0.07, 0, 0, 7); ctx.fill();
    if (cr.role === 'mystery') ctx.filter = 'grayscale(1) brightness(0.8)';
    drawEmoji(ctx, cr.def.e, px, py, T * 0.78, cr.stun > 0 ? 0.5 : 1);
    ctx.filter = 'none';
    let tag = null;
    if (cr.role === 'hostile' && cr.alert) tag = '❗';
    else if (cr.role === 'mystery') tag = '❓';
    else if ((cr.role === 'helper' && !cr.gave) || (cr.role === 'riddler' && !cr.solved)) tag = '💬';
    if (tag) drawEmoji(ctx, tag, px + T * 0.3, py - T * 0.45 + Math.sin(G.t * 6) * 2, T * 0.38);
  }
  // hamster
  drawHamster(ctx, (hx + 0.5) * T, (hy + 0.5) * T + T * 0.04, T * 0.9, {
    color: S.color, equipped: S.equipped, t: G.t, bob: h.moving || h.digging, tilt: h.tilt,
    blink: (G.t % 4) < 0.13, shadow: false, punch: h.digging ? Math.abs(Math.sin(G.t * 20)) * 0.5 : 0,
  });
  // particles
  for (const p of G.parts) {
    if (p.text) {
      ctx.save(); ctx.globalAlpha = Math.min(1, p.life);
      ctx.font = `bold ${Math.round(T * 0.4)}px Fredoka, sans-serif`; ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = '#4a2f2a'; ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    } else {
      ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
  }
  ctx.restore();

  // darkness (gets darker as you go deeper)
  const sx = (hx + 0.5) * T - cx, sy = (hy + 0.5) * T - cy;
  const depth = hy - HOME.y;
  const a = clamp((depth - 2) / 16, 0, 1) * wd.dark;
  if (a > 0.01) {
    const sw = shadeCv.width, sh = shadeCv.height, k = sw / cw;
    sctx.globalCompositeOperation = 'source-over';
    sctx.clearRect(0, 0, sw, sh);
    sctx.fillStyle = `rgba(6,3,12,${a})`; sctx.fillRect(0, 0, sw, sh);
    sctx.globalCompositeOperation = 'destination-out';
    const R = wd.light * T * k;
    const g = sctx.createRadialGradient(sx * k, sy * k, R * 0.3, sx * k, sy * k, R);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = g; sctx.fillRect(0, 0, sw, sh);
    ctx.drawImage(shadeCv, 0, 0, cw, ch);
  }

  // sniff arrow
  if (G.sniff) {
    const tx2 = (G.sniff.x + 0.5) * T - cx, ty2 = (G.sniff.y + 0.5) * T - cy;
    const ang = Math.atan2(ty2 - sy, tx2 - sx);
    const dist = Math.hypot(tx2 - sx, ty2 - sy);
    ctx.save();
    ctx.globalAlpha = Math.min(1, G.sniff.t);
    ctx.translate(sx, sy); ctx.rotate(ang);
    const off = T * 0.9 + Math.sin(G.t * 8) * 6;
    ctx.fillStyle = '#ffd54f'; ctx.strokeStyle = '#8d5a00'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(off, -T * 0.18); ctx.lineTo(off + T * 0.4, -T * 0.18); ctx.lineTo(off + T * 0.4, -T * 0.35);
    ctx.lineTo(off + T * 0.8, 0); ctx.lineTo(off + T * 0.4, T * 0.35); ctx.lineTo(off + T * 0.4, T * 0.18); ctx.lineTo(off, T * 0.18); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    if (dist < Math.max(cw, ch)) {
      ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(G.t * 8) * 0.3;
      ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(tx2, ty2, T * 0.6, 0, 7); ctx.stroke();
      ctx.restore();
    }
  }
}

function drawSky(ctx, T, cx, cw, skyTop) {
  const w = G.w, wd = G.wd;
  const gy = 3 * T;
  if (w === 0) {
    ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(G.W * T * 0.82, skyTop + T * 1.2, T * 0.7, 0, 7); ctx.fill();
  }
  if (w === 3) {
    for (let i = 0; i < 60; i++) {
      const hs = hash(i, 7);
      ctx.fillStyle = `rgba(255,255,255,${0.4 + (Math.sin(G.t * 2 + i) + 1) * 0.3})`;
      ctx.fillRect((hs % 1000) / 1000 * G.W * T, skyTop + ((hs >> 10) % 1000) / 1000 * (gy - skyTop - T * 0.5), 2, 2);
    }
  }
  if (w < 2) { // clouds
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 4; i++) {
      const x = ((i * 9 + G.t * (8 + i * 3)) * T / 6) % (G.W * T + 4 * T) - 2 * T;
      const y = skyTop + T * (0.5 + (i % 2) * 0.6) + 20;
      ctx.beginPath(); ctx.arc(x, y, T * 0.35, 0, 7); ctx.arc(x + T * 0.4, y - T * 0.15, T * 0.45, 0, 7); ctx.arc(x + T * 0.85, y, T * 0.33, 0, 7); ctx.fill();
    }
  }
  if (w === 2) { // falling snow
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 40; i++) {
      const hs = hash(i, 3);
      const x = (hs % 1000) / 1000 * G.W * T + Math.sin(G.t + i) * 10;
      const y = skyTop + ((hs >> 10) % 1000 / 1000 * (gy - skyTop) + G.t * 30) % (gy - skyTop);
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill();
    }
  }
  for (const d of DECOR[w]) {
    const s = T * d.s;
    drawEmoji(ctx, d.e, (d.x * G.W / 30 + 0.5) * T, d.sky ? skyTop + T * 1.2 : gy - s * 0.42, s);
  }
  void wd; void cx; void cw;
}

// ================= previews & main loop =================
let gTime = 0;
function drawPreview(id, opts, size) {
  const cv = $(id), ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  drawHamster(ctx, cv.width / 2, cv.height / 2 + 6, size, { t: gTime, bob: true, blink: (gTime % 4) < 0.13, ...opts });
}
const AUTH_COLORS = Object.keys(HAM_COLORS).filter(id => !HAM_COLORS[id].secret);
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now; gTime += dt;
  try {
    if (curScreen === 'game' && G) { update(dt); render(dt); }
    else if (curScreen === 'auth') drawPreview('#cvAuth', { color: AUTH_COLORS[Math.floor(gTime / 1.5) % AUTH_COLORS.length], equipped: {} }, 130);
    else if (curScreen === 'color') drawPreview('#cvColor', { color: pickColor }, 170);
    else if (curScreen === 'menu' && S) drawPreview('#cvMenu', { color: S.color, equipped: S.equipped, tilt: Math.sin(gTime * 2) * 0.06 }, 170);
    else if (curScreen === 'dress' && S) drawPreview('#cvDress', { color: S.color, equipped: S.equipped, karate: $('#dressKarate').checked, belt: BELTS[Math.max(0, S.beaten.lastIndexOf(true))] }, 180);
    if (B && battleOpen()) drawBattle(dt);
    if (TF) drawTf(dt);
  } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}

// ---------- music button ----------
let musicPref = true;
try { musicPref = localStorage.getItem(PREF_KEY) !== 'off'; } catch (e) { /* ignore */ }
Sound.setMusic(musicPref);
$('#musicBtn').classList.toggle('off', !musicPref);
$('#musicBtn').addEventListener('click', () => {
  Sound.init();
  musicPref = !musicPref;
  Sound.setMusic(musicPref);
  $('#musicBtn').classList.toggle('off', !musicPref);
  try { localStorage.setItem(PREF_KEY, musicPref ? 'on' : 'off'); } catch (e) { /* ignore */ }
  if (musicPref && !Sound.current()) Sound.play('menu');
});
// start audio on the very first interaction (browsers require a click first)
window.addEventListener('pointerdown', () => { Sound.init(); if (!Sound.current()) Sound.play(curScreen === 'game' && G ? 'w' + G.w : 'menu'); }, { once: true });
window.addEventListener('beforeunload', () => persist());

resize();
requestAnimationFrame(frame);
