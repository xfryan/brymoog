// Graba en un track una vuelta completa del loop.
//
// Fases: 'ready' (cuenta previa, luz naranja GET READY) y 'go' (grabando, luz roja GO!).
// Las notas se juntan aquí mientras se graba y al final se guardan en la canción
// con una sola acción, que reemplaza lo que el track tenía.

import { audio } from '../audio/engine.js';
import { getSong, setTrackNotes } from '../state/actions.js';
import { getView } from '../state/view.js';
import { meterOf, loopSteps } from '../state/song.js';
import { atAudioTime } from './clock.js';
import { play, isPlaying, currentStep } from './player.js';

/** Pasos mínimos de aviso antes de empezar a grabar con la canción ya sonando. */
const MIN_LEAD = 2;

/**
 * @type {null | {trackId: string, start: number, phase: 'ready'|'go',
 *   t0: number, sd: number, pending: Record<number, number>, notes: import('../state/song.js').Note[]}}
 */
let rec = null;
const listeners = new Set();

export function onRecorderChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const emit = () => listeners.forEach((fn) => fn(status()));

/** Qué se está grabando: {trackId, phase} o null. */
export const status = () => (rec ? { trackId: rec.trackId, phase: rec.phase } : null);
export const isActive = () => rec !== null;

/**
 * Nota grabada a partir de cuándo empezó y terminó, en pasos desde el inicio del loop.
 * Exportada para las pruebas.
 */
export function makeNote(n, start, end, loopLength) {
  const e = Math.min(end, loopLength);
  return {
    n,
    st: Math.round(start * 1000) / 1000,
    du: Math.max(0.1, Math.round((e - start) * 1000) / 1000),
  };
}

/** Rec en un track. Si ya se graba ese track, termina; si se graba otro, cambia. */
export function arm(trackId) {
  if (rec) {
    const same = rec.trackId === trackId;
    finish();
    if (same) return;
  }
  const song = getSong();
  const L = loopSteps(song);
  if (!isPlaying()) {
    rec = newRecording(trackId, 0);
    play(-meterOf(song).n);
  } else {
    // Empieza en la próxima vuelta del loop, con al menos dos pasos de aviso.
    const now = currentStep();
    let start = Math.ceil(now / L) * L;
    if (start - now < MIN_LEAD) start += L;
    rec = newRecording(trackId, start);
  }
  emit();
}

function newRecording(trackId, start) {
  return { trackId, start, phase: 'ready', t0: 0, sd: 0, pending: {}, notes: [] };
}

/** Lo llama el player en cada paso programado. */
export function onStep(s, t, sd, L) {
  if (!rec) return;
  const r = rec;
  if (s === r.start) {
    r.t0 = t;
    r.sd = sd;
    atAudioTime(t, () => {
      if (rec !== r) return;
      r.phase = 'go';
      r.pending = {};
      r.notes = [];
      emit();
    });
  }
  if (s === r.start + L) {
    atAudioTime(t, () => { if (rec === r) finish(); });
  }
}

/** Mientras se graba un track, lo que tenía antes no suena. */
export const isReplacing = (trackId, s, L) =>
  rec !== null && rec.trackId === trackId && s >= rec.start && s < rec.start + L;

/** Notas grabadas hasta ahora en un track, para dibujarlas mientras se graba. */
export const liveNotes = (trackId) =>
  rec && rec.phase === 'go' && rec.trackId === trackId ? rec.notes : null;

const recording = () => rec && rec.phase === 'go' && rec.trackId === getView().selectedTrackId;
const stepNow = () => (audio.ctx.currentTime - rec.t0) / rec.sd;

export function noteOn(n) {
  if (!recording()) return;
  rec.pending[n] = stepNow();
}

export function noteOff(n) {
  if (!recording() || rec.pending[n] === undefined) return;
  const start = rec.pending[n];
  delete rec.pending[n];
  const L = loopSteps(getSong());
  if (start >= 0 && start < L) {
    rec.notes.push(makeNote(n, start, stepNow(), L));
    emit();
  }
}

/** Termina la grabación y guarda lo grabado en la canción. */
export function finish() {
  if (!rec) return;
  const r = rec;
  rec = null;
  if (r.phase === 'go') {
    const L = loopSteps(getSong());
    // Las teclas que siguen apretadas duran hasta el final del loop.
    for (const [n, start] of Object.entries(r.pending)) {
      if (start >= 0 && start < L) r.notes.push(makeNote(+n, start, L, L));
    }
    setTrackNotes(r.trackId, r.notes);
  }
  emit();
}
