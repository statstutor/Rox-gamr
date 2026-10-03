// Dig, Hamster, Dig! - procedural music + sound effects (Web Audio, no files needed)
'use strict';

const Sound = (() => {
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    harm: [0, 2, 3, 5, 7, 8, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixo: [0, 2, 4, 5, 7, 9, 10],
  };

  // Melody tokens: one token per step. number = scale degree (1-based),
  // ^ = octave up, _ = octave down, "." = hold, "-" = rest.
  const SONGS = {
    menu: {
      bpm: 116, root: 60, scale: 'major', spb: 16, chords: [0, 4, 5, 3],
      mels: [{ inst: 'square', vol: 0.13, oct: 1, bars: [
        '1 . 3 . 5 . 3 . 6 . 5 . 3 . 1 .',
        '2 . 5_ . 7_ . 2 . 5 . 4 . 2 . - .',
        '3 . 1 . 6_ . 1 . 3 . 5 . 6 . 5 .',
        '4 . 6 . 1^ . 6 . 5 . 4 . 3 . 2 .',
        '5 . . 5 6 . 5 . 3 . . 1 2 . 3 .',
        '2 . . 2 5 . . . 7_ . 2 . 5 . . .',
        '6 . . 5 6 . 1^ . 6 . 5 . 3 . . .',
        '4 . 3 . 2 . 4 . 2 . . . 1 . . .'] }],
      bass: { inst: 'tri', vol: 0.3, pat: 'x...x.o.x...x.o.' },
      arp: { inst: 'pluck', vol: 0.06, pat: '0.1.2.1.0.1.2.1.' },
      drums: { kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.' },
    },
    w0: { // Garden: bouncy & sunny
      bpm: 126, root: 55, scale: 'major', spb: 16, chords: [0, 3, 0, 4],
      mels: [{ inst: 'pluck', vol: 0.16, oct: 1, bars: [
        '1 . 2 3 . 5 . 3 . 2 1 . 5_ . . .',
        '4 . 6 . 1^ . 6 . 4 . 3 . 1 . . .',
        '3 . 5 . 6 5 3 . 2 . 3 . 1 . . .',
        '2 . . 7_ 5_ . 7_ . 2 . 5 . 7 . 5 .',
        '5 . . 3 5 . 1^ . 7 . 5 . 3 . . .',
        '6 . . 4 6 . 1^ . 6 . 4 . 1 . . .',
        '5 . 3 . 1 . 3 . 5 . 6 . 5 . 3 .',
        '2 . 3 . 2 . 7_ . 5_ . . . - . . .'] },
      { inst: 'tri', vol: 0.05, oct: 2, bars: [
        '- - - - - - - - - - - - 5 . 3 .', '- - - - - - - - - - - - 6 . 4 .',
        '- - - - - - - - - - - - 5 . 3 .', '- - - - - - - - - - - - 2 . 7_ .'] }],
      bass: { inst: 'tri', vol: 0.32, pat: 'x..xo...x..x5...' },
      arp: { inst: 'tri', vol: 0.05, pat: '..0...1...2...1.' },
      drums: { kick: 'x.......x..x....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    },
    w1: { // Jungle: marimba + bongos
      bpm: 134, root: 62, scale: 'mixo', spb: 16, chords: [0, 6, 3, 0],
      mels: [{ inst: 'marimba', vol: 0.22, oct: 1, bars: [
        '1 . 3 5 . 3 . 5 6 . 5 . 3 . 1 .',
        '7_ . 2 4 . 2 . 4 5 . 4 . 2 . 7_ .',
        '4 . 6 1^ . 6 . 1^ 2^ . 1^ . 6 . 4 .',
        '5 . 3 . 1 . 3 5 . . 5 6 5 . . .'] }],
      bass: { inst: 'sawbass', vol: 0.16, pat: 'x..x..x...x..5..' },
      arp: { inst: 'marimba', vol: 0.08, pat: '0.2.1.2.0.2.1.2.' },
      drums: { kick: 'x..x..x...x..x..', conga: '..x..x....x.x..x', tom: '......x.....x.x.', shaker: 'xxxxxxxxxxxxxxxx', clap: '....x.......x...' },
    },
    w2: { // Snow: twinkly waltz
      bpm: 104, root: 65, scale: 'major', spb: 12, chords: [0, 5, 3, 4],
      mels: [{ inst: 'bell', vol: 0.16, oct: 1, bars: [
        '5 . . . 6 . 5 . 3 . . .',
        '1^ . . . 6 . . . 3 . . .',
        '4 . . . 6 . 1^ . 6 . 4 .',
        '5 . . . 2 . . . - . . .',
        '1 . . . 3 . 5 . 1^ . . .',
        '6 . . . 5 . 3 . 1 . . .',
        '4 . 6 . 1^ . . . 2^ . 1^ .',
        '7 . . . 5 . . . - . . .'] }],
      bass: { inst: 'tri', vol: 0.3, pat: 'x...5...5...' },
      arp: { inst: 'pad', vol: 0.05, pat: 'x...........' },
      drums: { kick: 'x...........', shaker: '..x.x.x.x.x.', hat: '....x...x...' },
    },
    w3: { // Moon: dreamy space
      bpm: 108, root: 64, scale: 'lydian', spb: 16, chords: [0, 1, 5, 1],
      mels: [{ inst: 'space', vol: 0.09, oct: 1, bars: [
        '5 . . . . . 3 . 1 . . . 2 . 3 .',
        '4 . . . . . 2 . 6 . . . 4 . . .',
        '6 . . . 1^ . . . 3^ . . . 1^ . 6 .',
        '4 . . . 2 . . . 6_ . . . - . . .'] }],
      bass: { inst: 'tri', vol: 0.3, pat: 'x.......x...o...' },
      arp: { inst: 'pluck', vol: 0.05, pat: '0123210301232103' },
      drums: { kick: 'x.......x.......', hat: '..x...x...x...x.', clap: '............x...' },
    },
    battle: { // creature battles: fast, driving E minor with a heroic counter-melody
      bpm: 152, root: 52, scale: 'minor', spb: 16, chords: [0, 5, 2, 6],
      mels: [{ inst: 'square', vol: 0.08, oct: 1, bars: [
        '1 . 3 5 1^ . 5 3 1 . 3 5 7 . 5 .',
        '6_ . 1 3 6 . 3 1 6_ . 1 3 5 . 3 .',
        '3 . 5 7 3^ . 7 5 3 . 5 7 2^ . 7 .',
        '7_ . 2 4 7 . 4 2 7_ . 2 4 6 . 5 .'] },
      { inst: 'supersaw', vol: 0.07, oct: 1, bars: [
        '5 . . . . . . . 4 . . . 3 . . .',
        '3 . . . . . . . 1 . . . 6_ . . .',
        '5 . . . . . . . 3 . . . 2 . . .',
        '4 . . . . . . . 2 . . . 7_ . . .'] }],
      bass: { inst: 'sawbass', vol: 0.18, pat: 'x.x.xoxox.x.xoxo' },
      drums: { kick: 'x..xx..xx..xx.x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', crash: 'x...............' },
      crashEvery: 4,
    },
    boss: { // INTENSE: harmonic minor, driving bass, power stabs, heavy drums
      bpm: 168, root: 57, scale: 'harm', spb: 16, chords: [0, 5, 3, 4],
      mels: [{ inst: 'supersaw', vol: 0.09, oct: 1, bars: [
        '1^ . 7 . 1^ . 3^ . 2^ . 1^ . 7 . 5 .',
        '6 . 5 . 6 . 1^ . 6 . 5 . 4 . 3 .',
        '4 . 6 . 1^ . 4^ . 3^ . 2^ . 1^ . 6 .',
        '5 . 7 . 2^ . 5 . 7 . 2^ . 4^ . 3^ .',
        '1 1 3 1 5 1 3 1 7 1 5 1 3 2 1 7_',
        '6_ 6_ 1 6_ 3 6_ 1 6_ 4 3 1 6_ 1 3 4 5',
        '4 4 6 4 1^ 4 6 4 2^ 1^ 6 4 6 1^ 2^ 3^',
        '5 . 7_ . 2 . 5 . 7 . 2^ . 5^ . . .'] }],
      bass: { inst: 'sawbass', vol: 0.2, pat: 'xxoxxxoxxxoxxoxo' },
      stab: { inst: 'square', vol: 0.05, pat: 'x.....x.....x...' },
      drums: { kick: 'x...x...x...x.x.', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx', crash: 'x...............' },
      crashEvery: 4,
    },
  };

  let ctx = null, master, musicBus, sfxBus, noiseBuf, delayIn;
  let musicOn = true;
  let song = null, songName = null, step = 0, nextTime = 0, timer = null;

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.55 : 0; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    // echo for spacey / bell sounds
    delayIn = ctx.createGain(); delayIn.gain.value = 0.35;
    const dl = ctx.createDelay(1); dl.delayTime.value = 0.33;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    delayIn.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(musicBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (songName) startSong(songName);
  }

  function compileMel(m, s) {
    const sc = SCALES[s.scale];
    const toks = m.bars.join(' ').trim().split(/\s+/);
    const ev = new Array(toks.length).fill(null);
    toks.forEach((tk, i) => {
      if (tk === '.' || tk === '-') return;
      let oct = m.oct || 0;
      for (const ch of tk) { if (ch === '^') oct++; if (ch === '_') oct--; }
      const deg = parseInt(tk, 10) - 1;
      const midi = s.root + 12 * (oct + Math.floor(deg / sc.length)) + sc[((deg % sc.length) + sc.length) % sc.length];
      let len = 1;
      while (i + len < toks.length && toks[i + len] === '.') len++;
      ev[i] = { midi, len };
    });
    return ev;
  }

  function chordTones(s, c) {
    const sc = SCALES[s.scale];
    const deg = i => s.root + 12 * Math.floor(i / sc.length) + sc[i % sc.length];
    return [deg(c), deg(c + 2), deg(c + 4), deg(c) + 12];
  }

  function startSong(name) {
    if (timer) clearInterval(timer);
    timer = null;
    song = SONGS[name];
    if (!song || !ctx) return;
    song._mels = song.mels.map(m => compileMel(m, song));
    step = 0;
    nextTime = ctx.currentTime + 0.08;
    timer = setInterval(tick, 25);
  }

  function play(name) {
    if (name === songName && timer) return;
    songName = name;
    if (ctx) startSong(name);
  }

  function stop() { songName = null; if (timer) clearInterval(timer); timer = null; }

  function tick() {
    if (!song) return;
    const sd = 60 / song.bpm / 4;
    while (nextTime < ctx.currentTime + 0.15) {
      if (musicOn) scheduleStep(step, nextTime, sd);
      nextTime += sd; step++;
    }
  }

  function scheduleStep(s, t, sd) {
    const spb = song.spb, bar = Math.floor(s / spb), pos = s % spb;
    const chord = chordTones(song, song.chords[bar % song.chords.length]);
    song._mels.forEach((ev, mi) => {
      const e = ev[s % ev.length];
      if (e) voice(song.mels[mi].inst, e.midi, e.len * sd * 0.95, t, song.mels[mi].vol);
    });
    if (song.bass) {
      const c = song.bass.pat[pos % song.bass.pat.length];
      const r = chord[0] - 24;
      const m = { x: r, o: r + 12, 5: chord[2] - 24, 3: chord[1] - 24 }[c];
      if (m !== undefined) voice(song.bass.inst, m, sd * 1.6, t, song.bass.vol);
    }
    if (song.arp) {
      const c = song.arp.pat[pos % song.arp.pat.length];
      if (c === 'x') chord.slice(0, 3).forEach(m => voice(song.arp.inst, m, sd * spb * 0.95, t, song.arp.vol));
      else if (c >= '0' && c <= '3') voice(song.arp.inst, chord[+c] + 12, sd * 1.5, t, song.arp.vol);
    }
    if (song.stab && song.stab.pat[pos] === 'x') {
      [chord[0], chord[2], chord[3]].forEach(m => voice(song.stab.inst, m, sd * 2.5, t, song.stab.vol));
    }
    for (const k in song.drums) {
      if (k === 'crash' && bar % (song.crashEvery || 1) !== 0) continue;
      if (song.drums[k][pos % song.drums[k].length] === 'x') drum(k, t, musicBus);
    }
  }

  function env(g, t, vol, a, hold, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.setValueAtTime(vol, t + Math.max(a, hold));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a, hold) + rel);
    return t + Math.max(a, hold) + rel + 0.02;
  }

  function osc(type, f, t, end, dest, detune = 0) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    o.connect(dest); o.start(t); o.stop(end);
    return o;
  }

  function voice(inst, midi, dur, t, vol, dest = musicBus) {
    if (!ctx) return;
    const f = mtof(midi);
    const g = ctx.createGain(); g.connect(dest);
    let end;
    switch (inst) {
      case 'square': {
        const lp = ctx.createBiquadFilter(); lp.frequency.value = 2600; lp.connect(g);
        end = env(g, t, vol, 0.01, dur * 0.8, 0.08); osc('square', f, t, end, lp); break;
      }
      case 'tri': end = env(g, t, vol, 0.01, dur * 0.85, 0.06); osc('triangle', f, t, end, g); break;
      case 'pluck': {
        end = env(g, t, vol, 0.005, 0.01, Math.min(0.45, dur + 0.15));
        osc('triangle', f, t, end, g);
        const g2 = ctx.createGain(); g2.gain.value = 0.35; g2.connect(g); osc('square', f, t, end, g2);
        break;
      }
      case 'marimba': {
        end = env(g, t, vol, 0.004, 0.01, 0.32);
        osc('sine', f, t, end, g);
        const g2 = ctx.createGain(); g2.gain.value = 0.25; g2.connect(g); osc('sine', f * 4, t, t + 0.08, g2);
        break;
      }
      case 'bell': {
        end = env(g, t, vol, 0.004, 0.02, 1.4);
        osc('sine', f, t, end, g);
        const g2 = ctx.createGain(); g2.gain.value = 0.3; g2.connect(g); osc('sine', f * 2, t, end, g2);
        const g3 = ctx.createGain(); g3.gain.value = 0.12; g3.connect(g); osc('sine', f * 3.01, t, end, g3);
        g.connect(delayIn);
        break;
      }
      case 'space': {
        const lp = ctx.createBiquadFilter(); lp.frequency.value = 1400; lp.connect(g);
        end = env(g, t, vol, 0.06, dur * 0.8, 0.4);
        osc('sawtooth', f, t, end, lp, -7); osc('sawtooth', f, t, end, lp, 7);
        g.connect(delayIn);
        break;
      }
      case 'supersaw': {
        const lp = ctx.createBiquadFilter(); lp.frequency.value = 3200; lp.Q.value = 2; lp.connect(g);
        end = env(g, t, vol, 0.01, dur * 0.85, 0.08);
        [-12, 0, 12].forEach(d => osc('sawtooth', f, t, end, lp, d));
        break;
      }
      case 'sawbass': {
        const lp = ctx.createBiquadFilter(); lp.Q.value = 6;
        lp.frequency.setValueAtTime(1600, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.15);
        lp.connect(g);
        end = env(g, t, vol, 0.005, dur * 0.6, 0.06);
        osc('sawtooth', f, t, end, lp);
        break;
      }
      case 'pad': {
        end = env(g, t, vol, 0.25, dur * 0.7, 0.5);
        osc('triangle', f, t, end, g, -6); osc('triangle', f, t, end, g, 6);
        g.connect(delayIn);
        break;
      }
      default: end = env(g, t, vol, 0.01, dur, 0.05); osc('sine', f, t, end, g);
    }
  }

  function noise(t, dur, type, freq, vol, dest, q = 1) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t); src.stop(t + dur + 0.02);
  }

  function drum(k, t, dest) {
    switch (k) {
      case 'kick': {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.3); break;
      }
      case 'snare': noise(t, 0.16, 'bandpass', 1900, 0.5, dest, 0.8); voice('tri', 50, 0.05, t, 0.2, dest); break;
      case 'hat': noise(t, 0.04, 'highpass', 7500, 0.18, dest); break;
      case 'shaker': noise(t, 0.06, 'bandpass', 6500, 0.12, dest, 1.5); break;
      case 'clap': [0, 0.012, 0.024].forEach(d => noise(t + d, 0.09, 'bandpass', 1400, 0.3, dest, 1.2)); break;
      case 'crash': noise(t, 1.2, 'highpass', 4000, 0.22, dest); break;
      case 'tom': case 'conga': {
        const hi = k === 'conga';
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(hi ? 380 : 210, t); o.frequency.exponentialRampToValueAtTime(hi ? 280 : 110, t + 0.15);
        g.gain.setValueAtTime(hi ? 0.35 : 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.22); break;
      }
    }
  }

  function seq(notes, inst, stepDur, vol) {
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.01;
    notes.forEach((m, i) => { if (m != null) voice(inst, m, stepDur * 0.9, t0 + i * stepDur, vol, sfxBus); });
  }

  function sfx(name) {
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    switch (name) {
      case 'dig': noise(t, 0.09, 'lowpass', 700 + Math.random() * 400, 0.25, sfxBus); break;
      case 'bump': voice('tri', 40, 0.06, t, 0.25, sfxBus); break;
      case 'pickup': seq([79, 84], 'square', 0.07, 0.12); break;
      case 'chest': seq([72, 76, 79, 84, 88], 'tri', 0.07, 0.2); break;
      case 'task': seq([72, 79, 84], 'square', 0.09, 0.12); break;
      case 'wave': seq([67, 72, 76, 79, 84, null, 84], 'square', 0.1, 0.12); break;
      case 'correct': seq([76, 84], 'tri', 0.12, 0.25); break;
      case 'wrong': voice('square', 46, 0.25, t, 0.12, sfxBus); voice('square', 45, 0.25, t + 0.02, 0.1, sfxBus); break;
      case 'hit': noise(t, 0.12, 'lowpass', 1800, 0.5, sfxBus); voice('tri', 45, 0.1, t, 0.3, sfxBus); break;
      case 'crit': noise(t, 0.2, 'bandpass', 2500, 0.5, sfxBus); seq([84, 91], 'square', 0.05, 0.12); break;
      case 'hurt': noise(t, 0.15, 'lowpass', 900, 0.4, sfxBus); voice('square', 50, 0.12, t, 0.1, sfxBus); break;
      case 'heal': seq([72, 76, 79, 83, 86], 'bell', 0.06, 0.12); break;
      case 'levelup': seq([60, 64, 67, 72, 67, 72, 76, 79, 84], 'square', 0.07, 0.13); break;
      case 'talk': seq([72 + Math.floor(Math.random() * 5), 76], 'tri', 0.05, 0.12); break;
      case 'miss': noise(t, 0.2, 'highpass', 3000, 0.15, sfxBus); break;
      case 'warn': seq([81, null, 81, null, 81], 'square', 0.08, 0.1); break;
      case 'victory': seq([72, 72, 72, 72, null, 68, null, 70, null, 72, null, 70, 72, null, null, null], 'square', 0.1, 0.14); break;
      case 'lightning': {
        // electric zaps: sawtooth with a fast wobbling pitch
        [0, 0.18, 0.3].forEach((d, i) => {
          const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
          o.type = 'sawtooth'; o.frequency.setValueAtTime(1800 - i * 400, t + d); o.frequency.exponentialRampToValueAtTime(120, t + d + 0.22);
          lfo.type = 'square'; lfo.frequency.value = 55 + i * 20; lg.gain.value = 600;
          lfo.connect(lg); lg.connect(o.frequency);
          g.gain.setValueAtTime(0.12, t + d); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.24);
          o.connect(g); g.connect(sfxBus);
          o.start(t + d); lfo.start(t + d); o.stop(t + d + 0.26); lfo.stop(t + d + 0.26);
        });
        // the CRACK: a few sharp crackles
        for (let i = 0; i < 6; i++) noise(t + 0.42 + i * 0.025 + Math.random() * 0.02, 0.05, 'highpass', 2500 + Math.random() * 3000, 0.45, sfxBus);
        noise(t + 0.42, 0.3, 'bandpass', 1200, 0.5, sfxBus, 0.7);
        // rolling thunder
        noise(t + 0.5, 1.8, 'lowpass', 220, 0.9, sfxBus);
        drum('kick', t + 0.44, sfxBus);
        break;
      }
      case 'transform': {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(1600, t + 1.8);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 2);
        o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 2.05);
        noise(t + 1.8, 1, 'highpass', 3000, 0.3, sfxBus);
        drum('kick', t + 1.8, sfxBus);
        break;
      }
    }
  }

  function setMusic(on) {
    musicOn = on;
    if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.05);
  }

  return { init, play, stop, sfx, setMusic, isMusicOn: () => musicOn, current: () => songName };
})();
