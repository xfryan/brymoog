// Arranque del B-MOOG 9: conecta la canción, el audio, las entradas y la pantalla.

import { getSong, onSongChange } from './state/actions.js';
import { rhythmOf } from './state/song.js';
import { setDrumsVolume, setTracksVolume } from './audio/engine.js';
import { stop } from './seq/player.js';
import { attachKeyboard } from './input/keyboard.js';
import { attachScreenKeys } from './input/screen-keys.js';
import { killAll } from './input/notes.js';
import { setupTopbar } from './ui/topbar.js';
import { setupSongPane } from './ui/tracks.js';
import { setupDrumBox } from './ui/drum-box.js';

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
applyLevels();
onSongChange(applyLevels);

// El hub llama a allOff() al cambiar de pestaña: se apaga todo lo que suena.
window.allOff = () => {
  stop();
  killAll();
};
