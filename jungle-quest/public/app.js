'use strict';
// Jungle Quest client: shows the game and sends clicks to the server.

const AVATARS = ['🦁', '🐯', '🦊', '🐼', '🐨', '🐸', '🐵', '🦉', '🦜', '🐢', '🦄', '🐺'];
const TYPE_LABEL = { fight: '⚔️ Creature', riddle: '❓ Riddles', hunt: '🔍 Clue Hunt', code: '🔐 Secret Code' };

const app = document.getElementById('app');
const toast = document.getElementById('toast');
const store = {
  get(k, fallback) { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const sessionGet = () => { try { return JSON.parse(sessionStorage.getItem('jq-session')); } catch { return null; } };
const sessionSet = (v) => { try { v ? sessionStorage.setItem('jq-session', JSON.stringify(v)) : sessionStorage.removeItem('jq-session'); } catch { /* ignore */ } };

let session = sessionGet();
let state = null;
let unsubscribe = null;
const ui = {
  name: store.get('jq-name', ''),
  avatar: store.get('jq-avatar', AVATARS[Math.floor(Math.random() * AVATARS.length)]),
  joinCode: new URLSearchParams(location.search).get('join') || '',
  localNames: '',
  healing: false,
  slot: 0,
  leaving: false,
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const actBtn = (label, action, cls = '', disabled = false) =>
  `<button class="${cls}" data-act="${esc(JSON.stringify(action))}" ${disabled ? 'disabled' : ''}>${label}</button>`;
const uiBtn = (label, name, value = '', cls = '', disabled = false) =>
  `<button class="${cls}" data-ui="${name}" data-value="${esc(value)}" ${disabled ? 'disabled' : ''}>${label}</button>`;

let toastTimer;
function showError(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
}

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({ error: 'Could not reach the server.' }));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

// How this page talks to the other players. The Node server version is below;
// the Claude page build (build-artifact.js) swaps in its own as window.JQ_NET.
function serverNet() {
  return {
    features: { online: true, invite: true, local: false },
    create: (body) => post('/api/create', body),
    join: (body) => post('/api/join', body),
    act: (s, action) => post('/api/act', { code: s.code, playerId: s.playerId, action }),
    subscribe(s, onState, onGone) {
      const events = new EventSource(`/api/events?code=${encodeURIComponent(s.code)}&playerId=${encodeURIComponent(s.playerId)}`);
      events.onmessage = (e) => onState(JSON.parse(e.data));
      events.addEventListener('gone', onGone);
      return () => events.close();
    },
  };
}
const net = window.JQ_NET || serverNet();

async function act(action) {
  try { await net.act(session, action); } catch (err) { showError(err.message); }
}

function connect() {
  if (unsubscribe) unsubscribe();
  unsubscribe = net.subscribe(session, (next) => {
    const prevPhase = state && state.phase;
    state = next;
    if (state.phase !== prevPhase) { ui.healing = false; ui.slot = 0; }
    if (state.unlocked > store.get('jq-unlocked', 1)) store.set('jq-unlocked', state.unlocked);
    render();
  }, () => leave('That game has ended.'), showError);
}

function leave(message) {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
  session = null;
  state = null;
  ui.leaving = false;
  sessionSet(null);
  render();
  if (message) showError(message);
}

async function enter(start, body) {
  ui.name = ui.name.trim();
  store.set('jq-name', ui.name);
  store.set('jq-avatar', ui.avatar);
  try {
    session = await start(body);
    sessionSet(session);
    try { history.replaceState(null, '', location.pathname); } catch { /* ignore */ }
    connect();
  } catch (err) { showError(err.message); }
}

// ---------- Clicks ----------

document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-act]');
  if (a && !a.disabled) { act(JSON.parse(a.dataset.act)); return; }
  const u = e.target.closest('[data-ui]');
  if (!u || u.disabled) return;
  const v = u.dataset.value;
  switch (u.dataset.ui) {
    case 'avatar': ui.avatar = v; render(); break;
    case 'create': enter(net.create, { name: ui.name, avatar: ui.avatar, unlocked: store.get('jq-unlocked', 1) }); break;
    case 'join': enter(net.join, { code: ui.joinCode, name: ui.name, avatar: ui.avatar }); break;
    case 'local': enter(net.createLocal, { names: ui.localNames.split(/[\n,]/), unlocked: store.get('jq-unlocked', 1) }); break;
    case 'playAs': session = { ...session, playerId: v }; sessionSet(session); connect(); break;
    case 'leave':
      if (ui.leaving) { leave(); break; }
      ui.leaving = true;
      render();
      setTimeout(() => { if (ui.leaving) { ui.leaving = false; render(); } }, 3000);
      break;
    case 'copy':
      Promise.resolve().then(() => navigator.clipboard.writeText(v)).then(() => showError('Link copied! 📋'), () => showError(v));
      break;
    case 'heal': ui.healing = !ui.healing; render(); break;
    case 'slot': ui.slot = Number(v); render(); break;
    case 'symbol':
      act({ type: 'codeSet', slot: ui.slot, symbol: v || null });
      if (v) ui.slot = Math.min(state.enc.length - 1, ui.slot + 1);
      break;
  }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'name') ui.name = e.target.value;
  if (e.target.id === 'joincode') ui.joinCode = e.target.value.toUpperCase();
  if (e.target.id === 'localnames') ui.localNames = e.target.value;
});
window.addEventListener('jq-net', () => { if (!session) render(); });

// ---------- Screens ----------

function render() {
  document.body.className = state && state.level && !['lobby', 'levelSelect'].includes(state.phase) ? state.level.theme : '';
  if (!session) { app.innerHTML = homeScreen(); return; }
  if (!state) { app.innerHTML = '<p class="center">Connecting to the jungle... 🌴</p>'; return; }
  const screens = { lobby, levelSelect, map, fight, riddle, hunt, code, levelWon };
  app.innerHTML = header() + screens[state.phase]() + playersPanel() + feedPanel();
}

function homeScreen() {
  const f = net.features;
  const online = f.online
    ? `<div class="row">${f.canHost === false
        ? '<span class="muted">Only people who can edit this page can start an online game. You can still join one!</span>'
        : uiBtn('🌟 Create a new game', 'create')}</div>
      <p class="muted">...or type the 4-letter code a friend gave you:</p>
      <div class="row"><input id="joincode" maxlength="4" placeholder="ABCD" value="${esc(ui.joinCode)}" style="width:110px;text-transform:uppercase">
        ${uiBtn('Join game', 'join', '', 'ghost')}</div>`
    : `<p class="muted">${esc(f.onlineNote || 'Connecting...')}</p>`;
  const local = f.local
    ? `<div class="card"><h3>Or play together on this device</h3>
        <p class="muted">Pass one phone or computer around. Type 4 to 9 names, one per line.</p>
        <textarea id="localnames" rows="5" placeholder="Maya&#10;Leo&#10;Sam&#10;Ana" style="width:100%">${esc(ui.localNames)}</textarea>
        <div class="row" style="margin-top:8px">${uiBtn('🌴 Play on this device', 'local', '', 'ghost')}</div></div>`
    : '';
  return `
  <div class="hero"><div class="big">🌴🐊🐻🌴</div><h1>Jungle Quest</h1>
    <p class="muted">Explore the jungle with 4 to 9 friends. Fight creatures, solve mysteries, unlock new levels!</p></div>
  <div class="card">
    <h3>1. Who are you?</h3>
    <input id="name" maxlength="16" placeholder="Your name" value="${esc(ui.name)}" style="width:100%">
    <div class="avatars">${AVATARS.map((a) => uiBtn(a, 'avatar', a, a === ui.avatar ? 'on' : '')).join('')}</div>
  </div>
  <div class="card">
    <h3>2. Start or join an online game</h3>
    ${online}
  </div>
  ${local}`;
}

function header() {
  const switcher = session.local
    ? `<div class="card"><div class="tiny">Whose turn is it? Tap your name, then play.</div><div class="row" style="margin-top:6px">${state.players.map((p) =>
        uiBtn(`${p.avatar} ${esc(p.name)}`, 'playAs', p.id, p.id === state.you ? 'small' : 'ghost small')).join('')}</div></div>`
    : '';
  return `<div class="top"><div class="logo">🌴 Jungle Quest</div>
    <div class="row">${session.local ? '' : `<span class="chip">Game ${esc(state.code)}</span>`}${uiBtn(ui.leaving ? 'Tap again to leave' : 'Leave', 'leave', '', 'ghost small')}</div></div>${switcher}`;
}

const me = () => state.players.find((p) => p.id === state.you);
const isHost = () => state.hostId === state.you;
const nameOf = (id) => { const p = state.players.find((x) => x.id === id); return p ? esc(p.name) : '?'; };

function hpBar(hp, max, cls = '') {
  const pct = Math.max(0, Math.round((hp / max) * 100));
  return `<div class="bar ${cls} ${pct <= 30 ? 'low' : ''}"><div style="width:${pct}%"></div></div>`;
}

function playersPanel() {
  const chosen = state.enc && state.enc.chosen ? state.enc.chosen : [];
  const cards = state.players.map((p) => {
    const tags = [p.id === state.hostId ? '👑' : '', p.id === state.leaderId && state.phase === 'map' ? '🧭' : '',
      state.phase === 'fight' && chosen.includes(p.id) ? '✅' : ''].join('');
    return `<div class="player ${p.id === state.you ? 'me' : ''} ${p.connected ? '' : 'off'} ${p.hp <= 0 ? 'ko' : ''}">
      <span class="tag">${tags}</span>
      <div class="name">${p.avatar} ${esc(p.name)}</div>
      ${state.phase === 'lobby' ? '' : `${hpBar(p.hp, p.maxHp)}<div class="tiny">❤️ ${p.hp}/${p.maxHp} · 🧪 ${p.potions}${p.hp <= 0 ? ' · 😵 KO' : ''}${p.connected ? '' : ' · offline'}</div>`}
    </div>`;
  }).join('');
  return `<div class="card"><h3>Explorers (${state.players.length})</h3><div class="players">${cards}</div></div>`;
}

function feedPanel() {
  if (!state.feed.length || state.phase === 'lobby') return '';
  return `<div class="card"><h3>📜 What happened</h3><ul class="feed">${state.feed.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>`;
}

function lobby() {
  const link = `${location.origin}${location.pathname}?join=${state.code}`;
  const n = state.players.length;
  const need = state.minPlayers - n;
  return `<div class="card center">
    <p class="muted">Tell your friends to join with this code:</p>
    <div class="code">${esc(state.code)}</div>
    ${net.features.invite ? `<div class="row" style="justify-content:center">${uiBtn('📋 Copy invite link', 'copy', link, 'ghost small')}</div>` : ''}
    <p>${need > 0 ? `Waiting for ${need} more explorer${need > 1 ? 's' : ''}... (${state.minPlayers} to ${state.maxPlayers} players)` : `${n} explorers ready! (up to ${state.maxPlayers})`}</p>
    <p class="muted">More explorers = bigger creatures and trickier mysteries!</p>
    ${isHost() ? actBtn('🚀 Start the adventure', { type: 'start' }, '', need > 0) : '<p>Waiting for the host to start...</p>'}
  </div>`;
}

function levelSelect() {
  const tiles = state.levels.map((l) => {
    const locked = l.id > state.unlocked;
    const body = `<div class="em">${locked ? '🔒' : l.emoji}</div><h3>Level ${l.id}: ${esc(l.name)}</h3>
      <div class="muted">${locked ? `Beat level ${l.id - 1} to unlock!` : esc(l.blurb)}</div>`;
    return `<button class="tile" data-act="${esc(JSON.stringify({ type: 'chooseLevel', level: l.id }))}" ${locked || !isHost() ? 'disabled' : ''}>${body}</button>`;
  }).join('');
  return `<div class="card"><h2>🗺️ Choose a level</h2>
    <p class="muted">${isHost() ? 'You are the host — pick where to explore.' : 'The host is picking a level...'}
    Difficulty: ${state.diff} explorers.</p><div class="grid">${tiles}</div></div>`;
}

function map() {
  const leader = state.players.find((p) => p.id === state.leaderId);
  const canPick = leader && (leader.id === state.you || !leader.connected);
  const tiles = state.spots.map((s) => {
    const disabled = !canPick || s.done || s.locked;
    const status = s.done ? '✔️ Done' : s.locked ? '🔒 Finish everything else first' : s.boss ? '👑 BOSS' : '';
    return `<button class="tile ${s.done ? 'done' : ''} ${s.boss ? 'boss' : ''}" data-act="${esc(JSON.stringify({ type: 'go', spot: s.id }))}" ${disabled ? 'disabled' : ''}>
      <div class="em">${s.emoji}</div><h3>${esc(s.name)}</h3><div class="muted">${TYPE_LABEL[s.type]}</div><div>${status}</div></button>`;
  }).join('');
  const left = state.spots.filter((s) => !s.done).length;
  return `<div class="card"><h2>${state.level.emoji} Level ${state.level.id}: ${esc(state.level.name)}</h2>
    <p>${canPick ? '🧭 <b>You are leading!</b> Pick where the team goes next.' : `🧭 <b>${esc(leader.name)}</b> is leading. Waiting for them to choose...`}</p>
    <p class="muted">${left} place${left === 1 ? '' : 's'} left. Beat every creature and mystery, then defeat the boss!</p>
    <div class="grid">${tiles}</div></div>`;
}

function fight() {
  const e = state.enc;
  const you = me();
  let actions;
  if (you.hp <= 0) {
    actions = '<p>😵 You are knocked out! A teammate can use a potion to revive you.</p>';
  } else if (ui.healing) {
    actions = `<p>Who do you want to heal? (uses 1 🧪)</p><div class="moves">${state.players.map((p) =>
      actBtn(`${p.avatar} ${esc(p.name)} ❤️ ${p.hp}`, { type: 'fight', move: 'heal', target: p.id }, '', p.hp >= p.maxHp)).join('')}
      ${uiBtn('↩️ Back', 'heal', '', 'ghost')}</div>`;
  } else {
    const picked = (m) => (e.yourChoice && e.yourChoice.move === m ? 'picked' : '');
    actions = `<div class="moves">
      ${actBtn('⚔️ Attack<br><span class="tiny">Steady hit (3–8)</span>', { type: 'fight', move: 'attack' }, picked('attack'))}
      ${actBtn('🔨 Power Smash<br><span class="tiny">Big hit (5–15) but might miss, and you get hit harder</span>', { type: 'fight', move: 'power' }, picked('power'))}
      ${actBtn('🛡️ Defend<br><span class="tiny">Take half damage, +2 ❤️</span>', { type: 'fight', move: 'defend' }, picked('defend'))}
      ${uiBtn(`🧪 Heal / Revive<br><span class="tiny">+10 ❤️ to anyone (${you.potions} left)</span>`, 'heal', '', picked('heal'), you.potions <= 0)}
    </div>`;
  }
  const waiting = state.players.filter((p) => p.connected && p.hp > 0 && !e.chosen.includes(p.id)).length;
  return `<div class="card">
    <div class="monster">${e.emoji}</div>
    <h2 class="center">${esc(e.name)}</h2>
    ${hpBar(e.hp, e.maxHp, 'boss')}<p class="center">❤️ ${e.hp} / ${e.maxHp} · Round ${e.round}</p>
    <div class="log">${e.log.map(esc).join('\n')}</div>
  </div>
  <div class="card"><h3>Your move</h3>${actions}
    <p class="muted">${e.yourChoice ? '✅ Move chosen (you can still change it). ' : ''}Waiting for ${waiting} explorer${waiting === 1 ? '' : 's'}...</p>
    ${isHost() ? actBtn('⏩ Don\'t wait — go now', { type: 'hurry' }, 'ghost small') : ''}
  </div>`;
}

function riddle() {
  const e = state.enc;
  return `<div class="card"><div class="monster">${e.emoji}</div><h2 class="center">${esc(e.name)}</h2>
    <p>${esc(e.intro)}</p><p class="muted">Riddle ${e.index + 1} of ${e.total}. Talk it over — anyone can answer!</p>
    <h3>${esc(e.q)}</h3>
    <div class="options">${e.options.map((o) => {
      const wrong = e.wrong.includes(o);
      return actBtn(esc(o), { type: 'answer', choice: o }, wrong ? 'wrong' : '', wrong);
    }).join('')}</div></div>`;
}

function hunt() {
  const e = state.enc;
  const places = e.places.map((p, i) => {
    if (!p.searchedBy) {
      return `<button class="tile place" data-act="${esc(JSON.stringify({ type: 'search', index: i }))}" ${e.stage !== 'search' || me().hp <= 0 ? 'disabled' : ''}>
        <div class="em">${p.emoji}</div><b>${esc(p.label)}</b><div class="tiny">Tap to search</div></button>`;
    }
    const icon = p.kind === 'clue' ? '🔎 CLUE' : p.kind === 'trap' ? '💥 TRAP' : '🍃';
    return `<div class="tile place ${p.kind}"><b>${p.emoji} ${esc(p.label)}</b> <span class="tiny">(${esc(p.searchedBy)})</span>
      <div><b>${icon}</b></div><div class="${p.kind === 'clue' ? '' : 'muted'}">${esc(p.text)}</div></div>`;
  }).join('');
  const solve = e.stage === 'solve'
    ? `<div class="card"><h3>🤔 ${esc(e.question)}</h3><p class="muted">Read the clues together. Anyone can answer!</p>
       <div class="options">${e.options.map((o) => actBtn(esc(o), { type: 'solve', choice: o }, e.wrong.includes(o) ? 'wrong' : '', e.wrong.includes(o))).join('')}</div></div>`
    : '';
  return `<div class="card"><h2>${e.emoji} ${esc(e.name)}</h2><p>${esc(e.intro)}</p>
    <p><b>Clues found: ${e.found} / ${e.needed}</b> <span class="muted">· ${e.traps} traps are hidden here!</span></p></div>
    ${solve}<div class="grid places">${places}</div><br>`;
}

function code() {
  const e = state.enc;
  const dial = e.dial.map((s, i) => uiBtn(s || '❔', 'slot', String(i), i === ui.slot ? 'sel' : '')).join('');
  const symbols = e.symbols.map((s) => uiBtn(s, 'symbol', s)).join('') + uiBtn('⌫', 'symbol', '', 'ghost');
  return `<div class="card"><div class="monster">${e.emoji}</div><h2 class="center">${esc(e.name)}</h2><p>${esc(e.intro)}</p></div>
  <div class="card"><h3>🤫 Only you can see this:</h3>
    ${e.hints.length ? e.hints.map((h) => `<div class="hint">${esc(h)}</div>`).join('<br>') : '<p class="muted">You don\'t remember anything — ask your teammates!</p>'}
  </div>
  <div class="card center"><h3>The lock (${e.length} symbols)</h3>
    <p class="muted">Tap a slot, then tap a symbol. Everyone shares the same lock.</p>
    <div class="dial">${dial}</div><div class="symbols">${symbols}</div><br>
    ${actBtn('🔓 Try the code', { type: 'codeSubmit' }, '', e.dial.some((s) => !s))}
    ${e.feedback ? `<p>Last try: ${esc(e.feedback)}</p>` : ''}
  </div>`;
}

function levelWon() {
  const next = state.levels.find((l) => l.id === state.level.id + 1);
  const nextOpen = next && next.id <= state.unlocked;
  return `<div class="card center"><div class="monster">🏆</div><h2>${esc(state.level.name)} complete!</h2>
    ${next ? `<p>${next.emoji} <b>${esc(next.name)}</b> is unlocked!</p>` : '<p>You beat every level in the jungle! More levels are coming soon... 🌴</p>'}
    ${isHost()
      ? `<div class="row" style="justify-content:center">${nextOpen ? actBtn(`Go to Level ${next.id} ${next.emoji}`, { type: 'chooseLevel', level: next.id }) : ''}
         ${actBtn('🗺️ Level select', { type: 'menu' }, 'ghost')}</div>`
      : '<p class="muted">Waiting for the host...</p>'}
  </div>`;
}

if (session) connect();
render();
