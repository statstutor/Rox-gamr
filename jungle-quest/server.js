'use strict';
// Jungle Quest server. No packages needed: run `node server.js`.
// Players get live updates over Server-Sent Events and send clicks as POST requests.

const http = require('http');
const fs = require('fs');
const path = require('path');
const game = require('./game');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

// room code -> Set of { playerId, res }
const streams = new Map();

function send(res, data, event) {
  res.write(`${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(data)}\n\n`);
}

function broadcast(room) {
  for (const s of streams.get(room.code) || []) send(s.res, game.view(room, s.playerId));
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 10000) { reject(new Error('Too big')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch (err) { reject(err); }
    });
  });
}

function openStream(req, res, url) {
  const room = game.rooms.get(url.searchParams.get('code'));
  const playerId = url.searchParams.get('playerId');
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  if (!room || !room.players.some((p) => p.id === playerId)) {
    send(res, {}, 'gone');
    res.end();
    return;
  }
  const entry = { playerId, res };
  if (!streams.has(room.code)) streams.set(room.code, new Set());
  streams.get(room.code).add(entry);
  game.setConnected(room, playerId, true);
  broadcast(room);

  const ping = setInterval(() => res.write(': ping\n\n'), 20000);
  req.on('close', () => {
    clearInterval(ping);
    const set = streams.get(room.code);
    set.delete(entry);
    if (![...set].some((s) => s.playerId === playerId)) {
      game.setConnected(room, playerId, false);
      broadcast(room);
    }
  });
}

async function handleApi(req, res, url) {
  let body;
  try { body = await readBody(req); } catch { return json(res, 400, { error: 'Bad request.' }); }
  try {
    if (url.pathname === '/api/create') {
      const { room, player } = game.createRoom(body);
      return json(res, 200, { code: room.code, playerId: player.id });
    }
    if (url.pathname === '/api/join') {
      const { room, player } = game.joinRoom(body);
      broadcast(room);
      return json(res, 200, { code: room.code, playerId: player.id });
    }
    if (url.pathname === '/api/act') {
      const room = game.rooms.get(body.code);
      if (!room) return json(res, 404, { error: 'That game no longer exists.' });
      game.act(room, body.playerId, body.action);
      broadcast(room);
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: 'Not found.' });
  } catch (err) {
    if (err instanceof game.GameError) return json(res, 400, { error: err.message });
    console.error(err);
    return json(res, 500, { error: 'Something went wrong.' });
  }
}

function serveFile(res, pathname) {
  const file = path.normalize(path.join(PUBLIC, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/api/events') return openStream(req, res, url);
  if (req.method === 'POST' && url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  if (req.method === 'GET') return serveFile(res, url.pathname);
  res.writeHead(405);
  res.end();
});

// Forget games nobody has touched for 3 hours.
setInterval(() => {
  for (const [code, room] of game.rooms) {
    if (Date.now() - room.touched > 3 * 60 * 60 * 1000 && !(streams.get(code) || new Set()).size) {
      game.rooms.delete(code);
      streams.delete(code);
    }
  }
}, 10 * 60 * 1000).unref();

server.listen(PORT, () => console.log(`🌴 Jungle Quest is running at http://localhost:${PORT}`));
