# Esteban’s Forge

EstebanPdN’s static Nintendo 3DS project portfolio. [Visit the site](https://estebanpdn.github.io/).

This project was developed with the help of [OpenAI Codex](https://openai.com/codex/) and [Claude Code](https://claude.com/product/claude-code). Learn more about the development process [here](AI_DEVELOPMENT.md).

[Read the Mario Kart 64 v2.0 post](https://estebanpdn.github.io/blog-mario-kart-64-v2-0.html).

## Run locally

Requires Node.js 22+, npm 10+, Python 3, and `ffprobe` (from FFmpeg).

```sh
npm ci
npm test
npm run test:browser
npm run dev
```

Open `http://127.0.0.1:8080/`. The build creates `dist/`; GitHub Actions publishes that directory to GitHub Pages.

Source lives in `src/`, static assets in `public/`, and build tools in `tools/`. See the [architecture](docs/ARCHITECTURE.md), [verification record](docs/VERIFICATION.md), and [publishing guide](docs/PUBLISHING.md) for details.

The [asset register](docs/ASSET-CREDITS.md) records available sources and unresolved permissions for every bundled asset. A credit does not grant reuse rights; see [LICENSE.md](LICENSE.md).
