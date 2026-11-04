// Sonidos de fábrica, los mismos del B-MOOG 7. En la 1.1 no se pueden cambiar;
// el editor de sonido llega en la 1.2.
//
// Los valores de tiempo y de corte van de 0 a 1000 y se convierten a segundos
// o hertz con una escala exponencial (ver audio/voice.js), igual que los sliders del 7.

/**
 * @typedef {object} Oscillator
 * @property {number} oct    Octava respecto de la nota tocada (-8 a 2).
 * @property {'triangle'|'sawtooth'|'square'|'pulse'} wave
 * @property {number} cents  Desafinación en cents.
 * @property {number} vol    Volumen en el mixer, 0 a 10.
 * @property {boolean} on    Encendido en el mixer.
 */

/**
 * @typedef {object} Sound
 * @property {number} cut   Cutoff (corte), 0 a 1000.
 * @property {number} res   Emphasis (resonancia), valor Q del filtro.
 * @property {number} atk   Attack (ataque), 0 a 1000.
 * @property {number} dec   Decay (caída), 0 a 1000.
 * @property {number} sus   Sustain (sostenido), 0 a 100.
 * @property {number} rel   Release (liberación), 0 a 1000.
 * @property {number} famt  Filter Contour: cuánto abre el filtro, 0 a 100.
 * @property {number} fatk  Filter Contour: ataque, 0 a 1000.
 * @property {number} fdec  Filter Contour: caída, 0 a 1000.
 * @property {number} fsus  Filter Contour: sostenido, 0 a 100.
 * @property {Oscillator[]} osc  Los tres osciladores.
 */

/** @type {{bass: Sound, lead: Sound}} */
export const FACTORY_SOUNDS = {
  bass: {
    cut: 330, res: 3, atk: 10, dec: 400, sus: 60, rel: 250,
    famt: 30, fatk: 60, fdec: 380, fsus: 20,
    osc: [
      { oct: -1, wave: 'sawtooth', cents: 0, vol: 8, on: true },
      { oct: -1, wave: 'square', cents: 6, vol: 6, on: true },
      { oct: -2, wave: 'square', cents: 0, vol: 5, on: false },
    ],
  },
  lead: {
    cut: 480, res: 5, atk: 50, dec: 400, sus: 70, rel: 400,
    famt: 45, fatk: 150, fdec: 500, fsus: 35,
    osc: [
      { oct: 0, wave: 'sawtooth', cents: 0, vol: 8, on: true },
      { oct: 0, wave: 'sawtooth', cents: 8, vol: 7, on: true },
      { oct: 1, wave: 'triangle', cents: 0, vol: 5, on: false },
    ],
  },
};

/** Copia profunda de un sonido, para que cada track tenga el suyo. */
export function copySound(sound) {
  return { ...sound, osc: sound.osc.map((o) => ({ ...o })) };
}
