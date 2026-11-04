// Los instrumentos de percusión, sintetizados como en el B-MOOG 7.
// En la 1.1 hay Kick, Snare y Hi-hat; los adicionales llegan en la 1.2.

import { audio } from './engine.js';

/**
 * Golpe de un instrumento.
 * @param {'kick'|'snare'|'hat'} id
 * @param {number} t  Tiempo de audio.
 * @param {number} v  Volumen 0 a 1.
 */
export function drumHit(id, t, v) {
  if (v <= 0) return;
  if (id === 'kick') kick(t, v);
  else if (id === 'snare') snare(t, v);
  else if (id === 'hat') hat(t, v);
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
