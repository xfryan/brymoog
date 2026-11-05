// Barra superior: MIDI, ayuda y MASTER VOLUME. Hold está en la pantalla de Sonido.

import { bindSwitch, bindSlider } from './controls.js';
import { setupHelp } from './dialogs.js';
import { getView, setView, onViewChange } from '../state/view.js';
import { setMasterVolume } from '../audio/engine.js';
import { setMidi, onMidiChange } from '../input/midi.js';

const $ = (id) => document.getElementById(id);

export function setupTopbar() {
  const midi = bindSwitch($('midisw'), $('midilab'), 'MIDI', () => setMidi(!getView().midiOn));
  midi.set(getView().midiOn);

  onViewChange((patch) => {
    if ('midiOn' in patch) {
      midi.set(patch.midiOn);
      $('mled').classList.toggle('on', patch.midiOn);
    }
  });

  let ledTimer = 0;
  onMidiChange((info) => {
    if (info.hit) {
      const led = $('mled');
      led.classList.add('hit');
      clearTimeout(ledTimer);
      ledTimer = setTimeout(() => led.classList.remove('hit'), 90);
      return;
    }
    $('midist').textContent = `(${info.text})`;
  });

  bindSlider($('master'), $('mastero'), (v) => String(v), (v) => {
    setView({ master: v });
    setMasterVolume(v);
  });
  setMasterVolume(getView().master);

  setupHelp();
}
