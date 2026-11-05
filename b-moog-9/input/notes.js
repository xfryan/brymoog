// Entrada única de notas. El teclado del computador, el de la pantalla y el MIDI
// llaman a noteOn / noteOff; ninguno sabe de sonido ni de grabación.
//
// Aquí se decide qué pasa con cada nota: suena con el sonido del track elegido,
// respeta Hold y el pedal, y le avisa al recorder por si se está grabando.

import { audio, ensureAudio } from '../audio/engine.js';
import { startVoice } from '../audio/voice.js';
import { getSong, onSongChange } from '../state/actions.js';
import { getView } from '../state/view.js';
import { trackById } from '../state/song.js';
import * as recorder from '../seq/recorder.js';

const MAX_VOICES = 8;

/** Voces que suenan en vivo, por semitono. */
const voices = new Map();
/** Notas soltadas mientras el pedal está apretado. */
const sustained = new Set();
let pedal = false;
const listeners = new Set();

/** Escuchar cambios en las notas que suenan (para pintar teclas). */
export function onNotesChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const emit = () => listeners.forEach((fn) => fn());

export const isSounding = (n) => voices.has(n);

// Al cambiar el sonido del track elegido, las notas que suenan (con Hold, por ejemplo) se ajustan.
onSongChange((action) => {
  if (action !== 'setSound' || !voices.size) return;
  const track = trackById(getSong(), getView().selectedTrackId);
  if (track && track.sound) voices.forEach((v) => v.refresh(track.sound));
});

/**
 * Velocidad MIDI (1 a 127) a multiplicador de volumen.
 * 100 suena casi igual que el teclado del computador, que no tiene velocidad.
 */
export const velocityGain = (vel) => (vel === undefined ? 1 : Math.pow(vel / 127, 0.6) * 1.15);

/**
 * Tecla apretada. Con Hold encendido, la misma tecla prende y apaga la nota.
 * @param {number} n    Semitono (0 = C3).
 * @param {number} [vel] Velocidad MIDI; sin velocidad suena a volumen normal.
 */
export function noteOn(n, vel) {
  if (getView().hold && voices.has(n)) {
    release(n);
    return;
  }
  sustained.delete(n);
  start(n, vel);
}

/** Tecla soltada. Con Hold no hace nada; con el pedal apretado, la nota sigue. */
export function noteOff(n) {
  if (getView().hold) return;
  if (pedal) {
    sustained.add(n);
    return;
  }
  release(n);
}

/** Pedal de sustain (CC 64 del teclado MIDI). */
export function setPedal(down) {
  pedal = down;
  if (!down) {
    sustained.forEach((n) => release(n));
    sustained.clear();
  }
}

/** Suelta todas las notas (al apagar Hold). */
export function releaseAll() {
  [...voices.keys()].forEach((n) => release(n));
}

/** Corta todo lo que suena en vivo (al cambiar de pestaña en el hub). */
export function killAll() {
  voices.forEach((v) => v.kill());
  voices.clear();
  sustained.clear();
  pedal = false;
  emit();
}

function start(n, vel) {
  ensureAudio();
  const track = trackById(getSong(), getView().selectedTrackId);
  if (!track || track.type === 'rhythm') return;
  if (voices.has(n)) {
    voices.get(n).kill();
    voices.delete(n);
  }
  if (voices.size >= MAX_VOICES) {
    const oldest = voices.keys().next().value;
    voices.get(oldest).kill();
    voices.delete(oldest);
  }
  const level = track.vol * velocityGain(vel);
  voices.set(n, startVoice(track.sound, n, audio.ctx.currentTime, level, audio.live));
  recorder.noteOn(n);
  emit();
}

function release(n) {
  const v = voices.get(n);
  if (!v) return;
  v.release(audio.ctx.currentTime);
  voices.delete(n);
  recorder.noteOff(n);
  emit();
}
