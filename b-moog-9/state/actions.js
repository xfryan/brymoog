// Todos los cambios a la canción pasan por estas funciones.
// Cada una cambia el objeto de la canción y avisa a quien escuche (la pantalla).
// En la 1.3 este mismo punto guarda cada cambio en el historial de deshacer.

import {
  createSong, rhythmOf, trackById, applyPreset, copyFirstBar as copyBar, CUSTOM_PRESET,
  METERS, LOOPS, TEMPO_MIN, TEMPO_MAX, DRUMS, MAX_DRUM_ROWS, MAX_TRACKS,
  createDrumRow, drumRowName, drumInfo, createNoteTrack, newTrackId, newTrackName, isFixedTrack,
} from './song.js';
import { FACTORY_SOUNDS, copySound } from './sounds.js';

/** @type {import('./song.js').Song} */
let song = createSong();
const listeners = new Set();

export const getSong = () => song;

/** Escuchar cambios. La función recibe el nombre de la acción. Devuelve cómo dejar de escuchar. */
export function onSongChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function commit(action, change) {
  change(song);
  listeners.forEach((fn) => fn(action));
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Canción

export function newSong() {
  song = createSong();
  listeners.forEach((fn) => fn('newSong'));
}

/** Reemplaza la canción por una abierta desde un archivo (ya validada). */
export function replaceSong(loaded) {
  song = loaded;
  listeners.forEach((fn) => fn('replaceSong'));
}

export function setSongName(name) {
  commit('setSongName', (s) => { s.name = String(name).slice(0, 80) || 'Canción sin título'; });
}

export function setTracksVolume(v) {
  commit('setTracksVolume', (s) => { s.mix.tracks = clamp(v, 0, 10); });
}

// Ritmo

export function setTempo(bpm) {
  commit('setTempo', (s) => { rhythmOf(s).tempo = clamp(Math.round(bpm), TEMPO_MIN, TEMPO_MAX); });
}

export function setMeter(index) {
  commit('setMeter', (s) => {
    const r = rhythmOf(s);
    r.meter = clamp(index, 0, METERS.length - 1);
    r.preset = CUSTOM_PRESET;
  });
}

export function setLoop(bars) {
  if (!LOOPS.includes(bars)) return;
  commit('setLoop', (s) => { rhythmOf(s).loop = bars; });
}

/** @param {boolean} [fresh]  true quita los instrumentos adicionales ("Comenzar desde cero"). */
export function loadPreset(index, fresh = false) {
  commit('loadPreset', (s) => applyPreset(rhythmOf(s), index, fresh));
}

export function copyFirstBar() {
  commit('copyFirstBar', (s) => copyBar(rhythmOf(s)));
}

/** @param {number} step  Posición guardada (ver drumIndex en song.js). */
export function toggleStep(rowIndex, step) {
  commit('toggleStep', (s) => {
    const r = rhythmOf(s);
    const row = r.rows[rowIndex];
    row.steps[step] = !row.steps[step];
    r.preset = CUSTOM_PRESET;
  });
}

export function setDrumVolume(rowIndex, v) {
  commit('setDrumVolume', (s) => { rhythmOf(s).rows[rowIndex].vol = clamp(v, 0, 10); });
}

/** Suma un instrumento adicional al final. Devuelve false si ya hay 12 filas. */
export function addDrum(id) {
  const r = rhythmOf(song);
  if (r.rows.length >= MAX_DRUM_ROWS || !drumInfo(id) || DRUMS.some((d) => d.id === id)) return false;
  commit('addDrum', (s) => {
    const rhythm = rhythmOf(s);
    rhythm.rows.push(createDrumRow(id, drumRowName(rhythm, id)));
  });
  return true;
}

/** Quita un instrumento adicional. Kick, Snare y Hi-hat no se quitan. */
export function removeDrum(rowIndex) {
  if (rowIndex < DRUMS.length || rowIndex >= rhythmOf(song).rows.length) return;
  commit('removeDrum', (s) => { rhythmOf(s).rows.splice(rowIndex, 1); });
}

// Tracks

/** Suma un track de Bajo o Melodía. Devuelve su id, o null si ya hay 8 tracks. */
export function addTrack(type) {
  if (song.tracks.length >= MAX_TRACKS || !FACTORY_SOUNDS[type]) return null;
  const id = newTrackId(song, type);
  commit('addTrack', (s) => { s.tracks.push(createNoteTrack(type, id, newTrackName(s, type))); });
  return id;
}

/** Borra un track que se sumó. Ritmo, Bajo y Melodía no se borran. */
export function removeTrack(id) {
  const track = trackById(song, id);
  if (!track || isFixedTrack(track)) return;
  commit('removeTrack', (s) => { s.tracks = s.tracks.filter((t) => t.id !== id); });
}

export function renameTrack(id, name) {
  const track = trackById(song, id);
  if (!track || track.type === 'rhythm') return;
  const clean = String(name).trim().slice(0, 24);
  commit('renameTrack', (s) => { trackById(s, id).name = clean || track.name; });
}

export function setTrackVolume(id, v) {
  commit('setTrackVolume', (s) => { trackById(s, id).vol = clamp(v, 0, 10); });
}

export function setTrackMute(id, mute) {
  commit('setTrackMute', (s) => { trackById(s, id).mute = !!mute; });
}

export function clearTrack(id) {
  commit('clearTrack', (s) => { trackById(s, id).notes = []; });
}

/** Lo grabado reemplaza las notas del track. */
export function setTrackNotes(id, notes) {
  commit('setTrackNotes', (s) => { trackById(s, id).notes = notes; });
}

// Sonido de un track

/** Rangos de cada valor del sonido (ver state/sounds.js). */
const SOUND_RANGES = {
  cut: [0, 1000], res: [0, 25], atk: [0, 1000], dec: [0, 1000], sus: [0, 100], rel: [0, 1000],
  famt: [0, 100], fatk: [0, 1000], fdec: [0, 1000], fsus: [0, 100],
};
const OSC_RANGES = { oct: [-8, 2], cents: [-700, 700], vol: [0, 10] };
const WAVES = ['triangle', 'sawtooth', 'square', 'pulse'];

/** Cambia un valor del filtro o de las envolventes: key es cut, res, atk, dec, sus, rel, famt, fatk, fdec o fsus. */
export function setSoundValue(id, key, v) {
  const range = SOUND_RANGES[key];
  if (!range) return;
  commit('setSound', (s) => { trackById(s, id).sound[key] = clamp(v, ...range); });
}

/** Cambia un valor de un oscilador: key es oct, wave, cents, vol u on. */
export function setOscillator(id, index, key, v) {
  commit('setSound', (s) => {
    const o = trackById(s, id).sound.osc[index];
    if (key === 'wave') { if (WAVES.includes(v)) o.wave = v; }
    else if (key === 'on') o.on = !!v;
    else if (OSC_RANGES[key]) o[key] = clamp(v, ...OSC_RANGES[key]);
  });
}

/** Vuelve el track a su sonido de fábrica. */
export function resetSound(id) {
  commit('setSound', (s) => {
    const t = trackById(s, id);
    t.sound = copySound(FACTORY_SOUNDS[t.type]);
  });
}

/** Copia en un track el sonido de otro. Cada track queda con su propia copia. */
export function copySoundFrom(id, fromId) {
  commit('setSound', (s) => { trackById(s, id).sound = copySound(trackById(s, fromId).sound); });
}
