/** Compare baseline and candidate pixels under identical controlled fixtures. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { serve } from './helpers/server.mjs';

const baseline = process.argv[2];
assert.ok(baseline, 'Supply the baseline dist directory');
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = resolve(process.env.FORGE_REVIEW_DIR ?? join(root, '.review/visual'));
mkdirSync(output, { recursive: true });
const before = await serve(baseline),
  after = await serve(join(root, 'dist'));
const routes = readdirSync(join(root, 'dist')).filter((name) => name.endsWith('.html'));
const cases = [
  ...routes.filter((name) => name !== 'credits.html'),
  'index.html#progress',
  'index.html#info',
  'index.html?welcome',
];
const results = [];

try {
  for (const [engine, browserType, widths] of [
    ['chromium', chromium, [1440, 768, 390]],
    ['webkit', webkit, [390]],
  ]) {
    const browser = await browserType.launch();
    try {
      for (const width of widths)
        for (const theme of ['light', 'dark'])
          for (const route of cases) {
            console.log(`CHECK ${engine} ${width} ${theme} ${route}`);
            const images = [],
              diagnostics = [];
            for (const server of [before, after]) {
              const context = await browser.newContext({
                viewport: { width, height: width === 390 ? 844 : 900 },
                reducedMotion: 'reduce',
                colorScheme: theme,
              });
              await context.route('**/*', (request) =>
                new URL(request.request().url()).origin === new URL(server.url).origin
                  ? request.continue()
                  : request.abort(),
              );
              await context.addInitScript(
                ({ theme, welcome }) => {
                  localStorage.setItem('forge-theme', theme);
                  if (!welcome) localStorage.setItem('forge-welcome-seen-v1', '1');
                  const NativeDate = Date;
                  window.Date = class extends NativeDate {
                    constructor(...args) {
                      super(...(args.length ? args : ['2026-10-12T12:00:00-07:00']));
                    }
                    static now() {
                      return new NativeDate('2026-10-12T12:00:00-07:00').getTime();
                    }
                  };
                },
                { theme, welcome: route.includes('?welcome') },
              );
              const page = await context.newPage();
              const errors = [],
                failedLocal = [];
              page.on('pageerror', (error) => errors.push(error.message));
              page.on('console', (message) => {
                if (
                  message.type() === 'error' &&
                  !/net::ERR_FAILED|Load failed|Failed to load resource/.test(message.text())
                )
                  errors.push(message.text());
              });
              page.on('response', (response) => {
                if (response.status() >= 400 && response.url().startsWith(server.url))
                  failedLocal.push(response.url().replace(server.url, ''));
              });
              await page.goto(server.url + route, { waitUntil: 'networkidle' });
              await page.evaluate(async () => {
                await document.fonts.ready;
                // Native playback overlays fade according to browser timing. Compare
                // the authored presentation with both clips paused and controls hidden.
                for (const video of document.querySelectorAll('video')) {
                  video.pause();
                  video.controls = false;
                }
                for (const image of document.images) image.loading = 'eager';
                await Promise.race([
                  Promise.allSettled([...document.images].map((image) => image.decode())),
                  new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Images did not settle')), 15000),
                  ),
                ]);
              });
              const name = `${engine}-${width}-${theme}-${route.replace(/[^a-z0-9]/gi, '-')}`;
              const buffer = await page.screenshot({ fullPage: true, animations: 'disabled' });
              images.push(PNG.sync.read(buffer));
              writeFileSync(
                join(output, `${name}-${server === before ? 'before' : 'after'}.png`),
                buffer,
              );
              diagnostics.push({ errors, failedLocal });
              await context.close();
            }
            const [a, b] = images;
            const sameSize = a.width === b.width && a.height === b.height;
            const difference = sameSize
              ? pixelmatch(a.data, b.data, null, a.width, a.height, {
                  // Font antialiasing and paused video composition can vary by
                  // a handful of subpixel values between otherwise identical
                  // browser contexts. Count visible color changes instead.
                  threshold: 0.2,
                  includeAA: false,
                })
              : null;
            const allowedChangedPixels = sameSize
              ? Math.max(12, Math.ceil(a.width * a.height * 0.00005))
              : 0;
            const result = {
              engine,
              width,
              theme,
              route,
              dimensions: [
                [a.width, a.height],
                [b.width, b.height],
              ],
              changedPixels: difference,
              allowedChangedPixels,
              diagnostics,
            };
            results.push(result);
            writeFileSync(join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n');
            console.log(
              `${sameSize && difference <= allowedChangedPixels ? 'PASS' : 'DIFF'} ${engine} ${width} ${theme} ${route}: ${difference} changed pixels (limit ${allowedChangedPixels})`,
            );
          }
    } finally {
      await browser.close();
    }
  }
} finally {
  await before.close();
  await after.close();
}

assert.ok(
  results.every(
    (result) =>
      result.changedPixels !== null && result.changedPixels <= result.allowedChangedPixels,
  ),
  'Investigate visual differences; do not approve new baselines automatically',
);
assert.ok(
  results.every((result) =>
    result.diagnostics.every((item) => item.errors.length === 0 && item.failedLocal.length === 0),
  ),
  'Unexpected script errors or missing local resources',
);
console.log(
  `PASS: ${results.length} controlled route/theme/viewport comparisons within a 0.005% visible-pixel tolerance.`,
);
