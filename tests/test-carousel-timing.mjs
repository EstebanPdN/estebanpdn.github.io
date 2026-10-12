import { position } from './helpers/source-sections.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Execute the production scheduler against a monotonic, controlled clock.
const source = readFileSync(new URL('../src/features/collection/dual.js', import.meta.url), 'utf8');
const start = position(source, 'const carouselInterval=');
const end = position(source, 'const backdropHeader=', start);
function harness() {
  let now = 0,
    id = 0;
  const timers = new Map(),
    events = [],
    observers = [],
    listeners = new Map();
  const hero = {};
  const context = {
    syncConsolePlayback() {},
    Date: { now: () => now },
    setTimeout(callback, delay) {
      const key = ++id;
      timers.set(key, { at: now + delay, callback });
      return key;
    },
    clearTimeout(key) {
      timers.delete(key);
    },
    document: {
      hidden: false,
      getElementById: () => hero,
      addEventListener: (name, fn) => listeners.set(name, fn),
    },
    dual: { querySelector: () => ({}) },
    welcomeActive: false,
    reduceMotion: {
      matches: false,
      addEventListener: (name, fn) => listeners.set('motion:' + name, fn),
    },
    requestedPage: 'collection',
    requestedGame: 'kart',
    gameKeys: ['alttp', 'minish', 'kart', 'doom', 'starwing'],
    showConsoleProject(key) {
      events.push({ key, at: now });
      context.requestedGame = key;
    },
    IntersectionObserver: class {
      constructor(callback, options) {
        this.callback = callback;
        this.options = options;
        observers.push(this);
      }
      observe(target) {
        this.target = target;
      }
    },
  };
  context.window = { IntersectionObserver: context.IntersectionObserver };
  vm.createContext(context);
  vm.runInContext(
    source.slice(start, end) +
      '\nglobalThis.api={holdCarousel,scheduleCarousel,state:()=>({carouselHoldUntil,carouselTimer})};',
    context,
  );
  function advance(milliseconds) {
    const target = now + milliseconds;
    for (;;) {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > target) break;
      now = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
      assert.ok(timers.size <= 1, 'One carousel timer at most');
    }
    now = target;
  }
  function visible(isVisible) {
    observers[0].callback([
      { target: hero, isIntersecting: isVisible, intersectionRatio: isVisible ? 0.7 : 0 },
    ]);
  }
  return { context, api: context.api, events, timers, listeners, observers, advance, visible };
}

{
  const h = harness();
  h.visible(true);
  h.advance(5999);
  assert.equal(h.events.length, 0);
  h.advance(1);
  assert.deepEqual(h.events, [{ key: 'doom', at: 6000 }]);
  h.advance(12000);
  assert.deepEqual(
    h.events.map((e) => e.at),
    [6000, 12000, 18000],
  );
}
{
  const h = harness();
  h.visible(true);
  h.advance(3200);
  h.api.holdCarousel();
  h.advance(24999);
  assert.equal(h.events.length, 0, 'Manual selection holds the full twenty-five seconds');
  h.advance(1);
  assert.equal(
    h.events[0].at,
    28200,
    'Rotation resumes exactly twenty-five seconds from the manual event',
  );
  h.advance(12000);
  assert.deepEqual(
    h.events.map((e) => e.at),
    [28200, 34200, 40200],
  );
}
{
  const h = harness();
  h.visible(true);
  h.api.holdCarousel();
  h.advance(12000);
  h.api.holdCarousel();
  assert.equal(h.timers.size, 1);
  h.advance(24999);
  assert.equal(h.events.length, 0, 'A prior hold cannot resume the latest selection early');
  h.advance(1);
  assert.equal(h.events[0].at, 37000);
  assert.equal(h.timers.size, 1);
}
{
  const h = harness();
  h.visible(true);
  h.api.holdCarousel();
  h.advance(7000);
  h.visible(false);
  assert.equal(h.api.state().carouselHoldUntil, 0, 'Actual viewport exit clears remaining hold');
  h.advance(5999);
  assert.equal(h.events.length, 0);
  h.advance(1);
  assert.equal(h.events[0].at, 13000);
  h.visible(true);
  h.advance(6000);
  assert.equal(h.events[1].at, 19000, 'Returning does not restore a cancelled hold');
  h.advance(8000);
  assert.deepEqual(
    h.events.map((e) => e.at),
    [13000, 19000, 25000],
    'The cancelled twenty-five-second timer cannot fire later',
  );
  assert.equal(h.observers[0].options.threshold, 0);
}
{
  const h = harness();
  h.visible(true);
  h.api.holdCarousel();
  h.context.reduceMotion.matches = true;
  h.listeners.get('motion:change')();
  assert.equal(h.timers.size, 0);
  h.advance(30000);
  assert.equal(h.events.length, 0, 'Reduced motion has no autoplay');
  h.context.reduceMotion.matches = false;
  h.listeners.get('motion:change')();
  h.advance(6000);
  assert.equal(h.events.length, 1);
}
{
  const h = harness();
  h.api.holdCarousel();
  h.advance(8000);
  h.context.document.hidden = true;
  h.listeners.get('visibilitychange')();
  h.advance(7000);
  assert.equal(h.timers.size, 0);
  h.context.document.hidden = false;
  h.listeners.get('visibilitychange')();
  h.advance(9999);
  assert.equal(h.events.length, 0);
  h.advance(1);
  assert.equal(h.events[0].at, 25000, 'Tab visibility changes preserve the current deadline');
}
{
  const h = harness();
  h.context.welcomeActive = true;
  h.api.scheduleCarousel();
  h.advance(30000);
  assert.equal(h.events.length, 0);
  h.context.welcomeActive = false;
  h.context.requestedPage = 'progress';
  h.api.scheduleCarousel();
  h.advance(6000);
  assert.equal(h.events.length, 0);
  h.context.requestedPage = 'collection';
  h.advance(6000);
  assert.equal(h.events.length, 1);
}
assert.ok(
  !source.includes("backdropHero.addEventListener('focusin'"),
  'Focus cannot indefinitely block the explicitly requested twenty-five-second resume',
);
console.log(
  'PASS: six-second cadence, exact twenty-five-second hold, restart from latest interaction, single timer, real viewport cancellation, return, hidden tabs and reduced motion.',
);
