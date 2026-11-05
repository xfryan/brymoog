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

/**
 * Los pasos de la batería se guardan en 4 compases de 16 posiciones cada uno (64 en total).
 * Cada compás usa sus primeras n posiciones según el Meter, y suenan los compases del Loop.
 * Al bajar el Loop, los compases de más quedan guardados aunque no suenen.
 */
export const BAR_STEPS = 16;
export const MAX_BARS = 4;
export const DRUM_STEPS = BAR_STEPS * MAX_BARS;

/** Posición en los pasos guardados de un paso dentro de un compás. */
export const drumIndex = (bar, step) => bar * BAR_STEPS + step;

/** Los tres instrumentos base del Ritmo: siempre están y no se quitan. */
export const DRUMS = [
  { id: 'kick', name: 'Kick', es: 'bombo', vol: 8 },
  { id: 'snare', name: 'Snare', es: 'caja', vol: 7 },
  { id: 'hat', name: 'Hi-hat', es: 'platillo cerrado', vol: 5 },
];

/** Instrumentos de percusión adicionales, los mismos del B-MOOG 7. Se pueden repetir. */
export const EXTRA_DRUMS = [
  { id: 'clap', name: 'Clap', es: 'palmas', vol: 6 },
  { id: 'cowbell', name: 'Cowbell', es: 'cencerro', vol: 5 },
  { id: 'crash', name: 'Crash', es: 'platillo de choque', vol: 5 },
  { id: 'ohat', name: 'Open hi-hat', es: 'platillo abierto', vol: 5 },
  { id: 'tomlo', name: 'Tom grave', es: 'timbal grave', vol: 7 },
  { id: 'tomhi', name: 'Tom agudo', es: 'timbal agudo', vol: 7 },
  { id: 'rim', name: 'Rimshot', es: 'golpe al aro', vol: 6 },
  { id: 'shaker', name: 'Shaker', es: 'maracas', vol: 5 },
];

/** Filas de batería como máximo: las 3 base más 9 adicionales. */
export const MAX_DRUM_ROWS = 12;

/** Datos de un instrumento (base o adicional) por su id. */
export const drumInfo = (id) => DRUMS.find((d) => d.id === id) || EXTRA_DRUMS.find((d) => d.id === id);

/** Tracks como máximo, contando el Ritmo. */
export const MAX_TRACKS = 8;

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
 * Una fila de la batería. Las 3 primeras son Kick, Snare y Hi-hat; las demás, adicionales.
 * @typedef {object} DrumRow
 * @property {string} id      Instrumento: kick, snare, hat o uno de EXTRA_DRUMS.
 * @property {string} name    Nombre en pantalla; los repetidos llevan número ("Cowbell 2").
 * @property {number} vol     0 a 10.
 * @property {boolean[]} steps 64 pasos: 4 compases de 16 (ver drumIndex).
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
 * Un track de notas, de tipo Bajo o Melodía. Los tracks con id 'bass' y 'lead' son los fijos:
 * se pueden renombrar pero no borrar. Los que se suman tienen otro id ('bass2', 'lead3'...).
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
    rows: DRUMS.map((d) => createDrumRow(d.id, d.name)),
  };
  applyPreset(track, DEFAULT_PRESET);
  return track;
}

/** @returns {DrumRow} */
export function createDrumRow(id, name) {
  return { id, name, vol: drumInfo(id).vol, steps: Array(DRUM_STEPS).fill(false) };
}

/** Nombre para un instrumento nuevo: "Cowbell", y si ya hay, "Cowbell 2", "Cowbell 3"... */
export function drumRowName(rhythm, id) {
  const base = drumInfo(id).name;
  const names = new Set(rhythm.rows.map((r) => r.name));
  if (!names.has(base)) return base;
  let k = 2;
  while (names.has(`${base} ${k}`)) k++;
  return `${base} ${k}`;
}

export const TYPE_NAMES = { bass: 'Bajo', lead: 'Melodía' };

/** @returns {NoteTrack} */
export function createNoteTrack(type, id = type, name = TYPE_NAMES[type]) {
  return {
    type, id, name,
    vol: 8, mute: false, notes: [], sound: copySound(FACTORY_SOUNDS[type]),
  };
}

/** ¿Es uno de los tracks fijos (Ritmo, Bajo, Melodía), que no se borran? */
export const isFixedTrack = (track) => ['rhythm', 'bass', 'lead'].includes(track.id);

/** Id libre para un track nuevo: 'bass2', 'bass3'... */
export function newTrackId(song, type) {
  let k = 2;
  while (song.tracks.some((t) => t.id === `${type}${k}`)) k++;
  return `${type}${k}`;
}

/** Nombre para un track nuevo: "Bajo 2", "Melodía 3"... sin repetir uno que ya exista. */
export function newTrackName(song, type) {
  const names = new Set(song.tracks.map((t) => t.name));
  let k = 2;
  while (names.has(`${TYPE_NAMES[type]} ${k}`)) k++;
  return `${TYPE_NAMES[type]} ${k}`;
}

/** ¿El sonido es igual al de fábrica de su tipo? */
export const isFactorySound = (track) => JSON.stringify(track.sound) === JSON.stringify(FACTORY_SOUNDS[track.type]);

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

/**
 * Pone en el track de Ritmo los pasos, el compás y el tempo de un ritmo predefinido.
 * El patrón llena todos los compases del Loop; los demás quedan vacíos.
 * Los ritmos solo traen Kick, Snare y Hi-hat: los instrumentos adicionales quedan como estaban
 * ("Adaptar lo existente"), o se quitan si fresh es true ("Comenzar desde cero").
 */
export function applyPreset(rhythm, index, fresh = false) {
  const p = PRESETS[index];
  rhythm.preset = index;
  rhythm.meter = p.meter;
  rhythm.tempo = p.tempo;
  if (fresh) rhythm.rows.length = DRUMS.length;
  for (const row of rhythm.rows.slice(0, DRUMS.length)) {
    const hits = p[row.id] || [];
    row.steps = Array.from({ length: DRUM_STEPS }, (_, i) =>
      Math.floor(i / BAR_STEPS) < rhythm.loop && hits.includes(i % BAR_STEPS));
  }
}

/** Copia el compás 1 en los demás compases del Loop. */
export function copyFirstBar(rhythm) {
  for (const row of rhythm.rows) {
    const first = row.steps.slice(0, BAR_STEPS);
    for (let bar = 1; bar < rhythm.loop; bar++) {
      for (let i = 0; i < BAR_STEPS; i++) row.steps[drumIndex(bar, i)] = first[i];
    }
  }
}

/** ¿El compás no tiene ningún golpe en sus primeras n posiciones? */
export function barIsEmpty(rhythm, bar, n = BAR_STEPS) {
  return rhythm.rows.every((row) => row.steps.slice(drumIndex(bar, 0), drumIndex(bar, n)).every((on) => !on));
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

/** Para un paso absoluto s (0 o más): compás del loop, paso dentro del compás y posición guardada. */
export function drumPosition(song, s) {
  const n = meterOf(song).n;
  const pos = s % loopSteps(song);
  const bar = Math.floor(pos / n);
  const step = pos % n;
  return { bar, step, index: drumIndex(bar, step) };
}

/** ¿La batería suena en algún paso del loop? */
export function drumsAudible(song) {
  const r = rhythmOf(song);
  const n = meterOf(song).n;
  if (r.mute || r.vol <= 0) return false;
  for (let bar = 0; bar < r.loop; bar++) {
    if (r.rows.some((row) => row.vol > 0 && row.steps.slice(drumIndex(bar, 0), drumIndex(bar, n)).some(Boolean))) return true;
  }
  return false;
}
