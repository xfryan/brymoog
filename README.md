# Brymoog

Sintetizadores web didácticos inspirados en el panel del Minimoog Model D, de lo simple a lo complejo. Todo el sonido lo genera el navegador con la Web Audio API.

- `index.html`: el hub con pestañas.
- `b-moog-1.html`: 1 oscilador, filtro, envelopes y LFO.
- `b-moog-3.html`: 3 osciladores, monofónico.
- `b-moog-5.html`: polifónico, con drum box.
- `b-moog-7.html`: tracks grabables y canciones en archivo.

Para abrirlo localmente hay que servir la carpeta (el hub carga cada sinte con `fetch`), por ejemplo: `python3 -m http.server` y abrir http://localhost:8000.

Contexto para trabajar con Claude: `CLAUDE.md`.
