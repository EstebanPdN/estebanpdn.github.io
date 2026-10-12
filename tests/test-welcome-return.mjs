import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/features/collection/dual.js', import.meta.url), 'utf8');
const start = source.indexOf('async function openWelcome()');
const end = source.indexOf('function welcomeEntranceParts()', start);
function fixture({ firstVisit = false, reduced = false } = {}) {
  const classes = new Set(firstVisit ? ['welcome-pending'] : []),
    events = [];
  let coverDone, collectionDone;
  const cover = new Promise((resolve) => {
    coverDone = resolve;
  });
  const collection = new Promise((resolve) => {
    collectionDone = resolve;
  });
  const context = {
    enteringSite: false,
    welcomeActive: false,
    carouselTimer: null,
    syncConsolePlayback() {},
    clearTimeout() {},
    runningMotion: new Set(),
    welcomeScreen: { hidden: true },
    welcomeEnter: {
      disabled: false,
      focus() {
        events.push('focus');
      },
    },
    siteMain: { inert: false },
    document: {
      documentElement: {
        classList: {
          contains: (key) => classes.has(key),
          add: (key) => classes.add(key),
          remove: (...keys) => keys.forEach((key) => classes.delete(key)),
        },
      },
    },
    history: { replaceState() {} },
    location: { pathname: '/', search: '' },
    window: {
      scrollTo() {
        events.push('scroll');
      },
    },
    playMotion(element, frames, options) {
      events.push('cover');
      assert.equal(element, context.welcomeScreen);
      assert.equal(frames[0].opacity, 0);
      assert.equal(frames[1].opacity, 1);
      assert.equal(options.fill, 'both');
      return reduced
        ? undefined
        : {
            finished: cover,
            cancel() {
              events.push('cancel');
            },
          };
    },
    settle: (animations) =>
      Promise.allSettled(animations.filter(Boolean).map((animation) => animation.finished)),
    setDualPage(page) {
      assert.equal(page, 'collection');
      events.push('collection');
      return collection;
    },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  return { context, classes, events, coverDone, collectionDone };
}
const flush = async () => {
  await new Promise((resolve) => setImmediate(resolve));
};
const returning = fixture(),
  opening = returning.context.openWelcome();
assert.equal(returning.context.welcomeScreen.hidden, false);
assert.equal(returning.context.siteMain.inert, true);
assert.ok(returning.classes.has('welcome-opening'));
assert.ok(
  !returning.classes.has('welcome-open'),
  'The old page stays visible behind the transparent cover',
);
assert.deepEqual(
  returning.events,
  ['cover'],
  'No scroll or collection swap before the cover is opaque',
);
await returning.context.openWelcome();
assert.deepEqual(
  returning.events,
  ['cover'],
  'A second brand click does not start a competing entrance',
);
returning.coverDone();
await flush();
assert.ok(returning.classes.has('welcome-open'));
assert.deepEqual(returning.events, ['cover', 'scroll', 'collection']);
assert.equal(returning.context.welcomeEnter.disabled, true);
returning.collectionDone();
await opening;
assert.equal(returning.context.welcomeEnter.disabled, false);
assert.ok(!returning.classes.has('welcome-opening'));
assert.equal(returning.events.at(-1), 'focus');
for (const settings of [{ firstVisit: true }, { reduced: true }]) {
  const f = fixture(settings),
    pending = f.context.openWelcome();
  await flush();
  assert.ok(f.classes.has('welcome-open'));
  if (settings.firstVisit)
    assert.ok(!f.events.includes('cover'), 'The initial landing never fades back to Collection');
  f.collectionDone();
  await pending;
  assert.ok(!f.classes.has('welcome-opening'));
  assert.equal(f.context.welcomeEnter.disabled, false);
}
console.log(
  'PASS: landing return covers the old scene before hiding or scrolling it; duplicate clicks, first visit and reduced motion settle cleanly.',
);
