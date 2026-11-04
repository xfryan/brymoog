// Guardar y abrir canciones. El archivo es el objeto de la canción en JSON.
// En la 1.1 guardar es una descarga; en la 1.4 pasa a actualizar el mismo archivo.

import {
  APP, FORMAT, METERS, LOOPS, PRESETS, CUSTOM_PRESET, DRUMS, DRUM_STEPS,
  TEMPO_MIN, TEMPO_MAX, createSong,
} from '../state/song.js';
import { FACTORY_SOUNDS, copySound } from '../state/sounds.js';

export const MAX_BYTES = 1024 * 1024;
const WAVES = ['triangle', 'sawtooth', 'square', 'pulse'];

/** Error con un mensaje para mostrarle a la persona. */
export class SongFileError extends Error {}

export function serialize(song) {
  return JSON.stringify(song, null, 1);
}

export function fileName(song) {
  const base = (song.name || 'Canción').replace(/[\\/:*?"<>|]+/g, '').trim() || 'Canción';
  return base + '.b-moog-9.json';
}

/**
 * Lee el texto de un archivo y devuelve una canción válida.
 * Lanza SongFileError con un mensaje claro si no se puede abrir.
 */
export function parse(text) {
  if (text.length > MAX_BYTES) throw new SongFileError('El archivo pesa más de 1 MB y no parece una canción.');
  let data;
  try { data = JSON.parse(text); } catch { throw new SongFileError('El archivo no es una canción: no se pudo leer.'); }
  if (!data || typeof data !== 'object') throw new SongFileError('El archivo no es una canción.');

  if (data.app !== APP) {
    if (typeof data.app === 'string' && /^B-MOOG \d+$/.test(data.app)) {
      throw new SongFileError(`Este archivo fue creado con el ${data.app} y por ahora solo se puede usar con ese sinte.`);
    }
    throw new SongFileError('El archivo no es una canción del B-MOOG 9.');
  }
  if (!Number.isInteger(data.format) || data.format < 1) throw new SongFileError('El archivo no dice qué versión del formato usa.');
  if (data.format > FORMAT) throw new SongFileError('Esta canción se guardó con una versión más nueva del B-MOOG 9. Recarga la página para usar la última.');

  return sanitize(data);
}

// Arma una canción desde cero y copia solo los valores válidos del archivo.
function sanitize(data) {
  const song = createSong();
  const num = (v, min, max, def) => (typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : def);
  const int = (v, min, max, def) => Math.round(num(v, min, max, def));

  if (typeof data.name === 'string') song.name = data.name.slice(0, 80) || song.name;
  song.mix.tracks = num(data.mix && data.mix.tracks, 0, 10, song.mix.tracks);

  const tracks = Array.isArray(data.tracks) ? data.tracks : [];
  const inR = tracks.find((t) => t && t.type === 'rhythm');
  const r = song.tracks[0];
  if (inR) {
    r.vol = num(inR.vol, 0, 10, r.vol);
    r.mute = !!inR.mute;
    r.tempo = int(inR.tempo, TEMPO_MIN, TEMPO_MAX, r.tempo);
    r.meter = int(inR.meter, 0, METERS.length - 1, r.meter);
    r.loop = LOOPS.includes(inR.loop) ? inR.loop : r.loop;
    r.preset = int(inR.preset, CUSTOM_PRESET, PRESETS.length - 1, CUSTOM_PRESET);
    const rows = Array.isArray(inR.rows) ? inR.rows : [];
    r.rows = DRUMS.map((d) => {
      const row = rows.find((x) => x && x.id === d.id) || {};
      const steps = Array.isArray(row.steps) ? row.steps : [];
      return { id: d.id, vol: num(row.vol, 0, 10, d.vol), steps: Array.from({ length: DRUM_STEPS }, (_, i) => steps[i] === true) };
    });
  }

  for (const track of song.tracks.slice(1)) {
    const inT = tracks.find((t) => t && t.id === track.id);
    if (!inT) continue;
    track.vol = num(inT.vol, 0, 10, track.vol);
    track.mute = !!inT.mute;
    track.notes = (Array.isArray(inT.notes) ? inT.notes : [])
      .slice(0, 4000)
      .filter((n) => n && isFinite(n.n) && isFinite(n.st) && isFinite(n.du))
      .map((n) => ({ n: int(n.n, -48, 79, 0), st: Math.max(0, +n.st), du: Math.max(0.05, +n.du) }));
    track.sound = sanitizeSound(inT.sound, FACTORY_SOUNDS[track.type], num, int);
  }
  return song;
}

function sanitizeSound(s, base, num, int) {
  const out = copySound(base);
  if (!s || typeof s !== 'object') return out;
  out.cut = num(s.cut, 0, 1000, out.cut);
  out.res = num(s.res, 0, 30, out.res);
  for (const k of ['atk', 'dec', 'rel', 'fatk', 'fdec']) out[k] = num(s[k], 0, 1000, out[k]);
  for (const k of ['sus', 'famt', 'fsus']) out[k] = num(s[k], 0, 100, out[k]);
  const osc = Array.isArray(s.osc) ? s.osc : [];
  out.osc = out.osc.map((o, i) => {
    const x = osc[i] || {};
    return {
      oct: int(x.oct, -8, 2, o.oct),
      wave: WAVES.includes(x.wave) ? x.wave : o.wave,
      cents: num(x.cents, -1200, 1200, o.cents),
      vol: num(x.vol, 0, 10, o.vol),
      on: typeof x.on === 'boolean' ? x.on : o.on,
    };
  });
  return out;
}

/**
 * Guarda la canción como descarga. Dentro de claude.ai usa la capacidad de
 * descargas del artifact; en el sitio, una descarga normal del navegador.
 */
export async function save(song) {
  const data = serialize(song);
  const name = fileName(song);
  let api = null;
  try {
    const c = window.claude || (window.parent !== window && window.parent.claude);
    if (c && c.use) api = await c.use('downloads');
  } catch { api = null; }
  if (api && api.save) {
    try {
      await api.save({ filename: name, data });
    } catch (e) {
      throw new SongFileError(e && e.code === 'declined' ? 'Guardado cancelado.' : 'No se pudo guardar aquí.');
    }
    return name;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return name;
}

/** Lee un File elegido por la persona y devuelve la canción. */
export async function open(file) {
  if (file.size > MAX_BYTES) throw new SongFileError('El archivo pesa más de 1 MB y no parece una canción.');
  return parse(await file.text());
}
