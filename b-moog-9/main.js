// Arranque del B-MOOG 9: conecta la canción, el audio, las entradas y la pantalla.

import { getSong, onSongChange } from './state/actions.js';
import { rhythmOf } from './state/song.js';
import { setDrumsVolume, setTracksVolume } from './audio/engine.js';
import { stop } from './seq/player.js';
import { attachKeyboard } from './input/keyboard.js';
import { attachScreenKeys } from './input/screen-keys.js';
import { killAll } from './input/notes.js';
import { toggleHold } from './input/keyboard.js';
import { getView, onViewChange } from './state/view.js';
import { setupTopbar } from './ui/topbar.js';
import { setupSongPane } from './ui/tracks.js';
import { setupDrumBox } from './ui/drum-box.js';
import { setupSoundEditor } from './ui/sound-editor.js';

// Los volúmenes de la canción mandan sobre los buses de audio.
function applyLevels() {
  const song = getSong();
  setDrumsVolume(rhythmOf(song).vol);
  setTracksVolume(song.mix.tracks);
}

attachKeyboard();
attachScreenKeys(document.getElementById('kb'));
setupTopbar();
setupSongPane();
setupDrumBox();
setupSoundEditor();
applyLevels();

// Una pantalla a la vez: la canción, el Ritmo o el Sonido de un track.
// Hold es de la pantalla de Sonido: al salir de ella se apaga y suelta las notas.
onViewChange((patch) => {
  if (patch.pane === undefined) return;
  document.getElementById('paneSong').hidden = patch.pane !== 'song';
  document.getElementById('paneRhythm').hidden = patch.pane !== 'rhythm';
  document.getElementById('paneSound').hidden = patch.pane !== 'sound';
  if (patch.pane !== 'sound' && getView().hold) toggleHold();
  window.scrollTo(0, 0);
});
onSongChange(applyLevels);

// El hub llama a allOff() al cambiar de pestaña: se apaga todo lo que suena.
window.allOff = () => {
  stop();
  killAll();
};
