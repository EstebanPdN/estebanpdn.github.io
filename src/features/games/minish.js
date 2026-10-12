// A little movement, without changing the booklet's reading layout.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const ease = 'cubic-bezier(.22,.68,.24,1)';
  const animate = (element, frames, options = {}) => {
    if (reduced.matches || !element?.animate) return null;
    return element.animate(frames, { duration: 300, easing: ease, ...options });
  };

  const accordions = [...document.querySelectorAll('.faq-item, .art-credits')];
  const states = new WeakMap();
  function expand(details, open) {
    details.dataset.forgeDisclosureOpen = String(open);
    const from = details.getBoundingClientRect().height;
    states.get(details)?.animation?.cancel();
    details.style.height = '';
    details.style.overflow = '';
    if (reduced.matches) {
      details.open = open;
      states.set(details, { open });
      return;
    }
    details.open = true;
    const style = getComputedStyle(details);
    const frame = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce(
      (sum, property) => sum + (parseFloat(style[property]) || 0),
      0,
    );
    const to = open
      ? details.getBoundingClientRect().height
      : details.querySelector('summary').getBoundingClientRect().height + frame;
    details.style.overflow = 'hidden';
    const animation = animate(details, [{ height: `${from}px` }, { height: `${to}px` }]);
    const state = { open, animation };
    states.set(details, state);
    const finish = () => {
      if (states.get(details) !== state) return;
      details.open = open;
      details.style.height = '';
      details.style.overflow = '';
      state.animation = null;
      delete details.dataset.forgeDisclosureOpen;
    };
    if (animation) animation.onfinish = finish;
    else finish();
  }
  accordions.forEach((details) => {
    details.querySelector('summary').addEventListener('click', (event) => {
      event.preventDefault();
      const open = !(states.get(details)?.open ?? details.open);
      if (open && details.classList.contains('faq-item')) {
        accordions
          .filter((other) => other !== details && other.classList.contains('faq-item'))
          .forEach((other) => {
            if (states.get(other)?.open ?? other.open) expand(other, false);
          });
      }
      expand(details, open);
    });
  });

  // The preview keeps its screen visible as framing and pixel style change.
  const viewPreview = document.querySelector('.minish-view-preview');
  const viewImage = document.getElementById('minish-view-image');
  const viewDescriptions = {
    wide: [
      'A little more world to discover.',
      'Wide extends compatible gameplay to a 266 × 160 view, scaled across the upper display. Scenes that cannot show extra scenery return to the original framing.',
    ],
    original: [
      'The familiar GBA proportions.',
      'Original keeps the 240 × 160 game’s 3:2 proportions. With Blur or Bilinear, it fills the screen height at 360 × 240, leaving a slim border on each side.',
    ],
    stretch: [
      'Make yourself at home.',
      'Stretch fills the 400 × 240 upper screen with the original view. It uses all the available space, making the image a little wider.',
    ],
    pixel: [
      'The original pixels, in their own space.',
      'Pixel Perfect centers the original 240 × 160 GBA picture. Choose a framing above to return to a larger view with Bilinear filtering.',
    ],
  };
  const filterDescriptions = {
    blur: [
      'A softer, gentler picture.',
      'Blur applies linear filtering directly as the image is resized. It blends neighboring pixels for smoother edges, with a softer result than Bilinear.',
    ],
    bilinear: [
      'A sharper, comfortable view.',
      'Bilinear uses the port’s sharp scaling method: first a crisp 2× enlargement, then gentle filtering to fit the display. It keeps pixel edges more defined than Blur.',
    ],
    pixel: [
      'Every pixel has its own place.',
      'Pixel Perfect uses a centered 1× image without smoothing or fractional scaling. The picture is smaller and the pixel boundaries stay crisp.',
    ],
  };
  const updateSize = () => {
    const pixel = viewPreview.dataset.filter === 'pixel',
      view = viewPreview.dataset.view;
    document.getElementById('minish-view-size').textContent = pixel
      ? '240 × 160'
      : view === 'original'
        ? '360 × 240'
        : '400 × 240';
  };
  function applyPreview(view, filter) {
    const changedView = viewPreview.dataset.view !== view,
      changedFilter = viewPreview.dataset.filter !== filter;
    if (!changedView && !changedFilter) return;
    viewPreview.dataset.view = view;
    viewPreview.dataset.filter = filter;
    document
      .querySelectorAll('[data-minish-view]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.minishView === view)));
    document
      .querySelectorAll('[data-minish-filter]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.minishFilter === filter)));
    if (changedView) {
      window.ForgeMotion.crossfadeSVG(viewImage, () =>
        viewImage.setAttribute('viewBox', view === 'wide' ? '67 40 266 160' : '80 40 240 160'),
      );
      window.ForgeMotion.replaceText(document.getElementById('minish-view-description'), () => {
        document.getElementById('minish-view-title').textContent = viewDescriptions[view][0];
        document.getElementById('minish-view-copy').textContent = viewDescriptions[view][1];
      });
    }
    if (changedFilter)
      window.ForgeMotion.replaceText(document.getElementById('minish-filter-description'), () => {
        document.getElementById('minish-filter-title').textContent = filterDescriptions[filter][0];
        document.getElementById('minish-filter-copy').textContent = filterDescriptions[filter][1];
      });
    updateSize();
  }
  function selectView(button) {
    const view = button.dataset.minishView;
    viewPreview.dataset.lastView = view;
    applyPreview(
      view,
      viewPreview.dataset.filter === 'pixel' ? 'bilinear' : viewPreview.dataset.filter,
    );
  }
  function selectFilter(button) {
    const filter = button.dataset.minishFilter,
      view = viewPreview.dataset.view;
    if (filter === 'pixel') {
      if (view !== 'pixel') viewPreview.dataset.lastView = view;
      applyPreview('pixel', 'pixel');
    } else
      applyPreview(view === 'pixel' ? viewPreview.dataset.lastView || 'stretch' : view, filter);
  }
  for (const [selector, select] of [
    ['[data-minish-view]', selectView],
    ['[data-minish-filter]', selectFilter],
  ]) {
    const buttons = [...document.querySelectorAll(selector)];
    buttons.forEach((button, index) => {
      button.addEventListener('click', () => select(button));
      button.addEventListener('keydown', (event) => {
        const next = {
          ArrowRight: (index + 1) % buttons.length,
          ArrowLeft: (index + buttons.length - 1) % buttons.length,
          Home: 0,
          End: buttons.length - 1,
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        buttons[next].focus();
        select(buttons[next]);
      });
    });
  }

  // Prepare offscreen chapters before they can paint. Starting an animation on
  // already-visible paper produced a one-frame opacity drop and an 18px jump.
  if ('IntersectionObserver' in window && !reduced.matches) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          if (!isIntersecting) return;
          if (document.documentElement.matches('.forge-entering,.forge-arriving')) {
            observer.unobserve(target);
            target.classList.remove('reveal-pending');
            return;
          }
          observer.unobserve(target);
          const animation = animate(target, [{ opacity: 0 }, { opacity: 1 }], { duration: 480 });
          const reveal = () => target.classList.remove('reveal-pending');
          if (animation) {
            animation.onfinish = reveal;
            animation.oncancel = reveal;
          } else reveal();
        });
      },
      { threshold: 0, rootMargin: '0px 0px -24px 0px' },
    );
    document.querySelectorAll('.folio:not(.cover-folio)').forEach((section) => {
      if (section.getBoundingClientRect().top < innerHeight) return;
      section.classList.add('reveal-pending');
      observer.observe(section);
    });
    reduced.addEventListener('change', () => {
      if (!reduced.matches) return;
      observer.disconnect();
      document
        .querySelectorAll('.reveal-pending')
        .forEach((section) => section.classList.remove('reveal-pending'));
    });
  }
  reduced.addEventListener('change', () => {
    if (!reduced.matches) return;
    accordions.forEach((details) => expand(details, states.get(details)?.open ?? details.open));
    document.getAnimations().forEach((animation) => animation.finish());
  });
})();
