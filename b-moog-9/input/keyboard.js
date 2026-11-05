// Teclado del computador: dos octavas desde C3, y la barra espaciadora para Hold
// (solo en la pantalla de Sonido, que es donde está el switch).

import { noteOn, noteOff, releaseAll } from './notes.js';
import { getView, setView } from '../state/view.js';

/** Tecla del computador para cada semitono, de 0 (C3) a 24 (C5). */
export const KEYS = ['q', '2', 'w', '3', 'e', 'r', '5', 't', '6', 'y', '7', 'u', 'v', 'g', 'b', 'h', 'n', 'm', 'k', ',', 'l', '.', 'ñ', '-', 'ç'];
/** Teclas que cambian de letra según la distribución del teclado: se leen por código. */
const CODES = { Semicolon: 22, Backslash: 24, Comma: 19, Period: 21, Slash: 23 };

const byKey = Object.fromEntries(KEYS.map((k, i) => [k, i]));

function noteFor(e) {
  const k = (e.key || '').toLowerCase();
  if (byKey[k] !== undefined) return byKey[k];
  return CODES[e.code];
}

// Al escribir en un campo de texto (el nombre de la canción) el teclado no toca.
const typing = (e) => e.target.closest && e.target.closest('input[type=text], textarea, [contenteditable]');

export function toggleHold() {
  const hold = !getView().hold;
  setView({ hold });
  if (!hold) releaseAll();
}

export function attachKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat && getView().pane === 'sound') toggleHold();
      return;
    }
    if (e.repeat) return;
    const n = noteFor(e);
    if (n !== undefined) noteOn(n);
  });
  document.addEventListener('keyup', (e) => {
    const n = noteFor(e);
    if (n !== undefined) noteOff(n);
  });
}
