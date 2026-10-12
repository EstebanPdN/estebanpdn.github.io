import { position } from './helpers/source-sections.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../src/features/collection/dual.js', import.meta.url), 'utf8');
const events = [],
  animations = [];
function panel(id) {
  return {
    id,
    inert: false,
    _hidden: id !== 'dual-collection',
    get hidden() {
      return this._hidden;
    },
    set hidden(value) {
      events.push([id, 'hidden', value]);
      this._hidden = value;
    },
    querySelectorAll() {
      return [];
    },
    getBoundingClientRect() {
      return { height: 700 };
    },
  };
}
const collection = panel('dual-collection'),
  progress = panel('dual-progress');
const rootBackdrop = {
  hidden: false,
  style: {
    set opacity(value) {
      events.push(['backdrop', 'opacity', value]);
    },
  },
};
const pageStage = {
  dataset: {},
  style: {},
  getBoundingClientRect() {
    return { height: 700 };
  },
};
const context = {
  document: {
    querySelectorAll: () => [],
    getElementById: (id) => (id === 'dual-collection' ? collection : progress),
  },
  dual: { querySelectorAll: () => [] },
  rootBackdrop,
  pageStage,
  phoneLayout: { matches: false },
  syncConsolePlayback() {},
  syncBackdropGeometry() {
    events.push(['geometry']);
  },
  playMotion(element, frames, options) {
    const item = { element, frames, options, finished: Promise.resolve(), cancel() {} };
    animations.push(item);
    return item;
  },
};
vm.createContext(context);
const start = position(source, "let visiblePage='collection'");
const end = position(
  source,
  "document.querySelectorAll('[data-dual-page]').forEach(button=>button.addEventListener",
  start,
);
vm.runInContext(source.slice(start, end) + '\nglobalThis.setPage=setDualPage;', context);
await context.setPage('progress');
assert.equal(animations[0].element, rootBackdrop, 'Artwork exits with the outgoing scene');
assert.equal(animations[0].frames[1].opacity, 0);
assert.ok(
  events.findIndex((e) => e[0] === 'backdrop' && e[2] === '0') <
    events.findIndex((e) => e[0] === 'dual-collection' && e[2] === true),
  'Fade completes before Collection is hidden',
);
assert.equal(rootBackdrop.hidden, false, 'Geometry never hides the backdrop');
await context.setPage('collection');
assert.ok(
  animations.some(
    (a) => a.element === rootBackdrop && a.frames[0].opacity === 0 && a.frames[1].opacity === 1,
  ),
  'Artwork fades back in on return',
);
assert.equal(events.at(-1)[2], '1');
console.log('PASS: artwork fades before panel hiding and fades back in with Collection.');

// A late resize/decode after scrolling must not shrink artwork to the sticky
// header's viewport position. Hidden panels retain their last useful geometry.
{
  let scroll = 0,
    height = 940;
  const values = new Map();
  const fixture = {
    backdropHero: {
      get offsetHeight() {
        return height;
      },
      offsetTop: 0,
      getBoundingClientRect() {
        return { top: 110 - scroll, bottom: 1050 - scroll };
      },
    },
    backdropHeader: {
      getBoundingClientRect() {
        return { bottom: 110 };
      },
    },
    dual: {
      getBoundingClientRect() {
        return { top: 110 - scroll };
      },
      style: { setProperty: (name, value) => values.set(name, value) },
    },
  };
  vm.createContext(fixture);
  const begin = position(source, 'function syncBackdropGeometry(){'),
    end = position(source, 'const backdropGeometryObserver', begin);
  vm.runInContext(source.slice(begin, end), fixture);
  fixture.syncBackdropGeometry();
  const initial = Object.fromEntries(values);
  scroll = 925;
  fixture.syncBackdropGeometry();
  assert.deepEqual(
    Object.fromEntries(values),
    initial,
    'Scrolling below the carousel cannot collapse its background',
  );
  height = 0;
  fixture.syncBackdropGeometry();
  assert.deepEqual(
    Object.fromEntries(values),
    initial,
    'A hidden Collection retains its last visible size',
  );
  height = 650;
  fixture.syncBackdropGeometry();
  assert.equal(
    values.get('--backdrop-height'),
    '674px',
    'A real layout resize updates the artwork height',
  );
}
console.log(
  'PASS: scrolling and hidden-panel measurements preserve artwork geometry; visible resizing updates it.',
);
