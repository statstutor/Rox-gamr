'use strict';
// Plays the claude.ai page version in a real browser, as one explorer with 3 AI teammates.
// It pretends to be claude.ai (a stand-in for the page's account storage), sets the account's
// unlocked level, then beats the chosen levels in a row and checks the unlock is saved.
//
// Needs Playwright with Chromium installed. Usage:
//   node build-artifact.js /tmp/jq.html
//   node browser-test.js /tmp/jq.html <first level> <last level> [screenshot folder]

const fs = require('fs');
const http = require('http');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); } catch {
  ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')));
}

const [page = '', first = '1', last = first, shots = ''] = process.argv.slice(2);
const FIRST = Number(first);
const LAST = Number(last);
if (!fs.existsSync(page)) { console.error('Build the page first: node build-artifact.js <file.html>'); process.exit(1); }

// The real page gets its charset from claude.ai's wrapper; add one for this local copy.
const html = `<meta charset="utf-8">${fs.readFileSync(page, 'utf8')}`;

// Stand-in for claude.ai: a tiny database kept in localStorage, and a signed-in user.
const SHIM = `(() => {
  const snap = (p) => { const raw = localStorage.getItem('mockdb:' + p); return { exists: !!raw, data: () => raw && JSON.parse(raw) }; };
  const db = { doc: (p) => ({
    get: async () => snap(p),
    set: async (d) => { localStorage.setItem('mockdb:' + p, JSON.stringify(d)); },
    onSnapshot(next) { setTimeout(() => next(snap(p))); return () => {}; },
  }) };
  const user = { id: async () => 'tester1', can: async () => true };
  window.claude = { use: async (n) => ({ db, user })[n] || null };
})();`;

const shot = async (p, name, full = true) => { if (shots) await p.screenshot({ path: path.join(shots, `${name}.png`), fullPage: full }); };

async function screenOf(p) {
  if (await p.locator('#cutscene:not([hidden])').count()) return 'cutscene';
  if (await p.locator('.monster').count() && await p.locator('text=Your move').count()) return 'fight';
  if (await p.locator('text=Talk it over').count()) return 'riddle';
  if (await p.locator('text=The lock').count()) return 'code';
  if (await p.locator('text=Clues found').count()) return 'hunt';
  return 'map';
}

async function beatLevel(p, level, seen, errors) {
  const start = Date.now();
  while (!(await p.locator('text=complete!').count())) {
    if (Date.now() - start > 600000) { await shot(p, `stuck-${level}`); throw new Error(`Stuck in level ${level}`); }
    const screen = await screenOf(p);
    if (!seen.has(screen + level)) {
      seen.add(screen + level);
      if (screen === 'cutscene') await p.waitForTimeout(400);
      await shot(p, `${screen}-${level}`, screen !== 'cutscene');
    }
    try {
      if (screen === 'cutscene') await p.click('.cs-skip', { timeout: 2000 });
      else if (screen === 'map') { const t = p.locator('button.tile:not([disabled])'); if (await t.count()) await t.first().click({ timeout: 2000 }); }
      else if (screen === 'fight') {
        if (await p.locator('.rage').count() && !seen.has('rage' + level)) { seen.add('rage' + level); await shot(p, `rage-${level}`); }
        const a = p.locator('button:has-text("Attack")'); if (await a.count()) await a.click({ timeout: 2000 });
      } else if (screen === 'riddle') await p.locator('.options button:not([disabled])').first().click({ timeout: 2000 });
      else if (screen === 'hunt') {
        const answers = p.locator('.options button:not([disabled])');
        if (await answers.count()) await answers.first().click({ timeout: 2000 });
        else { const t = p.locator('button.place:not([disabled])'); if (await t.count()) await t.first().click({ timeout: 2000 }); }
      } else if (screen === 'code') {
        // Use your own hint plus what the AI teammates say.
        const texts = (await p.locator('.hint').allTextContents()).concat(await p.locator('.card p').allTextContents());
        const known = {};
        for (const h of texts) { const m = h.match(/Symbol #(\d) is (\S+?)"?$/u); if (m) known[m[1] - 1] = m[2]; }
        const slots = await p.locator('.dial button').count();
        for (let i = 0; i < slots; i++) {
          await p.locator('.dial button').nth(i).click({ timeout: 2000 });
          await p.locator(`.symbols button:has-text("${known[i]}")`).click({ timeout: 2000 });
        }
        await p.click('text=Try the code', { timeout: 2000 });
      }
    } catch { /* the screen changed under us: look again */ }
    await p.waitForTimeout(150);
  }
  console.log(`✅ Level ${level} beaten in ${Math.round((Date.now() - start) / 1000)}s`);
  if (errors.length) throw new Error(`Page errors: ${errors.join(' | ')}`);
}

(async () => {
  const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); });
  await new Promise((r) => server.listen(0, r));
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(SHIM);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(url);
    // The account remembers the starting level; this browser remembers nothing.
    await p.evaluate((n) => { localStorage.clear(); localStorage.setItem('mockdb:data/users/tester1/progress', JSON.stringify({ unlocked: n })); }, FIRST);
    await p.reload();
    await p.waitForTimeout(600);
    console.log('Home screen:', await p.locator('.chip').first().textContent().catch(() => '(no unlock note)'));
    await p.fill('#name', 'Tester');
    await p.click('button[data-ui="solo"][data-value="3"]');
    await shot(p, 'levels');
    const seen = new Set();
    for (let level = FIRST; level <= LAST; level++) {
      if (level === FIRST) await p.click(`button.tile[data-act*='"level":${level}}']`);
      else await p.click('text=/^Go to /');
      await beatLevel(p, level, seen, errors);
    }
    await shot(p, `won-${LAST}`);
    const saved = await p.evaluate(() => localStorage.getItem('mockdb:data/users/tester1/progress'));
    console.log('Account now remembers:', saved);
    if (errors.length) throw new Error(`Page errors: ${errors.join(' | ')}`);
    console.log('No page errors 🌴');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((err) => { console.error('❌', err.message); process.exit(1); });
