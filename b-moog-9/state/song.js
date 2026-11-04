// La canción: un solo objeto con todo lo que se guarda en el archivo.
// La pantalla se dibuja a partir de este objeto; nadie lo cambia directo,
// todo cambio pasa por state/actions.js.

import { FACTORY_SOUNDS, copySound } from './sounds.js';

export const APP = 'B-MOOG 9';
export const FORMAT = 1;

/** Compases posibles. n: pasos por compás, grp: pasos por pulso, div: pasos por negra. */
export const METERS = [
  { label: '4/4', n: 16, grp: 4, div: 4 },
  { label: '3/4', n: 12, grp: 4, div: 4 },
  { label: '12/8', n: 12, grp: 3, div: 3 },
];

/** Largo posible del loop, en compases. */
export const LOOPS = [1, 2, 4];

/** Los pasos de la batería se guardan siempre en 16 posiciones; cada compás usa las primeras n. */
export const DRUM_STEPS = 16;

export const DRUMS = [
  { id: 'kick', name: 'Kick', es: 'bombo', vol: 8 },
  { id: 'snare', name: 'Snare', es: 'caja', vol: 7 },
  { id: 'hat', name: 'Hi-hat', es: 'platillo cerrado', vol: 5 },
];

const EIGHTHS = [0, 2, 4, 6, 8, 10, 12, 14];

/** Ritmos predefinidos, los mismos del B-MOOG 7. meter es el índice en METERS. */
export const PRESETS = [
  { name: 'Rock', meter: 0, tempo: 110, kick: [0, 8, 10], snare: [4, 12], hat: EIGHTHS },
  { name: 'Pop/Disco', meter: 0, tempo: 120, kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] },
  { name: 'Funk', meter: 0, tempo: 100, kick: [0, 3, 7, 10], snare: [4, 12], hat: [...Array(16).keys()] },
  { name: 'Hip-hop', meter: 0, tempo: 90, kick: [0, 7, 10], snare: [4, 12], hat: EIGHTHS },
  { name: 'Reggaetón', meter: 0, tempo: 95, kick: [0, 4, 8, 12], snare: [3, 6, 11, 14], hat: EIGHTHS },
  { name: 'Vals', meter: 1, tempo: 120, kick: [0], snare: [4, 8], hat: [0, 4, 8] },
  { name: 'Blues', meter: 2, tempo: 80, kick: [0, 6], snare: [3, 9], hat: [0, 2, 3, 5, 6, 8, 9, 11] },
];

export const DEFAULT_PRESET = 1; // Pop/Disco
export const CUSTOM_PRESET = -1;
export const TEMPO_MIN = 60;
export const TEMPO_MAX = 180;

/**
 * Una nota grabada. Las posiciones se miden en pasos desde el inicio del loop.
 * @typedef {object} Note
 * @property {number} n   Semitono: 0 es C3 (nota MIDI 48). Va de -48 a 79.
 * @property {number} st  Paso donde empieza.
 * @property {number} du  Duración en pasos.
 */

/**
 * @typedef {object} DrumRow
 * @property {string} id      kick, snare o hat.
 * @property {number} vol     0 a 10.
 * @property {boolean[]} steps 16 pasos.
 */

/**
 * El track de Ritmo: define el tempo, el compás y el loop de toda la canción.
 * @typedef {object} RhythmTrack
 * @property {'rhythm'} type
 * @property {string} id
 * @property {string} name
 * @property {number} vol      DRUMS VOL, 0 a 10.
 * @property {boolean} mute
 * @property {number} tempo    BPM.
 * @property {number} meter    Índice en METERS.
 * @property {number} loop     Compases: 1, 2 o 4.
 * @property {number} preset   Índice en PRESETS, o -1 si se editó a mano.
 * @property {DrumRow[]} rows
 */

/**
 * Un track de notas (Bajo o Melodía).
 * @typedef {object} NoteTrack
 * @property {'bass'|'lead'} type
 * @property {string} id
 * @property {string} name
 * @property {number} vol   0 a 10.
 * @property {boolean} mute
 * @property {Note[]} notes
 * @property {import('./sounds.js').Sound} sound
 */

/**
 * @typedef {object} Song
 * @property {string} app      Siempre "B-MOOG 9".
 * @property {number} format   Versión del formato del archivo.
 * @property {string} name
 * @property {{tracks: number}} mix  TRACKS VOL, 0 a 10.
 * @property {[RhythmTrack, ...NoteTrack[]]} tracks  El primero es siempre el Ritmo.
 */

/** @returns {RhythmTrack} */
export function createRhythmTrack() {
  const track = {
    type: 'rhythm', id: 'rhythm', name: 'Ritmo', vol: 8, mute: false,
    tempo: 120, meter: 0, loop: 1, preset: DEFAULT_PRESET,
    rows: DRUMS.map((d) => ({ id: d.id, vol: d.vol, steps: Array(DRUM_STEPS).fill(false) })),
  };
  applyPreset(track, DEFAULT_PRESET);
  return track;
}

/** @returns {NoteTrack} */
export function createNoteTrack(type) {
  return {
    type, id: type, name: type === 'bass' ? 'Bajo' : 'Melodía',
    vol: 8, mute: false, notes: [], sound: copySound(FACTORY_SOUNDS[type]),
  };
}

/** @returns {Song} */
export function createSong() {
  return {
    app: APP,
    format: FORMAT,
    name: 'Canción sin título',
    mix: { tracks: 8 },
    tracks: [createRhythmTrack(), createNoteTrack('bass'), createNoteTrack('lead')],
  };
}

/** Pone en el track de Ritmo los pasos, el compás y el tempo de un ritmo predefinido. */
export function applyPreset(rhythm, index) {
  const p = PRESETS[index];
  rhythm.preset = index;
  rhythm.meter = p.meter;
  rhythm.tempo = p.tempo;
  for (const row of rhythm.rows) {
    const hits = p[row.id] || [];
    row.steps = Array.from({ length: DRUM_STEPS }, (_, i) => hits.includes(i));
  }
}

/** @returns {RhythmTrack} */
export const rhythmOf = (song) => song.tracks[0];

/** @returns {NoteTrack[]} */
export const noteTracks = (song) => song.tracks.slice(1);

export const trackById = (song, id) => song.tracks.find((t) => t.id === id);

export const meterOf = (song) => METERS[rhythmOf(song).meter];

/** Largo del loop en pasos. */
export const loopSteps = (song) => rhythmOf(song).loop * meterOf(song).n;

/** Duración de un paso en segundos. */
export const stepDuration = (song) => 60 / rhythmOf(song).tempo / meterOf(song).div;

/** ¿Hay algún track de notas con notas? Sirve para avisar antes de cambiar el compás. */
export const hasNotes = (song) => noteTracks(song).some((t) => t.notes.length > 0);

/** ¿La batería suena en algún paso del compás? */
export function drumsAudible(song) {
  const r = rhythmOf(song);
  const n = meterOf(song).n;
  return !r.mute && r.vol > 0 && r.rows.some((row) => row.vol > 0 && row.steps.slice(0, n).some(Boolean));
}
