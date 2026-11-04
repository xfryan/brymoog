# Brymoog

Sintetizadores web didácticos que Bryan construye con Claude para entender la síntesis de sonido, de lo simple a lo complejo, siguiendo el panel del Minimoog Model D. El contexto completo, las decisiones y las ideas abiertas están en Notion: página "Proyecto Brymoog" (Claude's Corner / Itera Projects). Leerla antes de proponer cambios grandes.

## Dónde se trabaja

**La fuente de verdad es el repositorio privado de GitHub `xfryan/brymoog`** (rama `main`), en la cuenta personal de Bryan. Todo cambio se hace sobre una copia del repositorio y se sube ahí.

Al empezar un hilo nuevo:
1. Agregar el repositorio a la sesión (`add_repo`, owner `xfryan`, repo `brymoog`, acceso `push`) y clonarlo.
2. Editar los archivos en el clon.
3. Probar (ver "Cómo se trabaja").
4. `git commit` y `git push` a `main`, con un mensaje que diga qué cambió.
5. Republicar el artifact desde el clon y copiar los archivos cambiados a la carpeta del Mac.

Copias que se actualizan después de cada cambio, pero no se editan:
- Carpeta del Mac: `~/Claude/Projects/Synths/brymoog/` (para que Bryan tenga los archivos a mano).
- Artifact de claude.ai (es lo que se usa para tocar y compartir, ver "Publicación").

Cuentas de GitHub: `xfryan` es la cuenta de Bryan, donde se guarda. `agentes-itera` es solo una cuenta de trabajo para los agentes: nunca guardar repositorios ahí. La aplicación de Claude está instalada en `xfryan` solo para `brymoog`.

No hay hosting propio todavía: Bryan está evaluando contratar uno. Por ahora el sitio se usa como artifact; GitHub Pages quedó descartado.

## Archivos

- `index.html`: el hub. Pestañas laterales (B-MOOG 1, 3, 5, 7), botón "Acerca de" con enlace a la guía "Leer un Minimoog". Carga cada sinte en un iframe con `srcdoc` (hace `fetch` del archivo) y llama a `window.allOff()` del sinte al cambiar de pestaña.
- `b-moog-1.html`: 1 oscilador, filtro, envelopes, LFO.
- `b-moog-3.html`: 3 osciladores, monofónico (suena la tecla más grave), sin LFO, como el Minimoog.
- `b-moog-5.html`: polifónico + drum box de 16 pasos, 7 ritmos predefinidos + Custom, Meter 4/4, 3/4 y 12/8, Filter Contour, DRUMS VOL.
- `b-moog-7.html`: tracks grabables, loop, canciones en JSON, tambores adicionales. Es donde se concentra el trabajo nuevo.

Cada archivo es autocontenido (HTML, CSS y JS en uno). **Se editan directamente.** Los generadores en Python que se usaron en el primer hilo eran temporales y ya no existen; no intentar reconstruirlos.

## Publicación

- Artifact "Brymoog": https://claude.ai/artifact/Crx23Dd2xWX3q2qRfaxUV4 . Se publica `index.html` como página y los cuatro sintes como `files` (`b-moog-1.html` ... `b-moog-7.html`). Tiene la capability `downloads` (para guardar canciones); se arrastra sola entre publicaciones. Compartido como "cualquiera con el enlace".
- Guía "Leer un Minimoog": https://claude.ai/artifact/9H9R9Y5uCn8RpeyTowJAdB (privada; su HTML no está en la carpeta del Mac).
- Primera publicación desde un hilo nuevo: leer el artifact (`action: read`) y publicar pasando `url`, con `file_path` = `index.html` del clon y `files` apuntando a los cuatro sintes del clon.
- Después de cada cambio: push a GitHub, publicar el artifact, actualizar la carpeta del Mac y entregar los archivos cambiados en el panel lateral.

## Cómo se trabaja

- Bryan pide los cambios con mucho detalle estético. Antes de construir algo nuevo (no un ajuste), presentar el plan con preguntas numeradas y esperar su respuesta.
- Probar con Playwright antes de publicar: sin errores de página, y una captura para mirar el resultado. Decir explícito lo que no se pudo probar (por ejemplo, cómo suena).
- Responder en español, tuteo neutro, sin raya larga.

## Criterios de diseño acordados (valen para todo cambio)

- Nombres en inglés con traducción entre paréntesis: "Cutoff (corte)". Números de control del manual de Moog.
- Grupos como en el Minimoog: Controllers, Oscillator Bank, Mixer, Modifiers.
- Verde (`--on`) = encendido. Naranja solo para destacar dentro de las pantallas.
- Tonos oscuros forzados para todos.
- Pantallas negras con retícula de osciloscopio; no forzar formato cuadrado, ocupar el espacio.
- Controles cuadrados en sliders y switches. Todo slider muestra relleno verde hasta su posición.
- Sliders verticales en Modifiers; selectores giratorios para opciones discretas (Range, Meter).
- Switches tipo iOS con estado escrito ("Hold ON/OFF", "Click ON/OFF"). Hold encendido por defecto.
- Teclas blancas reales que se pintan completas de verde al sonar.
- Botones de un mismo grupo con igual ancho.
- Barra superior: nombre y Hold a la izquierda, "Ayuda con las teclas" al centro, MASTER VOLUME a la derecha.

## Teclado del computador

```
KEYS=["q","2","w","3","e","r","5","t","6","y","7","u","v","g","b","h","n","m","k",",","l",".","ñ","-","ç"]
CODES={Semicolon:22,Backslash:24,Comma:19,Period:21,Slash:23}
```
Barra espaciadora: Hold.

## Motor de audio (Web Audio API)

- Síntesis sustractiva: OscillatorNode (Pulse con PeriodicWave), BiquadFilter pasa bajos, GainNode, AnalyserNode para las pantallas.
- Filter Contour: rampas sobre `filter.detune`, pico = amount × 7200 cents.
- Secuenciador con lookahead: `setInterval` cada 25 ms, programa 0.1 s hacia adelante. Duración del paso = 60 / bpm / div.
- `METERS`: 4/4 {n:16, grp:4, div:4}, 3/4 {n:12, grp:4, div:4}, 12/8 {n:12, grp:3, div:3}.

## B-MOOG 7: estructura

- Buses: `master` ← `drumBus` (DRUMS VOL, ganancia = v/8) y `tracksBus` (TRACKS VOL, ganancia = v/8, solo notas reproducidas; lo tocado en vivo va directo).
- Tracks: `LINES` (máx. 8, `MAXL`), cada uno `{name, vol, mute, notes:[{n, st, du}], sound}`. Posiciones en pasos. Tipos Bajo y Melodía (`newLine("bass"|"lead")`).
- Grabación: `armRec`, cuenta previa de un compás (abs empieza en −n), luces GET READY (naranja) y GO! (rojo) vía la cola `uiq`.
- Batería: `DR` (filas) y `steps` (pasos) en paralelo. Las 3 primeras tienen `base:1` y no se borran. `DKIT` lista los 8 instrumentos adicionales, `MAXD` = 12, se permiten repetidos ("Cowbell 2"). `extraHit()` sintetiza sus sonidos. `askPreset()` abre el modal "Adaptar lo existente / Comenzar desde cero / Cancelar" si hay tambores adicionales.
- Canción (`sessionData` / `applySession`): `{app:"B-MOOG 7", v:2, song, tempo, meter, bars, preset, drums:{kit, names, steps, vol, master}, tracksVol, lines:[...]}`. Tope de 1 MB al abrir. Archivos sin `kit` (anteriores) abren con la batería base.

## Ideas abiertas (ninguna aprobada)

B-MOOG 9 (ritmos como track, grabación a audio, posible versión paga); GO:KEYS como controlador MIDI (por evaluar); exportar e importar MIDI (`.mid` dentro de `.zip` en claude.ai); track de tipo Acordes; Decay por instrumento en la batería; hosting propio (Bryan lo está evaluando).
