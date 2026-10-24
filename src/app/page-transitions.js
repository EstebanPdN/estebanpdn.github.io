// Every authored route is a scene inside one live document.
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const routes = new Set([
    'index.html',
    'the-minish-cap.html',
    'a-link-to-the-past.html',
    'legend-of-doom.html',
    'mario-kart-64.html',
    'star-fox.html',
    'dusklight.html',
    'super-mario-64-ds.html',
    'credits.html',
    'red-viper-color.html',
    'blog.html',
    'blog-mario-kart-64-v2-0.html',
  ]);
  const prepared = new Map(),
    images = new Map(),
    snapshots = new Map();
  const running = new Set(),
    curtains = new Set(),
    warmedFonts = new Map();
  let entryAnimations = [];
  let runtime,
    scope,
    controller,
    currentURL = new URL(location.href),
    currentPage,
    requested,
    worker,
    generation = 0;
  const route = (url) => {
    const name = url.pathname.endsWith('/') ? 'index.html' : url.pathname.split('/').pop();
    return name.endsWith('.html') ? name : name + '.html';
  };
  if (
    route(currentURL) !== 'index.html' ||
    ['#collection', '#progress', '#info'].includes(currentURL.hash)
  )
    root.classList.add('forge-entering');
  const key = (url) =>
    url.origin + url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1) + route(url) + url.search;
  const visible = (el) => {
    const bounds = el.getBoundingClientRect();
    return (
      bounds.width > 0 &&
      bounds.height > 0 &&
      bounds.bottom > 0 &&
      bounds.top < innerHeight &&
      !el.closest('[hidden]')
    );
  };
  const bounded = (promise, ms) => {
    let timer;
    return Promise.race([
      promise,
      new Promise((resolve) => {
        timer = setTimeout(resolve, ms);
      }),
    ]).finally(() => clearTimeout(timer));
  };
  const settle = (animations) =>
    Promise.allSettled(animations.filter(Boolean).map((a) => a.finished));
  function animate(el, frames, options) {
    if (!el || reduced.matches) return null;
    const animation = el.animate(frames, options);
    running.add(animation);
    animation.finished.then(
      () => running.delete(animation),
      () => running.delete(animation),
    );
    return animation;
  }
  function imageReady(src) {
    if (images.has(src)) return images.get(src);
    const image = new Image();
    image.src = src;
    const promise = image.decode
      ? image.decode().catch(() => {})
      : new Promise((resolve) => {
          image.onload = image.onerror = resolve;
        });
    images.set(src, promise);
    return promise;
  }
  function assetURL(value, base) {
    try {
      const url = new URL(value, base);
      return url.origin === location.origin && /^https?:$/.test(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }
  function warmFont(rule, base) {
    const value = (property) => rule.match(new RegExp(property + '\\s*:\\s*([^;]+)'))?.[1]?.trim();
    const family = value('font-family')?.replace(/^['"]|['"]$/g, '');
    const src = value('src')?.replace(
      /url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g,
      (_, path) => `url("${new URL(path, base).href}")`,
    );
    if (!family || !src || !window.FontFace) return Promise.resolve();
    const id = family + src + value('font-weight');
    if (!warmedFonts.has(id)) {
      const descriptors = {};
      for (const [property, name] of [
        ['font-weight', 'weight'],
        ['font-style', 'style'],
        ['unicode-range', 'unicodeRange'],
      ]) {
        if (value(property)) descriptors[name] = value(property);
      }
      const face = new FontFace(family, src, descriptors);
      warmedFonts.set(
        id,
        face
          .load()
          .then(() => document.fonts.add(face))
          .catch(() => {}),
      );
    }
    return warmedFonts.get(id);
  }
  async function styleReady(url, visited) {
    if (visited.has(url)) return;
    visited.add(url);
    try {
      const response = await fetch(url, { credentials: 'same-origin', cache: 'force-cache' });
      if (!response.ok) return;
      const css = await response.text();
      const assets = [...css.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)]
        .map((match) => assetURL(match[1], url))
        .filter(Boolean);
      const fonts = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map((match) =>
        warmFont(match[1], url),
      );
      await Promise.allSettled([
        ...fonts,
        ...assets
          .filter((src) => /\.(?:css|png|jpe?g|webp|gif|svg)(?:\?|$)/i.test(src))
          .map((src) => (/\.css(?:\?|$)/.test(src) ? styleReady(src, visited) : imageReady(src))),
      ]);
    } catch {
      /* Keep the prepared HTML usable when an optional texture is unavailable. */
    }
  }
  function describe(doc, url) {
    const moduleURL = assetURL(
      doc.querySelector('meta[name="forge-controller"]')?.content,
      url.href,
    );
    if (!moduleURL || !new URL(moduleURL).pathname.includes('/page-controllers/'))
      throw new Error('Missing scene controller');
    return {
      url,
      title: doc.title,
      description: doc.querySelector('meta[name="description"]')?.content || '',
      body: doc.body,
      styles: [...doc.querySelectorAll('[data-forge-page-style]')],
      moduleURL,
      module: null,
    };
  }
  function loadStyle(template, url) {
    const node = template.cloneNode(true);
    if (node.tagName === 'LINK') node.href = new URL(node.getAttribute('href'), url);
    node.media = 'not all';
    const ready =
      node.tagName === 'LINK'
        ? new Promise((resolve, reject) => {
            node.onload = resolve;
            node.onerror = () => reject(new Error('Scene stylesheet unavailable'));
          })
        : Promise.resolve();
    document.head.append(node);
    return { node, ready };
  }
  function preparePage(url) {
    const id = key(url);
    if (prepared.has(id)) return prepared.get(id);
    const promise = (async () => {
      const response = await fetch(url.pathname + url.search, { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Page unavailable');
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const page = describe(doc, url);
      const styles = page.styles.map((el) => loadStyle(el, url.href));
      page.styles = styles.map((item) => item.node);
      try {
        page.module = await import(page.moduleURL);
        await Promise.all(styles.map((item) => item.ready));
        const main = doc.querySelector('main'),
          hero = main?.querySelector('section,article') || main;
        const media = [doc.querySelector('header'), hero]
          .filter(Boolean)
          .flatMap((part) => [...part.querySelectorAll('img[src],svg image[href]')]);
        const visited = new Set();
        await bounded(
          Promise.allSettled([
            ...media
              .map((el) => assetURL(el.getAttribute('src') || el.getAttribute('href'), url.href))
              .filter(Boolean)
              .map(imageReady),
            ...page.styles.filter((el) => el.href).map((el) => styleReady(el.href, visited)),
          ]),
          900,
        );
        return page;
      } catch (error) {
        page.styles.forEach((node) => node.remove());
        throw error;
      }
    })();
    prepared.set(id, promise);
    promise.catch(() => prepared.delete(id));
    return promise;
  }
  function prewarmScenes() {
    if (navigator.connection?.saveData) return;
    const urls = [
      'the-minish-cap.html',
      'a-link-to-the-past.html',
      'index.html',
      ...document.querySelectorAll('a[href]'),
      ...routes,
    ].map((value) => new URL(typeof value === 'string' ? value : value.href, location.href));
    const seen = new Set();
    const queue = urls.filter(
      (url) =>
        url.origin === location.origin &&
        routes.has(route(url)) &&
        key(url) !== key(currentURL) &&
        !prepared.has(key(url)) &&
        !seen.has(key(url)) &&
        seen.add(key(url)),
    );
    const run = async () => {
      while (queue.length) await preparePage(queue.shift()).catch(() => {});
    };
    const begin = () => {
      run();
      run();
    };
    if (window.requestIdleCallback) requestIdleCallback(begin, { timeout: 450 });
    else setTimeout(begin, 120);
  }
  function paintBackdrop(url) {
    const dark = root.dataset.theme === 'dark',
      name = route(url);
    const colors = {
      'index.html': dark ? '#1b1b1d' : '#f7f9fa',
      'blog.html': dark ? '#1b1b1d' : '#f7f9fa',
      'blog-mario-kart-64-v2-0.html': dark ? '#1b1b1d' : '#f7f9fa',
      'the-minish-cap.html': dark ? '#243921' : '#426521',
      'a-link-to-the-past.html': '#10271f',
      'legend-of-doom.html': '#086563',
      'mario-kart-64.html': '#161937',
      'star-fox.html': '#121e2e',
      'dusklight.html': '#141916',
      'super-mario-64-ds.html': dark ? '#181c21' : '#e7e7e7',
      'red-viper-color.html': '#090607',
      'credits.html': dark ? '#171718' : '#f5f4ec',
    };
    const layer = document.createElement('div');
    layer.className = 'forge-route-backdrop';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.backgroundColor = colors[name] || getComputedStyle(document.body).backgroundColor;
    if (name === 'the-minish-cap.html') {
      layer.style.backgroundImage = `linear-gradient(90deg,#1c371639,transparent 25% 75%,#1c371652),url("${new URL('assets/minish/manual-paper-4x.webp', location.href).href}")`;
      layer.style.backgroundBlendMode = 'normal,multiply';
      layer.style.backgroundSize = 'auto,650px 320px';
    }
    root.append(layer);
    curtains.add(layer);
    root.classList.add('forge-routing');
    const animation = animate(layer, [{ opacity: 0 }, { opacity: 1 }], {
      duration: 180,
      easing: 'ease-in-out',
      fill: 'both',
    });
    const ready = settle([animation]).then(() => {
      layer.style.opacity = '1';
      animation?.cancel();
    });
    return { layer, ready };
  }
  async function clearBackdrops() {
    const layers = [...curtains];
    const animations = layers.map((layer) =>
      animate(layer, [{ opacity: getComputedStyle(layer).opacity }, { opacity: 0 }], {
        duration: 180,
        easing: 'ease-in-out',
        fill: 'both',
      }),
    );
    await settle(animations);
    animations.forEach((a) => a?.cancel());
    layers.forEach((layer) => {
      layer.remove();
      curtains.delete(layer);
    });
  }
  function destination(event) {
    const link = event.target.closest?.('a[href]');
    if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download'))
      return null;
    const url = new URL(link.href, location.href);
    if (
      url.origin !== location.origin ||
      !/^https?:$/.test(url.protocol) ||
      !routes.has(route(url))
    )
      return null;
    if (key(url) === key(currentURL)) return null;
    return { url, link };
  }
  function saveCurrent() {
    const actualURL = new URL(location.href);
    if (key(actualURL) === key(currentURL)) currentURL = actualURL;
    window.ForgeMotion?.stabilize(document.body);
    const state = controller?.capture?.() || {};
    const scroll = [scrollX, scrollY];
    const focus = document.activeElement?.getAttribute('href') || null;
    // Cancel temporary layers before taking a clean, listener-free history snapshot.
    scope?.dispose();
    const body = document.body.cloneNode(true);
    // History keeps the last completed carousel scene, never its temporary overlays.
    body
      .querySelectorAll('.screen-incoming,.logo-incoming,.scene-copy-incoming')
      .forEach((el) => el.remove());
    body.querySelectorAll('.scene-copy-current').forEach((el) => el.replaceWith(...el.childNodes));
    body
      .querySelectorAll('.scene-copy-stage')
      .forEach((el) => el.classList.remove('scene-copy-stage'));
    const stage = body.querySelector('#dual-pages');
    if (stage) {
      stage.style.height = '';
      delete stage.dataset.transitioning;
    }
    body.querySelectorAll('dialog[open]').forEach((dialog) => dialog.removeAttribute('open'));
    body
      .querySelectorAll('[data-theme-bound]')
      .forEach((button) => delete button.dataset.themeBound);
    body.querySelectorAll('[inert]').forEach((el) => (el.inert = false));
    body.querySelectorAll('.reveal-pending').forEach((el) => el.classList.remove('reveal-pending'));
    const welcome = body.querySelector('#welcome-screen');
    if (welcome) welcome.hidden = true;
    snapshots.set(key(currentURL), { body, state, scroll, focus });
    return scroll;
  }
  function surfaces() {
    const main = document.querySelector('main');
    const parts = [...document.body.children].filter(
      (el) =>
        el !== main &&
        !['SVG', 'DIALOG', 'SCRIPT'].includes(el.tagName) &&
        !el.matches('.skip-link,[hidden],#welcome-screen,[data-forge-persistent]'),
    );
    if (main) parts.push(...main.children);
    // The homepage has one enclosing section; keep its stable shell and reveal its own parts.
    if (main?.querySelector('#dual')) {
      const dual = main.querySelector('#dual');
      return [
        ...dual.querySelectorAll(
          '#dual-collection:not([hidden]) > *,#dual-progress:not([hidden]) > *,#dual-info:not([hidden]) > *',
        ),
      ].filter(visible);
    }
    return parts.filter(visible);
  }
  function details() {
    const selectors = {
      minish: '.platform-line,.cover-link,.cover-copy > *,.cover-ezlo,.contents',
      alttp: '.hero-copy > *,.hero-actions',
      doom: '.launch-strip,.desktop-icons,.release-stamp,.welcome-window,.gallery-window',
      kart: '.hero-copy > *,.starting-line,.lap-nav',
      starwing: '.hero-copy > *,.hero-fleet,.hero-foot',
      dusklight: '.twilight-cover-copy > *,.twilight-cover-art,.twilight-cover-foot',
      viper: '.vb-hero-copy > *,.vb-brand-panel,.vb-hero-foot',
      sm64ds: '.ds-window-bar,.ds-hero-content > *,.ds-group,.ds-dual-menu',
    };
    const selector = selectors[document.body.dataset.game];
    return selector
      ? [...document.querySelectorAll(selector)]
          .filter(visible)
          .filter((el, index, all) => !all.some((parent) => parent !== el && parent.contains(el)))
      : [];
  }
  async function enter() {
    root.classList.add('forge-arriving');
    const base = surfaces(),
      accents = details().filter((el) => !base.includes(el));
    const reveal = (el, distance, options) => {
      const resting = getComputedStyle(el).transform;
      return animate(
        el,
        [
          {
            opacity: 0,
            transform: `translateY(${distance}px) ${resting === 'none' ? '' : resting}`,
          },
          { opacity: 1, transform: resting },
        ],
        options,
      );
    };
    const animations = [
      ...base.map((el, index) =>
        reveal(el, 10, {
          duration: 620,
          delay: Math.min(index * 35, 105),
          easing: 'cubic-bezier(.22,1,.36,1)',
          fill: 'both',
        }),
      ),
      ...accents.map((el, index) =>
        reveal(el, 9, {
          duration: 600,
          delay: 60 + Math.min(index * 35, 175),
          easing: 'cubic-bezier(.22,1,.36,1)',
          fill: 'both',
        }),
      ),
    ];
    entryAnimations = animations.filter(Boolean);
    root.classList.remove('forge-entering');
    await settle(animations);
    animations.forEach((a) => a?.cancel());
    entryAnimations = [];
    root.classList.remove('forge-arriving');
    document.dispatchEvent(new Event('forge:page-entered'));
  }
  async function mount(page, request) {
    const saved = snapshots.get(key(request.url));
    const body = document.importNode(saved?.body || page.body, true);
    // The actual system bar survives the swap, including theme and sound state.
    const header = document.querySelector('[data-forge-persistent]');
    if (header) body.querySelector('[data-forge-persistent]').replaceWith(header);
    document.body.replaceWith(body);
    root.classList.remove('welcome-pending', 'welcome-open', 'welcome-opening', 'welcome-leaving');
    page.styles.forEach((node) => {
      if (!node.isConnected) document.head.append(node);
      node.media = '';
    });
    currentPage?.styles
      .filter((node) => !page.styles.includes(node))
      .forEach((node) => {
        node.media = 'not all';
      });
    document.title = page.title;
    let description = document.querySelector('meta[name="description"]');
    if (!description) {
      description = document.createElement('meta');
      description.name = 'description';
      document.head.append(description);
    }
    description.content = page.description;
    document.querySelector('meta[name="forge-controller"]').content = page.moduleURL;
    currentPage = page;
    currentURL = new URL(request.url);
    scope = runtime.createSceneScope(body);
    controller = page.module.mount(scope, saved?.state);
    document.dispatchEvent(new Event('forge:page-mounted'));
    // History movement preserves its scroll; authored return links open their section at the top.
    // A newer in-memory snapshot wins over the original pushState position.
    const position = request.pop ? saved?.scroll || request.scroll || [0, 0] : [0, 0];
    window.scrollTo({ left: position[0], top: position[1], behavior: 'instant' });
    if (
      !request.pop &&
      request.url.hash &&
      !['#collection', '#progress', '#info'].includes(request.url.hash)
    ) {
      document
        .getElementById(decodeURIComponent(request.url.hash.slice(1)))
        ?.scrollIntoView({ behavior: 'instant' });
    }
    // Let decoded fonts settle geometry while the scene is still covered.
    body.getBoundingClientRect();
    await bounded(document.fonts.ready, 1000);
  }
  function errorNotice() {
    let notice = document.getElementById('forge-navigation-status');
    if (!notice) {
      notice = document.createElement('p');
      notice.id = 'forge-navigation-status';
      notice.setAttribute('role', 'status');
      document.body.append(notice);
    }
    notice.textContent = 'This page could not be loaded. Please try the link again.';
  }
  async function navigate() {
    while (requested) {
      const request = requested;
      requested = null;
      if (key(request.url) === key(currentURL)) {
        currentURL = new URL(request.url);
        if (request.pop) restoreFragment(request.url, request.scroll);
        await clearBackdrops();
        root.classList.remove('forge-routing');
        continue;
      }
      let page;
      try {
        page = await preparePage(request.url);
      } catch {
        if (!requested) {
          await clearBackdrops();
          root.classList.remove('forge-routing');
          errorNotice();
        }
        continue;
      }
      if (request.id !== generation) continue;
      document.getElementById('forge-navigation-status')?.remove();
      await request.cover.ready;
      if (request.id !== generation) continue;
      const scroll = saveCurrent();
      if (!request.pop) {
        history.replaceState({ ...history.state, forgeScroll: scroll }, '', currentURL.href);
        history.pushState({ forgeScroll: [0, 0] }, '', request.url.href);
      }
      root.classList.add('forge-entering');
      root.classList.remove('forge-arriving');
      try {
        await mount(page, request);
        await Promise.all([enter(), clearBackdrops()]);
        if (!request.pop) {
          const focus = document.querySelector('main h1') || document.querySelector('main');
          if (focus) {
            if (!focus.hasAttribute('tabindex')) focus.setAttribute('tabindex', '-1');
            focus.focus({ preventScroll: true });
          }
        }
      } finally {
        root.classList.remove('forge-routing', 'forge-entering', 'forge-arriving');
      }
    }
  }
  function requestNavigation(url, options = {}) {
    entryAnimations.forEach((animation) => {
      try {
        animation.finish();
      } catch {}
    });
    requested = { url, ...options, id: ++generation, cover: paintBackdrop(url) };
    preparePage(url).catch(() => {});
    if (!worker)
      worker = ready
        .then(navigate)
        .catch(() => errorNotice())
        .finally(() => {
          worker = null;
          if (requested) requestNavigation(requested.url, requested);
        });
  }
  const ready = new Promise((resolve) => {
    const initialize = async () => {
      runtime = await import('./scene-runtime.js');
      currentPage = describe(document, currentURL);
      currentPage.module = await import(currentPage.moduleURL);
      prepared.set(key(currentURL), Promise.resolve(currentPage));
      scope = runtime.createSceneScope(document.body);
      controller = currentPage.module.mount(scope);
      document.dispatchEvent(new Event('forge:page-mounted'));
      prewarmScenes();
      history.scrollRestoration = 'manual';
      document.body.getBoundingClientRect();
      await bounded(document.fonts.ready, 1000);
      if (!root.matches('.welcome-pending,.welcome-open')) await enter();
      else root.classList.remove('forge-entering');
      if (document.body.dataset.section === 'blog' && currentURL.hash) restoreFragment(currentURL);
      resolve();
    };
    if (document.readyState === 'loading')
      document.addEventListener(
        'DOMContentLoaded',
        () =>
          initialize().catch((error) => {
            console.error(error);
            resolve();
          }),
        { once: true },
      );
    else
      initialize().catch((error) => {
        console.error(error);
        resolve();
      });
  });
  ['pointerover', 'focusin'].forEach((name) =>
    document.addEventListener(name, (event) => {
      const target = destination(event);
      if (target) preparePage(target.url).catch(() => {});
    }),
  );
  document.addEventListener('forge:navigate', (event) => {
    try {
      const url = new URL(event.detail?.url, location.href);
      if (url.origin === location.origin && routes.has(route(url))) requestNavigation(url);
    } catch {
      /* Ignore malformed scene destinations. */
    }
  });
  document.addEventListener('click', (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const target = destination(event);
    if (!target) {
      const link = event.target.closest?.('a[href]');
      if (link && !link.hasAttribute('download') && (!link.target || link.target === '_self')) {
        const url = new URL(link.href, location.href);
        if (key(url) === key(currentURL) && url.hash)
          history.replaceState(
            { ...history.state, forgeScroll: [scrollX, scrollY] },
            '',
            location.href,
          );
      }
      return;
    }
    event.preventDefault();
    requestNavigation(target.url);
  });
  addEventListener('popstate', (event) => {
    const url = new URL(location.href);
    if (key(url) === key(currentURL) && !worker) {
      generation++;
      requested = null;
      currentURL = url;
      restoreFragment(url, event.state?.forgeScroll);
      return;
    }
    requestNavigation(url, { pop: true, scroll: event.state?.forgeScroll });
  });
  function restoreFragment(url, scroll) {
    if (scroll) window.scrollTo({ left: scroll[0], top: scroll[1], behavior: 'instant' });
    else if (url.hash && !['#collection', '#progress', '#info'].includes(url.hash))
      document
        .getElementById(decodeURIComponent(url.hash.slice(1)))
        ?.scrollIntoView({ behavior: 'instant' });
    else window.scrollTo({ top: 0, behavior: 'instant' });
  }
  addEventListener('hashchange', () => {
    const url = new URL(location.href);
    if (key(url) === key(currentURL) && !worker) currentURL = url;
  });
  reduced.addEventListener('change', () => {
    if (reduced.matches) {
      running.forEach((animation) => animation.cancel());
    }
  });
})();
