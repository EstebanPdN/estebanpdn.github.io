# Contributing

Create a branch or fork, change the maintained files in `src/` or `public/`, and run the checks before opening a pull request:

```sh
npm ci
npm test
npm run format:check
npm run test:browser
```

Do not edit `dist/`; the build replaces it. Describe the observable result and affected routes. Preserve existing URLs, single-document transitions, visual behavior, and credits unless the change intentionally updates them. Add a relevant test when behavior changes.

For each new asset, record the known creator or rights holder, primary source, applicable license or permission, and any processing in the nearest `public/assets/` source manifest. Mark unknown facts as unknown. Run `npm run provenance` and review the resulting asset register. Do not commit secrets, private files, ROMs, or personal data.
