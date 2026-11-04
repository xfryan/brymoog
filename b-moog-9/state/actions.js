// Todos los cambios a la canción pasan por estas funciones.
// Cada una cambia el objeto de la canción y avisa a quien escuche (la pantalla).
// En la 1.3 este mismo punto guarda cada cambio en el historial de deshacer.

import {
  createSong, rhythmOf, trackById, applyPreset, CUSTOM_PRESET,
  METERS, LOOPS, TEMPO_MIN, TEMPO_MAX,
} from './song.js';

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

export function loadPreset(index) {
  commit('loadPreset', (s) => applyPreset(rhythmOf(s), index));
}

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

// Tracks

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
