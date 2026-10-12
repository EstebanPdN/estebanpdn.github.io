# Site architecture

## Browser experience

Each public URL has its own static HTML document, so direct visits and bookmarks work on GitHub Pages. After a page loads, `src/app/page-transitions.js` handles eligible internal links, fetches the next document, updates browser history, and swaps the scene and its styles. Supported transitions keep the same browser document and its shared listeners. Back and forward navigation restore the expected route.

Direct loading and animated navigation use the same destination pages. The build retains established resource names and produces readable HTML without a server runtime.

## Source and output

1. Maintained pages and modules live in `src/`.
2. Static media, public data, and source manifests live in `public/`.
3. `tools/build.py` assembles pages and shared headers, applies the content security policy, compiles page controllers with `tools/compile-controllers.mjs`, and copies static assets.
4. `tools/build-community.mjs` embeds maintained community data for static delivery.
5. `tools/build-provenance.mjs` inventories every file in `public/assets/` and generates `public/asset-provenance.json` and `docs/ASSET-CREDITS.md`.
6. The generated site is written to `dist/`, which Git ignores.

## Module ownership

- `src/app/`: startup state, scene runtime, and route transitions.
- `src/features/collection/`: collection cards and behavior.
- `src/features/community/`: community data and information views.
- `src/features/games/`: game-specific controllers and experiences.
- `src/shared/`: header, gallery, and shared interactions.
- `src/styles/`: common and page-specific styles.
- `src/partials/`: HTML fragments expanded at build time.

`tools/source-map.json` maps published JavaScript filenames to maintained source files. `src/app/index-state.js` is inserted into the homepage controller rather than shipped as a separate script.

GitHub Actions builds from `main` and deploys only `dist/`. The site has no database or server process. Static URLs and filenames are part of its compatibility contract.
