// Teclado de la pantalla: dos octavas con las letras del computador,
// o las 61 teclas del GO:KEYS (C2 a C7) cuando el MIDI está encendido.

import { noteOn, noteOff, isSounding, onNotesChange } from './notes.js';
import { KEYS } from './keyboard.js';
import { getView, onViewChange } from '../state/view.js';

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const isBlack = (n) => [1, 3, 6, 8, 10].includes(((n % 12) + 12) % 12);

/** Teclas a dibujar: [semitono, etiqueta]. */
function keyList(midiOn) {
  const [low, high] = midiOn ? [-12, 48] : [0, 24];
  const list = [];
  for (let n = low; n <= high; n++) {
    let label = '';
    if (n >= 0 && n < KEYS.length) label = KEYS[n].toUpperCase();
    else if (n % 12 === 0) label = 'C' + (Math.floor(n / 12) + 3);
    list.push([n, label]);
  }
  return list;
}

/** @param {HTMLElement} el */
export function attachScreenKeys(el) {
  function layout() {
    el.innerHTML = '';
    const list = keyList(getView().midiOn);
    const whites = list.filter(([n]) => !isBlack(n)).length;
    const ww = el.clientWidth / whites;
    let wi = 0;
    for (const [n, label] of list) {
      const key = document.createElement('div');
      key.dataset.n = n;
      key.textContent = label;
      key.title = NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) + 3);
      if (isBlack(n)) {
        key.className = 'b';
        key.style.width = ww * 0.6 + 'px';
        key.style.left = wi * ww - ww * 0.3 + 'px';
      } else {
        key.className = 'w';
        key.style.width = ww + 'px';
        key.style.left = wi * ww + 'px';
        wi++;
      }
      el.appendChild(key);
    }
    paint();
  }

  function paint() {
    el.querySelectorAll('[data-n]').forEach((k) => k.classList.toggle('cur', isSounding(+k.dataset.n)));
  }

  const pointers = new Map();
  el.addEventListener('pointerdown', (e) => {
    const key = e.target.closest('[data-n]');
    if (!key) return;
    e.preventDefault();
    const n = +key.dataset.n;
    pointers.set(e.pointerId, n);
    noteOn(n);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
    el.addEventListener(type, (e) => {
      const n = pointers.get(e.pointerId);
      if (n === undefined) return;
      pointers.delete(e.pointerId);
      noteOff(n);
    });
  }

  onNotesChange(paint);
  onViewChange((patch) => { if ('midiOn' in patch) layout(); });
  new ResizeObserver(layout).observe(el);
  layout();
}
