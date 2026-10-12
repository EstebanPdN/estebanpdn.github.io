# Version 1.0.0 verification

The independent baseline is a local copy of the previous site at commit `a03017d6f9181a636bb4b7b9553cfb0a3baaaa3e`. It is not part of this public repository. Local checks ran on October 12, 2026, with Node.js 26.8.1, Python 3.14.7, and Playwright 1.64.0.

| Check                                           | Result         | Scope                                                                                                                                                                                                    |
| ----------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                                      | Passed         | Syntax, scene behavior, navigation, galleries, interactions, data, and local references across 10 pages.                                                                                                 |
| `npm run test:browser`                          | Passed locally | Direct loading of all 10 routes in Chromium and WebKit; gallery, theme, and single-document history in Chromium.                                                                                         |
| `node tests/preservation.mjs /path/to/baseline` | Passed         | 24 equivalent JavaScript syntax trees, 18 stylesheets with unchanged content, and 446 original resources identical byte for byte. The provenance register is an added file.                              |
| `npm run test:visual -- /path/to/baseline/dist` | Passed         | 96 controlled route, viewport, and theme comparisons: 92 identical visible-pixel results; four differed by 3–11 pixels. None exceeded the 0.005% tolerance; no script errors or missing local resources. |
| `npm run provenance:check`                      | Passed         | All 443 files under `public/assets/` have a path, byte count, SHA-256 digest, and evidence status.                                                                                                       |
| `npm run format:check`                          | Passed         | Maintained code, documentation, and configuration follow project formatting.                                                                                                                             |

The visual test ignores font antialiasing differences and allows at most 0.005% changed visible pixels per screenshot. It requires identical page dimensions and writes screenshots under `.review/visual/`, outside Git. The new credits page did not exist in the baseline and was reviewed separately in the browser.

The provenance register reports the evidence found in project manifests. A cited source or named license does not by itself prove that every rights holder authorized redistribution. Unverified permissions remain explicitly marked.
