'use strict';
// Networking for the claude.ai page version (built by build-artifact.js).
// - "Play on this device": the game runs right here in the page.
// - Online: the host's page runs the game and saves it to the page's shared
//   database; other players read it from there and send their moves through
//   the page's live room (their "presence").

(function () {
  const game = JQ_MODULES.game;
  const HOST_ACTIONS = ['start', 'chooseLevel', 'menu', 'hurry'];
  const features = { online: false, invite: false, local: true, canHost: null, onlineNote: 'Checking online play...' };
  const notify = () => window.dispatchEvent(new Event('jq-net'));
  const listeners = new Map(); // code -> function to re-send the view
  const randomId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const message = (err) => (err && err.message) || String(err);
  const roomName = (code) => `jq-${code.toLowerCase()}`;

  let caps = null;
  const capsReady = (async () => {
    if (!window.claude || !window.claude.use) {
      features.onlineNote = 'Online play works when this page is opened on claude.ai. You can still play on one device below.';
      notify();
      return null;
    }
    const [db, room, user] = await Promise.all(['db', 'room', 'user'].map((n) => window.claude.use(n).catch(() => null)));
    if (!db || !room) {
      features.onlineNote = 'To play online, sign in to Claude and ask the owner of this page to invite you. You can still play on one device below.';
      notify();
      return null;
    }
    features.online = true;
    features.canHost = user ? await user.can('data.write').catch(() => null) : null;
    notify();
    caps = { db, room };
    return caps;
  })();

  // ---------- Same-device games ----------

  const current = new Map(); // code -> whose turn it is on this device

  function createLocal({ names, unlocked }) {
    const list = names.map((n) => n.trim()).filter(Boolean);
    if (list.length < game.MIN_PLAYERS || list.length > game.MAX_PLAYERS) throw new Error('Type 4 to 9 names, one per line.');
    const avatars = game.AVATARS.slice().sort(() => Math.random() - 0.5);
    const { room, player } = game.createRoom({ name: list[0], avatar: avatars[0], unlocked });
    list.slice(1).forEach((name, i) => game.joinRoom({ code: room.code, name, avatar: avatars[i + 1] }));
    room.players.forEach((p) => game.setConnected(room, p.id, true));
    game.act(room, player.id, { type: 'start' });
    room.feed = [];
    return { code: room.code, playerId: player.id, local: true };
  }

  function actLocal(s, action) {
    const room = game.rooms.get(s.code);
    if (!room) throw new Error('That game has ended.');
    let as = current.get(s.code) || s.playerId;
    if (HOST_ACTIONS.includes(action.type)) as = room.hostId;
    if (action.type === 'go') as = room.players[room.leader % room.players.length].id;
    game.act(room, as, action);
    // In a fight, hand the device to the next explorer who still needs to choose.
    if (action.type === 'fight' && room.phase === 'fight') {
      const next = room.players.find((p) => p.hp > 0 && !room.enc.choices[p.id]);
      if (next) current.set(s.code, next.id);
    }
    const resend = listeners.get(s.code);
    if (resend) resend();
  }

  function subscribeLocal(s, onState, onGone) {
    const room = game.rooms.get(s.code);
    if (!room) { setTimeout(onGone); return () => {}; }
    current.set(s.code, s.playerId);
    const send = () => {
      const v = game.view(room, current.get(s.code));
      v.hostId = v.you; // everyone shares the host buttons on one device
      onState(v);
    };
    listeners.set(s.code, send);
    send();
    return () => listeners.delete(s.code);
  }

  // ---------- Online games ----------

  const hosts = new Map(); // code -> host controller on this page
  const players = new Map(); // code -> player controller on this page

  async function create(body) {
    if (!(await capsReady)) throw new Error(features.onlineNote);
    const { room, player } = game.createRoom(body);
    room.seqs = {};
    room.errors = {};
    await caps.db.doc(`games/${room.code}`).set({ room: JSON.parse(JSON.stringify(room)) });
    return { code: room.code, playerId: player.id, host: true };
  }

  async function join({ code, name, avatar }) {
    if (!(await capsReady)) throw new Error(features.onlineNote);
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) throw new Error('Type the 4-letter game code.');
    if (!String(name || '').trim()) throw new Error('Please type your name.');
    const snap = await caps.db.doc(`games/${code}`).get();
    if (!snap.exists) throw new Error('No game with that code. Check the code and try again.');
    const room = snap.data().room;
    if (room.phase !== 'lobby') throw new Error('That game has already started.');
    if (room.players.length >= game.MAX_PLAYERS) throw new Error(`That game is full (${game.MAX_PLAYERS} players max).`);
    return { code, playerId: randomId(), name: String(name).trim().slice(0, 16), avatar };
  }

  function subscribeHost(s, onState, onGone, onError) {
    const ref = caps.db.doc(`games/${s.code}`);
    let room = null;
    let named = null;
    let stopped = false;
    let writing = false;
    let dirty = false;

    const send = () => { if (room && !stopped) onState(game.view(room, s.playerId)); };
    async function save() {
      if (writing) { dirty = true; return; }
      writing = true;
      do {
        dirty = false;
        try { await ref.set({ room: JSON.parse(JSON.stringify(room)) }); } catch (err) { onError(`Could not save the game: ${message(err)}`); }
      } while (dirty);
      writing = false;
    }

    function onPeers() {
      if (!room || !named) return;
      let changed = false;
      const here = new Map();
      for (const peer of named.peers()) {
        const pr = peer.presence || {};
        if (typeof pr.pid === 'string' && !peer.isMe) here.set(pr.pid, pr);
      }
      // New players in the lobby
      for (const [pid, pr] of here) {
        if (!room.players.some((p) => p.id === pid) && room.phase === 'lobby' && room.players.length < game.MAX_PLAYERS) {
          try { game.joinRoom({ code: room.code, id: pid, name: pr.name, avatar: pr.avatar }); changed = true; } catch { /* bad name */ }
        }
      }
      for (const p of room.players) {
        const on = p.id === s.playerId || here.has(p.id);
        if (p.connected !== on) { game.setConnected(room, p.id, on); changed = true; }
      }
      // Moves sent by other players
      for (const [pid, pr] of here) {
        if (!room.players.some((p) => p.id === pid) || !Array.isArray(pr.acts)) continue;
        for (const a of pr.acts.slice().sort((x, y) => x.seq - y.seq)) {
          if (!(a.seq > (room.seqs[pid] || 0))) continue;
          room.seqs[pid] = a.seq;
          changed = true;
          try { game.act(room, pid, a.action); } catch (err) { room.errors[pid] = { seq: a.seq, msg: message(err) }; }
        }
      }
      if (changed) { save(); send(); }
    }

    (async () => {
      if (!(await capsReady)) { onGone(); return; }
      room = game.rooms.get(s.code);
      if (!room) {
        const snap = await ref.get();
        if (!snap.exists) { onGone(); return; }
        room = JSON.parse(JSON.stringify(snap.data().room));
        room.players.forEach((p) => { p.connected = false; });
        game.rooms.set(room.code, room);
      }
      game.setConnected(room, s.playerId, true);
      send();
      try {
        named = await caps.room.join(roomName(s.code));
      } catch (err) { onError(`Could not open the game room: ${message(err)}`); return; }
      if (stopped) { named.leave(); return; }
      named.presence({ pid: s.playerId, host: true });
      named.onPeers(onPeers, (err) => onError(`Lost the connection to the other players (${err.code}). Reload the page to reconnect.`));
    })();

    hosts.set(s.code, {
      act(action) {
        if (!room) throw new Error('Still loading the game...');
        game.act(room, s.playerId, action);
        save();
        send();
      },
    });
    return () => { stopped = true; hosts.delete(s.code); if (named) named.leave(); };
  }

  function subscribePlayer(s, onState, onGone, onError) {
    let named = null;
    let stopped = false;
    let acts = [];
    let lastSeq = 0;
    let seenError = 0;
    let unsubDoc = () => {};

    (async () => {
      if (!(await capsReady)) { onGone(); return; }
      unsubDoc = caps.db.doc(`games/${s.code}`).onSnapshot((snap) => {
        if (!snap.exists) { onGone(); return; }
        const room = snap.data().room;
        if (!room.players.some((p) => p.id === s.playerId)) {
          if (room.phase !== 'lobby') onGone();
          return; // waiting for the host to add us
        }
        const err = room.errors && room.errors[s.playerId];
        if (err && err.seq > seenError) { seenError = err.seq; if (seenError > Date.now() - 60000) onError(err.msg); }
        onState(game.view(room, s.playerId));
      }, (err) => onError(`Lost the game (${err.code}). Reload the page to reconnect.`));
      try {
        named = await caps.room.join(roomName(s.code));
      } catch (err) { onError(`Could not join the game room: ${message(err)}`); return; }
      if (stopped) { named.leave(); return; }
      named.presence({ pid: s.playerId, name: s.name, avatar: s.avatar, acts });
    })();

    players.set(s.code, {
      act(action) {
        if (!named) throw new Error('Still connecting...');
        lastSeq = Math.max(Date.now(), lastSeq + 1);
        acts = [...acts, { seq: lastSeq, action }].slice(-12);
        named.presence({ acts });
      },
    });
    return () => { stopped = true; unsubDoc(); players.delete(s.code); if (named) named.leave(); };
  }

  window.JQ_NET = {
    features,
    createLocal,
    create,
    join,
    async act(s, action) {
      if (s.local) return actLocal(s, action);
      const c = (s.host ? hosts : players).get(s.code);
      if (!c) throw new Error('Not connected to the game.');
      return c.act(action);
    },
    subscribe(s, onState, onGone, onError) {
      if (s.local) return subscribeLocal(s, onState, onGone);
      return (s.host ? subscribeHost : subscribePlayer)(s, onState, onGone, onError);
    },
  };
})();
