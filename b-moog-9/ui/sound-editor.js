// Pantalla de Sonido: el sonido de un track de Bajo o Melodía, con los controles del Minimoog
// (Oscillator Bank, Mixer y Modifiers), sus pantallas y el Scope.
//
// Hold vive aquí: se deja una nota sonando mientras se busca el sonido, y al volver a la
// canción se apaga solo. Los cambios se aplican a la nota que suena (ver input/notes.js).

import { createKnob, createRotary, createFader, bindSwitch, badge } from './controls.js';
import { confirmDialog, choose, flash } from './dialogs.js';
import {
  getSong, onSongChange, setSoundValue, setOscillator, resetSound, copySoundFrom,
} from '../state/actions.js';
import { getView, setView, onViewChange } from '../state/view.js';
import { trackById, noteTracks, isFactorySound } from '../state/song.js';
import { FACTORY_SOUNDS } from '../state/sounds.js';
import { audio } from '../audio/engine.js';
import { cutoffHz, envelopeSeconds, soundTimes } from '../audio/voice.js';
import { toggleHold } from '../input/keyboard.js';

const $ = (id) => document.getElementById(id);

/** Range en pies, como los tubos de órgano: cada paso es una octava y 8' es la afinación del teclado. */
const FEET = [['LO', -8], ["32'", -2], ["16'", -1], ["8'", 0], ["4'", 1], ["2'", 2]];

const WAVES = [['triangle', 'Triangle'], ['sawtooth', 'Saw'], ['square', 'Square'], ['pulse', 'Pulse']];

const WAVE_ICONS = {
  triangle: 'M2,19 L12,3 L22,19 L32,3 L42,19',
  sawtooth: 'M2,3 L22,19 V3 L42,19 V3',
  square: 'M2,3 H12 V19 H22 V3 H32 V19 H42',
  pulse: 'M2,3 H7 V19 H22 V3 H27 V19 H42',
};
const waveIcon = (w) => `<svg class="wi" viewBox="0 0 44 22" aria-hidden="true"><path d="${WAVE_ICONS[w]}"/></svg>`;

/** Números de control del manual de Moog para cada oscilador. */
const OSC_META = [
  { name: 'Oscillator 1', range: '4', wave: '5', freq: '', vol: '12', sw: 'C' },
  { name: 'Oscillator 2', range: '', wave: '', freq: '7', vol: '13', sw: 'E' },
  { name: 'Oscillator 3', range: '9', wave: '11', freq: '10', vol: '14', sw: 'G' },
];

const fmtTime = (s) => (s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(2)} s`);
const fmtHz = (hz) => (hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${Math.round(hz)} Hz`);
const fmtCents = (c) => `${c > 0 ? '+' : ''}${c} ct`;

/** Los faders de Modifiers: [clave del sonido, columna, nombre, traducción, número Moog, mín, máx, paso, formato]. */
const FADERS = [
  ['cut', 'filter', 'Cutoff', '(corte)', '17', 0, 1000, 1, (v) => fmtHz(cutoffHz(v))],
  ['res', 'filter', 'Emphasis', '(resonancia)', '18', 0, 25, 0.1, (v) => v.toFixed(1)],
  ['famt', 'contour', 'Amount', '(cantidad)', '19', 0, 100, 1, (v) => `${v}%`],
  ['fatk', 'contour', 'Attack', '(ataque)', '20', 0, 1000, 1, (v) => fmtTime(envelopeSeconds('fatk', v))],
  ['fdec', 'contour', 'Decay', '(decaimiento)', '21', 0, 1000, 1, (v) => fmtTime(envelopeSeconds('fdec', v))],
  ['fsus', 'contour', 'Sustain', '(sostenido)', '22', 0, 100, 1, (v) => `${v}%`],
  ['atk', 'loudness', 'Attack', '(ataque)', '23', 0, 1000, 1, (v) => fmtTime(envelopeSeconds('atk', v))],
  ['dec', 'loudness', 'Decay', '(decaimiento)', '24', 0, 1000, 1, (v) => fmtTime(envelopeSeconds('dec', v))],
  ['sus', 'loudness', 'Sustain', '(sostenido)', '25', 0, 100, 1, (v) => `${v}%`],
  ['rel', 'loudness', 'Release', '(relajación)', '', 0, 1000, 1, (v) => fmtTime(envelopeSeconds('rel', v))],
];

/** Controles armados, para ponerles los valores del track que se está editando. */
const ui = { faders: {}, osc: [] };

/** Track cuyo sonido se edita: el elegido al abrir la pantalla. */
const editing = () => trackById(getSong(), getView().selectedTrackId);

export function setupSoundEditor() {
  buildOscillators();
  buildModifiers();

  const hold = bindSwitch($('holdsw'), $('holdlab'), 'Hold', toggleHold);
  hold.set(getView().hold);

  $('soundBack').addEventListener('click', () => setView({ pane: 'song' }));
  $('soundReset').addEventListener('click', askReset);
  $('soundCopy').addEventListener('click', askCopy);

  onSongChange((action) => {
    if (getView().pane !== 'sound') return;
    if (!editing() || editing().type === 'rhythm') { setView({ pane: 'song' }); return; }
    if (action === 'setSound' || action === 'renameTrack' || action === 'replaceSong' || action === 'newSong') load();
  });
  onViewChange((patch) => {
    if ('hold' in patch) hold.set(patch.hold);
    // La pantalla se muestra después de este aviso: las pantallas se dibujan en el cuadro siguiente.
    if (patch.pane === 'sound') { load(); requestAnimationFrame(drawModifiers); }
  });
  window.addEventListener('resize', () => { if (getView().pane === 'sound') drawModifiers(); });
  requestAnimationFrame(scopeLoop);
}

// Oscillator Bank y Mixer: una fila por oscilador.

function buildOscillators() {
  const grid = $('oscgrid');
  const factory = FACTORY_SOUNDS.bass.osc;
  grid.innerHTML = OSC_META.map((m, i) => `
    <div class="orow" data-i="${i}">
      <div class="ncell">
        <div class="onum" aria-hidden="true">${i + 1}</div>
        <div class="ctl">
          <button type="button" class="tgl" role="switch" aria-checked="false" aria-label="${m.name}"><span class="knobdot"></span></button>
          <span class="rlab"></span>${badge(m.sw)}
        </div>
      </div>
      <div class="mcell">
        <div class="kl">${badge(m.vol)}Volume <small>(volumen)</small></div>
        <span class="mrange"><input type="range" min="0" max="10" step="0.1" aria-label="Volume ${m.name}"><span class="kv"></span></span>
      </div>
      <div class="bcell">
        <div class="orange"></div>
        <div class="wcol">
          <div class="kl">${badge(m.wave)}Waveform <small>(forma de onda)</small></div>
          <div class="wrow">${WAVES.map(([w, name]) => `<button type="button" data-w="${w}">${waveIcon(w)}<span>${name}</span></button>`).join('')}</div>
        </div>
        <div class="ofreq">${i === 0 ? '<div class="blank">Sin Frequency:<br>es la referencia<br>de afinación</div>' : ''}</div>
      </div>
    </div>`).join('');

  grid.querySelectorAll('.orow').forEach((row) => {
    const i = +row.dataset.i;
    const id = () => editing().id;
    const sw = row.querySelector('.tgl');
    const vol = row.querySelector('input[type=range]');
    const volOut = row.querySelector('.mrange .kv');
    const o = {
      row,
      sw: bindSwitch(sw, row.querySelector('.rlab'), '', () => setOscillator(id(), i, 'on', !editing().sound.osc[i].on)),
      vol,
      volOut,
      range: createRotary(row.querySelector('.orange'), {
        label: 'Range', sub: '(rango)', num: OSC_META[i].range, options: FEET.map((f) => f[0]),
        value: FEET.findIndex((f) => f[1] === factory[i].oct),
        onChange: (k) => setOscillator(id(), i, 'oct', FEET[k][1]),
      }),
      freq: i === 0 ? null : createKnob(row.querySelector('.ofreq'), {
        label: 'Frequency', sub: '(desafinación)', num: OSC_META[i].freq, min: -700, max: 700, step: 1,
        value: 0, format: fmtCents, onInput: (v) => setOscillator(id(), i, 'cents', v),
      }),
    };
    vol.addEventListener('input', () => setOscillator(id(), i, 'vol', +vol.value));
    vol.addEventListener('keydown', (e) => e.stopPropagation());
    row.querySelector('.wrow').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-w]');
      if (b) setOscillator(id(), i, 'wave', b.dataset.w);
    });
    ui.osc.push(o);
  });
}

// Modifiers: Filter, Filter Contour y Loudness Contour, cada uno con su pantalla.

function buildModifiers() {
  const base = FACTORY_SOUNDS.bass;
  for (const [key, col, label, sub, num, min, max, step, format] of FADERS) {
    const box = document.createElement('div');
    $(`f-${col}`).appendChild(box);
    ui.faders[key] = createFader(box, {
      label, sub, num, min, max, step, value: base[key], format,
      onInput: (v) => setSoundValue(editing().id, key, v),
      reset: () => FACTORY_SOUNDS[editing().type][key],
    });
  }
}

/** Pone en los controles el sonido del track que se edita. */
function load() {
  const track = editing();
  if (!track || track.type === 'rhythm') return;
  const s = track.sound;
  $('soundName').textContent = track.name;
  $('soundReset').disabled = isFactorySound(track);
  $('soundCopy').disabled = noteTracks(getSong()).length < 2;
  for (const [key] of FADERS) ui.faders[key].set(s[key]);
  s.osc.forEach((o, i) => {
    const c = ui.osc[i];
    c.sw.set(o.on);
    c.row.querySelector('.rlab').textContent = o.on ? 'ON' : 'OFF';
    c.row.querySelector('.onum').classList.toggle('on', o.on);
    if (document.activeElement !== c.vol) c.vol.value = o.vol;
    c.vol.style.setProperty('--p', o.vol * 10 + '%');
    c.volOut.textContent = o.vol.toFixed(1);
    const k = FEET.findIndex((f) => f[1] === o.oct);
    c.range.set(k < 0 ? 3 : k);
    if (c.freq) c.freq.set(o.cents);
    c.row.querySelectorAll('[data-w]').forEach((b) => b.classList.toggle('on', b.dataset.w === o.wave));
  });
  drawModifiers();
}

async function askReset() {
  const track = editing();
  const ok = await confirmDialog({
    title: `Sonido de fábrica para ${track.name}`,
    text: `El sonido vuelve al de fábrica de ${track.type === 'bass' ? 'Bajo' : 'Melodía'}. Lo que cambiaste se pierde; esto todavía no se puede deshacer.`,
    ok: 'Volver al de fábrica',
    danger: true,
  });
  if (!ok) return;
  resetSound(track.id);
  flash('Sonido de fábrica');
}

async function askCopy() {
  const track = editing();
  const others = noteTracks(getSong()).filter((t) => t.id !== track.id);
  const from = await choose({
    title: `Copiar un sonido en ${track.name}`,
    text: `Elige de qué track copiar. El sonido de ${track.name} se reemplaza por una copia; esto todavía no se puede deshacer.`,
    buttons: [
      ...others.map((t) => ({ label: t.name, value: t.id })),
      { label: 'Cancelar', value: false },
    ],
  });
  if (!from) return;
  copySoundFrom(track.id, from);
  flash(`Sonido copiado de ${trackById(getSong(), from).name}`);
}

// Pantallas de Modifiers: la curva del filtro y las dos envolventes, con retícula de osciloscopio.

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function graticule(ctx, W, H) {
  const cols = 10, rows = 8, dx = W / cols, dy = H / rows;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = css('--grid');
  ctx.beginPath();
  for (let i = 1; i < cols; i++) { const x = Math.round(i * dx) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let j = 1; j < rows; j++) { const y = Math.round(j * dy) + 0.5; ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  ctx.strokeStyle = css('--grid2');
  ctx.beginPath();
  const cx = Math.round(W / 2) + 0.5, cy = Math.round(H / 2) + 0.5;
  ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.moveTo(0, cy); ctx.lineTo(W, cy);
  for (let i = 0; i < cols * 5; i++) { const x = Math.round((i * dx) / 5) + 0.5; ctx.moveTo(x, cy - 5); ctx.lineTo(x, cy + 5); }
  for (let j = 0; j < rows * 5; j++) { const y = Math.round((j * dy) / 5) + 0.5; ctx.moveTo(cx - 5, y); ctx.lineTo(cx + 5, y); }
  ctx.stroke();
  ctx.restore();
}

function prepare(id) {
  const c = $(id);
  c.width = c.clientWidth * 2;
  c.height = c.clientHeight * 2;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  graticule(ctx, c.width, c.height);
  return [ctx, c.width, c.height];
}

function drawModifiers() {
  const track = editing();
  if (!track || !track.sound) return;
  const p = soundTimes(track.sound);
  drawFilter(track.sound, p);
  drawEnvelope('ec', [p.attack, p.decay, p.sustain, p.release], 1);
  drawEnvelope('fe', [p.contourAttack, p.contourDecay, p.contourSustain, p.release], p.contour);
}

function drawFilter(sound, p) {
  const [ctx, W, H] = prepare('fc');
  const q = Math.max(sound.res, 0.0001);
  ctx.strokeStyle = css('--tre');
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= W; i++) {
    const r = (20 * Math.pow(1000, i / W)) / p.cutoff;
    let db = -20 * Math.log10(Math.sqrt(Math.pow(1 - r * r, 2) + Math.pow(r / q, 2)));
    db = Math.max(-40, Math.min(30, db));
    const y = db >= 0 ? H * 0.4 - (db / 30) * H * 0.35 : H * 0.4 + (-db / 40) * H * 0.55;
    if (i) ctx.lineTo(i, y); else ctx.moveTo(i, y);
  }
  ctx.stroke();
  ctx.fillStyle = css('--trl');
  ctx.font = '20px system-ui';
  ctx.fillText('graves', 10, H - 10);
  ctx.textAlign = 'right';
  ctx.fillText('agudos', W - 10, H - 10);
}

/** Envolvente A D S R; amount escala la altura (Filter Contour). */
function drawEnvelope(id, [a, d, s, r], amount) {
  const [ctx, W, H] = prepare(id);
  const hold = 0.6, total = a + d + hold + r, pad = 8;
  const u = (W - 2 * pad) / total, bottom = H - pad - 24, h = bottom - pad - 4;
  const points = [[0, 0], [a, 1], [a + d, s], [a + d + hold, s], [total, 0]];
  ctx.strokeStyle = css('--tre');
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach(([t, v], i) => {
    const x = pad + t * u, y = bottom - v * h * amount;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = css('--trl');
  ctx.font = '20px system-ui';
  ctx.textAlign = 'center';
  [['A', a / 2], ['D', a + d / 2], ['S', a + d + hold / 2], ['R', a + d + hold + r / 2]]
    .forEach(([label, t]) => ctx.fillText(label, pad + t * u, H - 8));
}

// Scope: la envolvente medida en tiempo real (naranja) y la forma del oscilador 1 ralentizada (verde).

function shape(p, wave) {
  p -= Math.floor(p);
  if (wave === 'square') return p < 0.5 ? 1 : -1;
  if (wave === 'pulse') return p < 0.2 ? 1 : -1;
  if (wave === 'sawtooth') return 1 - 2 * p;
  return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
}

const history = [];
let tick = 0, lastFrame = 0, samples = null;

function scopeLoop(ts) {
  requestAnimationFrame(scopeLoop);
  if (getView().pane !== 'sound' || ts - lastFrame < 1000 / 60) return;
  lastFrame = ts;
  const track = editing();
  if (!track || !track.sound) return;
  const c = $('scope');
  const W = c.clientWidth * 2, H = c.clientHeight * 2;
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }

  let peak = 0;
  if (audio.analyser) {
    if (!samples) samples = new Float32Array(audio.analyser.fftSize);
    audio.analyser.getFloatTimeDomainData(samples);
    for (const v of samples) peak = Math.max(peak, Math.abs(v));
  }
  const cols = Math.floor(W / 3);
  history.push({ peak: Math.min(peak / 0.5, 1), phase: tick / 9, wave: track.sound.osc[0].wave });
  tick++;
  while (history.length > cols) history.shift();

  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  graticule(ctx, W, H);
  const mid = H / 2, scale = H * 0.44, offset = cols - history.length, dx = W / cols;
  ctx.strokeStyle = css('--trb');
  ctx.lineWidth = 2;
  ctx.beginPath();
  history.forEach((h, i) => {
    const x = (offset + i) * dx, y = mid - h.peak * scale * shape(h.phase, h.wave);
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  });
  ctx.stroke();
  ctx.strokeStyle = css('--trf');
  ctx.lineWidth = 3;
  for (const sign of [1, -1]) {
    ctx.beginPath();
    history.forEach((h, i) => {
      const x = (offset + i) * dx, y = mid - sign * h.peak * scale;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.stroke();
  }
}
