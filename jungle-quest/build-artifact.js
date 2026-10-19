'use strict';
// Builds a single-file version of the game for publishing as a claude.ai page.
// Usage: node build-artifact.js <output.html>

const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const out = process.argv[2] || path.join(__dirname, 'jungle-quest.html');

const wrap = (name, file) => `define('${name}', function (module, require) {\n${read(file)}\n});`;

const html = `<title>Jungle Quest</title>
<style>
${read('public/style.css')}
</style>
<div id="app"></div>
<div id="toast" hidden></div>
<script>
const JQ_MODULES = {};
(function () {
  function define(name, fn) {
    const module = { exports: {} };
    fn(module, (n) => JQ_MODULES[n.replace('./', '')]);
    JQ_MODULES[name] = module.exports;
  }
${wrap('levels', 'levels.js')}
${wrap('game', 'game.js')}
})();
</script>
<script>
${read('artifact/net.js')}
</script>
<script>
${read('public/app.js')}
</script>
`;

fs.writeFileSync(out, html);
console.log(`Wrote ${out} (${Math.round(html.length / 1024)} KB)`);
