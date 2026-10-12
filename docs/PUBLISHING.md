# Compilar y publicar

## Sitio local

```sh
npm ci
npm test
npm run format:check
npm run provenance:check
npm run build
npm run test:browser
npm run dev
```

GitHub Pages no procesa las fuentes de este proyecto. La acción de CI compila las páginas a `dist/` y publica esa carpeta mediante el flujo oficial de artefactos y despliegue de Pages. Así la salida de publicación coincide con la compilación probada.

## Flujo automatizado

`.github/workflows/pages.yml` se ejecuta al enviar cambios a `main` o al iniciarse manualmente. Antes de publicar, el job prepara Node.js y FFmpeg, instala exactamente lo descrito en `package-lock.json`, revisa el formato, ejecuta la suite local, instala Chromium y WebKit para la prueba de navegador, compila el sitio y comprueba la navegación. Solo si esos pasos pasan se configura Pages, se carga `dist/` y se crea el despliegue con `GITHUB_TOKEN` de alcance limitado al job.

Los permisos de workflow se declaran de forma explícita. No hay claves API del sitio en el repositorio ni configuración de dominio personalizado. La publicación del sitio de cuenta depende de que el repositorio público se llame `estebanpdn.github.io`.

## Diagnóstico

- **404 en todas las rutas:** confirma que Pages usa GitHub Actions como origen y que el último despliegue terminó correctamente.
- **Falta `index.html`:** revisa el artefacto `github-pages`; debe contener el contenido de `dist/`, incluida la página principal.
- **Recursos o páginas 404:** comprueba que se conservan los nombres relativos originales y que el build incluye `public/` y los módulos servidos.
- **El controlador no arranca:** revisa la consola y los archivos JavaScript versionados por hash de contenido en `dist/`.
- **Los datos de comunidad no coinciden con la compilación:** valida el snapshot con la suite de comunidad y vuelve a ejecutar `npm run build`.

El sitio publicado debe verificarse con HTTP después del despliegue; que el job compile correctamente no demuestra por sí solo que el dominio responda al público.
