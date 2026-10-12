// Run with: node --test tests/test-scene-runtime.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { createSceneScope, inspect } from '../src/app/scene-runtime.js';

const add = EventTarget.prototype.addEventListener;
const remove = EventTarget.prototype.removeEventListener;
class Target extends EventTarget {
  addEventListener(...args) {
    return add.apply(this, args);
  }
  removeEventListener(...args) {
    return remove.apply(this, args);
  }
  emit(type) {
    this.dispatchEvent(new Event(type));
  }
}
class Observer {
  constructor(callback) {
    this.callback = callback;
    this.disconnections = 0;
  }
  observe() {}
  disconnect() {
    this.disconnections++;
  }
  fire() {
    this.callback([], this);
  }
}

function fixture({ fallbackSignals = false } = {}) {
  const timeouts = new Map(),
    intervals = new Map(),
    frames = new Map();
  const owner = new Target(),
    win = new Target();
  const root = {
    dataset: {},
    classList: {
      add(value) {
        this.value = value;
      },
    },
    style: {
      setProperty(key, value) {
        this[key] = value;
      },
    },
  };
  const node = { id: 'old' };
  let nextId = 1,
    cancelled = 0,
    lastFetchSignal;
  const body = Object.assign(new Target(), {
    ownerDocument: owner,
    id: 'scene',
    matches: (selector) => selector === 'body',
    querySelector: (selector) => (selector === '#old' ? node : null),
    querySelectorAll: () => [],
    getElementsByTagName: () => [],
    getElementsByClassName: () => [],
    contains: (value) => value === node,
    getAnimations: () => [{ cancel: () => cancelled++ }],
  });
  Object.assign(win, {
    EventTarget: Target,
    AbortController,
    AbortSignal: fallbackSignals ? {} : AbortSignal,
    CSS: { escape: String },
    IntersectionObserver: Observer,
    ResizeObserver: Observer,
    MutationObserver: Observer,
    setTimeout: (callback) => {
      const id = nextId++;
      timeouts.set(id, () => {
        timeouts.delete(id);
        callback();
      });
      return id;
    },
    clearTimeout: (id) => timeouts.delete(id),
    setInterval: (callback) => {
      const id = nextId++;
      intervals.set(id, callback);
      return id;
    },
    clearInterval: (id) => intervals.delete(id),
    requestAnimationFrame: (callback) => {
      const id = nextId++;
      frames.set(id, (time) => {
        frames.delete(id);
        callback(time);
      });
      return id;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    matchMedia: () => Object.assign(new Target(), { matches: false }),
    fetch: (_, options) => {
      lastFetchSignal = options.signal;
      return new Promise((resolve, reject) => {
        if (options.signal.aborted) reject(options.signal.reason);
        else
          options.signal.addEventListener('abort', () => reject(options.signal.reason), {
            once: true,
          });
      });
    },
    receiver() {
      return this;
    },
  });
  Object.assign(owner, { defaultView: win, documentElement: root, body });
  return {
    owner,
    win,
    root,
    body,
    node,
    timeouts,
    intervals,
    frames,
    get cancelled() {
      return cancelled;
    },
    get fetchSignal() {
      return lastFetchSignal;
    },
  };
}

test('document lookup keeps the old body; shared html writers stop after disposal', () => {
  const f = fixture(),
    scope = createSceneScope(f.body);
  try {
    assert.equal(scope.window.document, scope.document);
    assert.equal(scope.window.receiver(), f.win);
    assert.equal(scope.document.getElementById('old'), f.node);
    assert.equal(scope.document.getElementById(''), null);
    assert.equal(scope.document.querySelector('body'), f.body);
    f.owner.body = { querySelector: () => ({ id: 'new' }) };
    assert.equal(scope.document.getElementById('old'), f.node);
    const retainedRoot = scope.document.documentElement;
    retainedRoot.dataset.active = 'old';
    scope.dispose();
    retainedRoot.dataset.active = 'new';
    retainedRoot.classList.add('late');
    retainedRoot.style.setProperty('--late', '1');
    assert.equal(f.root.dataset.active, 'old');
    assert.equal(f.root.classList.value, undefined);
    assert.equal(f.root.style['--late'], undefined);
  } finally {
    scope.dispose();
  }
});

test('mount restores prototype methods on success, errors, and nested mounts', () => {
  const first = fixture(),
    firstScope = createSceneScope(first.body);
  const originalAdd = Target.prototype.addEventListener;
  const originalRemove = Target.prototype.removeEventListener;
  let secondScope;
  try {
    firstScope.run(() => {
      const second = fixture();
      secondScope = createSceneScope(second.body);
      let calls = 0;
      secondScope.run(() => second.body.addEventListener('click', () => calls++));
      firstScope.dispose();
      second.body.emit('click');
      assert.equal(calls, 1, 'The nested scene does not inherit its parent abort signal');
    });
    assert.equal(Target.prototype.addEventListener, originalAdd);
    assert.equal(Target.prototype.removeEventListener, originalRemove);
    assert.throws(
      () =>
        secondScope.run(() => {
          throw Error('mount failed');
        }),
      /mount failed/,
    );
    assert.equal(Target.prototype.addEventListener, originalAdd);
    assert.equal(Target.prototype.removeEventListener, originalRemove);
  } finally {
    firstScope.dispose();
    secondScope?.dispose();
  }
});

test('element, document, window and media-query listeners stop on disposal', () => {
  const f = fixture(),
    scope = createSceneScope(f.body);
  let calls = 0;
  const listener = () => calls++;
  try {
    scope.run(() => f.body.addEventListener('click', listener));
    scope.window.addEventListener('resize', listener);
    scope.document.addEventListener('visibilitychange', listener);
    const media = scope.matchMedia('test');
    media.addEventListener('change', listener);
    f.body.emit('click');
    f.win.emit('resize');
    f.owner.emit('visibilitychange');
    media.emit('change');
    assert.equal(calls, 4);
    scope.dispose();
    f.body.emit('click');
    f.win.emit('resize');
    f.owner.emit('visibilitychange');
    media.emit('change');
    assert.equal(calls, 4);
    assert.equal(scope.inspect().listeners, 0);
    assert.equal(
      scope.run(() => {
        throw Error('A disposed mount must not run');
      }),
      undefined,
    );
  } finally {
    scope.dispose();
  }
});

test('native remove and once listeners can be registered again', () => {
  const f = fixture(),
    scope = createSceneScope(f.body);
  let calls = 0;
  const listener = () => calls++;
  try {
    scope.run(() => f.body.addEventListener('click', listener, { once: true }));
    f.body.emit('click');
    f.body.emit('click');
    assert.equal(calls, 1);
    scope.run(() => f.body.addEventListener('click', listener));
    f.body.emit('click');
    assert.equal(calls, 2);
    f.body.removeEventListener('click', listener);
    scope.run(() => f.body.addEventListener('click', listener));
    f.body.emit('click');
    assert.equal(calls, 3);
    scope.dispose();
    f.body.emit('click');
    assert.equal(calls, 3);
  } finally {
    scope.dispose();
  }
});

test('queued timers, frames and observers are cancelled and cannot run late', () => {
  const f = fixture(),
    scope = createSceneScope(f.body);
  let calls = 0,
    receiver;
  try {
    const once = scope.setTimeout(
      function (value) {
        calls += value;
        receiver = this;
      },
      1,
      2,
    );
    f.timeouts.get(once)();
    assert.equal(receiver, scope.window);
    assert.equal(calls, 2);
    const timeout = scope.setTimeout(() => calls++, 1);
    const interval = scope.setInterval(() => calls++, 1);
    const frame = scope.requestAnimationFrame(() => calls++);
    const late = [f.timeouts.get(timeout), f.intervals.get(interval), f.frames.get(frame)];
    const observers = [
      scope.IntersectionObserver,
      scope.ResizeObserver,
      scope.MutationObserver,
    ].map((Constructor) => {
      const observer = new Constructor(() => calls++);
      observer.observe(f.body);
      return observer;
    });
    scope.dispose();
    late.forEach((callback) => callback(1));
    observers.forEach((observer) => observer.fire());
    assert.equal(calls, 2);
    assert.equal(f.timeouts.size + f.intervals.size + f.frames.size, 0);
    assert.equal(scope.inspect().observers, 0);
    assert.equal(f.cancelled, 1);
    scope.dispose();
    assert.equal(f.cancelled, 1);
  } finally {
    scope.dispose();
  }
});

test('legacy onchange assignments replace their listener and are disposable', () => {
  const f = fixture(),
    scope = createSceneScope(f.body),
    media = scope.matchMedia('test');
  let oldCalls = 0,
    newCalls = 0;
  try {
    media.onchange = () => oldCalls++;
    media.onchange = () => newCalls++;
    media.emit('change');
    assert.equal(oldCalls, 0);
    assert.equal(newCalls, 1);
    media.onchange = null;
    media.emit('change');
    assert.equal(newCalls, 1);
    media.addListener(() => newCalls++);
    scope.dispose();
    media.emit('change');
    assert.equal(newCalls, 1);
  } finally {
    scope.dispose();
  }
});

for (const fallbackSignals of [false, true]) {
  test(`fetch respects scene and caller abortion (${fallbackSignals ? 'fallback' : 'native'} signal composition)`, async () => {
    const f = fixture({ fallbackSignals }),
      scope = createSceneScope(f.body);
    const caller = new AbortController();
    try {
      const first = scope.fetch('/pending', { signal: caller.signal }).catch((error) => error.name);
      caller.abort();
      assert.equal(await first, 'AbortError');
      assert.equal(scope.signal.aborted, false);
      const second = scope.fetch('/pending').catch((error) => error.name);
      scope.dispose();
      assert.equal(f.fetchSignal.aborted, true);
      assert.equal(await second, 'AbortError');
      assert.equal(scope.inspect().requests, 0);
    } finally {
      scope.dispose();
    }
  });
}

test('diagnostics retain only live scenes', () => {
  const f = fixture(),
    scope = createSceneScope(f.body);
  try {
    assert.equal(inspect().length, 1);
    scope.dispose();
    assert.deepEqual(inspect(), []);
  } finally {
    scope.dispose();
  }
});
