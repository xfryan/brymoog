// Los instrumentos de percusión, sintetizados como en el B-MOOG 7:
// Kick, Snare y Hi-hat, y los adicionales de EXTRA_DRUMS (state/song.js).

import { audio } from './engine.js';

/**
 * Golpe de un instrumento.
 * @param {string} id  kick, snare, hat o uno de los adicionales.
 * @param {number} t   Tiempo de audio.
 * @param {number} v   Volumen 0 a 1.
 */
export function drumHit(id, t, v) {
  if (v <= 0) return;
  const hit = HITS[id];
  if (hit) hit(t, v);
}

function kick(t, v) {
  const ctx = audio.ctx;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  o.connect(g).connect(audio.drumBus);
  o.start(t);
  o.stop(t + 0.5);
}

function snare(t, v) {
  const ctx = audio.ctx;
  // Ruido filtrado: el cuerpo de la caja.
  const n = ctx.createBufferSource();
  n.buffer = audio.noise;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1200;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(v * 0.8, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  n.connect(hp).connect(ng).connect(audio.drumBus);
  n.start(t);
  n.stop(t + 0.25);
  // Un tono corto: el golpe sobre el parche.
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.value = 185;
  g.gain.setValueAtTime(v * 0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o.connect(g).connect(audio.drumBus);
  o.start(t);
  o.stop(t + 0.12);
}

function hat(t, v) {
  const ctx = audio.ctx;
  const n = ctx.createBufferSource();
  n.buffer = audio.noise;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(v * 0.45, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  n.connect(hp).connect(g).connect(audio.drumBus);
  n.start(t);
  n.stop(t + 0.08);
}

// Piezas para armar los instrumentos adicionales.

/** Ruido filtrado que dura dur segundos; devuelve el filtro para conectarlo. */
function noise(t, dur, type, freq, q) {
  const ctx = audio.ctx;
  const n = ctx.createBufferSource();
  n.buffer = audio.noise;
  n.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  if (q) f.Q.value = q;
  n.connect(f);
  n.start(t);
  n.stop(t + dur);
  return f;
}

/** Envolvente de golpe: sube en 2 ms y cae en dec segundos, hacia la batería. */
function strike(t, peak, dec) {
  const g = audio.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.001, t + dec);
  g.connect(audio.drumBus);
  return g;
}

/** Un tono que baja de f0 a f1 (si hay f1). */
function tone(t, type, f0, f1, peak, dec) {
  const o = audio.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dec * 0.6);
  o.connect(strike(t, peak, dec));
  o.start(t);
  o.stop(t + dec + 0.02);
}

function clap(t, v) {
  // Tres palmadas muy seguidas y una cola.
  const f = noise(t, 0.3, 'bandpass', 1100, 1.2);
  const g = audio.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  for (const d of [0, 0.011, 0.022]) {
    g.gain.setValueAtTime(v * 0.9, t + d);
    g.gain.exponentialRampToValueAtTime(0.05, t + d + 0.009);
  }
  g.gain.setValueAtTime(v * 0.8, t + 0.033);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  f.connect(g).connect(audio.drumBus);
}

function cowbell(t, v) {
  const bp = audio.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 800;
  bp.Q.value = 3;
  bp.connect(strike(t, v * 0.9, 0.35));
  for (const freq of [540, 800]) {
    const o = audio.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    o.connect(bp);
    o.start(t);
    o.stop(t + 0.37);
  }
}

function crash(t, v) {
  noise(t, 1.6, 'highpass', 4500).connect(strike(t, v * 0.55, 1.5));
  noise(t, 0.4, 'bandpass', 9000, 0.8).connect(strike(t, v * 0.35, 0.35));
}

function openHat(t, v) {
  noise(t, 0.4, 'highpass', 7000).connect(strike(t, v * 0.45, 0.35));
}

function rim(t, v) {
  tone(t, 'triangle', 1700, 0, v * 0.6, 0.035);
  noise(t, 0.03, 'highpass', 3000).connect(strike(t, v * 0.45, 0.025));
}

function shaker(t, v) {
  const f = noise(t, 0.12, 'bandpass', 6500, 1.5);
  const g = audio.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(v * 0.5, t + 0.025);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  f.connect(g).connect(audio.drumBus);
}

const HITS = {
  kick, snare, hat, clap, cowbell, crash, rim, shaker,
  ohat: openHat,
  tomlo: (t, v) => tone(t, 'sine', 130, 85, v * 0.95, 0.45),
  tomhi: (t, v) => tone(t, 'sine', 230, 160, v * 0.85, 0.32),
};

/** Click del metrónomo; acentuado en el primer tiempo del compás. */
export function click(t, accent) {
  const ctx = audio.ctx;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = accent ? 1760 : 1100;
  g.gain.setValueAtTime(accent ? 0.35 : 0.22, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  o.connect(g).connect(audio.master);
  o.start(t);
  o.stop(t + 0.06);
}
