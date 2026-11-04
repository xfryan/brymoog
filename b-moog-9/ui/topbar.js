// Barra superior: Hold, MIDI, ayuda y MASTER VOLUME.

import { bindSwitch, bindSlider } from './controls.js';
import { setupHelp } from './dialogs.js';
import { getView, setView, onViewChange } from '../state/view.js';
import { setMasterVolume } from '../audio/engine.js';
import { toggleHold } from '../input/keyboard.js';
import { setMidi, onMidiChange } from '../input/midi.js';

const $ = (id) => document.getElementById(id);

export function setupTopbar() {
  const hold = bindSwitch($('holdsw'), $('holdlab'), 'Hold', toggleHold);
  const midi = bindSwitch($('midisw'), $('midilab'), 'MIDI', () => setMidi(!getView().midiOn));
  hold.set(getView().hold);
  midi.set(getView().midiOn);

  onViewChange((patch) => {
    if ('hold' in patch) hold.set(patch.hold);
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
