// Dig, Hamster, Dig! - cartoon drawing helpers
'use strict';

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(typeof r === 'number' ? r : 0, w / 2, h / 2);
    this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
  };
}

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

function shade(hex, amt) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  let r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function ell(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}
function circ(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
function fillStroke(ctx, fill, stroke) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

function drawEmoji(ctx, e, x, y, size, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(e, x, y);
  ctx.restore();
}

// ---------- accessories (unit coordinates; body radius ~1) ----------
function flower(ctx, x, y, r, petal, center) {
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    circ(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75); fillStroke(ctx, petal);
  }
  circ(ctx, x, y, r * 0.6); fillStroke(ctx, center);
}

const ACC_DRAW = {
  // ---- back (drawn behind body) ----
  cape(ctx, t) {
    const sway = Math.sin(t * 3) * 0.06;
    ctx.beginPath();
    ctx.moveTo(-0.7, -0.35);
    ctx.quadraticCurveTo(-1.35, 0.5, -1.15 + sway, 1.15);
    ctx.lineTo(1.15 + sway, 1.15);
    ctx.quadraticCurveTo(1.35, 0.5, 0.7, -0.35);
    ctx.closePath(); fillStroke(ctx, '#7b3fd1', '#4b2190');
    ctx.fillStyle = '#ffe44d';
    [[-0.85, 0.7], [0.9, 0.85], [-0.95, 1.0]].forEach(([x, y]) => drawStar(ctx, x + sway, y, 0.1));
  },
  backpack(ctx) {
    ctx.beginPath(); ctx.roundRect(0.55, -0.35, 0.65, 0.9, 0.18); fillStroke(ctx, '#4caf50', '#2e7d32');
    ctx.beginPath(); ctx.roundRect(0.65, 0.1, 0.5, 0.3, 0.08); fillStroke(ctx, '#66bb6a', '#2e7d32');
  },
  wings(ctx, t) {
    const f = Math.sin(t * 8) * 0.08;
    ctx.save(); ctx.globalAlpha *= 0.8;
    for (const s of [-1, 1]) {
      const g = ctx.createLinearGradient(s * 0.6, -0.6, s * 1.6, 0.4);
      g.addColorStop(0, '#9ff3ff'); g.addColorStop(0.5, '#d9a8ff'); g.addColorStop(1, '#ffc2e8');
      ell(ctx, s * 1.15, -0.35, 0.6, 0.38 + f, s * -0.5); fillStroke(ctx, g, '#a070e0');
      ell(ctx, s * 1.05, 0.25, 0.42, 0.25 - f / 2, s * 0.4); fillStroke(ctx, g, '#a070e0');
    }
    ctx.restore();
  },
  jetpack(ctx, t) {
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.roundRect(s * 0.95 - 0.18, -0.35, 0.36, 0.85, 0.15); fillStroke(ctx, '#cfd8dc', '#607d8b');
      const fl = 0.35 + Math.sin(t * 30 + s) * 0.1;
      ctx.beginPath(); ctx.moveTo(s * 0.95 - 0.13, 0.5); ctx.lineTo(s * 0.95, 0.5 + fl); ctx.lineTo(s * 0.95 + 0.13, 0.5); ctx.closePath();
      fillStroke(ctx, '#ff9800');
      ctx.beginPath(); ctx.moveTo(s * 0.95 - 0.07, 0.5); ctx.lineTo(s * 0.95, 0.5 + fl * 0.6); ctx.lineTo(s * 0.95 + 0.07, 0.5); ctx.closePath();
      fillStroke(ctx, '#ffeb3b');
    }
  },
  // ---- neck ----
  scarf(ctx) {
    ell(ctx, 0, 0.17, 0.82, 0.15); fillStroke(ctx, '#e53935', '#a3221f');
    ctx.save(); ell(ctx, 0, 0.17, 0.82, 0.15); ctx.clip();
    ctx.fillStyle = '#fff';
    for (let x = -0.7; x < 0.8; x += 0.3) ctx.fillRect(x, 0.05, 0.1, 0.5);
    ctx.restore();
    ctx.beginPath(); ctx.roundRect(0.45, 0.2, 0.22, 0.55, 0.06); fillStroke(ctx, '#e53935', '#a3221f');
    ctx.fillStyle = '#fff'; ctx.fillRect(0.45, 0.4, 0.22, 0.08); ctx.fillRect(0.45, 0.6, 0.22, 0.08);
  },
  lei(ctx) {
    const cols = ['#ff4f8b', '#ffd23f', '#ff8a3d', '#b05cff', '#3ed6c7'];
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * (0.1 + 0.8 * i / 8);
      flower(ctx, Math.cos(a) * 0.72, 0.02 + Math.sin(a) * 0.3, 0.07, cols[i % cols.length], '#fff7a8');
    }
  },
  bowtie(ctx) {
    ctx.beginPath(); ctx.moveTo(0, 0.11); ctx.lineTo(-0.11, -0.01); ctx.lineTo(-0.11, 0.23); ctx.closePath(); fillStroke(ctx, '#d81b60', '#880e4f');
    ctx.beginPath(); ctx.moveTo(0, 0.11); ctx.lineTo(0.11, -0.01); ctx.lineTo(0.11, 0.23); ctx.closePath(); fillStroke(ctx, '#d81b60', '#880e4f');
    circ(ctx, 0, 0.11, 0.07); fillStroke(ctx, '#f06292', '#880e4f');
  },
  medal(ctx) {
    ctx.beginPath(); ctx.moveTo(-0.3, 0.12); ctx.lineTo(0, 0.5); ctx.lineTo(0.3, 0.12); ctx.lineWidth = 0.1; ctx.strokeStyle = '#1e88e5'; ctx.stroke(); ctx.lineWidth = 0.06;
    circ(ctx, 0, 0.58, 0.17); fillStroke(ctx, '#ffca28', '#c79100');
    ctx.fillStyle = '#fff59d'; drawStar(ctx, 0, 0.58, 0.09);
  },
  // ---- face ----
  sunglasses(ctx) {
    for (const s of [-1, 1]) { ell(ctx, s * 0.36, -0.15, 0.24, 0.17); fillStroke(ctx, '#222', '#000'); }
    ctx.beginPath(); ctx.moveTo(-0.13, -0.2); ctx.lineTo(0.13, -0.2); ctx.strokeStyle = '#000'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (const s of [-1, 1]) { ell(ctx, s * 0.36 - 0.08, -0.2, 0.06, 0.03, -0.4); ctx.fill(); }
  },
  goggles(ctx) {
    ctx.beginPath(); ctx.roundRect(-0.85, -0.25, 1.7, 0.2, 0.1); fillStroke(ctx, '#455a64');
    for (const s of [-1, 1]) {
      ell(ctx, s * 0.36, -0.15, 0.25, 0.19);
      const g = ctx.createLinearGradient(s * 0.36, -0.34, s * 0.36, 0.04);
      g.addColorStop(0, '#ffb74d'); g.addColorStop(1, '#ff5722');
      fillStroke(ctx, g, '#37474f');
    }
  },
  monocle(ctx) {
    circ(ctx, 0.36, -0.15, 0.2); ctx.lineWidth = 0.06; fillStroke(ctx, 'rgba(200,240,255,0.35)', '#c9a227');
    ctx.beginPath(); ctx.moveTo(0.52, -0.05); ctx.quadraticCurveTo(0.7, 0.3, 0.5, 0.55); ctx.lineWidth = 0.03; ctx.strokeStyle = '#c9a227'; ctx.stroke(); ctx.lineWidth = 0.06;
  },
  mustache(ctx) {
    ctx.fillStyle = '#5d3a1a';
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(0, 0.1);
      ctx.bezierCurveTo(s * 0.15, 0.02, s * 0.35, 0.05, s * 0.42, 0.0);
      ctx.bezierCurveTo(s * 0.45, 0.1, s * 0.3, 0.2, 0, 0.16);
      ctx.fill();
    }
  },
  // ---- head ----
  leafhat(ctx, t) {
    ctx.save(); ctx.translate(0.05, -0.92); ctx.rotate(-0.3 + Math.sin(t * 2) * 0.05);
    ell(ctx, 0, 0, 0.55, 0.22); fillStroke(ctx, '#66bb6a', '#2e7d32');
    ctx.beginPath(); ctx.moveTo(-0.5, 0); ctx.lineTo(0.5, 0); ctx.strokeStyle = '#2e7d32'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.5, 0); ctx.lineTo(0.68, -0.1); ctx.stroke();
    ctx.restore();
  },
  flowercrown(ctx) {
    const cols = ['#ff80ab', '#fff176', '#ffffff', '#b39ddb', '#ffab91'];
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (1.18 + 0.64 * i / 4);
      ctx.fillStyle = '#7cb342';
      flower(ctx, Math.cos(a) * 0.72, -0.12 + Math.sin(a) * 0.78, 0.09, cols[i], '#ffb300');
    }
  },
  bow(ctx) {
    ctx.save(); ctx.translate(0.5, -0.82); ctx.rotate(0.3);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-0.35, -0.3, -0.35, 0.05); ctx.quadraticCurveTo(-0.3, 0.25, 0, 0); fillStroke(ctx, '#ff6fa5', '#c2185b');
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(0.35, -0.3, 0.35, 0.05); ctx.quadraticCurveTo(0.3, 0.25, 0, 0); fillStroke(ctx, '#ff6fa5', '#c2185b');
    circ(ctx, 0, 0, 0.08); fillStroke(ctx, '#ff9fc4', '#c2185b');
    ctx.restore();
  },
  explorer(ctx) {
    ell(ctx, 0, -0.72, 0.95, 0.16); fillStroke(ctx, '#d7b98c', '#8d6e47');
    ctx.beginPath(); ctx.ellipse(0, -0.74, 0.58, 0.42, 0, Math.PI, 0); ctx.closePath(); fillStroke(ctx, '#e3c79c', '#8d6e47');
    ctx.fillStyle = '#6d4c2f'; ctx.fillRect(-0.57, -0.86, 1.14, 0.1);
  },
  beanie(ctx) {
    ctx.beginPath(); ctx.ellipse(0, -0.55, 0.86, 0.6, 0, Math.PI, 0); ctx.closePath(); fillStroke(ctx, '#42a5f5', '#1565c0');
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, -0.55, 0.86, 0.6, 0, Math.PI, 0); ctx.clip();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-1, -0.88, 2, 0.1); ctx.fillRect(-1, -1.05, 2, 0.08);
    ctx.restore();
    ctx.beginPath(); ctx.roundRect(-0.9, -0.62, 1.8, 0.2, 0.08); fillStroke(ctx, '#1e88e5', '#1565c0');
    circ(ctx, 0, -1.18, 0.15); fillStroke(ctx, '#ffffff', '#b0bec5');
  },
  earmuffs(ctx) {
    ctx.beginPath(); ctx.arc(0, -0.5, 0.62, Math.PI * 1.05, Math.PI * 1.95); ctx.lineWidth = 0.1; ctx.strokeStyle = '#8e24aa'; ctx.stroke(); ctx.lineWidth = 0.06;
    for (const s of [-1, 1]) { circ(ctx, s * 0.55, -0.7, 0.24); fillStroke(ctx, '#f8bbd0', '#ad1457'); circ(ctx, s * 0.55, -0.7, 0.13); fillStroke(ctx, '#fce4ec'); }
  },
  spacehelmet(ctx) {
    circ(ctx, 0, -0.05, 1.28);
    ctx.fillStyle = 'rgba(180,230,255,0.18)'; ctx.fill();
    ctx.lineWidth = 0.07; ctx.strokeStyle = 'rgba(160,220,255,0.9)'; ctx.stroke(); ctx.lineWidth = 0.06;
    ctx.beginPath(); ctx.arc(0, -0.05, 1.1, Math.PI * 1.15, Math.PI * 1.45); ctx.lineWidth = 0.1; ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.stroke(); ctx.lineWidth = 0.06;
  },
  antennae(ctx, t) {
    for (const s of [-1, 1]) {
      const wob = Math.sin(t * 4 + s) * 0.06;
      ctx.beginPath(); ctx.moveTo(s * 0.25, -0.85); ctx.quadraticCurveTo(s * 0.35, -1.2, s * 0.5 + wob, -1.45); ctx.strokeStyle = '#43a047'; ctx.stroke();
      circ(ctx, s * 0.5 + wob, -1.48, 0.12); fillStroke(ctx, '#b2ff59', '#43a047');
    }
  },
  crown(ctx) {
    ctx.beginPath();
    ctx.moveTo(-0.45, -0.75); ctx.lineTo(-0.5, -1.15); ctx.lineTo(-0.25, -0.95); ctx.lineTo(0, -1.25);
    ctx.lineTo(0.25, -0.95); ctx.lineTo(0.5, -1.15); ctx.lineTo(0.45, -0.75); ctx.closePath();
    fillStroke(ctx, '#ffd54f', '#c79100');
    circ(ctx, 0, -0.88, 0.07); fillStroke(ctx, '#e53935');
    circ(ctx, -0.3, -0.85, 0.05); fillStroke(ctx, '#42a5f5');
    circ(ctx, 0.3, -0.85, 0.05); fillStroke(ctx, '#66bb6a');
  },
  tophat(ctx) {
    ell(ctx, 0.05, -0.8, 0.6, 0.12); fillStroke(ctx, '#222', '#000');
    ctx.beginPath(); ctx.roundRect(-0.3, -1.45, 0.7, 0.66, 0.06); fillStroke(ctx, '#2b2b2b', '#000');
    ctx.fillStyle = '#c62828'; ctx.fillRect(-0.3, -0.98, 0.7, 0.12);
  },
};

function drawStar(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
}

// ---------- the hamster (soft anime style, real hamster proportions) ----------
// Unit coordinates: head top ~ -1.0, feet ~ 1.0. Eyes sit at y = -0.36.
function hamsterPath(ctx) {
  const R = [ // right half: [cp1x, cp1y, cp2x, cp2y, x, y]
    [0.4, -1.02, 0.7, -0.88, 0.74, -0.55], // round head
    [0.78, -0.32, 0.93, -0.25, 0.9, -0.04], // puffy cheek pouch
    [0.88, 0.08, 0.81, 0.12, 0.83, 0.2], // tiny dip under the cheek
    [1.06, 0.45, 1.1, 0.88, 0.68, 0.99], // big round bottom
  ];
  ctx.beginPath(); ctx.moveTo(0, -1.0);
  for (const c of R) ctx.bezierCurveTo(...c);
  ctx.quadraticCurveTo(0.3, 1.05, 0, 1.05); ctx.quadraticCurveTo(-0.3, 1.05, -0.68, 0.99);
  const pts = [[0, -1.0], ...R.map(c => [c[4], c[5]])];
  for (let i = R.length - 1; i >= 0; i--) {
    const c = R[i], p = pts[i];
    ctx.bezierCurveTo(-c[2], c[3], -c[0], c[1], -p[0], p[1]);
  }
  ctx.closePath();
}

// o: {color, equipped, karate, belt, t, blink, tilt, bob, squash, punch}
function drawHamster(ctx, x, y, size, o = {}) {
  const col = HAM_COLORS[o.color] || HAM_COLORS.golden;
  const t = o.t || 0;
  const eq = o.equipped || {};
  const s = size / 2.4;
  const out = shade(col.body, -0.4);
  const pink = '#f4a7b3', pinkD = '#d97b8b';
  ctx.save();
  ctx.translate(x, y);
  if (o.tilt) ctx.rotate(o.tilt);
  const bob = o.bob ? Math.sin(t * 7) * 0.03 : 0;
  const sq = o.squash || 0;
  ctx.scale(s * (1 + sq), s * (1 - sq + bob));
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 0.045;

  if (o.shadow !== false) { ell(ctx, 0, 1.03, 0.85, 0.11); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill(); }
  if (eq.back && ACC_DRAW[eq.back]) { ctx.lineWidth = 0.06; ACC_DRAW[eq.back](ctx, t); ctx.lineWidth = 0.045; }
  if (o.karate) drawHeadbandTails(ctx, t);

  // ears (behind the head)
  for (const sx of [-1, 1]) {
    const tw = o.blink ? 0 : Math.sin(t * 1.3 + sx) * 0.03;
    ell(ctx, sx * 0.47, -0.88 + tw, 0.2, 0.18, sx * 0.4); fillStroke(ctx, shade(col.body, -0.06), out);
    ell(ctx, sx * 0.48, -0.86 + tw, 0.11, 0.095, sx * 0.4);
    const eg = ctx.createRadialGradient(sx * 0.48, -0.84, 0.01, sx * 0.48, -0.86, 0.12);
    eg.addColorStop(0, '#e98a9b'); eg.addColorStop(1, pink);
    ctx.fillStyle = eg; ctx.fill();
  }

  // body + head (one soft pear shape)
  hamsterPath(ctx);
  const fg = ctx.createRadialGradient(-0.15, -0.55, 0.1, 0, -0.1, 1.35);
  fg.addColorStop(0, shade(col.body, 0.22)); fg.addColorStop(0.55, col.body); fg.addColorStop(1, shade(col.body, -0.18));
  ctx.fillStyle = fg; ctx.fill();

  // white muzzle + chest, clipped to the body (Syrian hamster markings)
  ctx.save();
  hamsterPath(ctx); ctx.clip();
  ctx.fillStyle = col.belly;
  ell(ctx, 0, -0.05, 0.43, 0.27); ctx.fill();
  ell(ctx, 0, 0.25, 0.5, 0.38); ctx.fill();
  ell(ctx, 0, 0.62, 0.72, 0.48); ctx.fill();
  // fur texture
  ctx.strokeStyle = shade(col.belly, -0.12); ctx.lineWidth = 0.025;
  for (const [fx, fy] of [[-0.35, 0.55], [0.3, 0.62], [-0.12, 0.8], [0.15, 0.45], [0.42, 0.82]]) {
    ctx.beginPath(); ctx.moveTo(fx - 0.05, fy); ctx.quadraticCurveTo(fx, fy + 0.05, fx + 0.05, fy); ctx.stroke();
  }
  ctx.strokeStyle = shade(col.body, -0.15);
  for (const [fx, fy] of [[-0.6, -0.65], [0.55, -0.7], [-0.75, 0.45], [0.8, 0.5]]) {
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 0.04, fy + 0.08); ctx.stroke();
  }
  if (o.karate) drawGi(ctx, col, o.belt || '#222');
  ctx.restore();

  // outline + fluffy tufts
  ctx.lineWidth = 0.045;
  hamsterPath(ctx); ctx.strokeStyle = out; ctx.stroke();
  ctx.fillStyle = col.body;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * 0.89, -0.16); ctx.lineTo(sx * 0.99, -0.12); ctx.lineTo(sx * 0.91, -0.06);
    ctx.lineTo(sx * 1.0, 0.0); ctx.lineTo(sx * 0.89, 0.04);
    ctx.fill(); ctx.strokeStyle = out; ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(-0.1, -0.99); ctx.lineTo(-0.04, -1.1); ctx.lineTo(0.0, -1.0); ctx.lineTo(0.07, -1.08); ctx.lineTo(0.1, -0.99);
  ctx.fill(); ctx.stroke();

  // eyes - big glossy anime eyes
  for (const sx of [-1, 1]) {
    const ex = sx * 0.33, ey = -0.36;
    if (o.blink) {
      ctx.beginPath(); ctx.moveTo(ex - 0.12, ey); ctx.quadraticCurveTo(ex, ey + 0.08, ex + 0.12, ey);
      ctx.strokeStyle = '#2a1610'; ctx.lineWidth = 0.05; ctx.stroke();
      continue;
    }
    ell(ctx, ex, ey, 0.135, 0.165);
    const ig = ctx.createLinearGradient(ex, ey - 0.16, ex, ey + 0.16);
    ig.addColorStop(0, '#120806'); ig.addColorStop(0.65, '#2c1610'); ig.addColorStop(1, '#6b3a24');
    ctx.fillStyle = ig; ctx.fill();
    // upper lash line
    ctx.beginPath(); ctx.ellipse(ex, ey, 0.145, 0.175, 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.strokeStyle = '#120806'; ctx.lineWidth = 0.05; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex + sx * 0.12, ey - 0.1); ctx.lineTo(ex + sx * 0.18, ey - 0.15); ctx.lineWidth = 0.03; ctx.stroke();
    // shine
    ctx.fillStyle = '#ffffff';
    circ(ctx, ex + 0.045, ey - 0.07, 0.05); ctx.fill();
    circ(ctx, ex - 0.05, ey + 0.07, 0.022); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ell(ctx, ex, ey + 0.1, 0.07, 0.025); ctx.fill();
  }
  if (o.karate) { // determined eyebrows
    ctx.strokeStyle = '#2a1610'; ctx.lineWidth = 0.055;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 0.47, -0.58); ctx.lineTo(sx * 0.2, -0.52); ctx.stroke(); }
  }

  // blush with anime hatching
  for (const sx of [-1, 1]) {
    const bg = ctx.createRadialGradient(sx * 0.58, -0.14, 0.01, sx * 0.58, -0.14, 0.17);
    bg.addColorStop(0, 'rgba(255,120,150,0.5)'); bg.addColorStop(1, 'rgba(255,120,150,0)');
    ctx.fillStyle = bg; ell(ctx, sx * 0.58, -0.14, 0.18, 0.11); ctx.fill();
    ctx.strokeStyle = 'rgba(220,80,110,0.55)'; ctx.lineWidth = 0.018;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(sx * 0.58 + i * 0.06 - 0.02, -0.1); ctx.lineTo(sx * 0.58 + i * 0.06 + 0.02, -0.18); ctx.stroke(); }
  }

  // nose, mouth, little buck teeth
  ctx.beginPath(); ctx.moveTo(-0.06, -0.15); ctx.quadraticCurveTo(0, -0.18, 0.06, -0.15); ctx.quadraticCurveTo(0.02, -0.08, 0, -0.08); ctx.quadraticCurveTo(-0.02, -0.08, -0.06, -0.15);
  ctx.fillStyle = '#e8798e'; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; circ(ctx, -0.015, -0.145, 0.012); ctx.fill();
  ctx.strokeStyle = '#7a4636'; ctx.lineWidth = 0.025;
  ctx.beginPath(); ctx.moveTo(0, -0.08); ctx.lineTo(0, -0.04); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-0.09, -0.03); ctx.quadraticCurveTo(-0.045, 0.0, 0, -0.04); ctx.quadraticCurveTo(0.045, 0.0, 0.09, -0.03); ctx.stroke();
  ctx.fillStyle = '#fffdf7'; ctx.strokeStyle = '#c9b8a8'; ctx.lineWidth = 0.012;
  ctx.beginPath(); ctx.rect(-0.03, -0.03, 0.028, 0.05); ctx.rect(0.002, -0.03, 0.028, 0.05); ctx.fill(); ctx.stroke();
  // whiskers
  ctx.strokeStyle = 'rgba(90,60,50,0.45)'; ctx.lineWidth = 0.014;
  for (const sx of [-1, 1]) for (const [a, b] of [[-0.12, -0.2], [-0.07, -0.08], [-0.03, 0.04]]) {
    ctx.beginPath(); ctx.moveTo(sx * 0.2, a); ctx.quadraticCurveTo(sx * 0.5, a + (b - a) * 0.3, sx * 0.78, b); ctx.stroke();
  }

  if (!o.karate && eq.neck && ACC_DRAW[eq.neck]) { ctx.lineWidth = 0.06; ACC_DRAW[eq.neck](ctx, t); }

  // arms + tiny paws held at the chest
  const p = o.punch || 0;
  ctx.lineWidth = 0.035;
  for (const sx of [-1, 1]) {
    const px = sx * 0.17 + (sx > 0 ? p * 0.55 : 0), py = 0.24 - (sx > 0 ? p * 0.3 : 0);
    ell(ctx, sx * 0.27 + (sx > 0 ? p * 0.35 : 0), py - 0.05, 0.15, 0.09, sx * -0.45);
    ctx.fillStyle = o.karate ? '#f2f2f2' : shade(col.body, -0.08); ctx.fill();
    ell(ctx, px, py, 0.1, 0.075); fillStroke(ctx, pink, pinkD);
    ctx.strokeStyle = pinkD; ctx.lineWidth = 0.015;
    for (const f of [-0.04, 0, 0.04]) { ctx.beginPath(); ctx.moveTo(px + f, py + 0.03); ctx.lineTo(px + f, py + 0.07); ctx.stroke(); }
    ctx.lineWidth = 0.035;
  }
  // feet
  for (const sx of [-1, 1]) {
    ell(ctx, sx * 0.42, 0.98, 0.19, 0.085); fillStroke(ctx, pink, pinkD);
    ctx.fillStyle = pinkD;
    for (const f of [-0.1, -0.03, 0.04]) { circ(ctx, sx * 0.42 + sx * f, 0.94, 0.018); ctx.fill(); }
  }

  ctx.lineWidth = 0.06;
  if (!o.karate) {
    if (eq.face && ACC_DRAW[eq.face]) { ctx.save(); ctx.translate(0, -0.21); ACC_DRAW[eq.face](ctx, t); ctx.restore(); }
    if (eq.head === 'spacehelmet') ACC_DRAW.spacehelmet(ctx, t);
    else if (eq.head && ACC_DRAW[eq.head]) { ctx.save(); ctx.translate(0, -0.13); ACC_DRAW[eq.head](ctx, t); ctx.restore(); }
  } else {
    drawHeadband(ctx);
  }
  ctx.restore();
}

// drawn while clipped to the body
function drawGi(ctx, col, belt) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-1.2, 0.2, 2.4, 1.0);
  ctx.beginPath(); ctx.moveTo(-0.42, 0.19); ctx.lineTo(0, 0.6); ctx.lineTo(0.42, 0.19); ctx.closePath();
  ctx.fillStyle = col.belly; ctx.fill();
  ctx.strokeStyle = '#d5d5d5'; ctx.lineWidth = 0.08;
  ctx.beginPath(); ctx.moveTo(-0.46, 0.2); ctx.lineTo(0.05, 0.7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.46, 0.2); ctx.lineTo(0, 0.64); ctx.stroke();
  ctx.strokeStyle = '#ececec'; ctx.lineWidth = 0.03;
  for (const fx of [-0.7, 0.7]) { ctx.beginPath(); ctx.moveTo(fx, 0.3); ctx.quadraticCurveTo(fx * 0.9, 0.6, fx * 1.1, 0.9); ctx.stroke(); }
  ctx.fillStyle = belt; ctx.fillRect(-1.2, 0.66, 2.4, 0.13);
  ctx.strokeStyle = shade(belt === '#222222' ? '#555555' : belt, -0.3); ctx.lineWidth = 0.03;
  ctx.beginPath(); ctx.roundRect(-0.09, 0.64, 0.18, 0.17, 0.04); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-0.05, 0.79); ctx.lineTo(-0.2, 1.04); ctx.lineTo(-0.08, 1.06); ctx.lineTo(0.0, 0.81); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.05, 0.79); ctx.lineTo(0.18, 1.03); ctx.lineTo(0.29, 1.0); ctx.lineTo(0.09, 0.77); ctx.closePath(); ctx.fill(); ctx.stroke();
}

function drawHeadband(ctx) {
  ctx.save();
  hamsterPath(ctx); ctx.clip();
  ctx.fillStyle = '#e53935'; ctx.fillRect(-1.1, -0.8, 2.2, 0.16);
  ctx.strokeStyle = '#a31515'; ctx.lineWidth = 0.035;
  ctx.beginPath(); ctx.moveTo(-1, -0.8); ctx.lineTo(1, -0.8); ctx.moveTo(-1, -0.64); ctx.lineTo(1, -0.64); ctx.stroke();
  ctx.restore();
  circ(ctx, 0, -0.72, 0.09); ctx.fillStyle = '#fff'; ctx.fill();
  circ(ctx, 0, -0.72, 0.045); ctx.fillStyle = '#e53935'; ctx.fill();
  circ(ctx, 0.78, -0.72, 0.085); ctx.fillStyle = '#e53935'; ctx.fill(); ctx.strokeStyle = '#a31515'; ctx.lineWidth = 0.035; ctx.stroke();
}

function drawHeadbandTails(ctx, t) {
  ctx.fillStyle = '#e53935'; ctx.strokeStyle = '#a31515'; ctx.lineWidth = 0.035;
  for (const k of [0, 1]) {
    const w = Math.sin(t * 9 + k * 1.7) * 0.12;
    ctx.beginPath();
    ctx.moveTo(0.75, -0.77 + k * 0.05);
    ctx.quadraticCurveTo(1.15, -0.82 + k * 0.25 + w, 1.5, -0.67 + k * 0.4 + w * 1.5);
    ctx.lineTo(1.48, -0.55 + k * 0.4 + w * 1.5);
    ctx.quadraticCurveTo(1.1, -0.67 + k * 0.25 + w, 0.75, -0.67 + k * 0.05);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

// ---------- bosses ----------
function drawBoss(ctx, boss, x, y, size, t, hurt) {
  ctx.save();
  ctx.translate(x, y);
  const bob = Math.sin(t * 2.5) * size * 0.03;
  ctx.translate(0, bob);
  // spooky aura
  const g = ctx.createRadialGradient(0, 0, size * 0.1, 0, 0, size * 0.65);
  g.addColorStop(0, 'rgba(255,60,60,0.35)'); g.addColorStop(1, 'rgba(255,60,60,0)');
  ctx.fillStyle = g; circ(ctx, 0, 0, size * 0.65); ctx.fill();
  if (hurt) ctx.globalAlpha = 0.6;
  if (boss.style === 'yeti') drawYeti(ctx, size, t);
  else {
    if (boss.style === 'kraken') ctx.filter = 'hue-rotate(250deg) saturate(1.6)';
    drawEmoji(ctx, boss.e, 0, 0, size * 0.75);
    ctx.filter = 'none';
    if (boss.style === 'queen' || boss.style === 'python') {
      ctx.save(); ctx.translate(0, -size * 0.34); ctx.scale(size * 0.22, size * 0.22); ctx.lineWidth = 0.06;
      ctx.translate(0, 0.95); ACC_DRAW.crown(ctx, t); ctx.restore();
    }
    if (boss.style === 'python') {
      ctx.save(); ctx.translate(size * 0.12, -size * 0.12); ctx.scale(size * 0.18, size * 0.18); ctx.lineWidth = 0.06;
      ctx.translate(-0.36, 0.15); ACC_DRAW.monocle(ctx); ctx.restore();
    }
    if (boss.style === 'kraken') {
      ctx.fillStyle = `rgba(120,255,140,${0.6 + Math.sin(t * 6) * 0.3})`;
      circ(ctx, -size * 0.1, -size * 0.06, size * 0.03); ctx.fill();
      circ(ctx, size * 0.1, -size * 0.06, size * 0.03); ctx.fill();
    }
  }
  ctx.restore();
}

function drawYeti(ctx, size, t) {
  const s = size / 2.6;
  ctx.save(); ctx.scale(s, s); ctx.lineWidth = 0.05;
  // fluffy body
  ctx.beginPath();
  for (let i = 0; i <= 28; i++) {
    const a = i / 28 * Math.PI * 2, r = 1.05 + (i % 2 ? 0.08 : 0);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 1.05 + 0.1);
  }
  ctx.closePath(); fillStroke(ctx, '#f4f8ff', '#9bb3d1');
  // arms
  for (const sx of [-1, 1]) {
    const sw = Math.sin(t * 3 + sx) * 0.1;
    ell(ctx, sx * 1.1, 0.35 + sw, 0.3, 0.5, sx * 0.3); fillStroke(ctx, '#eef4ff', '#9bb3d1');
  }
  // horns
  for (const sx of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(sx * 0.45, -0.75); ctx.quadraticCurveTo(sx * 0.9, -1.2, sx * 0.7, -1.35);
    ctx.quadraticCurveTo(sx * 0.65, -1.05, sx * 0.3, -0.85); ctx.closePath(); fillStroke(ctx, '#d6c3a3', '#8d7a5b');
  }
  // face
  ell(ctx, 0, -0.2, 0.62, 0.5); fillStroke(ctx, '#7fb3e0', '#4f7fae');
  for (const sx of [-1, 1]) {
    circ(ctx, sx * 0.24, -0.3, 0.1); ctx.fillStyle = '#fff'; ctx.fill();
    circ(ctx, sx * 0.24, -0.28, 0.055); ctx.fillStyle = '#111'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx * 0.42, -0.5); ctx.lineTo(sx * 0.1, -0.42); ctx.strokeStyle = '#1d3557'; ctx.lineWidth = 0.08; ctx.stroke();
  }
  ctx.lineWidth = 0.05;
  ctx.beginPath(); ctx.arc(0, 0.05, 0.25, Math.PI * 1.1, Math.PI * 1.9); ctx.strokeStyle = '#1d3557'; ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(-0.18, -0.12); ctx.lineTo(-0.12, 0.02); ctx.lineTo(-0.06, -0.12); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0.18, -0.12); ctx.lineTo(0.12, 0.02); ctx.lineTo(0.06, -0.12); ctx.fill();
  ctx.restore();
}
