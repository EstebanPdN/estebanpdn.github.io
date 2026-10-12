/** Exercise every built route and the core single-document interactions. */
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { serve } from './helpers/server.mjs';

const root = new URL('../dist/', import.meta.url);
const dist = decodeURIComponent(root.pathname);
const server = await serve(dist);
const routes = (await readdir(dist)).filter((file) => file.endsWith('.html')).sort();
assert.equal(routes.length, 10, 'The published route set should contain the ten documented pages');

for (const [engineName, browserType] of [
  ['Chromium', chromium],
  ['WebKit', webkit],
]) {
  const browser = await browserType.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    await context.route('**/*', (request) => {
      if (new URL(request.request().url()).origin === new URL(server.url).origin)
        request.continue();
      else request.abort();
    });
    await context.addInitScript(() => {
      localStorage.setItem('forge-theme', 'light');
      localStorage.setItem('forge-welcome-seen-v1', '1');
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400 && response.url().startsWith(server.url)) {
        errors.push(`HTTP ${response.status()} ${response.url().replace(server.url, '')}`);
      }
    });

    for (const route of routes) {
      await page.goto(`${server.url}${route}`, { waitUntil: 'load' });
      await page.locator('body').waitFor();
      const pageState = await page.evaluate(() => ({
        title: document.title,
        bodyText: document.body.innerText.trim(),
        controller: document.querySelector('meta[name="forge-controller"]')?.content,
        theme: document.documentElement.dataset.theme,
      }));
      assert.ok(pageState.title, `${engineName} ${route}: page title exists`);
      assert.ok(pageState.bodyText.length > 40, `${engineName} ${route}: content rendered`);
      assert.ok(pageState.controller, `${engineName} ${route}: page controller compiled`);
      assert.equal(pageState.theme, 'light', `${engineName} ${route}: saved theme is applied`);
    }

    if (engineName === 'Chromium') {
      await page.goto(server.url + 'index.html', { waitUntil: 'load' });
      await page.evaluate(() => {
        window.__forgeOriginalDocument = document;
      });
      await page.locator('a[href="the-minish-cap.html"]').first().click();
      await page.waitForURL('**/the-minish-cap.html');
      await page.locator('#gallery-image').waitFor();
      await page.locator('.gallery-thumb').nth(1).click();
      await page.waitForFunction(
        () =>
          document.querySelectorAll('.gallery-thumb')[1].getAttribute('aria-pressed') === 'true',
      );
      await page.locator('#gallery-open').click();
      await page.waitForFunction(() => document.getElementById('gallery-lightbox').open);
      await page.locator('[data-gallery-screen="lower"]').click();
      await page.waitForFunction(
        () => document.querySelector('#lightbox-image').dataset.screen === 'lower',
      );
      await page.locator('#lightbox-close').click();
      await page.waitForFunction(() => !document.getElementById('gallery-lightbox').open);

      await page.locator('#theme-toggle').click();
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
      assert.equal(await page.locator('#theme-toggle').getAttribute('aria-pressed'), 'true');

      await page.locator('details.art-credits summary').click();
      await page.locator('main a[href="credits.html"]').first().click();
      await page.waitForURL('**/credits.html');
      await page.getByRole('heading', { name: 'Who made these assets?' }).waitFor();
      assert.equal(
        await page.evaluate(() => document === window.__forgeOriginalDocument),
        true,
        'Internal navigation retains the same document',
      );
      assert.equal(
        await page.evaluate(() => performance.getEntriesByType('navigation').length),
        1,
        'Internal navigation does not reload the document',
      );
      assert.equal(
        await page.locator('html').getAttribute('data-theme'),
        'dark',
        'The theme survives page transitions',
      );

      await page.locator('#main-content a[href="index.html#collection"]').first().click();
      await page.waitForURL('**/index.html#collection');
      assert.equal(
        await page.evaluate(() => document === window.__forgeOriginalDocument),
        true,
        'Returning to the collection remains in the same document',
      );
      await page.goBack();
      await page.waitForURL('**/credits.html');
      await page.getByRole('heading', { name: 'Who made these assets?' }).waitFor();
      assert.equal(
        await page.evaluate(() => document === window.__forgeOriginalDocument),
        true,
        'Browser history restores a page in the same document',
      );
    }

    assert.deepEqual(errors, [], `${engineName}: no JavaScript errors or failed local requests`);
    await context.close();
    console.log(
      `PASS: ${engineName} loaded all ${routes.length} pages${engineName === 'Chromium' ? ' and checked gallery, theme, and single-document history' : ''}.`,
    );
  } finally {
    await browser.close();
  }
}

await server.close();
