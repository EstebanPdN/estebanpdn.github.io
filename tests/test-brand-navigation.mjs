import { position } from './helpers/source-sections.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const header = readFileSync(new URL('../src/partials/forge-header.html', import.meta.url), 'utf8');
const homepage = readFileSync(
  new URL('../src/features/collection/dual.js', import.meta.url),
  'utf8',
);
const initialize = readFileSync(new URL('../src/app/welcome-init.js', import.meta.url), 'utf8');
const target = header.match(/class="brand"\s+href="([^"]+)"/)[1];
const setupStart = position(homepage, 'const initialPage=');
const setupEnd = position(homepage, 'const mobileLogoBounds', setupStart);

// A game-page home link must enter Collection without a first-visit landing,
// even when storage is unavailable. Exercise the actual initializer and setup.
for (const origin of [
  'legend-of-doom.html',
  'mario-kart-64.html',
  'super-mario-64-ds.html',
  'credits.html',
]) {
  for (const storage of ['unseen', 'seen', 'unavailable']) {
    const url = new URL(target, 'https://portfolio.example/' + origin);
    assert.equal(url.pathname, '/index.html');
    assert.equal(url.hash, '#collection');
    const classes = new Set(),
      context = {
        location: url,
        localStorage: {
          getItem() {
            if (storage === 'unavailable') throw new Error('Storage unavailable');
            return storage === 'seen' ? '1' : null;
          },
        },
        document: {
          documentElement: {
            classList: {
              add: (key) => classes.add(key),
              remove: (key) => classes.delete(key),
              contains: (key) => classes.has(key),
            },
          },
        },
      };
    vm.createContext(context);
    vm.runInContext(
      initialize +
        '\n' +
        homepage.slice(setupStart, setupEnd) +
        '\nglobalThis.startState={initialPage,welcomeActive};',
      context,
    );
    assert.equal(context.startState.initialPage, 'collection');
    assert.equal(context.startState.welcomeActive, false);
    assert.equal(classes.has('welcome-pending'), false);
  }
}

// A subsequent normal click on the mounted homepage opens the landing.
// Modifier clicks retain the shared anchor's ordinary browser behaviour.
const handlerStart = position(homepage, "welcomeHome.addEventListener('click'");
const handlerEnd = position(homepage, 'welcomeScreen.addEventListener', handlerStart);
let handler,
  opens = 0;
const context = {
  welcomeHome: {
    addEventListener(type, callback) {
      assert.equal(type, 'click');
      handler = callback;
    },
  },
  openWelcome() {
    opens++;
  },
};
vm.createContext(context);
vm.runInContext(homepage.slice(handlerStart, handlerEnd), context);
let prevented = false;
handler({
  button: 0,
  preventDefault() {
    prevented = true;
  },
});
assert.equal(opens, 1);
assert.equal(prevented, true);
for (const settings of [
  { button: 1 },
  { metaKey: true },
  { ctrlKey: true },
  { shiftKey: true },
  { altKey: true },
  { defaultPrevented: true },
]) {
  prevented = false;
  handler({
    button: 0,
    ...settings,
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(opens, 1);
  assert.equal(prevented, false);
}
console.log(
  'PASS: game/credits brand returns to Collection for fresh, seen and unavailable storage; the next homepage click opens the landing; modifier clicks are preserved.',
);
