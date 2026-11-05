// Pantalla de la canción: transporte, archivo y la lista de tracks con sus piano rolls chicos.

import { bindSwitch, bindSlider } from './controls.js';
import { confirmDialog, notice, flash } from './dialogs.js';
import {
  getSong, onSongChange, newSong, replaceSong, setSongName, setTracksVolume,
  setTrackVolume, setTrackMute, clearTrack, addTrack, removeTrack, renameTrack,
} from '../state/actions.js';
import { getView, setView, onViewChange } from '../state/view.js';
import {
  PRESETS, MAX_TRACKS, rhythmOf, meterOf, loopSteps, drumIndex, isFixedTrack, isFactorySound,
} from '../state/song.js';
import { play, stop, isPlaying, position, onPlayerChange } from '../seq/player.js';
import * as recorder from '../seq/recorder.js';
import * as songFile from '../io/song-file.js';

const $ = (id) => document.getElementById(id);

export function setupSongPane() {
  setupTransport();
  setupFiles();
  buildTracks();

  const tracksVol = bindSlider($('tracksvol'), $('tracksvolo'), (v) => v.toFixed(1), setTracksVolume);

  onSongChange((action) => {
    if (['newSong', 'replaceSong', 'addTrack', 'removeTrack'].includes(action)) buildTracks();
    updateTracks();
    tracksVol.set(getSong().mix.tracks);
    if (document.activeElement !== $('songname')) $('songname').value = getSong().name;
  });
  onViewChange((patch) => { if ('selectedTrackId' in patch) updateTracks(); });
  recorder.onRecorderChange(updateTracks);
  onPlayerChange(() => { dirty = true; });

  $('addl').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-add]');
    if (!b) return;
    if (recorder.isActive()) { flash('No se puede sumar un track mientras se graba'); return; }
    const id = addTrack(b.dataset.add);
    if (id) setView({ selectedTrackId: id });
  });

  $('songname').value = getSong().name;
  $('songname').addEventListener('change', (e) => setSongName(e.target.value));
  $('songname').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });

  requestAnimationFrame(drawLoop);
}

// Transporte

function setupTransport() {
  const buttons = document.querySelectorAll('[data-play]');
  buttons.forEach((b) => b.addEventListener('click', () => (isPlaying() ? stop() : play(0))));
  let wasPlaying = null;
  onPlayerChange(() => {
    if (position.playing === wasPlaying) return;
    wasPlaying = position.playing;
    buttons.forEach((b) => {
      b.classList.toggle('on', position.playing);
      b.innerHTML = position.playing ? '&#9632; Stop' : '&#9654; Play';
    });
  });

  const click = bindSwitch($('clicksw'), $('clicklab'), 'Click', () => setView({ click: !getView().click }));
  click.set(getView().click);
  onViewChange((patch) => { if ('click' in patch) click.set(patch.click); });
}

// Archivo

function setupFiles() {
  $('newsong').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Nueva canción',
      text: 'Se empieza una canción vacía. Lo que no guardaste de esta canción se pierde.',
      ok: 'Empezar una nueva',
      danger: true,
    });
    if (!ok) return;
    stop();
    newSong();
    setView({ selectedTrackId: 'bass' });
  });

  $('save').addEventListener('click', async () => {
    try {
      await songFile.save(getSong());
      flash('Canción guardada');
    } catch (e) {
      flash(e instanceof songFile.SongFileError ? e.message : 'No se pudo guardar aquí.');
    }
  });

  $('open').addEventListener('click', () => $('openfile').click());
  $('openfile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const song = await songFile.open(file);
      stop();
      replaceSong(song);
      setView({ selectedTrackId: 'bass' });
      flash(`Abierta: ${song.name}`);
    } catch (err) {
      await notice('No se pudo abrir la canción', err instanceof songFile.SongFileError ? err.message : 'El archivo no se pudo leer.');
    }
  });
}

// Tracks

function rowHtml(track, index) {
  const vol = `<span class="mrange"><input type="range" data-act="vol" min="0" max="10" step="0.1" aria-label="Volumen de ${track.name}"><span class="kv"></span></span>`;
  if (track.type === 'rhythm') {
    return `
      <div class="lrow" data-id="${track.id}">
        <div class="lnum">${index + 1}</div>
        <div class="lname">${track.name}<small data-sum></small></div>
        <div></div>
        <button type="button" data-act="edit" class="on">Editar</button>
        <div></div>
        <button type="button" data-act="mute" class="muteb" aria-pressed="false">Mute</button>
        <div></div>
        <div></div>
        ${vol}
        <canvas class="roll" aria-label="Pasos del ritmo"></canvas>
      </div>`;
  }
  return `
    <div class="lrow pick" data-id="${track.id}">
      <div class="lnum">${index + 1}</div>
      <div class="lname"><input type="text" data-act="name" maxlength="24" autocomplete="off" aria-label="Nombre del track ${index + 1}"><small data-snd></small></div>
      <div class="lamps"><span class="lamp ready">GET READY</span><span class="lamp go">GO!</span></div>
      <button type="button" data-act="rec" class="recb">&#9679; Rec</button>
      <button type="button" data-act="sound" class="on">Sonido</button>
      <button type="button" data-act="mute" class="muteb" aria-pressed="false">Mute</button>
      <button type="button" data-act="clear">Clear</button>
      ${isFixedTrack(track) ? '<div></div>' : '<button type="button" data-act="del" class="delb">Borrar</button>'}
      ${vol}
      <canvas class="roll" aria-label="Notas de ${track.name}"></canvas>
    </div>`;
}

const sliders = new Map();

function buildTracks() {
  const box = $('tracks');
  box.innerHTML = getSong().tracks.map(rowHtml).join('');
  sliders.clear();
  box.querySelectorAll('.lrow').forEach((row) => {
    const id = row.dataset.id;
    const input = row.querySelector('[data-act=vol]');
    sliders.set(id, bindSlider(input, row.querySelector('.mrange .kv'), (v) => v.toFixed(1), (v) => setTrackVolume(id, v)));
    row.addEventListener('click', (e) => onRowClick(e, id));
    const name = row.querySelector('[data-act=name]');
    if (name) {
      name.addEventListener('change', () => renameTrack(id, name.value));
      name.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          if (e.key === 'Escape') name.value = getSong().tracks.find((t) => t.id === id).name;
          name.blur();
        }
      });
    }
  });
  const count = getSong().tracks.length;
  $('tcount').textContent = `${count} de ${MAX_TRACKS} tracks`;
  $('addl').querySelectorAll('button').forEach((b) => { b.disabled = count >= MAX_TRACKS; });
  updateTracks();
}

async function onRowClick(e, id) {
  const act = e.target.closest('[data-act]');
  const track = getSong().tracks.find((t) => t.id === id);
  if (!act || act.dataset.act === 'vol' || act.dataset.act === 'name') {
    if (act?.dataset.act !== 'vol' && track.type !== 'rhythm') setView({ selectedTrackId: id });
    return;
  }
  switch (act.dataset.act) {
    case 'edit':
      setView({ pane: 'rhythm' });
      break;
    case 'mute':
      setTrackMute(id, !track.mute);
      break;
    case 'rec':
      setView({ selectedTrackId: id });
      recorder.arm(id);
      break;
    case 'sound':
      setView({ selectedTrackId: id, pane: 'sound' });
      break;
    case 'del': {
      if (recorder.isActive()) { flash('No se puede borrar un track mientras se graba'); return; }
      const ok = await confirmDialog({
        title: `Borrar el track ${track.name}`,
        text: track.notes.length
          ? 'Se borran el track, sus notas y su sonido. Esto todavía no se puede deshacer.'
          : 'Se borra el track y su sonido. Esto todavía no se puede deshacer.',
        ok: 'Borrar el track',
        danger: true,
      });
      if (!ok) return;
      if (getView().selectedTrackId === id) setView({ selectedTrackId: 'bass' });
      removeTrack(id);
      break;
    }
    case 'clear': {
      if (!track.notes.length) return;
      const ok = await confirmDialog({
        title: `Borrar las notas de ${track.name}`,
        text: 'El track queda vacío. Esto todavía no se puede deshacer.',
        ok: 'Borrar las notas',
        danger: true,
      });
      if (ok) clearTrack(id);
      break;
    }
  }
}

function updateTracks() {
  const song = getSong();
  const rec = recorder.status();
  const selected = getView().selectedTrackId;
  for (const track of song.tracks) {
    const row = document.querySelector(`.lrow[data-id="${track.id}"]`);
    if (!row) continue;
    row.classList.toggle('sel', track.id === selected);
    const mute = row.querySelector('[data-act=mute]');
    mute.classList.toggle('on', track.mute);
    mute.setAttribute('aria-pressed', track.mute);
    sliders.get(track.id).set(track.vol);
    if (track.type === 'rhythm') {
      const r = rhythmOf(song);
      const name = r.preset >= 0 ? PRESETS[r.preset].name : 'Custom';
      row.querySelector('[data-sum]').textContent = `${name} · ${meterOf(song).label} · Loop ${r.loop} · ${r.tempo} BPM`;
    } else {
      const mine = rec && rec.trackId === track.id;
      row.querySelector('.recb').classList.toggle('on', !!mine);
      row.querySelector('.lamp.ready').classList.toggle('lit', !!(mine && rec.phase === 'ready'));
      row.querySelector('.lamp.go').classList.toggle('lit', !!(mine && rec.phase === 'go'));
      row.querySelector('[data-act=clear]').disabled = track.notes.length === 0;
      row.querySelector('[data-snd]').textContent = isFactorySound(track) ? 'sonido de fábrica' : 'sonido propio';
      const name = row.querySelector('[data-act=name]');
      if (document.activeElement !== name) name.value = track.name;
    }
  }
  dirty = true;
}

// Piano rolls chicos: se dibujan en cada cuadro solo si algo cambió.

let dirty = true;

function drawLoop() {
  requestAnimationFrame(drawLoop);
  if (!dirty) return;
  dirty = false;
  const song = getSong();
  for (const track of song.tracks) {
    const canvas = document.querySelector(`.lrow[data-id="${track.id}"] .roll`);
    if (!canvas || !canvas.clientWidth) continue;
    const ctx = fitCanvas(canvas);
    if (track.type === 'rhythm') drawRhythm(ctx, song, track);
    else drawNotes(ctx, song, track);
  }
}

function fitCanvas(canvas) {
  const w = canvas.clientWidth * 2, h = canvas.clientHeight * 2;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function drawGrid(ctx, song) {
  const { width: W, height: H } = ctx.canvas;
  const L = loopSteps(song);
  const meter = meterOf(song);
  ctx.lineWidth = 1;
  ctx.strokeStyle = css('--grid');
  ctx.beginPath();
  for (let i = meter.grp; i < L; i += meter.grp) {
    const x = Math.round((i / L) * W) + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  ctx.stroke();
  ctx.strokeStyle = css('--grid2');
  ctx.beginPath();
  for (let i = meter.n; i < L; i += meter.n) {
    const x = Math.round((i / L) * W) + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  ctx.stroke();
}

function drawPlayhead(ctx, song) {
  if (!position.playing || position.step < 0) return;
  const L = loopSteps(song);
  const x = ((position.step % L) / L) * ctx.canvas.width;
  ctx.fillStyle = css('--hl');
  ctx.fillRect(x, 0, 3, ctx.canvas.height);
}

function drawRhythm(ctx, song, rhythm) {
  const { width: W, height: H } = ctx.canvas;
  const L = loopSteps(song);
  const n = meterOf(song).n;
  drawGrid(ctx, song);
  ctx.fillStyle = rhythm.mute ? '#555' : css('--note');
  const lanes = rhythm.rows.length;
  rhythm.rows.forEach((row, r) => {
    const y = H - ((r + 0.5) / lanes) * H;
    for (let i = 0; i < L; i++) {
      if (!row.steps[drumIndex(Math.floor(i / n), i % n)]) continue;
      const x = ((i + 0.5) / L) * W;
      ctx.beginPath();
      ctx.arc(x, y, Math.min(7, (W / L) * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
  });
  drawPlayhead(ctx, song);
}

function drawNotes(ctx, song, track) {
  const { width: W, height: H } = ctx.canvas;
  const L = loopSteps(song);
  drawGrid(ctx, song);
  const live = recorder.liveNotes(track.id);
  const notes = live || track.notes;
  let lo = 0, hi = 24;
  for (const n of notes) { lo = Math.min(lo, n.n); hi = Math.max(hi, n.n); }
  ctx.fillStyle = live ? '#ff6b66' : track.mute ? '#555' : css('--note');
  for (const n of notes) {
    if (n.st >= L) continue;
    const x = (n.st / L) * W;
    const w = Math.max(3, (Math.min(n.du, L - n.st) / L) * W);
    const y = H - 6 - ((n.n - lo) / (hi - lo)) * (H - 14);
    ctx.fillRect(x, y - 4, w, 8);
  }
  drawPlayhead(ctx, song);
}

/** Pide volver a dibujar los rolls (al cambiar el tamaño, por ejemplo). */
export function redrawRolls() { dirty = true; }
