# Arquitectura del sitio

## La experiencia del navegador

Cada URL corresponde a un documento HTML estático para que GitHub Pages pueda servirlo al abrir una ruta directamente. Una vez carga la página, `src/app/page-transitions.js` intercepta los enlaces internos elegibles, obtiene el siguiente documento, actualiza el estado del historial y deja que el runtime de escenas intercambie la vista y sus estilos. Las navegaciones compatibles mantienen el documento del navegador, incluidos sus manejadores compartidos. El botón atrás/adelante vuelve a cargar el estado de ruta esperado.

La navegación directa y la navegación animada son complementarias: ambas usan las mismas rutas y el mismo HTML de cada destino. Los recursos no se renombran al compilarlos. El formato de salida mejora la lectura del HTML sin minificarlo ni insertar lógica de servidor.

## Fuentes y salida

1. Las páginas y módulos mantenidos viven en `src/`.
2. Los medios, datos públicos y manifiestos de origen viven en `public/`.
3. `tools/build.py` compila cada vista, prepara la cabecera y la política de contenido, ensambla sus módulos mediante el analizador de `tools/compile-controllers.mjs` y copia los recursos estáticos.
4. `tools/build-community.mjs` incluye los datos de comunidad mantenidos para que el sitio sea autosuficiente como contenido estático.
5. `tools/build-provenance.mjs` inventaría cada fichero de `public/assets/` y produce `public/asset-provenance.json` y `docs/ASSET-CREDITS.md`.
6. El sitio generado queda en `dist/`. Ese directorio se crea de nuevo en cada build y Git lo ignora.

## Propiedad de módulos

- `src/app/`: entrada, estado de inicio, runtime de vistas y transición entre rutas.
- `src/features/collection/`: tarjetas y comportamiento de colección.
- `src/features/community/`: página de comunidad, datos públicos y renderizado del panel de información.
- `src/features/games/`: controladores y experiencias específicas de juegos.
- `src/shared/`: navegación de cabecera, galería y comportamientos compartidos.
- `src/styles/`: hojas compartidas y de cada página.
- `src/partials/`: markup que el build expande en las páginas.

`tools/source-map.json` documenta dónde se mantiene cada módulo JavaScript plano publicado. `src/app/index-state.js` es un fragmento del estado de página que se integra en el controlador de inicio; no es un módulo independiente de descarga.

## Decisiones de despliegue

GitHub Actions construye desde `main`, ejecuta las pruebas y carga solo `dist/` como artefacto de Pages. El repositorio no depende de una base de datos ni de un proceso de servidor. Por ello, las rutas y nombres de archivo estáticos forman parte del contrato del sitio y deben conservarse en futuras versiones.
