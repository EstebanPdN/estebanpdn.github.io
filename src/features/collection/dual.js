// Both crops play the same captured clip; the console remains anchored during scene changes.
const consoleMedia = {
  kart: {
    name: 'Mario Kart 64',
    platform: 'NINTENDO 64 → NINTENDO 3DS',
    description: 'One more lap.\nThis time, on two screens.',
    logo: ['logos/mario-kart-64.png', 667, 374, '40 75 610 270'],
    top: [
      'captures/mario-kart-64/06-koopa-troopa-beach.mp4',
      720,
      240,
      '0 0 400 240',
      'captures/mario-kart-64/06-koopa-troopa-beach.webp',
    ],
    bottom: [
      'captures/mario-kart-64/06-koopa-troopa-beach.mp4',
      720,
      240,
      '400 0 320 240',
      'captures/mario-kart-64/06-koopa-troopa-beach.webp',
    ],
  },
  minish: {
    name: 'The Minish Cap',
    platform: 'GAME BOY ADVANCE → NINTENDO 3DS',
    description: 'A little adventure.\nA whole world to discover.',
    logo: ['logos/the-minish-cap.png', 844, 439, '0 0 844 439'],
    top: [
      'captures/the-minish-cap/04-minish-woods.mp4',
      720,
      240,
      '0 0 400 240',
      'captures/the-minish-cap/04-minish-woods.webp',
    ],
    bottom: [
      'captures/the-minish-cap/04-minish-woods.mp4',
      720,
      240,
      '400 0 320 240',
      'captures/the-minish-cap/04-minish-woods.webp',
    ],
  },
  alttp: {
    name: 'A Link to the Past',
    platform: 'SUPER NINTENDO → NINTENDO 3DS',
    description: 'Two worlds.\nAn adventure worth revisiting.',
    logo: ['logos/a-link-to-the-past.png', 1200, 1066, '0 0 1200 1066'],
    top: [
      'captures/a-link-to-the-past/12-village-outcasts.mp4',
      720,
      240,
      '0 0 400 240',
      'captures/a-link-to-the-past/12-village-outcasts.webp',
    ],
    bottom: [
      'captures/a-link-to-the-past/12-village-outcasts.mp4',
      720,
      240,
      '400 0 320 240',
      'captures/a-link-to-the-past/12-village-outcasts.webp',
    ],
  },
  starwing: {
    name: 'Starwing 3DS',
    platform: 'SUPER NINTENDO → NINTENDO 3DS',
    description: 'Set course for Lylat.\nYour next mission fits in your pocket.',
    logo: ['logos/starwing.png', 256, 128, '0 0 256 128'],
    top: [
      'captures/star-fox/07-corneria-city.mp4',
      720,
      240,
      '0 0 400 240',
      'captures/star-fox/07-corneria-city.webp',
    ],
    bottom: [
      'captures/star-fox/07-corneria-city.mp4',
      720,
      240,
      '400 0 320 240',
      'captures/star-fox/07-corneria-city.webp',
    ],
  },
  doom: {
    name: 'Legend of Doom',
    platform: 'ZELDA × DOOM → NINTENDO 3DS',
    description: 'Hyrule, from another angle.\nTwo classics come together.',
    logo: ['logos/legend-of-doom.png', 2560, 1280, '0 0 2560 1280'],
    top: [
      'captures/legend-of-doom/05-forest-enemy.mp4',
      720,
      240,
      '0 0 400 240',
      'captures/legend-of-doom/05-forest-enemy.webp',
    ],
    bottom: [
      'captures/legend-of-doom/05-forest-enemy.mp4',
      720,
      240,
      '400 0 320 240',
      'captures/legend-of-doom/05-forest-enemy.webp',
    ],
  },
};
const dual = document.getElementById('dual');
const projectButtons = [...dual.querySelectorAll('[data-console]')];
const railButtons = projectButtons.filter((button) => button.classList.contains('rail-project'));
const gameKeys = ['alttp', 'minish', 'kart', 'doom', 'starwing'];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const phoneLayout = window.matchMedia('(max-width: 900px)');
const initialPage = ['#progress', '#info'].includes(location.hash)
  ? location.hash.slice(1)
  : 'collection';
const hasPageDestination = ['#collection', '#progress', '#info'].includes(location.hash);
let welcomeActive =
  !hasPageDestination && document.documentElement.classList.contains('welcome-pending');
if (hasPageDestination) document.documentElement.classList.remove('welcome-pending');
// Visible source bounds remove transparent margins without changing the original artwork.
const mobileLogoBounds = {
  kart: '59 86 568 232',
  minish: '4 15 816 417',
  alttp: '0 0 1200 1066',
  starwing: '0 22 254 82',
  doom: '518 125 1310 1005',
};
let currentGame = 'kart';
let requestedGame = currentGame,
  requestedAnimation = true,
  consoleWorker = null,
  wakeSelection = null;
// Backdrop images own their drift independently of the scene opacity clock.
const backdropLayers = [...dual.querySelectorAll('[data-backdrop]')];
function showBackdrop(key) {
  backdropLayers.forEach((layer) => {
    const active = layer.dataset.backdrop === key;
    layer.classList.toggle('is-active', active);
    layer.classList.toggle('is-drifting', active);
  });
}
function projectFiles(key) {
  const project = consoleMedia[key];
  const backdrop = backdropLayers.find((layer) => layer.dataset.backdrop === key);
  const artwork = backdrop
    ?.querySelector('image')
    ?.getAttribute('href')
    ?.replace(/^assets\//, '');
  return [
    ...new Set(
      [
        project.top[4] || project.top[0],
        project.bottom[4] || project.bottom[0],
        project.logo[0],
        artwork,
      ].filter(Boolean),
    ),
  ];
}
const runningMotion = new Set();
const motion = { quick: 240, screenReveal: 560, reveal: 850, ease: 'cubic-bezier(.22,1,.36,1)' };
function playMotion(element, frames, options = {}) {
  if (reduceMotion.matches || !element?.animate) return;
  const animation = element.animate(frames, {
    duration: motion.reveal,
    easing: motion.ease,
    ...options,
  });
  runningMotion.add(animation);
  animation.finished
    .then(() => runningMotion.delete(animation))
    .catch(() => runningMotion.delete(animation));
  return animation;
}
function setScreen(surface, data, label) {
  const [file, width, height, viewBox, poster] = data;
  const isScreen = surface.classList.contains('console-screen-surface');
  const svg = isScreen ? surface.querySelector('svg') : surface,
    image = svg.querySelector('image');
  svg.setAttribute('viewBox', viewBox);
  if (label) surface.setAttribute('aria-label', label);
  image.setAttribute('href', 'assets/' + (poster || file));
  image.setAttribute('width', width);
  image.setAttribute('height', height);
  if (!poster || !isScreen) return;
  surface.querySelectorAll('video').forEach((video) => {
    video.pause();
    video.remove();
  });
  if (reduceMotion.matches || window.navigator?.connection?.saveData) return;
  // Native HTML video with an already cropped frame avoids Safari's SVG foreignObject compositor.
  const side = viewBox.startsWith('0 ') ? 'top' : 'bottom';
  const video = document.createElement('video');
  video.src = 'assets/' + file.replace(/\.mp4$/, `-${side}.mp4`);
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('loop', '');
  video.setAttribute('aria-hidden', 'true');
  video.style.opacity = '0';
  video.addEventListener(
    'loadeddata',
    () => {
      video.style.opacity = '1';
    },
    { once: true },
  );
  video.addEventListener('error', () => video.remove(), { once: true });
  surface.append(video);
}
function syncVideoPair(surfaces, enabled) {
  const videos = surfaces.map((surface) => surface?.querySelectorAll?.('video')?.[0]);
  if (videos.length !== 2 || videos.some((video) => !video)) return;
  videos.forEach((video) => {
    video.dataset.canPlay = String(enabled);
    if (!enabled) video.pause();
  });
  if (!videos[0].dataset.pairBound) {
    videos[0].dataset.pairBound = 'true';
    videos.forEach((video) =>
      video.addEventListener('loadeddata', () =>
        syncVideoPair(
          surfaces,
          videos.every((v) => v.dataset.canPlay === 'true'),
        ),
      ),
    );
    videos[0].addEventListener('timeupdate', () => {
      if (
        videos.every((v) => v.isConnected && !v.paused) &&
        Math.abs(videos[0].currentTime - videos[1].currentTime) > 0.12
      )
        videos[1].currentTime = videos[0].currentTime;
    });
  }
  if (!enabled || videos.some((video) => video.readyState < 2 || !video.isConnected)) return;
  if (!videos[0].dataset.pairStarted) {
    videos.forEach((video) => {
      video.currentTime = 0;
    });
    videos[0].dataset.pairStarted = 'true';
  }
  videos.forEach((video) => {
    if (video.paused) video.play().catch(() => {});
  });
}
function consoleVideoAllowed() {
  const hero = document.getElementById('dual-feature'),
    panel = document.getElementById('dual-collection');
  const bounds = hero?.getBoundingClientRect();
  return (
    !document.hidden &&
    !welcomeActive &&
    !reduceMotion.matches &&
    !panel.hidden &&
    bounds?.bottom > 0 &&
    bounds?.top < innerHeight
  );
}
function syncConsolePlayback() {
  const allowed = consoleVideoAllowed();
  if (!allowed)
    dual.querySelectorAll('video').forEach((video) => {
      video.dataset.canPlay = 'false';
      video.pause();
    });
  syncVideoPair(
    ['top', 'bottom'].map((side) => document.getElementById('dual-' + side)),
    allowed,
  );
}
function replaceScreen(id, data, label) {
  const previous = document.getElementById(id),
    next = previous.cloneNode(true);
  setScreen(next, data, label);
  previous.querySelectorAll?.('video').forEach((video) => video.pause());
  previous.replaceWith(next);
}
function revealSelectedTitle() {
  if (!phoneLayout.matches) return;
  const strip = dual.querySelector('.dual-rail'),
    card = strip.querySelector('.selected');
  if (!card) return;
  const stripBounds = strip.getBoundingClientRect(),
    cardBounds = card.getBoundingClientRect();
  const left = cardBounds.left - stripBounds.left,
    right = cardBounds.right - stripBounds.left;
  if (left < 4 || right > strip.clientWidth - 4) {
    const delta = left < 4 ? left - 4 : right - strip.clientWidth + 4;
    strip.scrollTo({
      left: strip.scrollLeft + delta,
      behavior: reduceMotion.matches ? 'instant' : 'smooth',
    });
  }
}
function selectRailProject(key) {
  railButtons.forEach((button) => {
    const active = button.dataset.console === key;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', active);
  });
  revealSelectedTitle();
}
function applyConsoleProject(key, { animate = true, screens = null } = {}) {
  const project = consoleMedia[key];
  if (!project) return;
  currentGame = key;
  dual.dataset.game = key;
  dual
    .querySelectorAll('[data-ambient]')
    .forEach((layer) => layer.classList.toggle('is-active', layer.dataset.ambient === key));
  showBackdrop(key);
  selectRailProject(key);
  ['top', 'bottom'].forEach((side, index) => {
    const label = project.name + ': ' + (side === 'top' ? 'top screen' : 'bottom screen');
    if (!screens) {
      replaceScreen('dual-' + side, project[side], label);
      return;
    }
    const previous = document.getElementById('dual-' + side),
      next = screens[index];
    previous.querySelectorAll?.('video').forEach((video) => video.pause());
    next.id = 'dual-' + side;
    next.setAttribute('aria-label', label);
    next.removeAttribute('aria-hidden');
    next.classList.remove('screen-incoming');
    previous.replaceWith(next);
  });
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(syncConsolePlayback);
  const featureLogo = document.getElementById('feature-logo');
  featureLogo.src = 'assets/' + project.logo[0];
  featureLogo.alt = project.name;
  featureLogo.parentElement.dataset.game = key;
  replaceScreen(
    'feature-mobile-logo',
    [...project.logo.slice(0, 3), mobileLogoBounds[key]],
    project.name,
  );
  dual.querySelectorAll('.selected-name').forEach((el) => (el.textContent = project.name));
  document.getElementById('feature-index').textContent = String(gameKeys.indexOf(key) + 1).padStart(
    2,
    '0',
  );
  document.getElementById('feature-platform').textContent = project.platform;
  document
    .getElementById('feature-description')
    .replaceChildren(
      ...project.description
        .split('\n')
        .flatMap((line, i) =>
          i
            ? [document.createElement('br'), document.createTextNode(line)]
            : [document.createTextNode(line)],
        ),
    );
  document.getElementById('feature-short').textContent = project.name;
  revealSelectedTitle();
}
const imageReady = new Map();
function readyImage(file) {
  if (imageReady.has(file)) return imageReady.get(file).promise;
  const image = new Image();
  const promise = new Promise((resolve, reject) => {
    image.onload = () => {
      if (image.decode) image.decode().then(resolve, reject);
      else resolve();
    };
    image.onerror = () => reject(new Error('Could not load ' + file));
    image.src = 'assets/' + file;
  });
  imageReady.set(file, { image, promise });
  // Prefetch failures remain retryable and cannot become unhandled rejections.
  promise.catch(() => {
    if (imageReady.get(file)?.promise === promise) imageReady.delete(file);
  });
  return promise;
}
function readyProject(key) {
  return Promise.all(projectFiles(key).map(readyImage));
}
async function waitForProject(key) {
  let wake;
  const superseded = new Promise((resolve) => {
    wake = () => resolve(false);
    wakeSelection = wake;
  });
  try {
    return await Promise.race([readyProject(key).then(() => true), superseded]);
  } finally {
    if (wakeSelection === wake) wakeSelection = null;
  }
}
function prepareScreenFade(key) {
  return ['top', 'bottom'].map((side) => {
    const previous = document.getElementById('dual-' + side),
      next = previous.cloneNode(true);
    next.removeAttribute('id');
    next.removeAttribute('aria-label');
    next.setAttribute('aria-hidden', 'true');
    next.classList.add('screen-incoming');
    setScreen(next, consoleMedia[key][side]);
    previous.parentElement.append(next);
    return next;
  });
}
function prepareLogoFade(key) {
  const previous = document.getElementById('feature-logo').parentElement;
  const next = previous.cloneNode(true);
  next.dataset.game = key;
  next.classList.add('logo-incoming');
  next.setAttribute('aria-hidden', 'true');
  next.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
  const image = next.querySelector('img');
  image.src = 'assets/' + consoleMedia[key].logo[0];
  image.alt = '';
  setScreen(next.querySelector('svg'), [
    ...consoleMedia[key].logo.slice(0, 3),
    mobileLogoBounds[key],
  ]);
  previous.parentElement.append(next);
  return { previous, next };
}
function selectedCopy(key) {
  const project = consoleMedia[key];
  return {
    'feature-index': String(gameKeys.indexOf(key) + 1).padStart(2, '0'),
    'feature-platform': project.platform,
    'feature-description': project.description,
    'feature-short': project.name,
  };
}
function copyNodes(text) {
  return text
    .split('\n')
    .flatMap((line, index) =>
      index
        ? [document.createElement('br'), document.createTextNode(line)]
        : [document.createTextNode(line)],
    );
}
function prepareCopyFade(key) {
  return Object.entries(selectedCopy(key)).map(([id, text]) => {
    const stage = document.getElementById(id);
    const previous = document.createElement('span'),
      next = document.createElement('span');
    previous.className = 'scene-copy-current';
    next.className = 'scene-copy-incoming';
    previous.append(...stage.childNodes);
    next.append(...copyNodes(text));
    next.setAttribute('aria-hidden', 'true');
    stage.append(previous, next);
    stage.classList.add('scene-copy-stage');
    return { previous, next, stage };
  });
}
function prepareSceneFade(key) {
  const incoming = prepareScreenFade(key),
    logo = prepareLogoFade(key),
    copy = prepareCopyFade(key);
  const fades = [
    ...incoming.map((element) => ({ element, from: 0, to: 1 })),
    { element: logo.next, from: 0, to: 1 },
    { element: logo.previous, from: 1, to: 0 },
    ...copy.flatMap((pair) => [
      { element: pair.next, from: 0, to: 1 },
      { element: pair.previous, from: 1, to: 0 },
    ]),
  ];
  const opacity =
    Number.parseFloat(getComputedStyle(dual).getPropertyValue('--backdrop-opacity')) || 0.3;
  backdropLayers.forEach((layer) => {
    if (layer.dataset.backdrop === key) {
      layer.classList.add('is-drifting');
      fades.push({ element: layer, from: 0, to: opacity });
    } else if (layer.dataset.backdrop === currentGame)
      fades.push({ element: layer, from: opacity, to: 0 });
  });
  return {
    fades,
    incoming,
    cleanup() {
      incoming.forEach((element) => {
        if (!element.id) {
          element.querySelectorAll?.('video').forEach((video) => video.pause());
          element.remove();
        }
      });
      logo.next.remove();
      // Successful commits replace the text. Restore it too if animation setup failed.
      copy.forEach(({ previous, next, stage }) => {
        if (previous.parentElement === stage) stage.replaceChildren(...previous.childNodes);
        next.remove();
        stage.classList.remove('scene-copy-stage');
      });
    },
  };
}
async function runConsoleTransitions() {
  while (currentGame !== requestedGame) {
    const key = requestedGame;
    let scene;
    const animations = [];
    try {
      if (!(await waitForProject(key)) || key !== requestedGame) continue;
      const animate = requestedAnimation && !welcomeActive;
      if (animate && !reduceMotion.matches) {
        scene = prepareSceneFade(key);
        syncVideoPair(scene.incoming, typeof innerHeight !== 'undefined' && consoleVideoAllowed());
        // Begin the rail highlight with the scene, after incoming assets are ready.
        selectRailProject(key);
        const timing = { duration: motion.screenReveal, easing: 'ease-in-out', fill: 'forwards' };
        for (const { element, from, to } of scene.fades)
          animations.push(playMotion(element, [{ opacity: from }, { opacity: to }], timing));
        // Every changing part starts and settles on this single document timeline.
        const start = document.timeline.currentTime;
        animations.filter(Boolean).forEach((animation) => {
          animation.startTime = start;
        });
        await settle(animations);
      }
      // Complete the active scene atomically, then service only the latest queued choice.
      applyConsoleProject(key, { animate: false, screens: scene?.incoming });
    } catch {
      if (key === requestedGame) {
        requestedGame = currentGame;
        document.getElementById('announcement').textContent =
          'Could not load ' + consoleMedia[key].name + '. Please try again.';
      }
    } finally {
      scene?.cleanup();
      animations.forEach((animation) => animation?.cancel());
      showBackdrop(currentGame);
      selectRailProject(currentGame);
    }
  }
}
function showConsoleProject(key, { animate = true } = {}) {
  if (!consoleMedia[key]) return;
  const changedRequest = requestedGame !== key;
  requestedGame = key;
  requestedAnimation = animate;
  if (changedRequest) wakeSelection?.();
  if (!animate && !consoleWorker) {
    applyConsoleProject(key, { animate: false });
    return;
  }
  if (!consoleWorker && currentGame !== requestedGame)
    consoleWorker = runConsoleTransitions().finally(() => {
      consoleWorker = null;
      if (currentGame !== requestedGame)
        showConsoleProject(requestedGame, { animate: requestedAnimation });
    });
  return consoleWorker;
}
projectButtons.forEach((button) => {
  button.addEventListener('click', () => {
    showConsoleProject(button.dataset.console);
    holdCarousel();
    if (button.classList.contains('game-channel')) {
      const hero = document.getElementById('dual-feature');
      if (hero.getBoundingClientRect().top < -150)
        hero.scrollIntoView({
          behavior: reduceMotion.matches ? 'instant' : 'smooth',
          block: 'start',
        });
    }
  });
  button.addEventListener('keydown', (event) => {
    const dir = ['ArrowDown', 'ArrowRight'].includes(event.key)
      ? 1
      : ['ArrowUp', 'ArrowLeft'].includes(event.key)
        ? -1
        : 0;
    if (!dir) return;
    event.preventDefault();
    const list = [...button.parentElement.querySelectorAll('[data-console]')],
      index = list.indexOf(button),
      next = list[(index + dir + list.length) % list.length];
    next.focus();
    next.click();
  });
});
function stepGame(direction) {
  const key =
    gameKeys[(gameKeys.indexOf(requestedGame) + direction + gameKeys.length) % gameKeys.length];
  dual.querySelector('.rail-project[data-console="' + key + '"]').click();
}
document.getElementById('previous-game').addEventListener('click', () => stepGame(-1));
document.getElementById('next-game').addEventListener('click', () => stepGame(1));
// Horizontal swipes select a project; vertical gestures remain native page scrolling.
const swipeSurface = dual.querySelector('.console-showcase');
let swipeStart = null;
swipeSurface.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.pointerType === 'mouse') return;
  swipeStart = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp };
  swipeSurface.setPointerCapture(event.pointerId);
});
swipeSurface.addEventListener('pointercancel', () => {
  swipeStart = null;
});
swipeSurface.addEventListener('pointerup', (event) => {
  const start = swipeStart;
  swipeStart = null;
  if (!start || start.id !== event.pointerId) return;
  const dx = event.clientX - start.x,
    dy = event.clientY - start.y;
  if (
    Math.abs(dx) >= 40 &&
    Math.abs(dx) > Math.abs(dy) * 1.5 &&
    event.timeStamp - start.time < 1200
  )
    stepGame(dx < 0 ? 1 : -1);
});

document.querySelector('.collection-link').addEventListener('click', (event) => {
  event.preventDefault();
  document
    .getElementById('dual-library')
    .scrollIntoView({ behavior: reduceMotion.matches ? 'instant' : 'smooth', block: 'start' });
});
const mediaFiles = new Set(Object.keys(consoleMedia).flatMap(projectFiles));
mediaFiles.forEach(readyImage);
showConsoleProject('kart', { animate: false });

// Exit first, then enter. A single worker coalesces repeated clicks to the latest destination.
const pageStage = document.getElementById('dual-pages');
let visiblePage = 'collection',
  requestedPage = 'collection',
  pageWorker = null;
function pageParts(panel) {
  return [
    ...panel.querySelectorAll(
      panel.id === 'dual-collection'
        ? phoneLayout.matches
          ? '.feature-platform,.feature-copy,.console-showcase,.collection-link,.feature-controls,.dual-rail,.library-heading-row,.game-channel'
          : '.console-showcase,.feature-story,.dual-rail,.library-heading-row,.game-channel'
        : panel.id === 'dual-info'
          ? '.info-heading,.info-card,.info-foot'
          : '.progress-heading,.progress-filters,.progress-context,[data-progress-completed] > summary,.progress-group-heading,.community-toolbar,.progress-grid .progress-card,.progress-note,.community-explainer,.community-sources',
    ),
  ].filter((part) => {
    const bounds = part.getBoundingClientRect();
    return bounds.width && bounds.height;
  });
}
async function settle(animations) {
  await Promise.allSettled(animations.filter(Boolean).map((animation) => animation.finished));
}
function enterParts(parts) {
  return parts.map((part, index) =>
    playMotion(
      part,
      [
        { opacity: 0, transform: 'translateY(20px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 680, delay: Math.min(index * 38, 190), fill: 'backwards' },
    ),
  );
}
async function runPageTransitions() {
  pageStage.dataset.transitioning = 'true';
  try {
    while (visiblePage !== requestedPage) {
      const old = document.getElementById('dual-' + visiblePage);
      const oldHeight = pageStage.getBoundingClientRect().height;
      const parts = pageParts(old);
      old.inert = true;
      const backdropExit =
        visiblePage === 'collection'
          ? playMotion(rootBackdrop, [{ opacity: 1 }, { opacity: 0 }], {
              duration: 302,
              easing: 'ease-in-out',
              fill: 'forwards',
            })
          : null;
      const outgoing = parts.map((part, index) =>
        playMotion(
          part,
          [
            { opacity: 1, transform: 'translateY(0)' },
            { opacity: 0, transform: 'translateY(-12px)' },
          ],
          {
            duration: 230,
            delay: Math.min(index * 18, 72),
            easing: 'cubic-bezier(.4,0,1,1)',
            fill: 'forwards',
          },
        ),
      );
      await settle([...outgoing, backdropExit]);
      // The user may have returned to the same destination while the outgoing scene was fading.
      if (visiblePage === requestedPage) {
        outgoing.forEach((animation) => animation?.cancel());
        backdropExit?.cancel();
        old.inert = false;
        break;
      }
      if (backdropExit) {
        rootBackdrop.style.opacity = '0';
        backdropExit.cancel();
      }
      pageStage.style.height = oldHeight + 'px';
      old.hidden = true;
      old.inert = false;
      outgoing.forEach((animation) => animation?.cancel());
      visiblePage = requestedPage;
      const next = document.getElementById('dual-' + visiblePage);
      next.hidden = false;
      syncConsolePlayback();
      const nextHeight = next.getBoundingClientRect().height;
      const backdropEnter =
        visiblePage === 'collection'
          ? playMotion(rootBackdrop, [{ opacity: 0 }, { opacity: 1 }], {
              duration: 680,
              easing: 'ease-in-out',
              fill: 'forwards',
            })
          : null;
      if (visiblePage === 'collection') syncBackdropGeometry();
      const resize = playMotion(
        pageStage,
        [{ height: oldHeight + 'px' }, { height: nextHeight + 'px' }],
        { duration: 680, fill: 'forwards' },
      );
      await settle([...enterParts(pageParts(next)), resize, backdropEnter]);
      if (visiblePage === 'collection') rootBackdrop.style.opacity = '1';
      backdropEnter?.cancel();
      resize?.cancel();
      pageStage.style.height = '';
    }
  } finally {
    pageStage.style.height = '';
    delete pageStage.dataset.transitioning;
  }
}
function setDualPage(page) {
  if (!['collection', 'progress', 'info'].includes(page)) return;
  requestedPage = page;
  document
    .querySelectorAll('[data-dual-page]')
    .forEach((button) => button.setAttribute('aria-pressed', button.dataset.dualPage === page));
  if (!pageWorker)
    pageWorker = runPageTransitions().finally(() => {
      pageWorker = null;
      if (visiblePage !== requestedPage) setDualPage(requestedPage);
    });
  return pageWorker;
}
document.querySelectorAll('[data-dual-page]').forEach((button) =>
  button.addEventListener('click', () => {
    history.replaceState(null, '', '#' + button.dataset.dualPage);
    setDualPage(button.dataset.dualPage);
    chime();
  }),
);
window.addEventListener('hashchange', () => {
  if (['#collection', '#progress', '#info'].includes(location.hash))
    setDualPage(location.hash.slice(1));
});
let visibleFilter = 'ports',
  requestedFilter = 'ports',
  filterWorker = null;
function filterParts(panel) {
  return [
    ...panel.querySelectorAll(
      '[data-progress-completed] > summary,.progress-group-heading,.community-toolbar,.progress-card,.community-explainer,.community-sources',
    ),
  ].filter((part) => {
    const bounds = part.getBoundingClientRect();
    return bounds.width && bounds.height;
  });
}
async function runFilterTransitions() {
  const stage = document.getElementById('progress-results');
  stage.dataset.transitioning = 'true';
  try {
    while (visibleFilter !== requestedFilter) {
      const context = document.getElementById('progress-context');
      const old = document.getElementById('progress-' + visibleFilter),
        oldHeight = stage.getBoundingClientRect().height;
      old.inert = true;
      const exits = [context, ...filterParts(old)].map((part, index) =>
        playMotion(
          part,
          [
            { opacity: 1, transform: 'translateY(0)' },
            { opacity: 0, transform: 'translateY(-12px)' },
          ],
          {
            duration: 230,
            delay: Math.min(index * 18, 72),
            easing: 'cubic-bezier(.4,0,1,1)',
            fill: 'forwards',
          },
        ),
      );
      await settle(exits);
      if (visibleFilter === requestedFilter) {
        exits.forEach((a) => a?.cancel());
        old.inert = false;
        break;
      }
      stage.style.height = oldHeight + 'px';
      old.hidden = true;
      old.inert = false;
      exits.forEach((a) => a?.cancel());
      visibleFilter = requestedFilter;
      const next = document.getElementById('progress-' + visibleFilter);
      next.hidden = false;
      context.textContent =
        visibleFilter === 'community'
          ? 'Live progress from the teams behind the games, with links to their code and PC projects.'
          : 'My work adapting games to Nintendo 3DS.';
      stage.style.height = 'auto';
      const height = stage.getBoundingClientRect().height;
      stage.style.height = oldHeight + 'px';
      const resize = playMotion(stage, [{ height: oldHeight + 'px' }, { height: height + 'px' }], {
        duration: 680,
        fill: 'forwards',
      });
      await settle([...enterParts([context, ...filterParts(next)]), resize]);
      resize?.cancel();
      stage.style.height = '';
    }
  } finally {
    stage.style.height = '';
    delete stage.dataset.transitioning;
  }
}
function setProgressFilter(filter) {
  requestedFilter = filter;
  dual
    .querySelectorAll('[data-progress-filter]')
    .forEach((button) =>
      button.setAttribute('aria-pressed', button.dataset.progressFilter === filter),
    );
  if (!filterWorker)
    filterWorker = runFilterTransitions().finally(() => {
      filterWorker = null;
      if (visibleFilter !== requestedFilter) setProgressFilter(requestedFilter);
    });
  return filterWorker;
}
dual.querySelectorAll('[data-progress-filter]').forEach((button) =>
  button.addEventListener('click', () => {
    setProgressFilter(button.dataset.progressFilter);
    chime();
  }),
);
dual.addEventListener('click', (event) => {
  const summary = event.target.closest('[data-progress-completed] > summary');
  if (!summary || !window.ForgeMotion?.toggleDisclosure) return;
  event.preventDefault();
  const details = summary.parentElement;
  const open =
    details.dataset.forgeDisclosureOpen === undefined
      ? details.open
      : details.dataset.forgeDisclosureOpen === 'true';
  window.ForgeMotion.toggleDisclosure(details, !open);
});
// Prepare unseen cards before scrolling so the first frame cannot blink.
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .forEach((entry, index) => {
          revealObserver.unobserve(entry.target);
          const finish = () => entry.target.classList.remove('reveal-pending');
          if (
            welcomeActive ||
            document.documentElement.matches('.forge-entering,.forge-arriving') ||
            pageStage.dataset.transitioning === 'true'
          ) {
            finish();
            return;
          }
          const animation = playMotion(
            entry.target,
            [
              { opacity: 0, transform: 'translateY(16px)' },
              { opacity: 1, transform: 'none' },
            ],
            { duration: 680, delay: Math.min(index * 45, 180), fill: 'backwards' },
          );
          if (animation) {
            animation.onfinish = finish;
            animation.oncancel = finish;
          } else finish();
        });
    },
    { threshold: 0, rootMargin: '0px 0px -20px 0px' },
  );
  dual.querySelectorAll('.library-heading-row,.game-channel').forEach((el) => {
    if (el.getBoundingClientRect().top >= innerHeight && !reduceMotion.matches)
      el.classList.add('reveal-pending');
    revealObserver.observe(el);
  });
  reduceMotion.addEventListener('change', () => {
    if (reduceMotion.matches) {
      revealObserver.disconnect();
      dual
        .querySelectorAll('.reveal-pending')
        .forEach((el) => el.classList.remove('reveal-pending'));
    }
  });
}
phoneLayout.addEventListener?.('change', revealSelectedTitle);
// Keep hardware anchored; only the media surfaces and surrounding content transition.
reduceMotion.addEventListener?.('change', () => {
  if (reduceMotion.matches) runningMotion.forEach((animation) => animation.cancel());
});

// One timer owns the manual hold and the regular six-second cadence.
const carouselInterval = 6000,
  carouselManualHold = 25000;
let carouselTimer = null,
  carouselHoldUntil = 0;
function scheduleCarousel(delay = carouselInterval) {
  clearTimeout(carouselTimer);
  carouselTimer = null;
  if (document.hidden || welcomeActive || reduceMotion.matches) return;
  const holdRemaining = Math.max(0, carouselHoldUntil - Date.now());
  carouselTimer = setTimeout(() => {
    carouselTimer = null;
    carouselHoldUntil = 0;
    if (requestedPage === 'collection')
      showConsoleProject(gameKeys[(gameKeys.indexOf(requestedGame) + 1) % gameKeys.length]);
    scheduleCarousel();
  }, holdRemaining || delay);
}
function holdCarousel() {
  carouselHoldUntil = Date.now() + carouselManualHold;
  scheduleCarousel();
}
reduceMotion.addEventListener('change', () => {
  scheduleCarousel();
  syncConsolePlayback();
});
document.addEventListener('visibilitychange', () => {
  scheduleCarousel();
  syncConsolePlayback();
});

// Real viewport visibility cancels a hold when the complete carousel leaves view.
// Focus and pointer position never extend or clear a user's twenty-second hold.
const rootBackdrop = dual.querySelector('.hero-backdrop');
const backdropHero = document.getElementById('dual-feature');
if ('IntersectionObserver' in window) {
  let heroWasVisible = false;
  const carouselVisibility = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const visible = entry.isIntersecting && entry.intersectionRatio > 0;
        if (heroWasVisible && !visible && carouselHoldUntil) {
          carouselHoldUntil = 0;
          scheduleCarousel();
        }
        heroWasVisible = visible;
        syncConsolePlayback();
      }
    },
    { threshold: 0 },
  );
  carouselVisibility.observe(backdropHero);
}
scheduleCarousel();
const backdropHeader = document.querySelector('.site-header');
function syncBackdropGeometry() {
  // Scroll and sticky-header positions never change the artwork's layout size.
  if (backdropHero.offsetHeight === 0) return;
  const height = backdropHero.offsetHeight + 24;
  if (height < 100) return;
  dual.style.setProperty('--backdrop-top', backdropHero.offsetTop + 'px');
  dual.style.setProperty('--backdrop-height', height + 'px');
}
const backdropGeometryObserver = new ResizeObserver(syncBackdropGeometry);
backdropGeometryObserver.observe(backdropHero);
backdropGeometryObserver.observe(backdropHeader);
syncBackdropGeometry();

// Only the mounted homepage brand replays the welcome entrance.
// The shared anchor returns other game scenes directly to Collection.
const welcomeScreen = document.getElementById('welcome-screen');
const welcomePanel = welcomeScreen.querySelector('.welcome-panel');
const welcomeEnter = document.getElementById('welcome-enter');
const welcomeHome = document.querySelector('.site-header .brand');
const siteMain = dual.closest('main');
let enteringSite = false;
async function openWelcome() {
  if (enteringSite || !welcomeScreen.hidden) return;
  const firstVisit = document.documentElement.classList.contains('welcome-pending');
  welcomeActive = true;
  clearTimeout(carouselTimer);
  syncConsolePlayback();
  runningMotion.forEach((animation) => animation.cancel());
  welcomeScreen.hidden = false;
  window.ForgeUI?.beginWelcomeSound();
  welcomeEnter.disabled = true;
  siteMain.inert = true;
  // Keep the outgoing page behind the arriving background until it is opaque.
  document.documentElement.classList.add(firstVisit ? 'welcome-open' : 'welcome-opening');
  document.documentElement.classList.remove('welcome-pending');
  history.replaceState(null, '', location.pathname + location.search);
  const cover = firstVisit
    ? null
    : playMotion(welcomeScreen, [{ opacity: 0 }, { opacity: 1 }], {
        duration: 440,
        easing: 'ease-in-out',
        fill: 'both',
      });
  try {
    await settle([cover]);
    document.documentElement.classList.add('welcome-open');
    document.documentElement.classList.remove('welcome-opening');
    window.scrollTo({ top: 0, behavior: 'instant' });
    await setDualPage('collection');
  } finally {
    cover?.cancel();
    document.documentElement.classList.remove('welcome-opening');
    welcomeEnter.disabled = false;
    welcomeEnter.focus({ preventScroll: true });
  }
}
function welcomeEntranceParts() {
  const headerParts = [
    ...document.querySelectorAll(
      '.site-header .brand-home,.site-header .dual-navigation,.site-header .system-clock',
    ),
  ];
  const sceneParts = phoneLayout.matches
    ? [
        ...dual.querySelectorAll(
          '.feature-platform,.feature-copy,.console-showcase,.collection-link,.feature-controls',
        ),
      ]
    : [dual.querySelector('.console-showcase'), dual.querySelector('.feature-story')];
  const railParts = [...dual.querySelectorAll('.rail-project')];
  return [...headerParts, ...sceneParts, ...railParts].filter((part) => {
    const bounds = part.getBoundingClientRect();
    return bounds.width && bounds.height && bounds.top < window.innerHeight && bounds.bottom > 0;
  });
}
async function enterSite() {
  if (enteringSite || welcomeScreen.hidden) return;
  enteringSite = true;
  window.ForgeUI?.playEntrySound();
  welcomeEnter.disabled = true;
  try {
    localStorage.setItem('forge-welcome-seen-v1', '1');
  } catch {}
  try {
    await settle([
      playMotion(
        welcomePanel,
        [
          { opacity: 1, transform: 'none' },
          { opacity: 0, transform: 'translateY(-14px) scale(.98)' },
        ],
        { duration: 300, fill: 'forwards' },
      ),
    ]);
    document.documentElement.classList.remove('welcome-open', 'welcome-pending');
    document.documentElement.classList.add('welcome-leaving');
    const parts = welcomeEntranceParts();
    const reveal = parts.map((part, index) =>
      playMotion(
        part,
        [
          { opacity: 0, transform: 'translateY(18px) scale(.96)', offset: 0 },
          { opacity: 1, transform: 'translateY(-1px) scale(1.008)', offset: 0.76 },
          { opacity: 1, transform: 'none', offset: 1 },
        ],
        { duration: 820, delay: 80 + index * 45, fill: 'backwards' },
      ),
    );
    const curtain = playMotion(welcomeScreen, [{ opacity: 1 }, { opacity: 0 }], {
      duration: 400,
      fill: 'forwards',
    });
    await settle([curtain, ...reveal]);
  } finally {
    welcomeScreen.hidden = true;
    welcomeScreen.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
    document.documentElement.classList.remove('welcome-open', 'welcome-pending', 'welcome-leaving');
    siteMain.inert = false;
    welcomeEnter.disabled = false;
    enteringSite = false;
    welcomeActive = false;
    syncConsolePlayback();
    carouselHoldUntil = 0;
    document
      .querySelector('.site-header [data-dual-page="collection"]')
      ?.focus({ preventScroll: true });
    scheduleCarousel();
  }
}
welcomeEnter.addEventListener('click', enterSite);
welcomeHome.addEventListener('click', (event) => {
  if (
    event.defaultPrevented ||
    event.button > 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  openWelcome();
});
welcomeScreen.addEventListener('keydown', (event) => {
  if (event.key === 'Tab') {
    event.preventDefault();
    welcomeEnter.focus({ preventScroll: true });
  }
});
if (initialPage !== 'collection') {
  visiblePage = requestedPage = initialPage;
  document.getElementById('dual-collection').hidden = true;
  document.getElementById('dual-progress').hidden = initialPage !== 'progress';
  document.getElementById('dual-info').hidden = initialPage !== 'info';
  rootBackdrop.style.opacity = '0';
  document
    .querySelectorAll('[data-dual-page]')
    .forEach((button) =>
      button.setAttribute('aria-pressed', button.dataset.dualPage === initialPage),
    );
}
if (welcomeActive || location.hash === '#welcome-screen') openWelcome();
