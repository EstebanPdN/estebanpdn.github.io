# Guía para colaborar

Este repositorio publica un sitio personal estático. Para proponer un cambio, crea una rama o un fork, instala las dependencias fijadas en el lockfile y ejecuta las comprobaciones locales antes de abrir una solicitud de cambio.

```sh
npm ci
npm test
npm run format:check
npm run build
npm run test:browser
```

Modifica los archivos fuente de `src/` o los recursos mantenidos de `public/`. No edites `dist/`: la compilación lo reemplaza. El formato de las páginas de salida se aplica automáticamente para que el HTML generado siga siendo inspeccionable.

Al añadir un recurso, guarda su procedencia en el manifiesto correspondiente de `public/assets/`: creador o titular conocido, enlace a la fuente primaria, licencia original y su texto completo, permiso recibido si corresponde, y los cambios de recorte, montaje, conversión o restauración. Si un dato no se ha confirmado, déjalo expresamente pendiente; no lo deduzcas a partir de una página que aloja el archivo. Después ejecuta `npm run provenance` y revisa el cambio de `docs/ASSET-CREDITS.md` y `public/asset-provenance.json`.

No añadas archivos privados, claves, roms, datos personales ni archivos binarios obtenidos sin un origen documentado. Los créditos deben conservar los avisos y nombres originales de cada autor.

## Flujo de solicitud de cambios

1. Describe el resultado observable y las rutas que afecta.
2. Mantén las URLs, la navegación dentro de una misma aplicación y el comportamiento de movimiento existente, salvo que el cambio aprobado exija otra cosa.
3. Añade o actualiza una prueba cuando el comportamiento del sitio haya cambiado.
4. Anota límites conocidos de verificación —incluida la diferencia entre evidencia de emulador y hardware— sin ampliar lo que demuestra una captura.
5. Confirma el formato, las pruebas y la compilación local.
