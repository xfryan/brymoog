// Estado de la pantalla: lo que no es parte de la canción y no se guarda en el archivo.

const view = {
  /** Track de notas que suena al tocar en vivo. */
  selectedTrackId: 'bass',
  /** Hold (sostener): empieza apagado, está pensado para afinar un sonido. */
  hold: false,
  /** Teclado MIDI encendido. */
  midiOn: false,
  /** Click (metrónomo) en la cuenta previa y al grabar sin batería. */
  click: true,
  /** Pantalla visible: 'song' (la canción) o 'rhythm' (el drum box). */
  pane: 'song',
  /** MASTER VOLUME, 0 a 100. */
  master: 40,
};

const listeners = new Set();

export const getView = () => view;

export function setView(patch) {
  Object.assign(view, patch);
  listeners.forEach((fn) => fn(patch));
}

export function onViewChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
