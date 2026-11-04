// AudioContext y buses de volumen.
//
//   master ← live (lo que se toca en vivo)
//          ← tracksBus (lo grabado, TRACKS VOL) → pasa por live
//          ← drumBus (el ritmo, DRUMS VOL)
//
// El contexto se crea con el primer gesto de la persona (un navegador no deja sonar antes).

export const audio = {
  /** @type {AudioContext|null} */ ctx: null,
  master: null,
  live: null,
  tracksBus: null,
  drumBus: null,
  /** Un segundo de ruido blanco, para la caja y el platillo. */ noise: null,
  /** Onda de pulso para los osciladores en Pulse. */ pulse: null,
};

// Niveles pedidos antes de que exista el contexto.
const levels = { master: 40, drums: 8, tracks: 8 };

export function ensureAudio() {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return audio.ctx;
  }
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  audio.ctx = ctx;

  audio.master = ctx.createGain();
  audio.master.connect(ctx.destination);

  audio.live = ctx.createGain();
  audio.live.gain.value = 0.6;
  audio.live.connect(audio.master);

  audio.tracksBus = ctx.createGain();
  audio.tracksBus.connect(audio.live);

  audio.drumBus = ctx.createGain();
  audio.drumBus.connect(audio.master);

  audio.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = audio.noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const N = 64, duty = 0.2;
  const re = new Float32Array(N), im = new Float32Array(N);
  for (let k = 1; k < N; k++) re[k] = (2 * Math.sin(Math.PI * k * duty)) / (Math.PI * k);
  audio.pulse = ctx.createPeriodicWave(re, im);

  setMasterVolume(levels.master);
  setDrumsVolume(levels.drums);
  setTracksVolume(levels.tracks);
  return ctx;
}

const setGain = (node, v) => {
  if (node) node.gain.setTargetAtTime(v, audio.ctx.currentTime, 0.02);
};

/** MASTER VOLUME, 0 a 100. */
export function setMasterVolume(v) {
  levels.master = v;
  setGain(audio.master, (v / 100) * 0.5);
}

/** DRUMS VOL, 0 a 10. */
export function setDrumsVolume(v) {
  levels.drums = v;
  setGain(audio.drumBus, v / 8);
}

/** TRACKS VOL, 0 a 10. */
export function setTracksVolume(v) {
  levels.tracks = v;
  setGain(audio.tracksBus, v / 8);
}
