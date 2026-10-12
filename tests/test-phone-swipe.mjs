import { position, statementEnd } from './helpers/source-sections.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const code = readFileSync(new URL('../src/features/collection/dual.js', import.meta.url), 'utf8');
const start = position(code, 'const swipeSurface=');
const end = statementEnd(code, "swipeSurface.addEventListener('pointerup'", start);
const events = {},
  steps = [];
const surface = {
  addEventListener: (type, fn) => {
    events[type] = fn;
  },
  setPointerCapture() {},
};
vm.runInNewContext(code.slice(start, end), {
  dual: { querySelector: () => surface },
  stepGame: (n) => steps.push(n),
});
function gesture(dx, dy, { pointerType = 'touch', cancel = false, duration = 150 } = {}) {
  events.pointerdown({
    isPrimary: true,
    pointerType,
    pointerId: 1,
    clientX: 180,
    clientY: 400,
    timeStamp: 0,
  });
  if (cancel) events.pointercancel();
  events.pointerup({ pointerId: 1, clientX: 180 + dx, clientY: 400 + dy, timeStamp: duration });
}
gesture(-100, 5);
gesture(100, 5);
assert.deepEqual(steps, [1, -1]);
gesture(10, 150);
gesture(-20, 0);
gesture(90, 0, { cancel: true });
gesture(90, 0, { duration: 1600 });
gesture(90, 0, { pointerType: 'mouse' });
assert.deepEqual(
  steps,
  [1, -1],
  'Vertical scroll, taps, cancelled touches, long holds and mouse drags must not change projects',
);
console.log(
  'PASS: horizontal phone swipes select projects; scroll, taps, cancellation and mouse input do not.',
);
