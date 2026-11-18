// The forge.store showcase plays the store on its two screens: the cursor walks
// through each category, R rolls to the next grid and the upper screen follows.
(() => {
  const STEP = 2600;
  const PICKS_PER_TAB = 4;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  function play(root) {
    const grids = [...root.querySelectorAll('.fs-grid')];
    const tabs = [...root.querySelectorAll('.fs-tab')];
    const track = root.querySelector('.fs-tab-track');
    const layers = [...root.querySelectorAll('.fs-banner-layer')];
    const card = root.querySelector('.fs-card');
    const field = (name) => root.querySelector(`[data-fs="${name}"]`);
    const clock = root.querySelector('[data-fs-clock]');
    // An optional host backdrop ([data-fs-ambient] .fs-ambient) follows the selected art.
    const ambient = [
      ...(root.closest('[data-fs-ambient]')?.querySelectorAll('.fs-ambient img') ?? []),
    ];
    let ambientFront = 0;
    let grid = grids.findIndex((element) => element.classList.contains('is-active'));
    let pick = 0,
      shown = 0,
      front = 0,
      token = 0,
      timer = 0,
      visible = false;

    const icons = () => [...grids[grid].querySelectorAll('.fs-icon')];

    function tickClock() {
      const now = new Date();
      clock.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }

    function setText(name, value) {
      const element = field(name);
      element.textContent = value;
      const chip = element.closest('.fs-chip');
      (chip || element).hidden = !value;
    }

    function preload(icon) {
      for (const source of [icon?.dataset.art, icon?.dataset.logo])
        if (source) new Image().src = source;
    }

    function updateCard(icon) {
      const data = icon.dataset;
      card.classList.remove('is-swapping');
      void card.offsetWidth; // Restart the card's entrance.
      card.classList.add('is-swapping');
      field('icon').src = icon.querySelector('img').getAttribute('src');
      field('title').textContent = data.title;
      field('meta').textContent = data.meta;
      setText('version', data.version);
      field('version').classList.toggle('is-development', Boolean(data.development));
      setText('needs', data.needs);
      setText('stars', data.stars);
      setText('size', data.size);
    }

    function show(icon) {
      root.querySelector('.fs-icon.is-selected')?.classList.remove('is-selected');
      icon.classList.add('is-selected');
      const data = icon.dataset;
      const next = layers[1 - front];
      const art = next.querySelector('.fs-art');
      const logo = next.querySelector('.fs-logo');
      next.style.backgroundImage = data.gradient;
      art.hidden = !data.art;
      if (data.art) {
        art.src = data.art;
        art.style.objectPosition = data.position;
      }
      art.classList.toggle('is-pixel', Boolean(data.pixel));
      logo.src = data.logo || icon.querySelector('img').getAttribute('src');
      logo.classList.toggle('is-icon', !data.logo);
      logo.style.setProperty('--logo-scale', data.logoScale || 1);
      const current = ++token;
      // The card and banner change together once the art is ready (or after 900 ms).
      const ready = Promise.allSettled(
        [art, logo].filter((element) => !element.hidden).map((element) => element.decode()),
      );
      Promise.race([ready, new Promise((resolve) => setTimeout(resolve, 900))]).then(() => {
        if (current !== token) return;
        updateCard(icon);
        layers[front].classList.remove('is-active');
        next.classList.add('is-active');
        front = 1 - front;
        if (ambient.length === 2) {
          const backdrop = ambient[1 - ambientFront];
          backdrop.src = data.art || icon.querySelector('img').getAttribute('src');
          ambient[ambientFront].classList.remove('is-active');
          backdrop.classList.add('is-active');
          ambientFront = 1 - ambientFront;
        }
      });
      const following = icons()[(icons().indexOf(icon) + 1) % icons().length];
      preload(
        shown + 1 >= PICKS_PER_TAB
          ? grids[(grid + 1) % grids.length].querySelector('.fs-icon')
          : following,
      );
    }

    function press(key) {
      const element = root.querySelector(`[data-fs-key="${key}"]`);
      element.classList.remove('is-pressed');
      void element.offsetWidth;
      element.classList.add('is-pressed');
    }

    function revealTab(tab) {
      const strip = track.parentElement;
      const limit = Math.max(0, track.scrollWidth - strip.clientWidth);
      const offset = Math.min(
        limit,
        Math.max(0, tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2),
      );
      track.style.transform = `translateX(${-offset}px)`;
    }

    function selectGrid(index, direction = 1) {
      if (index === grid) return;
      const leaving = grids[grid];
      leaving.classList.remove('is-active', 'from-left', 'from-right');
      leaving.classList.add(direction > 0 ? 'to-left' : 'to-right');
      grid = index;
      const entering = grids[grid];
      entering.classList.remove('to-left', 'to-right', 'from-left', 'from-right');
      entering.classList.add('is-active', direction > 0 ? 'from-right' : 'from-left');
      const tab = tabs.find((element) => element.dataset.tab === entering.dataset.tab);
      tabs.forEach((element) => element.classList.toggle('is-active', element === tab));
      revealTab(tab);
      pick = 0;
      shown = 0;
      show(icons()[0]);
    }

    function advance() {
      shown += 1;
      if (shown >= PICKS_PER_TAB) {
        press('r');
        selectGrid((grid + 1) % grids.length);
      } else {
        pick = (pick + 1) % icons().length;
        show(icons()[pick]);
      }
      schedule();
    }

    function schedule(delay = STEP) {
      clearTimeout(timer);
      if (visible && !document.hidden && !reduced.matches) timer = setTimeout(advance, delay);
    }

    root.addEventListener('click', (event) => {
      const icon = event.target.closest('.fs-icon');
      const tab = event.target.closest('.fs-tab');
      if (icon && icon.closest('.fs-grid') === grids[grid]) {
        pick = icons().indexOf(icon);
        shown = 0;
        show(icon);
        schedule(STEP * 2);
      } else if (tab) {
        const index = grids.findIndex((element) => element.dataset.tab === tab.dataset.tab);
        if (index >= 0) {
          selectGrid(index, index > grid ? 1 : -1);
          schedule(STEP * 2);
        }
      }
    });
    document.addEventListener('visibilitychange', () => schedule());
    reduced.addEventListener?.('change', () => schedule());
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      root.classList.toggle('is-playing', visible);
      schedule();
    }).observe(root);
    // The screens scale with the layout, so the tab offset is measured again.
    new ResizeObserver(() =>
      revealTab(tabs.find((element) => element.classList.contains('is-active'))),
    ).observe(root);
    tickClock();
    setInterval(tickClock, 15000);
  }

  document.querySelectorAll('[data-store-showcase]').forEach(play);
})();
