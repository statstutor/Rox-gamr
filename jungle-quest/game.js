'use strict';
// Game rules. The server keeps one "room" per group of players and calls
// act() whenever someone clicks something. view() builds what each player sees.

const { LEVELS } = require('./levels');
// Works in Node and in the browser build (see build-artifact.js).
const randomId = () => (globalThis.crypto && globalThis.crypto.randomUUID
  ? globalThis.crypto.randomUUID() : require('crypto').randomUUID()).replace(/-/g, '').slice(0, 16);

const MIN_PLAYERS = 4;
const MAX_PLAYERS = 9;
const MAX_HP = 30;
const POTIONS = 2;
const AVATARS = ['🦁', '🐯', '🦊', '🐼', '🐨', '🐸', '🐵', '🦉', '🦜', '🐢', '🦄', '🐺'];

const rooms = new Map();

class GameError extends Error {}
const fail = (msg) => { throw new GameError(msg); };

const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = Array.from({ length: 4 }, () => pick(letters)).join('');
  } while (rooms.has(code));
  return code;
}

function cleanName(name) {
  const n = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 16);
  if (!n) fail('Please type your name.');
  return n;
}

function newPlayer(name, avatar, id) {
  return {
    id: id || randomId(),
    name: cleanName(name),
    avatar: AVATARS.includes(avatar) ? avatar : pick(AVATARS),
    hp: MAX_HP,
    maxHp: MAX_HP,
    potions: POTIONS,
    connected: false,
  };
}

function createRoom({ name, avatar, unlocked }) {
  const host = newPlayer(name, avatar);
  const maxLevel = Math.max(1, Math.min(LEVELS.length, Number(unlocked) || 1));
  const room = {
    code: newCode(),
    hostId: host.id,
    players: [host],
    phase: 'lobby',
    diff: 0,
    unlocked: maxLevel,
    level: null,
    spots: null,
    leader: 0,
    enc: null,
    feed: [],
    touched: Date.now(),
  };
  rooms.set(room.code, room);
  return { room, player: host };
}

function joinRoom({ code, name, avatar, id }) {
  const room = rooms.get(String(code || '').trim().toUpperCase());
  if (!room) fail('No game with that code. Check the code and try again.');
  if (room.phase !== 'lobby') fail('That game has already started.');
  if (room.players.length >= MAX_PLAYERS) fail(`That game is full (${MAX_PLAYERS} players max).`);
  const player = newPlayer(name, avatar, id);
  room.players.push(player);
  say(room, `${player.avatar} ${player.name} joined the team!`);
  return { room, player };
}

function say(room, text) {
  room.feed.push(text);
  if (room.feed.length > 8) room.feed.shift();
}

const getPlayer = (room, id) => room.players.find((p) => p.id === id);
const activePlayers = (room) => room.players.filter((p) => p.connected && p.hp > 0);
const leaderOf = (room) => room.players[room.leader % room.players.length];
const levelOf = (room) => LEVELS[room.level - 1];

function setConnected(room, playerId, connected) {
  const p = getPlayer(room, playerId);
  if (!p) return;
  p.connected = connected;
  // Don't keep the team waiting on someone who left in the middle of a fight.
  if (room.phase === 'fight') maybeResolveRound(room);
}

function nextLeader(room) {
  for (let i = 1; i <= room.players.length; i++) {
    const idx = (room.leader + i) % room.players.length;
    if (room.players[idx].connected) { room.leader = idx; return; }
  }
}

// ---------- Actions ----------

function act(room, playerId, action) {
  const player = getPlayer(room, playerId);
  if (!player) fail('You are not in this game.');
  if (!action || typeof action.type !== 'string') fail('Unknown action.');
  room.touched = Date.now();
  const isHost = room.hostId === playerId;

  switch (action.type) {
    case 'start':
      if (!isHost) fail('Only the host can start.');
      if (room.phase !== 'lobby') fail('Already started.');
      if (room.players.length < MIN_PLAYERS) fail(`You need at least ${MIN_PLAYERS} players.`);
      room.diff = room.players.length;
      room.phase = 'levelSelect';
      say(room, `The adventure begins with ${room.diff} explorers!`);
      return;

    case 'chooseLevel': {
      if (!isHost) fail('Only the host picks the level.');
      if (room.phase !== 'levelSelect' && room.phase !== 'levelWon') fail('Not now.');
      const id = Number(action.level);
      if (!LEVELS[id - 1]) fail('No such level.');
      if (id > room.unlocked) fail('That level is still locked!');
      startLevel(room, id);
      return;
    }

    case 'menu':
      if (!isHost) fail('Only the host can do that.');
      if (room.phase !== 'levelWon') fail('Not now.');
      room.phase = 'levelSelect';
      return;

    case 'go': {
      if (room.phase !== 'map') fail('Not now.');
      const leader = leaderOf(room);
      if (leader.id !== playerId && leader.connected) fail(`${leader.name} is leading. Wait for them to choose!`);
      const spot = room.spots.find((s) => s.id === action.spot);
      if (!spot) fail('No such place.');
      if (spot.done) fail('You already finished that one.');
      if (spot.boss && !bossUnlocked(room)) fail('Finish everything else first!');
      startEncounter(room, spot);
      return;
    }

    case 'fight': return chooseMove(room, player, action);
    case 'hurry':
      if (!isHost) fail('Only the host can do that.');
      if (room.phase !== 'fight') fail('Not now.');
      resolveRound(room);
      return;

    case 'answer': return answerRiddle(room, player, action);
    case 'search': return searchSpot(room, player, action);
    case 'solve': return solveHunt(room, player, action);
    case 'codeSet': return setCodeSlot(room, player, action);
    case 'codeSubmit': return submitCode(room, player);

    default:
      fail('Unknown action.');
  }
}

function startLevel(room, id) {
  const level = LEVELS[id - 1];
  room.level = id;
  room.spots = level.spots.map((s) => ({ id: s.id, done: false, boss: !!s.boss }));
  room.players.forEach((p) => { p.hp = p.maxHp; p.potions = POTIONS; });
  room.enc = null;
  room.phase = 'map';
  room.feed = [];
  say(room, `${level.emoji} Welcome to ${level.name}! ${level.intro}`);
}

const bossUnlocked = (room) => room.spots.every((s) => s.boss || s.done);

function startEncounter(room, spot) {
  const def = levelOf(room).spots.find((s) => s.id === spot.id);
  const n = room.diff;
  const base = { spotId: def.id, name: def.name, emoji: def.emoji, intro: def.intro };
  const leader = leaderOf(room);
  say(room, `🧭 ${leader.name} leads the team to ${def.emoji} ${def.name}.`);

  if (def.type === 'fight') {
    const c = def.creature;
    // More players = more creature health, more attacks and harder hits.
    const hp = Math.round(c.hpPer * n * (1 + (n - 4) * 0.08));
    const bonus = Math.floor((n - 4) / 3);
    room.enc = {
      ...base, type: 'fight', hp, maxHp: hp, round: 1,
      attacks: c.attacks + Math.floor((n - 4) / 3),
      dmg: [c.dmg[0] + bonus, c.dmg[1] + bonus],
      special: c.special ? { ...c.special, dmg: [c.special.dmg[0] + bonus, c.special.dmg[1] + bonus] } : null,
      choices: {}, log: [def.intro],
    };
  } else if (def.type === 'riddle') {
    const count = n >= 8 ? 3 : 2;
    room.enc = {
      ...base, type: 'riddle', index: 0, wrong: [],
      list: shuffle(def.riddles).slice(0, count).map((r) => ({ q: r.q, a: r.a, options: shuffle([r.a, ...r.wrong]) })),
    };
  } else if (def.type === 'hunt') {
    const traps = 1 + Math.floor((n - 2) / 2);
    const places = shuffle(def.places).slice(0, 12);
    const kinds = shuffle([
      ...def.clues.map((text) => ({ kind: 'clue', text })),
      ...Array.from({ length: traps }, () => ({ kind: 'trap', text: pick(def.traps) })),
      ...Array.from({ length: places.length - def.clues.length - traps }, () => ({ kind: 'empty', text: pick(def.empty) })),
    ]);
    room.enc = {
      ...base, type: 'hunt', stage: 'search', found: 0, needed: def.clues.length, traps,
      places: places.map(([label, emoji], i) => ({ label, emoji, ...kinds[i], searchedBy: null })),
      question: def.question, answer: def.answer, options: shuffle([def.answer, ...def.wrongAnswers]), wrong: [],
    };
  } else if (def.type === 'code') {
    room.enc = { ...base, type: 'code', ...makeCode(room, def.symbols), attempts: 0, feedback: null };
  }
  room.phase = def.type;
}

// Each player only sees their own hints, so the team has to talk to crack it.
function makeCode(room, symbols) {
  const n = room.diff;
  const length = n <= 5 ? 3 : n <= 7 ? 4 : 5;
  const code = shuffle(symbols).slice(0, length);
  const unused = symbols.filter((s) => !code.includes(s));
  const people = shuffle(room.players.filter((p) => p.connected).length ? room.players.filter((p) => p.connected) : room.players);
  const hints = {};
  room.players.forEach((p) => { hints[p.id] = []; });
  const positions = shuffle(code.map((_, i) => i));
  positions.forEach((pos, i) => {
    hints[people[i % people.length].id].push(`Symbol #${pos + 1} is ${code[pos]}`);
  });
  people.slice(positions.length).forEach((p, i) => {
    if (i < unused.length) hints[p.id].push(`There is no ${unused[i]} anywhere in the code.`);
    else {
      const pos = rand(0, length - 1);
      const not = pick(symbols.filter((s) => s !== code[pos]));
      hints[p.id].push(`Symbol #${pos + 1} is NOT ${not}`);
    }
  });
  return { symbols, length, code, hints, dial: Array(length).fill(null) };
}

// Wrong answers in mysteries hurt the whole team (but never knock anyone out).
function teamPenalty(room, why) {
  const dmg = 2 + Math.floor(room.diff / 3);
  room.players.forEach((p) => { if (p.hp > 0) p.hp = Math.max(1, p.hp - dmg); });
  say(room, `❌ ${why} Everyone loses ${dmg} ❤️.`);
}

function finishSpot(room, message) {
  const spot = room.spots.find((s) => s.id === room.enc.spotId);
  spot.done = true;
  room.enc = null;
  say(room, message);
  if (spot.boss) {
    const level = levelOf(room);
    room.phase = 'levelWon';
    if (room.level < LEVELS.length && room.unlocked <= room.level) {
      room.unlocked = room.level + 1;
      const next = LEVELS[room.level];
      say(room, `🏆 ${level.name} is beaten! ${next.emoji} ${next.name} is now unlocked!`);
    } else {
      say(room, `🏆 ${level.name} is beaten!`);
    }
    return;
  }
  room.phase = 'map';
  nextLeader(room);
}

// ---------- Fights ----------

const MOVES = ['attack', 'power', 'defend', 'heal'];

function chooseMove(room, player, { move, target }) {
  if (room.phase !== 'fight') fail('Not in a fight.');
  if (player.hp <= 0) fail('You are knocked out! A teammate can heal you.');
  if (!MOVES.includes(move)) fail('Unknown move.');
  if (move === 'heal') {
    if (player.potions <= 0) fail('You have no potions left.');
    if (!getPlayer(room, target)) fail('Pick who to heal.');
  }
  room.enc.choices[player.id] = { move, target };
  maybeResolveRound(room);
}

function maybeResolveRound(room) {
  const waiting = activePlayers(room);
  if (waiting.length && waiting.every((p) => room.enc.choices[p.id])) resolveRound(room);
}

function resolveRound(room) {
  const e = room.enc;
  const log = [];
  const defending = new Set();
  const exposed = new Set();

  for (const p of room.players) {
    if (p.hp <= 0) continue;
    const c = e.choices[p.id];
    if (!c) { if (p.connected) { defending.add(p.id); log.push(`🛡️ ${p.name} was too slow and just defends.`); } continue; }
    if (c.move === 'attack') {
      let d = rand(1, 6) + 2;
      if (Math.random() < 0.1) { d *= 2; log.push(`💥 ${p.name} lands a CRITICAL hit for ${d}!`); } else log.push(`⚔️ ${p.name} hits for ${d}.`);
      e.hp -= d;
    } else if (c.move === 'power') {
      exposed.add(p.id);
      if (Math.random() < 0.35) log.push(`💨 ${p.name} swings big... and misses!`);
      else { const d = rand(2, 12) + 3; e.hp -= d; log.push(`🔨 ${p.name} smashes for ${d}!`); }
    } else if (c.move === 'defend') {
      defending.add(p.id);
      p.hp = Math.min(p.maxHp, p.hp + 2);
      log.push(`🛡️ ${p.name} defends (+2 ❤️).`);
    } else if (c.move === 'heal') {
      const t = getPlayer(room, c.target);
      if (p.potions > 0 && t) {
        p.potions--;
        const wasOut = t.hp <= 0;
        t.hp = Math.min(t.maxHp, t.hp + 10);
        log.push(wasOut ? `✨ ${p.name} revives ${t.name}!` : `🧪 ${p.name} heals ${t === p ? 'themself' : t.name} (+10 ❤️).`);
      }
    }
  }

  e.hp = Math.max(0, e.hp);
  e.choices = {};
  if (e.hp === 0) {
    room.players.forEach((p) => { p.hp = p.hp <= 0 ? 10 : Math.min(p.maxHp, p.hp + 5); });
    finishSpot(room, `🎉 The team defeated ${e.emoji} ${e.name}! Everyone catches their breath (+5 ❤️).`);
    return;
  }

  const hit = (p, dmg) => {
    if (defending.has(p.id)) dmg = Math.ceil(dmg / 2);
    if (exposed.has(p.id)) dmg += 3;
    p.hp = Math.max(0, p.hp - dmg);
    return `${p.name} takes ${dmg}${p.hp === 0 ? ' and is knocked out! 😵' : '.'}`;
  };
  const standing = () => room.players.filter((p) => p.hp > 0);
  const s = e.special;
  if (!standing().length) {
    // Nobody left standing to attack.
  } else if (s && e.round % s.every === 0) {
    if (s.kind === 'all') {
      log.push(`⚠️ ${e.name} uses ${s.name}! It hits everyone!`);
      standing().forEach((p) => log.push(`   ${hit(p, rand(...s.dmg))}`));
    } else {
      const t = pick(standing());
      log.push(`⚠️ ${e.name} uses ${s.name} on ${t.name}! ${hit(t, rand(...s.dmg) * 2)}`);
    }
  } else {
    for (let i = 0; i < e.attacks && standing().length; i++) {
      log.push(`${e.emoji} ${e.name} attacks! ${hit(pick(standing()), rand(...e.dmg))}`);
    }
  }

  e.round++;
  e.log = log;
  if (!activePlayers(room).length && room.players.some((p) => p.connected)) {
    room.players.forEach((p) => { p.hp = p.maxHp; });
    room.enc = null;
    room.phase = 'map';
    say(room, `😵 The whole team was knocked out by ${e.emoji} ${e.name}! You wake up back at camp, fully healed. Try again!`);
  }
}

// ---------- Riddles ----------

function answerRiddle(room, player, { choice }) {
  if (room.phase !== 'riddle') fail('Not now.');
  const e = room.enc;
  const r = e.list[e.index];
  if (!r.options.includes(choice) || e.wrong.includes(choice)) fail('Pick an answer.');
  if (choice !== r.a) {
    e.wrong.push(choice);
    teamPenalty(room, `${player.name} guessed "${choice}" — wrong!`);
    return;
  }
  say(room, `✅ ${player.name} got it: "${choice}"!`);
  e.index++;
  e.wrong = [];
  if (e.index >= e.list.length) finishSpot(room, `🎉 ${e.emoji} ${e.name} is solved!`);
}

// ---------- Clue hunts ----------

function searchSpot(room, player, { index }) {
  if (room.phase !== 'hunt' || room.enc.stage !== 'search') fail('Not now.');
  if (player.hp <= 0) fail('You are knocked out.');
  const place = room.enc.places[index];
  if (!place) fail('No such place.');
  if (place.searchedBy) fail('Someone already searched there.');
  place.searchedBy = player.name;
  if (place.kind === 'clue') {
    room.enc.found++;
    say(room, `🔍 ${player.name} searched the ${place.label} and found a clue!`);
    if (room.enc.found >= room.enc.needed) {
      room.enc.stage = 'solve';
      say(room, '💡 All the clues are found! Now work out the answer together.');
    }
  } else if (place.kind === 'trap') {
    const dmg = rand(3, 5) + Math.floor((room.diff - 4) / 2);
    player.hp = Math.max(1, player.hp - dmg);
    say(room, `💥 ${player.name} searched the ${place.label}: ${place.text} (-${dmg} ❤️)`);
  } else {
    say(room, `${player.name} searched the ${place.label}. Nothing there.`);
  }
}

function solveHunt(room, player, { choice }) {
  if (room.phase !== 'hunt' || room.enc.stage !== 'solve') fail('Not now.');
  const e = room.enc;
  if (!e.options.includes(choice) || e.wrong.includes(choice)) fail('Pick an answer.');
  if (choice !== e.answer) {
    e.wrong.push(choice);
    teamPenalty(room, `${player.name} blamed ${choice} — it wasn't them!`);
    return;
  }
  finishSpot(room, `🎉 ${player.name} solved it! It was ${choice}!`);
}

// ---------- Code doors ----------

function setCodeSlot(room, player, { slot, symbol }) {
  if (room.phase !== 'code') fail('Not now.');
  const e = room.enc;
  if (!Number.isInteger(slot) || slot < 0 || slot >= e.length) fail('No such slot.');
  if (symbol !== null && !e.symbols.includes(symbol)) fail('No such symbol.');
  e.dial[slot] = symbol;
}

function submitCode(room, player) {
  if (room.phase !== 'code') fail('Not now.');
  const e = room.enc;
  if (e.dial.some((s) => !s)) fail('Fill in every symbol first.');
  e.attempts++;
  const right = e.dial.filter((s, i) => s === e.code[i]).length;
  if (right === e.length) {
    finishSpot(room, `🎉 ${player.name} cracked the code ${e.code.join(' ')}! ${e.emoji} ${e.name} swings open!`);
    return;
  }
  e.feedback = `${e.dial.join('')} — ${right} of ${e.length} in the right place.`;
  teamPenalty(room, `${player.name} tried ${e.dial.join('')} — the lock zaps you!`);
}

// ---------- What each player sees ----------

function view(room, playerId) {
  const e = room.enc;
  let enc = null;
  if (e) {
    const base = { type: e.type, name: e.name, emoji: e.emoji, intro: e.intro };
    if (e.type === 'fight') {
      enc = { ...base, hp: e.hp, maxHp: e.maxHp, round: e.round, log: e.log,
        chosen: Object.keys(e.choices), yourChoice: e.choices[playerId] || null };
    } else if (e.type === 'riddle') {
      const r = e.list[e.index];
      enc = { ...base, index: e.index, total: e.list.length, q: r.q, options: r.options, wrong: e.wrong };
    } else if (e.type === 'hunt') {
      enc = { ...base, stage: e.stage, found: e.found, needed: e.needed, traps: e.traps,
        places: e.places.map((p) => (p.searchedBy
          ? { label: p.label, emoji: p.emoji, kind: p.kind, text: p.text, searchedBy: p.searchedBy }
          : { label: p.label, emoji: p.emoji })),
        question: e.question, options: e.options, wrong: e.wrong };
    } else if (e.type === 'code') {
      enc = { ...base, symbols: e.symbols, length: e.length, dial: e.dial,
        hints: e.hints[playerId] || [], attempts: e.attempts, feedback: e.feedback };
    }
  }
  const level = room.level ? levelOf(room) : null;
  return {
    code: room.code,
    you: playerId,
    hostId: room.hostId,
    phase: room.phase,
    diff: room.diff,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    players: room.players.map(({ id, name, avatar, hp, maxHp, potions, connected, bot }) => ({ id, name, avatar, hp, maxHp, potions, connected, bot: !!bot })),
    unlocked: room.unlocked,
    levels: LEVELS.map(({ id, name, emoji, blurb, theme }) => ({ id, name, emoji, blurb, theme })),
    level: level && { id: level.id, name: level.name, emoji: level.emoji, theme: level.theme },
    spots: room.spots && room.spots.map((s) => {
      const def = level.spots.find((d) => d.id === s.id);
      return { id: s.id, type: def.type, name: def.name, emoji: def.emoji, boss: s.boss, done: s.done,
        locked: s.boss && !bossUnlocked(room) };
    }),
    leaderId: room.players.length ? leaderOf(room).id : null,
    feed: room.feed,
    enc,
  };
}

module.exports = { rooms, createRoom, joinRoom, act, view, setConnected, GameError, AVATARS, MIN_PLAYERS, MAX_PLAYERS };
