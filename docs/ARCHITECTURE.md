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
- `src/features/blog/`: animated post navigation and game-specific articles.
- `src/shared/`: header, gallery, and shared interactions.
- `src/styles/`: common and page-specific styles.
- `src/partials/`: HTML fragments expanded at build time.

`tools/source-map.json` maps published JavaScript filenames to maintained source files. `src/app/index-state.js` is inserted into the homepage controller rather than shipped as a separate script.

GitHub Actions builds from `main` and deploys only `dist/`. The site has no database or server process. Static URLs and filenames are part of its compatibility contract.

## Public port versions

`public/data/port-releases.json` owns the displayed stable and experimental port
versions, their release links and the verification date. It describes public
distribution, independently of development percentages and upstream versions.
`tools/port_releases.py` expands explicit `port-status` and `port-release` HTML
comment markers during the build. Collection cards, progress cards and project
headers therefore use the same records without browser requests or listeners.
`src/styles/port-releases.css` owns the shared release labels; project themes
retain their layout and visual identity. Unknown project markers fail the build.

When a public release changes, verify its GitHub tag and channel, update the
registry and any version-specific download instructions, and rebuild both hosted
editions. Unreleased projects retain a null stable release instead of borrowing
an upstream or private candidate version.

## Blog and live project progress

The shared header opens `blog.html` between Progress and Info. Posts remain individual static routes registered with the scene runtime, so direct links, history and the saved theme work on GitHub Pages. `blog.css` owns the index and shared article layout; `blog-kart.css` applies the Mario Kart presentation. Author posts in `src/pages/` and their media manifests under `public/assets/blog/`.

Community cards refresh public per-version reports and repository activity independently. Worms 3D uses its public tracker feed and an origin-checked iframe bridge. The browser keeps dated data when a source is unavailable and refreshes after reconnecting. `node tools/refresh-community.mjs --watch --build` updates the local publication snapshot hourly; it does not commit or publish.
