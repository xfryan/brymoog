// Pantalla del Ritmo: el drum box con Tempo, Meter, Loop, ritmos predefinidos y pasos.
// La grilla tiene un bloque por instrumento y, dentro, un renglón por compás del Loop.

import { createKnob, createRotary, bindSlider } from './controls.js';
import { confirmDialog, choose, flash } from './dialogs.js';
import {
  getSong, onSongChange, setTempo, setMeter, setLoop, loadPreset, toggleStep, setDrumVolume,
  setTrackVolume, copyFirstBar,
} from '../state/actions.js';
import { setView, onViewChange } from '../state/view.js';
import {
  METERS, LOOPS, PRESETS, DRUMS, TEMPO_MIN, TEMPO_MAX,
  rhythmOf, meterOf, hasNotes, noteTracks, drumIndex, barIsEmpty,
} from '../state/song.js';
import { position, onPlayerChange } from '../seq/player.js';
import * as recorder from '../seq/recorder.js';

const $ = (id) => document.getElementById(id);

let tempo, meterSel, loopSel, drumsVol;
/** Compás y Loop con que se armó la grilla; si cambian, se vuelve a armar. */
let gridShape = '';
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
    onChange: (i) => changeLoop(LOOPS[i]),
  });
  drumsVol = bindSlider($('drumsvol'), $('drumsvolo'), (v) => v.toFixed(1), (v) => setTrackVolume('rhythm', v));

  buildPresets();
  update();

  $('back').addEventListener('click', () => setView({ pane: 'song' }));
  $('copybar').addEventListener('click', askCopy);
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

/**
 * Al subir el Loop, los compases nuevos aparecen como estaban: vacíos si nunca se usaron,
 * o con lo que tenían si se habían ocultado al bajar el Loop. Si quedan vacíos, pregunta
 * si copiar el compás 1 en ellos.
 */
async function changeLoop(bars) {
  if (blockedWhileRecording()) return;
  const r = rhythmOf(getSong());
  const before = r.loop;
  setLoop(bars);
  if (bars <= before) return;
  const n = meterOf(getSong()).n;
  const newBars = [];
  for (let b = before; b < bars; b++) newBars.push(b);
  if (!newBars.every((b) => barIsEmpty(r, b, n)) || barIsEmpty(r, 0, n)) return;
  const which = newBars.length === 1 ? `El compás ${bars} está vacío` : `Los compases ${before + 1} a ${bars} están vacíos`;
  const answer = await choose({
    title: `El loop ahora tiene ${bars} compases`,
    text: `${which}. ¿Copio el compás 1 en ${newBars.length === 1 ? 'él' : 'ellos'}? Si eliges Después, puedes copiarlo cuando quieras con "Copiar compás 1 a los demás".`,
    buttons: [
      { label: 'Sí, copiar', value: 'copy', cls: 'on' },
      { label: 'No, dejarlos vacíos', value: 'empty' },
      { label: 'Después', value: 'later' },
    ],
  });
  if (answer === 'copy') copyFirstBar();
}

/** Copiar a mano: si los otros compases tienen golpes, pregunta antes de reemplazarlos. */
async function askCopy() {
  const r = rhythmOf(getSong());
  const n = meterOf(getSong()).n;
  let used = false;
  for (let b = 1; b < r.loop; b++) if (!barIsEmpty(r, b, n)) used = true;
  if (used) {
    const ok = await confirmDialog({
      title: 'Copiar el compás 1 a los demás',
      text: 'Los otros compases ya tienen golpes. Se reemplazan por una copia del compás 1. Esto todavía no se puede deshacer.',
      ok: 'Reemplazar',
      danger: true,
    });
    if (!ok) return;
  }
  copyFirstBar();
  flash('Compás 1 copiado');
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

function stepsHtml(ri, name, bar, m) {
  let html = '';
  for (let i = 0; i < m.n; i++) {
    const g2 = Math.floor(i / m.grp) % 2 ? ' g2' : '';
    html += `<button type="button" class="st${g2}" data-row="${ri}" data-i="${drumIndex(bar, i)}" data-bar="${bar}" data-step="${i}" aria-label="${name}, compás ${bar + 1}, paso ${i + 1}"></button>`;
  }
  return html;
}

function buildGrid() {
  const song = getSong();
  const r = rhythmOf(song);
  const m = meterOf(song);
  gridShape = `${r.meter}/${r.loop}`;
  const cols = `grid-template-columns: repeat(${m.n}, minmax(0, 1fr))`;

  let nums = '';
  for (let i = 0; i < m.n; i++) nums += `<span>${i + 1}</span>`;
  let html = `<div class="dhead"><div class="dbar"><span></span><div class="snum" style="${cols}">${nums}</div></div></div>`;

  r.rows.forEach((row, ri) => {
    const d = DRUMS.find((x) => x.id === row.id);
    let bars = '';
    for (let b = 0; b < r.loop; b++) {
      bars += `<div class="dbar"><span class="blab" data-bar="${b}">Compás ${b + 1}</span><div class="steps" style="${cols}">${stepsHtml(ri, d.name, b, m)}</div></div>`;
    }
    html += `<div class="dgroup">
      <div class="dinfo">
        <div class="dname">${d.name}<small>${d.es}</small></div>
        <span class="mrange"><input type="range" min="0" max="10" step="0.1" data-row="${ri}" aria-label="Volumen ${d.name}"><span class="kv"></span></span>
      </div>
      <div class="dbars">${bars}</div>
    </div>`;
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
  lastStep = '';
}

function update() {
  const song = getSong();
  const r = rhythmOf(song);
  if (`${r.meter}/${r.loop}` !== gridShape) buildGrid();
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

  // Aviso y botón para copiar el compás 1, solo con más de un compás.
  $('dcopy').hidden = r.loop < 2;
  if (r.loop > 1) {
    const n = meterOf(song).n;
    const empty = [];
    for (let b = 1; b < r.loop; b++) if (barIsEmpty(r, b, n)) empty.push(b + 1);
    $('dcopytext').textContent = empty.length === 0 ? ''
      : empty.length === 1 ? `Compás ${empty[0]} vacío.` : `Compases ${empty.join(', ')} vacíos.`;
  }
}

let lastStep = '';
function showStep() {
  const key = position.playing ? `${position.bar}/${position.drumStep}` : '';
  if (key === lastStep) return;
  lastStep = key;
  document.querySelectorAll('#dgrid .st').forEach((b) => {
    b.classList.toggle('now', position.playing && +b.dataset.bar === position.bar && +b.dataset.step === position.drumStep);
  });
  document.querySelectorAll('#dgrid .blab').forEach((l) => {
    l.classList.toggle('now', position.playing && +l.dataset.bar === position.bar);
  });
}
