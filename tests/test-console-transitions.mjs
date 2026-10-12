import { position, declaration } from './helpers/source-sections.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Run the production selection worker with controllable decoding and animation clocks.
const source = readFileSync(new URL('../src/features/collection/dual.js', import.meta.url), 'utf8');
const section = (start, end) =>
  source.slice(position(source, start), position(source, end, position(source, start)));
const production = [
  section('const consoleMedia =', 'const dual='),
  declaration(source, 'mobileLogoBounds'),
  declaration(source, 'motion'),
  section('function projectFiles(', 'const runningMotion='),
  section('function setScreen(', 'function revealSelectedTitle('),
  section('function selectRailProject(', 'const imageReady='),
  section('const imageReady=', 'projectButtons.forEach(button=>{'),
].join('\n');
const tick = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}

function harness({ reduced = false } = {}) {
  const nodes = new Map(),
    loads = new Map(),
    animations = [],
    commits = [];
  class Element {
    constructor(id) {
      this.attributes = {};
      if (id) this.attributes.id = id;
      this.dataset = {};
      this.children = [];
      this.parentElement = null;
      this.classes = new Set();
      this.classList = {
        add: (n) => this.classes.add(n),
        remove: (n) => this.classes.delete(n),
        contains: (n) => this.classes.has(n),
        toggle: (n, active) => (active ? this.classes.add(n) : this.classes.delete(n)),
      };
    }
    get id() {
      return this.attributes.id;
    }
    set id(value) {
      this.attributes.id = value;
    }
    get childNodes() {
      return this.children;
    }
    get textContent() {
      return this.children
        .map((child) => (typeof child === 'string' ? child : child.textContent))
        .join('');
    }
    set textContent(text) {
      this.replaceChildren(String(text));
    }
    setAttribute(k, v) {
      this.attributes[k] = String(v);
    }
    getAttribute(k) {
      return this.attributes[k];
    }
    removeAttribute(k) {
      delete this.attributes[k];
    }
    append(...children) {
      for (const child of children) {
        if (typeof child !== 'string') {
          child.remove();
          child.parentElement = this;
        }
        this.children.push(child);
      }
    }
    remove() {
      if (this.parentElement)
        this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
      this.parentElement = null;
    }
    replaceChildren(...children) {
      for (const child of this.children) if (typeof child !== 'string') child.parentElement = null;
      this.children = [];
      this.append(...children);
    }
  }
  class SVG extends Element {
    constructor(id) {
      super(id);
      this.image = new Element();
    }
    querySelector() {
      return this.image;
    }
    cloneNode() {
      const node = new SVG(this.attributes.id);
      node.attributes = { ...this.attributes };
      node.image.attributes = { ...this.image.attributes };
      return node;
    }
    replaceWith(next) {
      const parent = this.parentElement;
      next.remove();
      next.parentElement = parent;
      parent.children = parent.children.map((child) => (child === this ? next : child));
      nodes.set(this.attributes.id, next);
      this.parentElement = null;
    }
  }
  for (const side of ['top', 'bottom']) {
    const svg = new SVG('dual-' + side),
      surface = new Element();
    surface.append(svg);
    nodes.set('dual-' + side, svg);
  }
  class LogoStage extends Element {
    constructor(image, svg) {
      super();
      this.img = image;
      this.svg = svg;
      this.append(image, svg);
    }
    querySelector(selector) {
      return selector === 'img' ? this.img : this.svg;
    }
    querySelectorAll() {
      return [this.img, this.svg];
    }
    cloneNode() {
      return new LogoStage(new Element(), this.svg.cloneNode(true));
    }
  }
  const logo = new SVG('feature-mobile-logo'),
    image = new Element();
  const logoStage = new LogoStage(image, logo),
    logoHost = new Element();
  logoHost.append(logoStage);
  // The original logo SVG is replaced atomically on each commit.
  logoStage.querySelector = (selector) =>
    selector === 'img' ? image : logoStage.children.find((child) => child instanceof SVG);
  nodes.set('feature-mobile-logo', logo);
  nodes.set('feature-logo', image);
  for (const id of [
    'feature-index',
    'feature-platform',
    'feature-description',
    'feature-short',
    'announcement',
  ])
    nodes.set(id, new Element(id));
  const backdrops = ['kart', 'minish', 'alttp', 'doom', 'starwing'].map((key) => {
    const backdrop = new Element();
    backdrop.dataset.backdrop = key;
    const svg = new SVG();
    svg.image.setAttribute('href', 'assets/artwork/' + key + '.png');
    backdrop.querySelector = () => svg.image;
    return backdrop;
  });
  const reduceMotion = { matches: reduced };
  const railButtons = ['alttp', 'minish', 'kart', 'doom', 'starwing'].map((key) => {
    const button = new Element();
    button.dataset.console = key;
    return button;
  });
  const context = {
    Image: class {
      set src(value) {
        this.file = value.slice(7);
        this.decoding = deferred();
        loads.set(this.file, this);
      }
      decode() {
        return this.decoding.promise;
      }
    },
    document: {
      timeline: { currentTime: 1234 },
      getElementById: (id) => nodes.get(id),
      createElement: (tag) => (tag === 'br' ? '\n' : new Element()),
      createTextNode: (value) => value,
    },
    getComputedStyle: () => ({ getPropertyValue: () => '.3' }),
    dual: { dataset: {}, querySelectorAll: () => [], querySelector: () => null },
    backdropLayers: backdrops,
    currentGame: 'kart',
    requestedGame: 'kart',
    requestedAnimation: true,
    consoleWorker: null,
    wakeSelection: null,
    welcomeActive: false,
    railButtons,
    gameKeys: ['alttp', 'minish', 'kart', 'doom', 'starwing'],
    reduceMotion,
    revealSelectedTitle() {},
    showBackdrop(key) {
      if (commits.at(-1) !== key) commits.push(key);
      backdrops.forEach((layer) => {
        layer.classList.toggle('is-active', layer.dataset.backdrop === key);
        layer.classList.toggle('is-drifting', layer.dataset.backdrop === key);
      });
    },
    playMotion(element, frames, options) {
      if (!element || reduceMotion.matches) return;
      const completion = deferred();
      const animation = {
        element,
        frames,
        options,
        active: true,
        finished: completion.promise,
        cancel() {
          this.active = false;
          completion.resolve();
        },
        complete() {
          this.active = false;
          completion.resolve();
        },
      };
      animations.push(animation);
      return animation;
    },
    async settle(values) {
      await Promise.allSettled(values.filter(Boolean).map((a) => a.finished));
    },
  };
  vm.createContext(context);
  vm.runInContext(
    production +
      '\nglobalThis.api={showConsoleProject,readyProject,motion,consoleMedia,projectFiles,state:()=>({currentGame,requestedGame,working:!!consoleWorker})};',
    context,
  );
  const api = context.api;
  api.showConsoleProject('kart', { animate: false });
  commits.length = 0;
  const files = (key) => api.projectFiles(key);
  function load(file) {
    const image = loads.get(file);
    assert.ok(image, 'Image requested: ' + file);
    image.onload();
    image.decoding.resolve();
  }
  function loadProject(key) {
    files(key).forEach(load);
  }
  function finish() {
    animations.filter((a) => a.active).forEach((a) => a.complete());
  }
  function verify(key) {
    assert.equal(
      railButtons.find((button) => button.classList.contains('selected')).dataset.console,
      key,
      'Rail and settled scene agree',
    );
    assert.equal(api.state().currentGame, key);
    assert.equal(logoHost.children.length, 1, 'No stale logo layers');
    assert.equal(context.dual.dataset.game, key);
    assert.equal(nodes.get('feature-short').textContent, api.consoleMedia[key].name);
    assert.equal(nodes.get('feature-platform').textContent, api.consoleMedia[key].platform);
    assert.equal(nodes.get('feature-description').textContent, api.consoleMedia[key].description);
    for (const id of ['feature-index', 'feature-platform', 'feature-description', 'feature-short'])
      assert.ok(!nodes.get(id).classList.contains('scene-copy-stage'), 'Text overlay cleaned up');
    assert.equal(backdrops.filter((layer) => layer.classList.contains('is-active')).length, 1);
    assert.ok(
      backdrops.find((layer) => layer.dataset.backdrop === key).classList.contains('is-active'),
    );
    for (const side of ['top', 'bottom']) {
      const svg = nodes.get('dual-' + side),
        data = api.consoleMedia[key][side];
      assert.equal(svg.getAttribute('viewBox'), data[3]);
      assert.equal(svg.image.getAttribute('href'), 'assets/' + (data[4] || data[0]));
      assert.equal(
        svg.getAttribute('aria-label'),
        api.consoleMedia[key].name + ': ' + side + ' screen',
      );
      assert.equal(svg.parentElement.children.length, 1, 'Only one capture remains per screen');
    }
  }
  async function complete() {
    finish();
    await tick();
  }
  return {
    api,
    nodes,
    loads,
    animations,
    commits,
    backdrops,
    railButtons,
    files,
    load,
    loadProject,
    verify,
    complete,
  };
}

// Every incoming resource, including the actual artwork, decodes before any scene change.
{
  const h = harness(),
    work = h.api.showConsoleProject('minish');
  h.files('minish').slice(0, -1).forEach(h.load);
  await tick();
  h.verify('kart');
  assert.equal(h.animations.length, 0, 'Artwork decode gates the complete scene');
  const previous = h.nodes.get('dual-top'),
    crop = previous.getAttribute('viewBox');
  h.load(h.files('minish').at(-1));
  await tick();
  assert.equal(h.api.state().currentGame, 'kart');
  assert.equal(
    h.railButtons.find((button) => button.classList.contains('selected')).dataset.console,
    'minish',
    'Rail changes at fade start, before scene commit',
  );
  assert.equal(
    h.railButtons
      .find((button) => button.dataset.console === 'minish')
      .getAttribute('aria-pressed'),
    'true',
  );
  assert.equal(
    h.animations.length,
    14,
    'Screens, logo, four text pairs and two backgrounds share one fade',
  );
  for (const a of h.animations) {
    assert.equal(a.options.duration, 560);
    assert.equal(a.options.easing, 'ease-in-out');
    assert.equal(a.startTime, 1234);
    for (const frame of a.frames) {
      assert.deepEqual(Object.keys(frame), ['opacity'], 'No wipe, transform, zoom or moving crop');
    }
  }
  for (const id of ['feature-index', 'feature-platform', 'feature-description', 'feature-short']) {
    const stage = h.nodes.get(id),
      fades = h.animations.filter((a) => a.element.parentElement === stage);
    assert.equal(fades.length, 2, id + ' has both fading layers');
    assert.equal(fades[0].frames[0].opacity, 0);
    assert.equal(fades[0].frames[1].opacity, 1);
    assert.equal(fades[1].frames[0].opacity, 1);
    assert.equal(fades[1].frames[1].opacity, 0);
  }
  for (const key of ['kart', 'minish'])
    assert.ok(
      h.backdrops.find((layer) => layer.dataset.backdrop === key).classList.contains('is-drifting'),
      'Outgoing and incoming drift remain active',
    );
  const artworkFades = h.animations.filter((a) => a.element.dataset.backdrop);
  assert.equal(artworkFades.length, 2);
  assert.equal(
    artworkFades.find((a) => a.element.dataset.backdrop === 'minish').frames[1].opacity,
    0.3,
  );
  for (const a of h.animations.filter((a) => a.element.classList.contains('screen-incoming'))) {
    assert.equal(a.element.parentElement.children.length, 2);
    assert.equal(a.element.getAttribute('aria-hidden'), 'true');
    assert.equal(a.element.getAttribute('id'), undefined);
    assert.equal(a.frames[0].opacity, 0);
    assert.equal(a.frames[1].opacity, 1);
  }
  assert.equal(previous.getAttribute('viewBox'), crop);
  await h.complete();
  await work;
  h.verify('minish');
  assert.equal(previous.getAttribute('viewBox'), crop, 'Old SVG never acquires an incoming crop');
  assert.equal(h.api.state().working, false);
  assert.equal(h.animations.filter((a) => a.active).length, 0);
}

// Obsolete decoding never blocks or overwrites a more recent selection.
{
  const h = harness(),
    work = h.api.showConsoleProject('doom');
  for (const key of ['minish', 'alttp', 'kart', 'minish', 'starwing'])
    h.api.showConsoleProject(key);
  await tick();
  h.loadProject('starwing');
  await tick();
  await h.complete();
  await work;
  h.verify('starwing');
  assert.deepEqual(
    h.commits.filter((key) => key !== 'kart'),
    ['starwing'],
  );
  h.loadProject('doom');
  await tick();
  h.verify('starwing');
}

// An active fade settles before the latest queued selection; intermediate choices do not mount.
{
  const h = harness(),
    work = h.api.showConsoleProject('minish');
  h.loadProject('minish');
  await tick();
  for (const key of ['doom', 'kart', 'starwing', 'alttp']) h.api.showConsoleProject(key);
  assert.equal(h.animations.length, 14, 'Clicks cannot stack a second scene');
  await h.complete();
  h.verify('minish');
  h.loadProject('alttp');
  await tick();
  for (const side of ['top', 'bottom'])
    assert.equal(h.nodes.get('dual-' + side).parentElement.children.length, 2);
  await h.complete();
  await work;
  h.verify('alttp');
  assert.deepEqual(h.commits, ['minish', 'alttp']);
}

// Failures leave the previous complete scene intact and all assets remain retryable.
{
  const h = harness(),
    work = h.api.showConsoleProject('minish');
  h.loads.get(h.files('minish').at(-1)).onerror();
  await work;
  h.verify('kart');
  const retry = h.api.showConsoleProject('minish');
  h.loadProject('minish');
  await tick();
  await h.complete();
  await retry;
  h.verify('minish');
}

// Reduced motion keeps resource gating but switches the whole scene without animation.
{
  const h = harness({ reduced: true }),
    work = h.api.showConsoleProject('doom');
  h.loadProject('doom');
  await work;
  h.verify('doom');
  assert.equal(h.animations.length, 0);
}
console.log(
  'PASS: full scene clock (14 opacity tracks), artwork decoding, atomic SVG crops, clean layers, rapid queues, stale loads, retries and reduced motion.',
);
