# Build and publish

## Local checks

```sh
npm ci
npm run format:check
npm test
npm run test:browser
npm run build
npm run dev
```

`npm test` builds the site before running its integrity checks. GitHub Pages does not process the maintained source directly; the workflow publishes `dist/`.

## GitHub Actions

`.github/workflows/pages.yml` runs on pushes to `main` or manual dispatch. It installs the locked Node dependencies and FFmpeg, checks formatting and provenance, runs the unit and integrity suite, installs Chromium and WebKit, builds the site, and checks rendered routes. Only passing jobs upload `dist/` and deploy through GitHub Pages.

Workflow permissions are explicit. The repository has no application API key or custom domain. The public account-site repository is named `estebanpdn.github.io`, and Pages uses **GitHub Actions** as its build source.

## Troubleshooting

- **All routes return 404:** confirm that Pages uses GitHub Actions and that the latest deployment succeeded.
- **No `index.html`:** inspect the `github-pages` artifact; it must contain the contents of `dist/`.
- **Missing assets or routes:** check that the build preserves relative URLs and copies `public/`.
- **Controller fails:** inspect the browser console and the content-hashed JavaScript URLs in `dist/`.
- **Community data differs:** validate the static snapshot and rebuild.

Verify the public URL with HTTP after deployment; a successful build alone does not prove that the site is available.
