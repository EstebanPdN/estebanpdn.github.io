// One scene owns both displays, its caption, and the enlarged view.
(() => {
  const thumbs = [...document.querySelectorAll('.gallery-thumb')];
  const stage = document.getElementById('gallery-image');
  if (!thumbs.length || !stage) return;
  const dialog = document.getElementById('gallery-lightbox');
  const enlarged = document.getElementById('lightbox-image');
  const video = document.getElementById('lightbox-video');
  const screenControls = dialog.querySelector('.gallery-screen-controls');
  const companion = document.getElementById('gallery-companion');
  const consoleTop = document.getElementById('gallery-console-top');
  const gbaScreen = document.getElementById('gallery-gba-screen');
  const pocket = document.getElementById('pocket-companion-image');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.getElementById('gallery-autoplay');
  const rail = document.querySelector('.scene-thumbs');
  const scrollControls = document.getElementById('gallery-scroll-controls');
  const slider = document.getElementById('gallery-scroll');
  const scrollPrevious = document.getElementById('gallery-scroll-previous');
  const scrollNext = document.getElementById('gallery-scroll-next');
  const screenButtons = [...document.querySelectorAll('[data-gallery-screen]')];
  const screenBoxes = { upper: '0 0 400 240', lower: '400 0 320 240' };
  const ready = new Map();
  let current = Math.max(
    0,
    thumbs.findIndex((thumb) => thumb.getAttribute('aria-pressed') === 'true'),
  );
  let requestedIndex = current,
    request = 0,
    closing = false;
  let screen = 'upper',
    requestedScreen = screen;
  let timer = null,
    holdUntil = 0,
    inView = false,
    paused = reduced.matches;
  const interval = 6000,
    manualHold = 25000;
  const source = (button) => button.querySelector('image').getAttribute('href');
  function decode(src) {
    if (ready.has(src)) return ready.get(src);
    const image = new Image();
    image.src = src;
    const promise = image.decode
      ? image.decode()
      : new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
        });
    ready.set(src, promise);
    promise.catch(() => ready.delete(src));
    return promise;
  }
  function paint(target, button, box, display) {
    if (!target) return Promise.resolve();
    return window.ForgeMotion.crossfadeSVG(target, () => {
      target.setAttribute('viewBox', box);
      if (display) target.dataset.screen = display;
      target.setAttribute('aria-label', button.dataset.title);
      target.replaceChildren(button.querySelector('image').cloneNode(true));
    });
  }
  function schedule(delay = interval) {
    clearTimeout(timer);
    timer = null;
    if (paused || !inView || document.hidden || dialog.open || !stage.isConnected) return;
    const remaining = Math.max(0, holdUntil - Date.now());
    timer = setTimeout(async () => {
      timer = null;
      const nextAt = Date.now() + interval;
      await select(requestedIndex + 1, false);
      schedule(Math.max(0, nextAt - Date.now()));
    }, remaining || delay);
  }
  function hold() {
    holdUntil = Date.now() + manualHold;
    schedule();
  }
  function updateToggle() {
    const label = paused ? 'Play slideshow' : 'Pause slideshow';
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('title', label);
    toggle.setAttribute('aria-pressed', String(!paused));
  }
  function updateVideo(button) {
    if (!video) return;
    const clip = button.dataset.video;
    video.pause();
    video.hidden = !clip;
    enlarged.hidden = Boolean(clip);
    if (screenControls) screenControls.hidden = Boolean(clip);
    dialog.dataset.media = clip ? 'video' : 'image';
    if (clip) {
      if (video.getAttribute('src') !== clip) {
        video.src = clip;
        video.load();
      }
      video.poster = source(button);
      video.setAttribute('aria-label', button.dataset.title);
    } else {
      video.removeAttribute('src');
      video.load();
    }
  }
  async function select(index, manual = true, display = requestedScreen) {
    if (manual) hold();
    const selected = (index + thumbs.length) % thumbs.length;
    const button = thumbs[selected],
      id = ++request;
    requestedIndex = selected;
    requestedScreen = display;
    try {
      await decode(source(button));
    } catch {
      if (id === request) {
        requestedIndex = current;
        requestedScreen = screen;
      }
      return false;
    }
    await Promise.all(
      [stage, companion, consoleTop, gbaScreen, pocket, enlarged]
        .filter(Boolean)
        .map((target) => window.ForgeMotion.idle(target)),
    );
    if (id !== request || !stage.isConnected) return false;
    const sceneChanged = selected !== current,
      screenChanged = display !== screen;
    if (!sceneChanged && !screenChanged) return true;
    current = selected;
    screen = display;
    if (sceneChanged) updateVideo(button);
    const paints = [];
    dialog.dataset.screen = screen;
    if (sceneChanged) paints.push(paint(stage, button, screenBoxes.upper));
    if (sceneChanged)
      paints.push(
        paint(companion, button, screenBoxes.lower),
        paint(consoleTop, button, screenBoxes.upper),
        paint(gbaScreen, button, screenBoxes.upper),
        paint(pocket, button, screenBoxes.lower),
      );
    paints.push(paint(enlarged, button, screenBoxes[screen], screen));
    document.getElementById('gallery-title').textContent = button.dataset.title;
    document.getElementById('gallery-caption').textContent = button.dataset.caption;
    document.getElementById('gallery-current').textContent = String(current + 1).padStart(2, '0');
    document.getElementById('lightbox-title').textContent = button.dataset.title;
    document.getElementById('lightbox-counter').textContent =
      `${current + 1} / ${thumbs.length} · ${button.dataset.video ? 'Video · Both screens' : `${screen === 'upper' ? 'Upper' : 'Lower'} screen`}`;
    screenButtons.forEach((control) =>
      control.setAttribute('aria-pressed', String(control.dataset.galleryScreen === screen)),
    );
    thumbs.forEach((thumb, i) => thumb.setAttribute('aria-pressed', String(i === current)));
    if (rail) {
      const bounds = rail.getBoundingClientRect(),
        selectedBounds = button.getBoundingClientRect();
      const delta =
        selectedBounds.left < bounds.left
          ? selectedBounds.left - bounds.left
          : selectedBounds.right > bounds.right
            ? selectedBounds.right - bounds.right
            : 0;
      if (delta) rail.scrollBy({ left: delta, behavior: reduced.matches ? 'instant' : 'smooth' });
    }
    decode(source(thumbs[(current + 1) % thumbs.length])).catch(() => {});
    await Promise.all(paints);
    return id === request && stage.isConnected;
  }
  async function openViewer(display = requestedScreen, index = requestedIndex) {
    const selected = await select(index, true, display);
    if (!selected || requestedScreen !== display || closing) return;
    if (!dialog.open) window.ForgeMotion.showDialog(dialog);
    if (video && !video.hidden) video.play().catch(() => {});
    schedule();
  }
  screenButtons.forEach((control) =>
    control.addEventListener('click', () => {
      const display = control.dataset.galleryScreen;
      return select(requestedIndex, true, display);
    }),
  );
  thumbs.forEach((button, index) => {
    button.addEventListener('click', () =>
      button.dataset.video ? openViewer('upper', index) : select(index),
    );
    button.addEventListener('keydown', (event) => {
      const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: thumbs.length - 1 }[
        event.key
      ];
      if (next === undefined) return;
      event.preventDefault();
      const target = (next + thumbs.length) % thumbs.length;
      thumbs[target].focus();
      select(target);
    });
  });
  document.querySelectorAll('[data-gallery-target]').forEach((button) =>
    button.addEventListener('click', () => {
      const index = thumbs.findIndex(
        (thumb) => thumb.dataset.scene === button.dataset.galleryTarget,
      );
      if (index >= 0) select(index);
    }),
  );
  document.querySelectorAll('[data-gallery-feature]').forEach((link) =>
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const index = thumbs.findIndex(
        (thumb) => thumb.dataset.scene === link.dataset.galleryFeature,
      );
      if (index >= 0) return openViewer('upper', index);
    }),
  );
  toggle.addEventListener('click', () => {
    paused = !paused;
    updateToggle();
    schedule();
  });
  if (rail && slider) {
    function updateScroll() {
      const max = Math.max(0, rail.scrollWidth - rail.clientWidth);
      scrollControls.hidden = max < 2;
      slider.value = max ? String(Math.round((rail.scrollLeft / max) * 100)) : '0';
      scrollPrevious.disabled = rail.scrollLeft < 2;
      scrollNext.disabled = rail.scrollLeft >= max - 2;
    }
    function browse(direction) {
      hold();
      rail.scrollBy({
        left: direction * rail.clientWidth * 0.8,
        behavior: reduced.matches ? 'instant' : 'smooth',
      });
    }
    scrollPrevious.addEventListener('click', () => browse(-1));
    scrollNext.addEventListener('click', () => browse(1));
    slider.addEventListener('input', () => {
      hold();
      rail.scrollLeft = ((rail.scrollWidth - rail.clientWidth) * Number(slider.value)) / 100;
    });
    rail.addEventListener('scroll', updateScroll, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(updateScroll).observe(rail);
    updateScroll();
  }
  document.getElementById('gallery-open').addEventListener('click', () => openViewer('upper'));
  function close() {
    if (closing) return;
    closing = true;
    video?.pause();
    window.ForgeMotion.hideDialog(dialog).then(() => {
      closing = false;
      hold();
    });
  }
  document.getElementById('lightbox-close').addEventListener('click', close);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  document
    .getElementById('lightbox-previous')
    .addEventListener('click', () => select(requestedIndex - 1));
  document
    .getElementById('lightbox-next')
    .addEventListener('click', () => select(requestedIndex + 1));
  dialog.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    select(requestedIndex + (event.key === 'ArrowRight' ? 1 : -1));
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    )
      close();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) video?.pause();
    schedule();
  });
  reduced.addEventListener('change', () => {
    paused = reduced.matches;
    updateToggle();
    schedule();
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        inView = entries.some((entry) => entry.isIntersecting);
        schedule();
      },
      { threshold: 0 },
    );
    observer.observe(document.getElementById('gallery'));
  } else {
    inView = true;
    schedule();
  }
  updateToggle();
  decode(source(thumbs[(current + 1) % thumbs.length])).catch(() => {});
})();
