// Reloj con lookahead: cada 25 ms programa los pasos que caen en los próximos 0,1 s.
// Así el tiempo lo lleva el reloj de audio, que es exacto, y no los timers del navegador.
//
// También tiene una cola de avisos para la pantalla: cosas que deben pasar en la
// pantalla justo cuando suena un paso (encender una luz, mover la línea de avance).

import { audio } from '../audio/engine.js';

const TICK_MS = 25;
const LOOKAHEAD = 0.1;
const START_DELAY = 0.06;

/**
 * @param {object} opts
 * @param {() => number} opts.stepDuration  Duración del paso en segundos (puede cambiar con el tempo).
 * @param {(step: number, time: number, duration: number) => void} opts.onStep
 */
export function createClock({ stepDuration, onStep }) {
  let timer = null;
  let nextTime = 0;
  let step = 0;

  function tick() {
    const limit = audio.ctx.currentTime + LOOKAHEAD;
    while (nextTime < limit) {
      const duration = stepDuration();
      onStep(step, nextTime, duration);
      nextTime += duration;
      step++;
    }
  }

  return {
    /** Empieza en un paso; un paso negativo es la cuenta previa. */
    start(fromStep = 0) {
      this.stop();
      step = fromStep;
      nextTime = audio.ctx.currentTime + START_DELAY;
      tick();
      timer = setInterval(tick, TICK_MS);
    },
    stop() {
      clearInterval(timer);
      timer = null;
      queue.length = 0;
    },
    get running() { return timer !== null; },
    /** Próximo paso a programar. */
    get step() { return step; },
  };
}

const queue = [];

/** Ejecuta fn en la pantalla cuando el reloj de audio llegue a time. */
export function atAudioTime(time, fn) {
  queue.push([time, fn]);
}

function drain() {
  requestAnimationFrame(drain);
  if (!audio.ctx) return;
  const now = audio.ctx.currentTime;
  while (queue.length && queue[0][0] <= now) queue.shift()[1]();
}
requestAnimationFrame(drain);
