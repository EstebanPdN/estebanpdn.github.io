# Esteban’s Forge

Portafolio estático de los proyectos de EstebanPdN, preparado para servirse gratis desde GitHub Pages en [estebanpdn.github.io](https://estebanpdn.github.io/). Esta copia del sitio corresponde a la versión **1.0.0**.

El código de navegación conserva las rutas públicas originales. Al navegar desde el sitio abierto, el controlador de transiciones carga la vista siguiente dentro de la misma aplicación del navegador y mantiene las animaciones entre vistas. Abrir una URL directamente también funciona: cada ruta genera su propio HTML estático para el alojamiento y los marcadores del navegador.

## Requisitos

- Node.js 22 o posterior.
- Python 3 para compilar las rutas estáticas.
- npm 10 o posterior.

## Desarrollo local

```sh
npm ci
npm test
npm run build
npm run dev
```

Abre `http://127.0.0.1:8080/`. La vista servida es la compilación de `dist/`; no abras las fuentes HTML directamente como archivos locales. Si cambias un manifiesto de atribución, ejecuta `npm run provenance` antes de compilar.

Para verificar que las fuentes públicas siguen produciendo exactamente la misma presentación que la copia de referencia local, instala Chromium y WebKit de Playwright y ejecuta:

```sh
npx playwright install chromium webkit
npm run build
npm run test:visual -- /ruta/a/review/github-pages-2026-10-12/baseline/dist
```

La referencia de comparación se mantiene separada del repositorio. El informe se escribe en `.review/visual/` y no se publica.

## Organización

- `src/pages/`: documentos de entrada de cada ruta pública.
- `src/app/`: estado y navegación entre vistas, carga del controlador de cada página y animaciones compartidas.
- `src/features/`: código de colección, comunidad y experiencias de los juegos.
- `src/shared/`: interacciones y piezas que comparten varias rutas.
- `src/styles/`: hojas de estilos compartidas y de cada área.
- `src/partials/`: fragmentos HTML insertados durante la compilación.
- `public/`: recursos estáticos servidos tal cual, datos del sitio y el registro de procedencia generado.
- `tools/`: compilación, verificación, formato de salida e inventario de recursos.
- `tests/`: pruebas de comportamiento y navegador.
- `dist/`: salida generada; no se edita manualmente ni se confirma en Git.

`tools/source-map.json` enlaza los módulos servidos con su fuente mantenida. El compilador analiza imports de JavaScript antes de ensamblar cada controlador. Así los ficheros publicados conservan sus nombres y orden de ejecución sin volver a concentrar el código fuente en una página desordenada.

## Verificaciones

`npm test` revisa sintaxis, navegación y marca, transiciones, escenas, carruseles, galerías, controles móviles, recursos de vídeo, datos de la comunidad, enlaces locales y actualidad del inventario de procedencia. `npm run test:browser` además recorre las rutas publicadas en Chromium y WebKit. `npm run test:visual` compara capturas controladas con la referencia independiente. La comparación de estructura y recursos originales se puede repetir con `node tests/preservation.mjs /ruta/a/review/github-pages-2026-10-12/baseline` cuando se disponga de esa copia local independiente.

Cada cambio a `main` ejecuta CI, vuelve a compilar el sitio y publica `dist/` mediante GitHub Pages. Consulta [la arquitectura](docs/ARCHITECTURE.md), [la guía de publicación](docs/PUBLISHING.md), [la evidencia de verificación](docs/VERIFICATION.md), [la guía para colaborar](CONTRIBUTING.md), [el historial](CHANGELOG.md) y [el registro completo de atribuciones](docs/ASSET-CREDITS.md).

## Derechos y reutilización

El código de este proyecto y los archivos multimedia tienen titulares y condiciones distintos. La presencia en un repositorio público permite ver y bifurcarlo dentro de GitHub; **no es una licencia general para descargar, redistribuir, adaptar o explotar los medios o el código fuera de las condiciones aplicables**. Se incluye un aviso de derechos en `LICENSE.md`, sin asignar una licencia de código abierto que el propietario no haya elegido.

El [registro por archivo](https://estebanpdn.github.io/asset-provenance.json) identifica la evidencia incluida en el proyecto, las modificaciones anotadas, los hashes y las incertidumbres. Citar una fuente no demuestra por sí solo que su autor, archivo o uso esté autorizado.
