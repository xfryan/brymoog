// Controles reutilizables de la interfaz: perilla, selector giratorio, slider vertical, switch y slider.

const SVG = 'http://www.w3.org/2000/svg';

/** Número de control del manual de Moog, en una pastilla al lado del nombre. */
export const badge = (num) => (num ? `<span class="n">${num}</span>` : '');

const point = (a, r, cx = 50, cy = 50) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];

function arcPath(a0, a1, r) {
  const [x0, y0] = point(a0, r);
  const [x1, y1] = point(a1, r);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
}

/**
 * Perilla continua: se arrastra hacia arriba o abajo, con la rueda o con las flechas.
 * Doble clic vuelve al valor inicial.
 */
export function createKnob(container, { label, sub, num = '', min, max, step = 1, value, format, onInput }) {
  const A0 = -0.75 * Math.PI;
  const SPAN = 1.5 * Math.PI;
  container.className = 'kn';
  container.innerHTML = `
    <div class="knob" tabindex="0" role="slider" aria-label="${label}" aria-valuemin="${min}" aria-valuemax="${max}">
      <svg viewBox="0 0 100 100"><path class="ktrack"/><path class="karc"/><circle class="kbody" cx="50" cy="50" r="30"/><line class="kptr" x1="50" y1="50" x2="50" y2="24"/></svg>
    </div>
    <div class="kl">${badge(num)}${label} <small>${sub}</small></div>
    <div class="kv"></div>`;
  const knob = container.querySelector('.knob');
  const out = container.querySelector('.kv');
  knob.querySelector('.ktrack').setAttribute('d', arcPath(A0, A0 + SPAN, 40));
  const initial = value;
  let current = value;

  function draw() {
    const f = (current - min) / (max - min);
    const a = A0 + SPAN * f;
    knob.querySelector('.karc').setAttribute('d', f > 0.001 ? arcPath(A0, a, 40) : '');
    const [x, y] = point(a, 26);
    knob.querySelector('.kptr').setAttribute('x2', x);
    knob.querySelector('.kptr').setAttribute('y2', y);
    knob.setAttribute('aria-valuenow', current);
    out.textContent = format(current);
  }

  function change(v) {
    v = Math.min(max, Math.max(min, Math.round(v / step) * step));
    if (v === current) return;
    current = v;
    draw();
    onInput(v);
  }

  let dragging = false, y0 = 0, v0 = 0;
  knob.addEventListener('pointerdown', (e) => {
    dragging = true;
    y0 = e.clientY;
    v0 = current;
    knob.setPointerCapture(e.pointerId);
    knob.focus();
    e.preventDefault();
  });
  knob.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const pixels = e.shiftKey ? 720 : 180;
    change(v0 + ((y0 - e.clientY) / pixels) * (max - min));
  });
  for (const t of ['pointerup', 'pointercancel']) knob.addEventListener(t, () => { dragging = false; });
  knob.addEventListener('wheel', (e) => {
    e.preventDefault();
    change(current - Math.sign(e.deltaY) * step);
  }, { passive: false });
  knob.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); change(current + step); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); change(current - step); }
  });
  knob.addEventListener('dblclick', () => change(initial));
  draw();

  return {
    set(v) { current = v; draw(); },
  };
}

/**
 * Selector giratorio para opciones discretas (Meter, Loop).
 * onChange recibe el índice pedido; quien lo usa decide si lo acepta y llama a set().
 */
export function createRotary(container, { label, sub, num = '', options, value, onChange }) {
  const cx = 75, cy = 66;
  const angles = options.map((_, i) => ((i - (options.length - 1) / 2) * 55 * Math.PI) / 180);
  let ticks = '', texts = '';
  options.forEach((text, i) => {
    const s = Math.sin(angles[i]), c = Math.cos(angles[i]);
    ticks += `<line class="tick" data-i="${i}" x1="${(cx + 34 * s).toFixed(1)}" y1="${(cy - 34 * c).toFixed(1)}" x2="${(cx + 41 * s).toFixed(1)}" y2="${(cy - 41 * c).toFixed(1)}"/>`;
    texts += `<text data-i="${i}" x="${(cx + 55 * s).toFixed(1)}" y="${(cy - 55 * c + 4).toFixed(1)}" text-anchor="middle">${text}</text>`;
  });
  container.className = 'rotary';
  container.innerHTML = `
    <div class="rsel" tabindex="0" role="slider" aria-label="${label}" aria-valuemin="0" aria-valuemax="${options.length - 1}">
      <svg viewBox="0 0 150 126">${ticks}${texts}<circle class="kbody" cx="${cx}" cy="${cy}" r="27"/><line class="kptr" x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - 22}"/></svg>
    </div>
    <div class="kl">${badge(num)}${label} <small>${sub}</small></div>`;
  const el = container.querySelector('.rsel');
  const pointer = el.querySelector('.kptr');
  let current = value;

  function draw() {
    const a = angles[current];
    pointer.setAttribute('x2', (cx + 22 * Math.sin(a)).toFixed(1));
    pointer.setAttribute('y2', (cy - 22 * Math.cos(a)).toFixed(1));
    el.querySelectorAll('[data-i]').forEach((n) => n.classList.toggle('on', +n.dataset.i === current));
    el.setAttribute('aria-valuenow', current);
    el.setAttribute('aria-valuetext', options[current]);
  }

  const ask = (i) => {
    i = Math.max(0, Math.min(options.length - 1, i));
    if (i !== current) onChange(i);
  };

  let dragging = false, y0 = 0, i0 = 0;
  el.addEventListener('pointerdown', (e) => {
    el.focus();
    const text = e.target.closest('text[data-i]');
    if (text) { ask(+text.dataset.i); return; }
    dragging = true;
    y0 = e.clientY;
    i0 = current;
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const i = i0 + Math.round((y0 - e.clientY) / 28);
    if (i !== current) { dragging = false; ask(i); }
  });
  for (const t of ['pointerup', 'pointercancel']) el.addEventListener(t, () => { dragging = false; });
  el.addEventListener('wheel', (e) => { e.preventDefault(); ask(current - Math.sign(e.deltaY)); }, { passive: false });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); ask(current + 1); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); ask(current - 1); }
  });
  draw();

  return {
    set(i) { current = i; draw(); },
  };
}

/**
 * Slider vertical (Modifiers): se arrastra el control o se hace clic en la guía; rueda y flechas
 * también lo mueven. Doble clic vuelve al valor inicial, o al que devuelva reset().
 */
export function createFader(container, { label, sub, num = '', min, max, step = 1, value, format, onInput, reset }) {
  container.className = 'kn';
  container.innerHTML = `
    <div class="fader" tabindex="0" role="slider" aria-orientation="vertical" aria-label="${label}" aria-valuemin="${min}" aria-valuemax="${max}">
      <div class="ftrack"><div class="ffill"></div><div class="fthumb"></div></div>
    </div>
    <div class="kl">${badge(num)}${label} <small>${sub}</small></div>
    <div class="kv"></div>`;
  const fader = container.querySelector('.fader');
  const track = fader.querySelector('.ftrack');
  const out = container.querySelector('.kv');
  const initial = value;
  let current = value;

  function draw() {
    const f = (current - min) / (max - min);
    fader.querySelector('.ffill').style.height = f * 100 + '%';
    fader.querySelector('.fthumb').style.bottom = f * 100 + '%';
    fader.setAttribute('aria-valuenow', current);
    out.textContent = format(current);
  }

  function change(v) {
    v = Math.min(max, Math.max(min, Math.round(v / step) * step));
    if (v === current) return;
    current = v;
    draw();
    onInput(v);
  }

  const fromY = (y) => {
    const r = track.getBoundingClientRect();
    return min + ((r.bottom - y) / r.height) * (max - min);
  };

  let dragging = false, y0 = 0, v0 = 0;
  fader.addEventListener('pointerdown', (e) => {
    dragging = true;
    fader.setPointerCapture(e.pointerId);
    fader.focus();
    e.preventDefault();
    if (!e.target.closest('.fthumb')) change(fromY(e.clientY));
    y0 = e.clientY;
    v0 = current;
  });
  fader.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const fine = e.shiftKey ? 0.25 : 1;
    change(v0 + ((y0 - e.clientY) / track.getBoundingClientRect().height) * (max - min) * fine);
  });
  for (const t of ['pointerup', 'pointercancel']) fader.addEventListener(t, () => { dragging = false; });
  fader.addEventListener('wheel', (e) => {
    e.preventDefault();
    change(current - Math.sign(e.deltaY) * (max - min) / 100);
  }, { passive: false });
  fader.addEventListener('keydown', (e) => {
    const d = (max - min) / (e.shiftKey ? 500 : 100);
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); change(current + d); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); change(current - d); }
  });
  fader.addEventListener('dblclick', () => change(reset ? reset() : initial));
  draw();

  return {
    set(v) { current = v; draw(); },
  };
}

/** Switch tipo iOS con su estado escrito ("Hold ON" / "Hold OFF"). */
export function bindSwitch(button, labelEl, name, onToggle) {
  button.addEventListener('click', () => onToggle());
  button.addEventListener('keydown', (e) => { if (e.code === 'Space') e.stopPropagation(); });
  return {
    set(on) {
      button.classList.toggle('on', on);
      button.setAttribute('aria-checked', on);
      labelEl.textContent = `${name} ${on ? 'ON' : 'OFF'}`;
      labelEl.classList.toggle('on', on);
    },
  };
}

/** Slider con relleno verde hasta su posición y su valor escrito al lado. */
export function bindSlider(input, outEl, format, onInput) {
  const paint = () => {
    const f = (input.value - input.min) / (input.max - input.min);
    input.style.setProperty('--p', f * 100 + '%');
    if (outEl) outEl.textContent = format(+input.value);
  };
  input.addEventListener('input', () => { paint(); onInput(+input.value); });
  // Las flechas mueven el slider y no tocan notas.
  input.addEventListener('keydown', (e) => e.stopPropagation());
  paint();
  return {
    set(v) {
      if (document.activeElement === input && +input.value === v) return;
      input.value = v;
      paint();
    },
  };
}
