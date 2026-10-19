'use strict';
// Plays through both levels with pretend players to check the rules work.
// Run with: npm test
const assert = require('assert');
const game = require('./game');
const { LEVELS } = require('./levels');

function playLevel(room, ids) {
  game.act(room, ids[0], { type: 'chooseLevel', level: room.level ? room.level + 1 : 1 });
  let steps = 0;
  while (room.phase !== 'levelWon') {
    assert(++steps < 5000, `stuck in phase ${room.phase}`);
    const e = room.enc;
    if (room.phase === 'map') {
      const leader = room.players[room.leader % room.players.length].id;
      const next = room.spots.find((s) => !s.done && !s.boss) || room.spots.find((s) => s.boss);
      game.act(room, leader, { type: 'go', spot: next.id });
    } else if (room.phase === 'fight') {
      for (const p of room.players.filter((x) => x.hp > 0 && x.connected)) {
        if (room.phase !== 'fight') break;
        const hurt = room.players.find((x) => x.hp < 12);
        const move = hurt && p.potions ? { move: 'heal', target: hurt.id } : { move: Math.random() < 0.5 ? 'attack' : 'power' };
        game.act(room, p.id, { type: 'fight', ...move });
      }
    } else if (room.phase === 'riddle') {
      const r = e.list[e.index];
      const wrong = r.options.find((o) => o !== r.a && !e.wrong.includes(o));
      game.act(room, ids[1], { type: 'answer', choice: wrong && Math.random() < 0.3 ? wrong : r.a });
    } else if (room.phase === 'hunt') {
      if (e.stage === 'search') {
        game.act(room, ids[steps % ids.length], { type: 'search', index: e.places.findIndex((p) => !p.searchedBy) });
      } else {
        game.act(room, ids[2], { type: 'solve', choice: e.answer });
      }
    } else if (room.phase === 'code') {
      // Each player only knows their own hints: combine them like the team would.
      const known = {};
      for (const hints of Object.values(e.hints)) {
        for (const h of hints) {
          const m = h.match(/^Symbol #(\d) is (\S+)$/u);
          if (m) known[m[1] - 1] = m[2];
        }
      }
      assert.strictEqual(Object.keys(known).length, e.length, 'every code position has a hint');
      for (let i = 0; i < e.length; i++) game.act(room, ids[i % ids.length], { type: 'codeSet', slot: i, symbol: known[i] });
      game.act(room, ids[3], { type: 'codeSubmit' });
    }
  }
}

for (let n = game.MIN_PLAYERS; n <= game.MAX_PLAYERS; n++) {
  const { room, player } = game.createRoom({ name: 'Host', avatar: '🦁' });
  const ids = [player.id];
  assert.throws(() => game.act(room, player.id, { type: 'start' }), /at least 4/);
  for (let i = 1; i < n; i++) ids.push(game.joinRoom({ code: room.code, name: `P${i}` }).player.id);
  ids.forEach((id) => game.setConnected(room, id, true));
  if (n === game.MAX_PLAYERS) assert.throws(() => game.joinRoom({ code: room.code, name: 'Extra' }), /full/);
  game.act(room, ids[0], { type: 'start' });
  assert.throws(() => game.act(room, ids[0], { type: 'chooseLevel', level: 2 }), /locked/);

  playLevel(room, ids);
  assert.strictEqual(room.unlocked, 2, 'beating level 1 unlocks level 2');
  playLevel(room, ids);
  assert.strictEqual(room.level, LEVELS.length);

  // Secret code hints stay private.
  const v = game.view(room, ids[1]);
  assert(!JSON.stringify(v).includes('"answer"'));
  console.log(`✅ ${n} players: beat both levels`);
}

// Creatures get tougher with more players.
function bossHp(n) {
  const { room, player } = game.createRoom({ name: 'Host' });
  for (let i = 1; i < n; i++) game.joinRoom({ code: room.code, name: `P${i}` });
  room.players.forEach((p) => game.setConnected(room, p.id, true));
  game.act(room, player.id, { type: 'start' });
  game.act(room, player.id, { type: 'chooseLevel', level: 1 });
  game.act(room, player.id, { type: 'go', spot: 'croc' });
  return room.enc;
}
const small = bossHp(4), big = bossHp(9);
assert(big.maxHp / 9 > small.maxHp / 4 && big.attacks > small.attacks);
console.log(`✅ Crocodile: 4 players → ${small.maxHp} HP, ${small.attacks} attack; 9 players → ${big.maxHp} HP, ${big.attacks} attacks`);
console.log('All tests passed! 🌴');
