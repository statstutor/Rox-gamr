'use strict';
// Simulates many playthroughs and prints how often the whole team gets knocked out
// in each level, for every team size. Use it to tune creature numbers in levels.js.
// Run with: node balance.js [runs per level, default 60] [levels, e.g. 6,7]
const game = require('./game');
const { LEVELS } = require('./levels');

const runs = Number(process.argv[2] || 60);
const only = process.argv[3] ? process.argv[3].split(',').map(Number) : null;

function playLevel(n, levelId) {
  const { room, player } = game.createRoom({ name: 'Host' });
  for (let i = 1; i < n; i++) game.joinRoom({ code: room.code, name: `P${i}` });
  room.players.forEach((p) => game.setConnected(room, p.id, true));
  game.act(room, player.id, { type: 'start' });
  room.unlocked = LEVELS.length;
  game.act(room, player.id, { type: 'chooseLevel', level: levelId });
  const level = LEVELS[levelId - 1];
  const order = level.spots.filter((s) => !s.boss).concat(level.spots.filter((s) => s.boss));
  let wipes = 0;
  for (const def of order) {
    const spot = room.spots.find((s) => s.id === def.id);
    if (def.type !== 'fight') {
      // Mysteries: skip them, but charge the team a typical wrong-answer penalty.
      spot.done = true;
      room.players.forEach((p) => { p.hp = Math.max(1, p.hp - (2 + Math.floor(n / 3))); });
      continue;
    }
    for (let tries = 0; !spot.done && tries < 30; tries++) {
      game.act(room, room.players[room.leader % n].id, { type: 'go', spot: def.id });
      while (room.phase === 'fight') {
        for (const p of room.players.filter((x) => x.hp > 0)) {
          if (room.phase !== 'fight') break;
          const hurt = room.players.filter((x) => x.hp < 10).sort((a, b) => a.hp - b.hp)[0];
          const roll = Math.random();
          const move = hurt && p.potions && Math.random() < 0.6 ? { move: 'heal', target: hurt.id }
            : { move: roll < 0.3 ? 'power' : roll < 0.45 ? 'defend' : 'attack' };
          game.act(room, p.id, { type: 'fight', ...move });
        }
      }
      if (!spot.done) wipes++;
    }
  }
  return wipes;
}

console.log(`Average team knockouts per level (${runs} runs each):`);
for (let n = game.MIN_PLAYERS; n <= game.MAX_PLAYERS; n++) {
  const cells = LEVELS.filter((l) => !only || only.includes(l.id)).map((l) => {
    let total = 0;
    for (let i = 0; i < runs; i++) total += playLevel(n, l.id);
    return `L${l.id} ${(total / runs).toFixed(1)}`;
  });
  console.log(`${n} players: ${cells.join(' | ')}`);
}
