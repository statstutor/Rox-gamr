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

// ---------- the hamster (kawaii style: white body, coloured head patch + ears) ----------
// Unit coordinates: head top -1.0, bottom 1.06. Eyes sit at y = -0.32.
const HAM_LINE = '#5b1f1f';
function hamsterPath(ctx) {
  const R = [ // right half: [cp1x, cp1y, cp2x, cp2y, x, y]
    [0.56, -1.0, 1.02, -0.56, 1.02, 0.03], // evenly round top half
    [1.02, 0.6, 0.56, 1.06, 0, 1.06], // evenly round bottom half
  ];
  ctx.beginPath(); ctx.moveTo(0, -1.0);
  for (const c of R) ctx.bezierCurveTo(...c);
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
  const s = size / 2.3;
  const pink = '#f2a7a7';
  ctx.save();
  ctx.translate(x, y);
  if (o.tilt) ctx.rotate(o.tilt);
  const bob = o.bob ? Math.sin(t * 7) * 0.03 : 0;
  const sq = o.squash || 0;
  ctx.scale(s * (1 + sq), s * (1 - sq + bob));
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  if (o.shadow !== false) { ell(ctx, 0, 1.06, 0.85, 0.1); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fill(); }
  if (eq.back && ACC_DRAW[eq.back]) { ctx.lineWidth = 0.06; ACC_DRAW[eq.back](ctx, t); }
  if (o.karate) drawHeadbandTails(ctx, t);
  const pika = o.color === 'pikachu';

  ctx.lineWidth = 0.04;
  if (pika) {
    // lightning-bolt tail peeking out on the right
    const tw = Math.sin(t * 3) * 0.04;
    ctx.beginPath();
    [[0.7, 0.55], [1.1, 0.3 + tw], [0.98, 0.18 + tw], [1.38, -0.12 + tw], [1.24, -0.22 + tw], [1.62, -0.58 + tw],
      [1.22, -0.5 + tw], [1.36, -0.32 + tw], [0.98, -0.06 + tw], [1.1, 0.06 + tw], [0.72, 0.3]].forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
    ctx.closePath(); fillStroke(ctx, col.belly, HAM_LINE);
    // long pointy ears with black tips
    for (const sx of [-1, 1]) {
      ctx.save(); ctx.translate(sx * 0.42, -0.78); ctx.rotate(sx * 0.42);
      ctx.beginPath(); ctx.moveTo(-0.17, 0.05); ctx.quadraticCurveTo(-0.2, -0.5, 0, -0.85); ctx.quadraticCurveTo(0.2, -0.5, 0.17, 0.05); ctx.closePath();
      fillStroke(ctx, col.belly, HAM_LINE);
      ctx.save(); ctx.clip();
      ctx.fillStyle = '#2b1d16'; ctx.fillRect(-0.3, -0.9, 0.6, 0.32);
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(-0.17, 0.05); ctx.quadraticCurveTo(-0.2, -0.5, 0, -0.85); ctx.quadraticCurveTo(0.2, -0.5, 0.17, 0.05);
      ctx.strokeStyle = HAM_LINE; ctx.stroke();
      ctx.restore();
    }
  } else {
    // ears
    for (const sx of [-1, 1]) {
      circ(ctx, sx * 0.56, -0.8, 0.24); fillStroke(ctx, col.body, HAM_LINE);
      circ(ctx, sx * 0.6, -0.78, 0.14); fillStroke(ctx, pink);
    }
  }
  // body
  hamsterPath(ctx); ctx.fillStyle = col.belly; ctx.fill();
  ctx.save();
  hamsterPath(ctx); ctx.clip();
  // coloured patch over the top-left of the head (Pikachu has two back stripes peeking over the top instead)
  if (pika) {
    ctx.fillStyle = '#b8862a';
    ell(ctx, -0.2, -1.0, 0.16, 0.06, -0.15); ctx.fill();
    ell(ctx, 0.22, -0.99, 0.16, 0.06, 0.15); ctx.fill();
  } else {
  ctx.beginPath();
  ctx.moveTo(-1, -0.25);
  ctx.quadraticCurveTo(-0.55, -0.3, -0.38, -0.5);
  ctx.quadraticCurveTo(-0.2, -0.7, 0.02, -0.66);
  ctx.quadraticCurveTo(0.12, -0.85, 0.08, -1.1);
  ctx.lineTo(-1, -1.1); ctx.closePath();
  ctx.fillStyle = col.body; ctx.fill();
  }
  if (o.karate) drawGi(ctx, col, o.belt || '#222');
  ctx.restore();
  ctx.lineWidth = 0.04;
  hamsterPath(ctx); ctx.strokeStyle = HAM_LINE; ctx.stroke();

  // cheeks
  ctx.fillStyle = pika ? '#e8412f' : 'rgba(240,140,140,0.55)';
  for (const sx of [-1, 1]) { circ(ctx, sx * 0.55, -0.1, pika ? 0.15 : 0.17); ctx.fill(); }
  // eyes
  for (const sx of [-1, 1]) {
    const ex = sx * 0.36, ey = -0.32;
    if (o.blink) {
      ctx.beginPath(); ctx.moveTo(ex - 0.1, ey); ctx.quadraticCurveTo(ex, ey + 0.07, ex + 0.1, ey);
      ctx.strokeStyle = HAM_LINE; ctx.lineWidth = 0.045; ctx.stroke();
    } else {
      circ(ctx, ex, ey, 0.115); ctx.fillStyle = '#5a1414'; ctx.fill();
      circ(ctx, ex + 0.035, ey - 0.04, 0.042); ctx.fillStyle = '#fff'; ctx.fill();
    }
  }
  if (o.karate) {
    ctx.strokeStyle = HAM_LINE; ctx.lineWidth = 0.05;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 0.5, -0.52); ctx.lineTo(sx * 0.24, -0.47); ctx.stroke(); }
  }
  // nose + mouth
  ell(ctx, 0, -0.25, 0.045, 0.032); ctx.fillStyle = '#ef8f8f'; ctx.fill();
  ctx.strokeStyle = HAM_LINE; ctx.lineWidth = 0.028;
  ctx.beginPath(); ctx.arc(-0.045, -0.2, 0.045, 0.1 * Math.PI, 0.95 * Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.arc(0.045, -0.2, 0.045, 0.05 * Math.PI, 0.9 * Math.PI); ctx.stroke();
  // whiskers
  ctx.lineWidth = 0.022;
  for (const sx of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(sx * 0.62, -0.2); ctx.lineTo(sx * 1.14, -0.27); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx * 0.64, -0.08); ctx.lineTo(sx * 1.16, -0.04); ctx.stroke();
  }

  if (!o.karate && eq.neck && ACC_DRAW[eq.neck]) { ctx.lineWidth = 0.06; ACC_DRAW[eq.neck](ctx, t); }

  // tiny paws
  const p = o.punch || 0;
  ctx.lineWidth = 0.03;
  for (const sx of [-1, 1]) {
    const px = sx * 0.24 + (sx > 0 ? p * 0.5 : 0), py = 0.22 - (sx > 0 ? p * 0.3 : 0);
    ctx.beginPath(); ctx.ellipse(px, py, 0.085, 0.075, 0, Math.PI * 0.05, Math.PI * 0.95, true);
    ctx.closePath(); fillStroke(ctx, pink, HAM_LINE);
  }
  // round feet with toe beans
  for (const sx of [-1, 1]) {
    const fx = sx * 0.36, fy = 0.76;
    circ(ctx, fx, fy, 0.12); fillStroke(ctx, '#ffffff', HAM_LINE);
    ctx.lineWidth = 0.05; ctx.stroke(); ctx.lineWidth = 0.03;
    ell(ctx, fx, fy + 0.025, 0.06, 0.05); ctx.fillStyle = pink; ctx.fill();
    for (const dx of [-0.055, 0, 0.055]) { circ(ctx, fx + dx, fy - 0.06, 0.022); ctx.fill(); }
  }

  ctx.lineWidth = 0.06;
  if (!o.karate) {
    if (eq.face && ACC_DRAW[eq.face]) { ctx.save(); ctx.translate(0, -0.17); ACC_DRAW[eq.face](ctx, t); ctx.restore(); }
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
  circ(ctx, 0.7, -0.72, 0.085); ctx.fillStyle = '#e53935'; ctx.fill(); ctx.strokeStyle = '#a31515'; ctx.lineWidth = 0.035; ctx.stroke();
}

function drawHeadbandTails(ctx, t) {
  ctx.fillStyle = '#e53935'; ctx.strokeStyle = '#a31515'; ctx.lineWidth = 0.035;
  for (const k of [0, 1]) {
    const w = Math.sin(t * 9 + k * 1.7) * 0.12;
    ctx.beginPath();
    ctx.moveTo(0.68, -0.77 + k * 0.05);
    ctx.quadraticCurveTo(1.15, -0.82 + k * 0.25 + w, 1.5, -0.67 + k * 0.4 + w * 1.5);
    ctx.lineTo(1.48, -0.55 + k * 0.4 + w * 1.5);
    ctx.quadraticCurveTo(1.1, -0.67 + k * 0.25 + w, 0.68, -0.67 + k * 0.05);
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
