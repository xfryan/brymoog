// Teclado MIDI (GO:KEYS u otro, por USB). Escucha todos los canales.
// Nota MIDI 48 (C3) = semitono 0. El pedal (CC 64) sostiene.

import { noteOn, noteOff, setPedal } from './notes.js';
import { setView } from '../state/view.js';
import { ensureAudio } from '../audio/engine.js';

const C3 = 48;
let access = null;
let on = false;
const listeners = new Set();

/** Escuchar el estado: {on, text} y cada nota que llega ({hit: true}). */
export function onMidiChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const emit = (info) => listeners.forEach((fn) => fn(info));

function handle(e) {
  const [status, d1 = 0, d2 = 0] = e.data;
  const type = status & 0xf0;
  if (type === 0x90 && d2 > 0) {
    noteOn(d1 - C3, d2);
    emit({ hit: true });
  } else if (type === 0x80 || type === 0x90) {
    noteOff(d1 - C3);
  } else if (type === 0xb0 && d1 === 64) {
    setPedal(d2 >= 64);
  }
}

function connectInputs() {
  if (!access) return;
  const inputs = [...access.inputs.values()];
  inputs.forEach((i) => { i.onmidimessage = on ? handle : null; });
  if (on) {
    const names = inputs.filter((i) => i.state === 'connected').map((i) => i.name);
    emit({ on, text: names.length ? names.join(', ') : 'sin teclado conectado' });
  }
}

/** Enciende o apaga el MIDI. Al encender, Chrome pide permiso la primera vez. */
export async function setMidi(want) {
  if (!want) {
    on = false;
    setPedal(false);
    connectInputs();
    setView({ midiOn: false });
    emit({ on, text: 'teclado USB, Chrome' });
    return;
  }
  if (typeof navigator.requestMIDIAccess !== 'function') {
    emit({ on, text: 'este navegador no tiene MIDI: usa Chrome' });
    return;
  }
  const policy = document.permissionsPolicy || document.featurePolicy;
  if (policy && policy.allowsFeature && !policy.allowsFeature('midi')) {
    emit({ on, text: 'bloqueado aquí: abre brymoog.goitera.com' });
    return;
  }
  // El audio se activa ahora, con el clic: las notas MIDI no cuentan como gesto para el navegador.
  ensureAudio();
  try {
    access = access || (await navigator.requestMIDIAccess());
    access.onstatechange = connectInputs;
  } catch {
    emit({ on, text: 'permiso denegado: revísalo junto a la dirección' });
    return;
  }
  on = true;
  setView({ midiOn: true });
  connectInputs();
}
