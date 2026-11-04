// Toca la canción: la batería del track de Ritmo y las notas de cada track, en loop.

import { audio, ensureAudio } from '../audio/engine.js';
import { drumHit, click } from '../audio/drums.js';
import { startVoice } from '../audio/voice.js';
import { getSong } from '../state/actions.js';
import { getView } from '../state/view.js';
import {
  rhythmOf, noteTracks, meterOf, loopSteps, stepDuration, drumsAudible,
} from '../state/song.js';
import { createClock, atAudioTime } from './clock.js';
import * as recorder from './recorder.js';

const scheduled = new Set();
const listeners = new Set();

const clock = createClock({ stepDuration: () => stepDuration(getSong()), onStep });

/**
 * Posición que se ve en pantalla.
 * @type {{playing: boolean, step: number, drumStep: number}}
 * step: paso absoluto (negativo en la cuenta previa); drumStep: paso dentro del compás.
 */
export const position = { playing: false, step: -1, drumStep: -1 };

/** Escuchar cambios de Play/Stop y del paso que suena. */
export function onPlayerChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const emit = () => listeners.forEach((fn) => fn(position));

export const isPlaying = () => clock.running;
export const currentStep = () => clock.step;

/** Empieza a tocar. Un paso negativo agrega cuenta previa. */
export function play(fromStep = 0) {
  ensureAudio();
  clock.start(fromStep);
  position.playing = true;
  emit();
}

export function stop() {
  recorder.finish();
  clock.stop();
  scheduled.forEach((v) => v.kill());
  scheduled.clear();
  Object.assign(position, { playing: false, step: -1, drumStep: -1 });
  emit();
}

function onStep(s, t, sd) {
  const song = getSong();
  const rhythm = rhythmOf(song);
  const meter = meterOf(song);
  const L = loopSteps(song);

  if (s >= 0) {
    const drumStep = s % meter.n;
    if (!rhythm.mute) {
      rhythm.rows.forEach((row) => {
        if (row.steps[drumStep]) drumHit(row.id, t, row.vol / 10);
      });
    }
    const pos = s % L;
    for (const track of noteTracks(song)) {
      if (track.mute || recorder.isReplacing(track.id, s, L)) continue;
      for (const note of track.notes) {
        if (note.st >= pos && note.st < pos + 1) {
          const t0 = t + (note.st - pos) * sd;
          playNote(track, note.n, t0, t0 + note.du * sd);
        }
      }
    }
    atAudioTime(t, () => {
      position.step = s;
      position.drumStep = drumStep;
      emit();
    });
  } else {
    atAudioTime(t, () => {
      position.step = s;
      emit();
    });
  }

  // Click: en la cuenta previa, y al grabar si la batería no suena.
  const beat = ((s % meter.grp) + meter.grp) % meter.grp === 0;
  if (getView().click && beat && (s < 0 || (recorder.isActive() && !drumsAudible(song)))) {
    click(t, ((s % meter.n) + meter.n) % meter.n === 0);
  }

  recorder.onStep(s, t, sd, L);
}

function playNote(track, n, t0, t1) {
  const voice = startVoice(track.sound, n, t0, track.vol, audio.tracksBus);
  scheduled.add(voice);
  voice.release(Math.max(t1, t0 + 0.02));
  voice.onended = () => scheduled.delete(voice);
}
