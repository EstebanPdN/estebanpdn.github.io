# Esteban’s Forge

EstebanPdN’s static Nintendo 3DS project portfolio. [Visit the site](https://estebanpdn.github.io/).

<p>
  <a href="https://estebanpdn.github.io/"><img src="public/assets/brand/website.svg" alt="Website" width="142" height="46"></a>
  <a href="https://discord.gg/zy8BqH5ss"><img src="public/assets/brand/discord-official.svg" alt="Join Discord" width="166" height="46"></a>
  <a href="https://ko-fi.com/estebanpdn"><img src="public/assets/brand/kofi.svg" alt="Support on Ko-fi" width="190" height="46"></a>
  <a href="https://www.patreon.com/c/EstebanPdN"><img src="public/assets/brand/patreon.svg" alt="Support on Patreon" width="216" height="46"></a>
</p>

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
