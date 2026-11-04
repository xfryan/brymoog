// Una voz de sinte: tres osciladores → filtro pasa bajos → envelope de volumen.
// La misma síntesis del B-MOOG 7, a partir del sonido del track.

import { audio } from './engine.js';

const CUT_MIN = 60;
const CUT_MAX = 12000;
/** Pico del Filter Contour, en cents: amount × 7200. */
const CONTOUR_CENTS = 7200;

/** Escala exponencial de un valor 0 a 1000 entre min y max. */
const expScale = (v, min, max) => min * Math.pow(max / min, v / 1000);

/** Hertz del semitono n; 0 es C3. */
export const noteHz = (n) => 130.81 * Math.pow(2, n / 12);

/** Convierte un sonido (valores de 0 a 1000) a segundos y hertz. */
export function soundTimes(s) {
  return {
    cutoff: expScale(s.cut, CUT_MIN, CUT_MAX),
    attack: expScale(s.atk, 0.002, 3),
    decay: expScale(s.dec, 0.01, 3),
    sustain: s.sus / 100,
    release: expScale(s.rel, 0.01, 4),
    contour: s.famt / 100,
    contourAttack: expScale(s.fatk, 0.002, 3),
    contourDecay: expScale(s.fdec, 0.01, 3),
    contourSustain: s.fsus / 100,
  };
}

// Corta lo programado en un parámetro y lo deja en su valor actual.
function holdAt(param, t) {
  if (param.cancelAndHoldAtTime) {
    param.cancelAndHoldAtTime(t);
  } else {
    const v = param.value;
    param.cancelScheduledValues(t);
    param.setValueAtTime(v, t);
  }
}

/**
 * Empieza a sonar una nota.
 * @param {import('../state/sounds.js').Sound} sound
 * @param {number} note   Semitono (0 = C3).
 * @param {number} time   Tiempo de audio en que empieza.
 * @param {number} level  Volumen 0 a 10 (el del track, ya multiplicado por la velocidad).
 * @param {AudioNode} dest
 */
export function startVoice(sound, note, time, level, dest) {
  const ctx = audio.ctx;
  const p = soundTimes(sound);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = p.cutoff;
  filter.Q.value = sound.res;
  const peak = p.contour * CONTOUR_CENTS;
  filter.detune.setValueAtTime(0, time);
  filter.detune.linearRampToValueAtTime(peak, time + p.contourAttack);
  filter.detune.linearRampToValueAtTime(peak * p.contourSustain, time + p.contourAttack + p.contourDecay);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, time);
  env.gain.linearRampToValueAtTime(1, time + p.attack);
  env.gain.linearRampToValueAtTime(Math.max(p.sustain, 0.0001), time + p.attack + p.decay);

  const out = ctx.createGain();
  out.gain.value = level / 10;
  filter.connect(env).connect(out).connect(dest);

  const oscillators = sound.osc.map((o) => {
    const osc = ctx.createOscillator();
    if (o.wave === 'pulse') osc.setPeriodicWave(audio.pulse);
    else osc.type = o.wave;
    osc.frequency.value = noteHz(note) * Math.pow(2, o.oct);
    osc.detune.value = o.cents;
    const mix = ctx.createGain();
    mix.gain.value = o.on ? (o.vol / 10) * 0.22 : 0;
    osc.connect(mix).connect(filter);
    osc.start(time);
    return osc;
  });

  let done = false;
  return {
    /** Suelta la nota: suena el Release y se apaga. */
    release(t) {
      if (done) return;
      done = true;
      holdAt(env.gain, t);
      holdAt(filter.detune, t);
      filter.detune.linearRampToValueAtTime(0, t + p.release);
      env.gain.linearRampToValueAtTime(0, t + p.release);
      oscillators.forEach((o) => { try { o.stop(t + p.release + 0.05); } catch { /* ya detenido */ } });
    },
    /** Corta la nota de inmediato. */
    kill() {
      done = true;
      const t = ctx.currentTime;
      holdAt(env.gain, t);
      env.gain.linearRampToValueAtTime(0, t + 0.01);
      oscillators.forEach((o) => { try { o.stop(t + 0.03); } catch { /* ya detenido */ } });
    },
    /** Se llama cuando la voz terminó de sonar. */
    set onended(fn) { oscillators[0].onended = fn; },
  };
}
