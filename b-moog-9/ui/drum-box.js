// Pantalla del Ritmo: el drum box con Tempo, Meter, Loop, ritmos predefinidos y pasos.

import { createKnob, createRotary, bindSlider } from './controls.js';
import { confirmDialog, flash } from './dialogs.js';
import {
  getSong, onSongChange, setTempo, setMeter, setLoop, loadPreset, toggleStep, setDrumVolume, setTrackVolume,
} from '../state/actions.js';
import { setView, onViewChange } from '../state/view.js';
import {
  METERS, LOOPS, PRESETS, DRUMS, TEMPO_MIN, TEMPO_MAX, rhythmOf, meterOf, hasNotes, noteTracks,
} from '../state/song.js';
import { position, onPlayerChange } from '../seq/player.js';
import * as recorder from '../seq/recorder.js';

const $ = (id) => document.getElementById(id);

let tempo, meterSel, loopSel, drumsVol;
let gridMeter = -1;
const rowSliders = [];

export function setupDrumBox() {
  const r = rhythmOf(getSong());

  tempo = createKnob($('tempoKnob'), {
    label: 'Tempo', sub: '(pulsos por minuto)', min: TEMPO_MIN, max: TEMPO_MAX, step: 1,
    value: r.tempo, format: (v) => `${v} BPM`, onInput: setTempo,
  });
  meterSel = createRotary($('meterSel'), {
    label: 'Meter', sub: '(compás)', options: METERS.map((m) => m.label), value: r.meter,
    onChange: (i) => askMeter(i, () => setMeter(i)),
  });
  loopSel = createRotary($('loopSel'), {
    label: 'Loop', sub: '(compases)', options: LOOPS.map(String), value: LOOPS.indexOf(r.loop),
    onChange: (i) => { if (!blockedWhileRecording()) setLoop(LOOPS[i]); },
  });
  drumsVol = bindSlider($('drumsvol'), $('drumsvolo'), (v) => v.toFixed(1), (v) => setTrackVolume('rhythm', v));

  buildPresets();
  update();

  $('back').addEventListener('click', () => setView({ pane: 'song' }));
  onSongChange(update);
  onPlayerChange(showStep);
  onViewChange((patch) => {
    if (patch.pane === undefined) return;
    $('paneSong').hidden = patch.pane !== 'song';
    $('paneRhythm').hidden = patch.pane !== 'rhythm';
    window.scrollTo(0, 0);
  });
}

function blockedWhileRecording() {
  if (!recorder.isActive()) return false;
  flash('No se puede cambiar mientras se graba');
  return true;
}

/**
 * Cambiar el compás afecta a todos los tracks: si Bajo o Melodía tienen notas, primero pregunta.
 * Las notas no se mueven; cambia el largo del compás y del loop.
 */
async function askMeter(index, apply) {
  if (blockedWhileRecording()) return;
  if (index !== rhythmOf(getSong()).meter && hasNotes(getSong())) {
    const names = noteTracks(getSong()).filter((t) => t.notes.length).map((t) => t.name);
    const who = names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)} ya tienen` : `${names[0]} ya tiene`;
    const ok = await confirmDialog({
      title: `Cambiar el compás a ${METERS[index].label}`,
      text: `${who} notas. Las notas quedan donde están, pero el compás y el loop cambian de largo, así que pueden quedar mal acomodadas o fuera del loop.`,
      ok: 'Cambiar el compás',
    });
    if (!ok) return;
  }
  apply();
}

function buildPresets() {
  const box = $('presets');
  box.innerHTML = PRESETS.map((p, i) =>
    `<button type="button" data-p="${i}">${p.name}<small>${METERS[p.meter].label}</small></button>`,
  ).join('') + '<button type="button" data-p="-1" disabled>Custom<small>editado</small></button>';
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-p]');
    if (!b || b.disabled) return;
    const i = +b.dataset.p;
    askMeter(PRESETS[i].meter, () => loadPreset(i));
  });
}

function buildGrid() {
  const song = getSong();
  const r = rhythmOf(song);
  const m = meterOf(song);
  gridMeter = r.meter;
  const cols = `grid-template-columns: repeat(${m.n}, minmax(0, 1fr))`;
  let html = `<div class="drow head"><div></div><div></div><div class="snum" style="${cols}">`;
  for (let i = 0; i < m.n; i++) html += `<span>${i + 1}</span>`;
  html += '</div></div>';
  r.rows.forEach((row, ri) => {
    const d = DRUMS.find((x) => x.id === row.id);
    html += `<div class="drow">
      <div class="dname">${d.name}<small>${d.es}</small></div>
      <span class="mrange"><input type="range" min="0" max="10" step="0.1" data-row="${ri}" aria-label="Volumen ${d.name}"><span class="kv"></span></span>
      <div class="steps" style="${cols}">`;
    for (let i = 0; i < m.n; i++) {
      const g2 = Math.floor(i / m.grp) % 2 ? ' g2' : '';
      html += `<button type="button" class="st${g2}" data-row="${ri}" data-i="${i}" aria-label="${d.name} paso ${i + 1}"></button>`;
    }
    html += '</div></div>';
  });
  const grid = $('dgrid');
  grid.innerHTML = html;
  rowSliders.length = 0;
  grid.querySelectorAll('input[type=range]').forEach((input) => {
    const ri = +input.dataset.row;
    rowSliders[ri] = bindSlider(input, input.nextElementSibling, (v) => v.toFixed(1), (v) => setDrumVolume(ri, v));
  });
  grid.onclick = (e) => {
    const st = e.target.closest('.st');
    if (st) toggleStep(+st.dataset.row, +st.dataset.i);
  };
  lastStep = -2;
}

function update() {
  const song = getSong();
  const r = rhythmOf(song);
  if (r.meter !== gridMeter) buildGrid();
  tempo.set(r.tempo);
  meterSel.set(r.meter);
  loopSel.set(LOOPS.indexOf(r.loop));
  drumsVol.set(r.vol);
  r.rows.forEach((row, ri) => rowSliders[ri].set(row.vol));
  document.querySelectorAll('#dgrid .st').forEach((b) => {
    const on = r.rows[+b.dataset.row].steps[+b.dataset.i];
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on);
  });
  document.querySelectorAll('#presets button').forEach((b) => b.classList.toggle('on', +b.dataset.p === r.preset));
}

let lastStep = -2;
function showStep() {
  const k = position.playing ? position.drumStep : -1;
  if (k === lastStep) return;
  lastStep = k;
  document.querySelectorAll('#dgrid .st').forEach((b) => b.classList.toggle('now', +b.dataset.i === k));
}
