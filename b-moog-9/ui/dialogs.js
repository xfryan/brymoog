// Ventanas modales (ayuda, confirmaciones, avisos) y el aviso corto de abajo.

const $ = (id) => document.getElementById(id);

// Mientras hay una ventana abierta, las teclas no tocan notas.
function trapKeys(modal, onEscape) {
  modal.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') onEscape();
  });
  modal.addEventListener('keyup', (e) => e.stopPropagation());
}

export function setupHelp() {
  const modal = $('help');
  const open = (v) => {
    modal.hidden = !v;
    $(v ? 'helpx' : 'helpbtn').focus();
  };
  $('helpbtn').addEventListener('click', () => open(true));
  $('helpx').addEventListener('click', () => open(false));
  modal.addEventListener('click', (e) => { if (e.target === modal) open(false); });
  trapKeys(modal, () => open(false));
}

let closeDialog = null;
{
  const modal = $('dialog');
  trapKeys(modal, () => closeDialog && closeDialog(false));
  modal.addEventListener('click', (e) => { if (e.target === modal && closeDialog) closeDialog(false); });
}

/**
 * Pregunta antes de hacer algo. Devuelve true si la persona confirma.
 * @param {{title: string, text: string, ok: string, cancel?: string, danger?: boolean}} opts
 */
export function confirmDialog({ title, text, ok, cancel = 'Cancelar', danger = false }) {
  return showDialog(title, text, [
    { label: ok, value: true, cls: danger ? 'warn' : 'on' },
    { label: cancel, value: false },
  ]);
}

/**
 * Pregunta con varias respuestas. Devuelve el value del botón elegido; Escape o clic afuera devuelve false.
 * @param {{title: string, text: string, buttons: {label: string, value: any, cls?: string}[]}} opts
 */
export function choose({ title, text, buttons }) {
  return showDialog(title, text, buttons);
}

/** Aviso con un solo botón. */
export function notice(title, text) {
  return showDialog(title, text, [{ label: 'Entendido', value: true }]);
}

function showDialog(title, text, buttons) {
  const modal = $('dialog');
  const back = document.activeElement;
  $('dlgt').textContent = title;
  $('dlgp').textContent = text;
  const box = $('dlgb');
  box.innerHTML = '';
  return new Promise((resolve) => {
    closeDialog = (value) => {
      modal.hidden = true;
      closeDialog = null;
      if (back && back.focus) back.focus();
      resolve(value);
    };
    for (const b of buttons) {
      const el = document.createElement('button');
      el.type = 'button';
      el.textContent = b.label;
      if (b.cls) el.className = b.cls;
      el.addEventListener('click', () => closeDialog(b.value));
      box.appendChild(el);
    }
    modal.hidden = false;
    box.firstChild.focus();
  });
}

let flashTimer = 0;
/** Aviso corto abajo de la pantalla ("Canción guardada"). */
export function flash(text) {
  const el = $('flash');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { el.hidden = true; }, 2200);
}
