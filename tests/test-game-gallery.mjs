import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const production = readFileSync(new URL('../src/shared/game-gallery.js', import.meta.url), 'utf8');
const flush = () => new Promise((resolve) => setImmediate(resolve));
const crop = { upper: '0 0 400 240', lower: '400 0 320 240' };
function fixture({ deferred = false, reduced = false, physical = false, clips = false } = {}) {
  let now = 0,
    sequence = 0;
  const timers = new Map(),
    loads = new Map(),
    nodes = new Map(),
    events = new Map(),
    idleGates = new Map();
  class Node {
    constructor(id) {
      this.id = id;
      this.dataset = {};
      this.attrs = {};
      this.listeners = new Map();
      this.isConnected = true;
      this.children = [];
      this.textContent = '';
      this.open = false;
    }
    addEventListener(name, fn) {
      this.listeners.set(name, fn);
    }
    setAttribute(name, value) {
      this.attrs[name] = String(value);
      if (name.startsWith('data-'))
        this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] =
          String(value);
    }
    getAttribute(name) {
      return this.attrs[name] ?? null;
    }
    hasAttribute(name) {
      return Object.hasOwn(this.attrs, name);
    }
    querySelector(selector) {
      return selector === 'image' ? this.image : null;
    }
    closest(selector) {
      return this.owner?.id === 'gallery-lightbox' &&
        /dialog|#gallery-lightbox|\[open\]/.test(selector)
        ? this.owner
        : null;
    }
    cloneNode() {
      const clone = new Node();
      clone.attrs = { ...this.attrs };
      return clone;
    }
    replaceChildren(child) {
      this.image = child;
      this.children = [child];
    }
    getBoundingClientRect() {
      return { left: 0, right: 400, top: 0, bottom: 240 };
    }
    focus() {}
  }
  for (const id of [
    'gallery',
    'gallery-image',
    'gallery-companion',
    'gallery-console-top',
    'gallery-gba-screen',
    'pocket-companion-image',
    'gallery-lightbox',
    'lightbox-image',
    'gallery-autoplay',
    'gallery-title',
    'gallery-caption',
    'gallery-current',
    'lightbox-title',
    'lightbox-counter',
    'gallery-open',
    'lightbox-close',
    'lightbox-previous',
    'lightbox-next',
  ])
    nodes.set(id, new Node(id));
  for (const id of [
    'gallery-image',
    'gallery-companion',
    'gallery-console-top',
    'gallery-gba-screen',
    'pocket-companion-image',
    'lightbox-image',
  ]) {
    const target = nodes.get(id);
    target.image = new Node();
    target.image.setAttribute('href', 'scene-0.webp');
    target.setAttribute(
      'viewBox',
      id === 'gallery-companion' || id === 'pocket-companion-image' ? crop.lower : crop.upper,
    );
  }
  if (clips) {
    const video = new Node('lightbox-video');
    video.pause = () => {
      video.paused = true;
    };
    video.play = () => {
      video.paused = false;
      return Promise.resolve();
    };
    video.load = () => {};
    video.removeAttribute = (name) => delete video.attrs[name];
    Object.defineProperty(video, 'src', {
      set(value) {
        video.setAttribute('src', value);
      },
      get() {
        return video.getAttribute('src');
      },
    });
    nodes.set('lightbox-video', video);
  }
  if (!physical) nodes.get('gallery-image').setAttribute('data-gallery-display', '');
  nodes.get('lightbox-image').setAttribute('data-gallery-display', '');
  for (const id of ['gallery-open', 'gallery-lightbox', 'lightbox-image'])
    nodes.get(id).dataset.screen = 'upper';
  if (!physical) nodes.get('gallery-image').dataset.screen = 'upper';
  for (const id of ['gallery-title', 'lightbox-title']) nodes.get(id).textContent = 'Scene 0';
  nodes.get('gallery-caption').textContent = 'Description 0';
  nodes.get('gallery-current').textContent = '01';
  nodes.get('lightbox-counter').textContent = '1 / 3 · Upper screen';
  const thumbs = [0, 1, 2].map((index) => {
    const node = new Node();
    node.dataset = {
      title: 'Scene ' + index,
      caption: 'Description ' + index,
      scene: 'scene-' + index,
    };
    node.setAttribute('aria-pressed', String(index === 0));
    node.image = new Node();
    node.image.setAttribute('href', 'scene-' + index + '.webp');
    return node;
  });
  if (clips) thumbs[2].dataset.video = 'clip.mp4';
  const screens = ['upper', 'lower'].map((screen) => {
    const node = new Node();
    node.setAttribute('data-gallery-screen', screen);
    node.setAttribute('aria-pressed', String(screen === 'upper'));
    node.owner = nodes.get('gallery-lightbox');
    return node;
  });
  const features = thumbs.map((thumb) => {
    const node = new Node();
    node.setAttribute('data-gallery-feature', thumb.dataset.scene);
    return node;
  });
  const motion = {
    matches: reduced,
    addEventListener: (name, fn) => events.set('motion:' + name, fn),
  };
  let observe;
  const context = {
    Date: { now: () => now },
    Image: class {
      set src(src) {
        this.source = src;
      }
      decode() {
        if (!deferred) return Promise.resolve();
        if (!loads.has(this.source)) {
          let resolve;
          const promise = new Promise((done) => (resolve = done));
          loads.set(this.source, { promise, resolve });
        }
        return loads.get(this.source).promise;
      }
    },
    document: {
      querySelector: () => null,
      hidden: false,
      getElementById: (id) => nodes.get(id),
      querySelectorAll: (selector) =>
        selector === '.gallery-thumb'
          ? thumbs
          : selector === '[data-gallery-screen]'
            ? screens
            : selector === '[data-gallery-feature]'
              ? features
              : [],
      addEventListener: (name, fn) => events.set(name, fn),
    },
    setTimeout(fn, delay) {
      const id = ++sequence;
      timers.set(id, { at: now + delay, fn });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    matchMedia: () => motion,
    IntersectionObserver: class {
      constructor(fn) {
        observe = fn;
      }
      observe() {}
    },
    window: {
      IntersectionObserver: true,
      ForgeMotion: {
        idle: (target) => idleGates.get(target.id)?.promise || Promise.resolve(),
        crossfadeSVG(target, commit) {
          commit();
          return Promise.resolve();
        },
        showDialog(dialog) {
          dialog.open = true;
        },
        hideDialog(dialog) {
          dialog.open = false;
          return Promise.resolve();
        },
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(production, context);
  observe([{ isIntersecting: true }]);
  async function advance(ms) {
    const end = now + ms;
    for (;;) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      now = next[1].at;
      timers.delete(next[0]);
      await next[1].fn();
      await flush();
      assert.ok(timers.size <= 1, 'One gallery timer owns all deadlines');
    }
    now = end;
  }
  const invoke = (node) => node.listeners.get('click')({ currentTarget: node, target: node });
  const click = (index) => invoke(thumbs[index]);
  const clickScreen = (screen) =>
    invoke(screens.find((node) => node.dataset.galleryScreen === screen));
  const clickFeature = (index) => {
    let prevented = false;
    const pending = features[index].listeners.get('click')({
      preventDefault() {
        prevented = true;
      },
    });
    assert.equal(prevented, true, 'Feature cards use the shared viewer instead of navigating away');
    return pending;
  };
  const selected = () => thumbs.findIndex((thumb) => thumb.getAttribute('aria-pressed') === 'true');
  const verify = (index, screen = 'upper') => {
    assert.equal(selected(), index);
    for (const id of [
      'gallery-image',
      'gallery-companion',
      'gallery-console-top',
      'gallery-gba-screen',
      'pocket-companion-image',
      'lightbox-image',
    ])
      assert.equal(
        nodes.get(id).image.getAttribute('href'),
        'scene-' + index + '.webp',
        id + ' belongs to the selected scene',
      );
    assert.equal(
      nodes.get('gallery-image').getAttribute('viewBox'),
      crop.upper,
      'The page gallery always shows the upper capture',
    );
    assert.equal(
      nodes.get('lightbox-image').getAttribute('viewBox'),
      crop[screen],
      'The enlarged view shows one selected screen',
    );
    if (!physical) assert.equal(nodes.get('gallery-image').dataset.screen, 'upper');
    assert.equal(nodes.get('lightbox-image').dataset.screen, screen);
    assert.equal(nodes.get('gallery-lightbox').dataset.screen, screen);
    assert.equal(
      nodes.get('gallery-open').dataset.screen,
      'upper',
      'The enlarge button always opens the upper screen',
    );
    for (const id of ['gallery-companion', 'pocket-companion-image'])
      assert.equal(
        nodes.get(id).getAttribute('viewBox'),
        crop.lower,
        'Physical lower display keeps its own crop',
      );
    assert.equal(
      nodes.get('gallery-console-top').getAttribute('viewBox'),
      crop.upper,
      'Physical upper display keeps its own crop',
    );
    assert.equal(nodes.get('gallery-title').textContent, 'Scene ' + index);
    assert.equal(
      nodes.get('lightbox-counter').textContent,
      `${index + 1} / 3 · ${screen === 'upper' ? 'Upper' : 'Lower'} screen`,
    );
    for (const button of screens)
      assert.equal(
        button.getAttribute('aria-pressed'),
        String(button.dataset.galleryScreen === screen),
        'The enlarged screen controls reflect the selected display',
      );
  };
  function blockIdle(id = 'gallery-image') {
    let resolve;
    const promise = new Promise((done) => (resolve = done));
    idleGates.set(id, { promise, resolve });
    return () => {
      idleGates.delete(id);
      resolve();
    };
  }
  return {
    context,
    nodes,
    thumbs,
    screens,
    timers,
    loads,
    events,
    motion,
    observe,
    advance,
    click,
    clickScreen,
    clickFeature,
    selected,
    verify,
    blockIdle,
  };
}
{
  const f = fixture();
  await flush();
  f.verify(0);
  await f.advance(5999);
  assert.equal(f.selected(), 0);
  await f.advance(1);
  f.verify(1);
  await f.advance(6000);
  f.verify(2);
  await f.click(0);
  await f.advance(24999);
  assert.equal(f.selected(), 0, 'Manual selection stays for 25 seconds');
  await f.advance(1);
  f.verify(1);
  await f.advance(6000);
  f.verify(2);
}
{
  const f = fixture();
  await f.click(1);
  await f.advance(14000);
  await f.click(2);
  await f.advance(24999);
  assert.equal(f.selected(), 2, 'A second selection replaces the previous hold');
  await f.advance(1);
  f.verify(0);
}
{
  const f = fixture();
  assert.equal(f.screens.length, 2);
  assert.ok(
    f.screens.every((button) => button.owner.id === 'gallery-lightbox'),
    'Screen buttons belong only to the expanded gallery',
  );
  await f.nodes.get('gallery-open').listeners.get('click')();
  await f.clickScreen('lower');
  f.verify(0, 'lower');
  assert.equal(f.nodes.get('gallery-lightbox').open, true);
  await f.nodes.get('lightbox-next').listeners.get('click')();
  f.verify(1, 'lower');
  await f.clickScreen('upper');
  f.verify(1);
}
{
  const f = fixture();
  await f.advance(5999);
  await f.nodes.get('gallery-open').listeners.get('click')();
  await f.clickScreen('lower');
  f.nodes.get('lightbox-close').listeners.get('click')();
  await flush();
  await f.advance(24999);
  f.verify(0, 'lower');
  await f.advance(1);
  f.verify(1, 'lower');
}
{
  const f = fixture({ physical: true });
  await f.nodes.get('gallery-open').listeners.get('click')();
  await f.clickScreen('lower');
  f.verify(0, 'lower');
  assert.equal(f.timers.size, 0, 'The open viewer pauses the slideshow');
  await f.click(2);
  f.verify(2, 'lower');
  f.nodes.get('lightbox-close').listeners.get('click')();
  await flush();
  f.verify(2, 'lower');
  await f.nodes.get('gallery-open').listeners.get('click')();
  f.verify(2);
  assert.equal(
    f.nodes.get('gallery-lightbox').open,
    true,
    'Reopening the gallery starts with the upper screen',
  );
}
{
  const f = fixture({ deferred: true }),
    earlier = f.click(1),
    latest = f.click(2);
  f.loads.get('scene-2.webp').resolve();
  await latest;
  f.verify(2);
  f.loads.get('scene-1.webp').resolve();
  await earlier;
  f.verify(2);
}
{
  const f = fixture({ deferred: true }),
    scene = f.click(1),
    screen = f.clickScreen('lower');
  f.loads.get('scene-1.webp').resolve();
  await Promise.all([scene, screen]);
  f.verify(1, 'lower');
}
{
  const f = fixture(),
    release = f.blockIdle();
  const scene = f.click(1);
  await flush();
  const lower = f.clickScreen('lower');
  await flush();
  const upper = f.clickScreen('upper');
  await flush();
  release();
  await Promise.all([scene, lower, upper]);
  f.verify(1);
}
{
  const f = fixture(),
    release = f.blockIdle();
  const lower = f.clickScreen('lower');
  await flush();
  const scene = f.click(2);
  await flush();
  release();
  await Promise.all([lower, scene]);
  f.verify(2, 'lower');
}
{
  const f = fixture({ physical: true });
  await f.nodes.get('gallery-open').listeners.get('click')();
  const release = f.blockIdle();
  const lower = f.clickScreen('lower');
  await flush();
  const upper = f.clickScreen('upper');
  await flush();
  release();
  await Promise.all([lower, upper]);
  f.verify(0);
  assert.equal(
    f.nodes.get('gallery-lightbox').open,
    true,
    'Rapid screen changes keep the expanded viewer open',
  );
}
for (const physical of [false, true]) {
  const f = fixture({ physical });
  await f.clickScreen('lower', true);
  await f.clickFeature(2);
  f.verify(2);
  assert.equal(
    f.nodes.get('gallery-lightbox').open,
    true,
    'Feature cards open their captured scene on the upper screen',
  );
  assert.equal(f.timers.size, 0, 'Feature viewer pauses the slideshow');
  f.nodes.get('lightbox-close').listeners.get('click')();
  await flush();
  await f.advance(24999);
  f.verify(2);
  await f.advance(1);
  f.verify(0);
}
{
  const f = fixture();
  await f.click(1);
  await f.advance(8000);
  f.context.document.hidden = true;
  f.events.get('visibilitychange')();
  await f.advance(7000);
  assert.equal(f.timers.size, 0);
  f.context.document.hidden = false;
  f.events.get('visibilitychange')();
  await f.advance(9999);
  assert.equal(f.selected(), 1);
  await f.advance(1);
  f.verify(2);
  f.observe([{ isIntersecting: false }]);
  assert.equal(f.timers.size, 0, 'Offscreen galleries do not advance');
}
{
  const f = fixture();
  await f.nodes.get('gallery-open').listeners.get('click')();
  assert.equal(f.timers.size, 0, 'Opening the enlarged view pauses autoplay');
  await f.nodes.get('lightbox-next').listeners.get('click')();
  f.verify(1);
  f.nodes.get('lightbox-close').listeners.get('click')();
  await flush();
  await f.advance(24999);
  assert.equal(f.selected(), 1);
  await f.advance(1);
  f.verify(2);
}
{
  const f = fixture({ reduced: true });
  assert.equal(f.timers.size, 0);
  await f.click(2);
  f.verify(2);
  await f.advance(30000);
  assert.equal(f.selected(), 2);
  f.nodes.get('gallery-autoplay').listeners.get('click')();
  await f.advance(6000);
  f.verify(0);
  f.nodes.get('gallery-autoplay').listeners.get('click')();
  await f.advance(30000);
  assert.equal(f.selected(), 0, 'Pause button stops subsequent automatic scenes');
}
{
  const f = fixture({ deferred: true }),
    pending = f.click(1);
  f.nodes.get('gallery-image').isConnected = false;
  f.loads.get('scene-1.webp').resolve();
  await pending;
  assert.equal(f.selected(), 0, 'A disconnected scene cannot commit a late decode');
}
{
  const f = fixture({ clips: true });
  await f.click(2);
  assert.equal(
    f.nodes.get('gallery-lightbox').open,
    true,
    'A clip thumbnail opens the shared viewer',
  );
  assert.equal(f.nodes.get('lightbox-video').hidden, false);
  assert.equal(f.nodes.get('lightbox-video').paused, false);
  assert.equal(f.nodes.get('lightbox-video').getAttribute('src'), 'clip.mp4');
  assert.equal(f.nodes.get('lightbox-image').hidden, true);
  await f.nodes.get('lightbox-next').listeners.get('click')();
  assert.equal(f.nodes.get('lightbox-video').hidden, true);
  assert.equal(
    f.nodes.get('lightbox-video').paused,
    true,
    'Changing back to a still stops the clip',
  );
  await f.click(2);
  f.nodes.get('lightbox-close').listeners.get('click')();
  await flush();
  assert.equal(f.nodes.get('lightbox-video').paused, true, 'Closing the viewer stops playback');
}
console.log(
  'PASS: upper-screen defaults, expanded-only screen controls, upper page captures, physical console crops, lower-screen viewer, latest scene/screen requests, 6-second gallery cadence, 25-second manual hold, paired captures, visibility/dialog pause and reduced motion.',
);
