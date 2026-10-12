// Windows-inspired gallery, help and installation guide for Legend of Doom.
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

  document
    .querySelector('[data-enlarge]')
    .addEventListener('click', () => document.getElementById('gallery-open').click());
  const about = document.getElementById('about-dialog');
  document.querySelectorAll('[data-about]').forEach((button) =>
    button.addEventListener('click', () => {
      document.querySelectorAll('.win-menu[open]').forEach((menu) => (menu.open = false));
      window.ForgeMotion.showDialog(about);
    }),
  );
  document
    .querySelectorAll('[data-close-about]')
    .forEach((button) =>
      button.addEventListener('click', () => window.ForgeMotion.hideDialog(about)),
    );
  const menus = [...document.querySelectorAll('.win-menu')];
  document.addEventListener('click', (event) =>
    menus.forEach((menu) => {
      if (!menu.contains(event.target)) menu.open = false;
    }),
  );
  menus.forEach((menu) =>
    menu
      .querySelectorAll('a')
      .forEach((link) => link.addEventListener('click', () => (menu.open = false))),
  );
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape')
      menus.forEach((menu) => {
        if (menu.open) {
          menu.open = false;
          menu.querySelector('summary').focus();
        }
      });
  });
  const qr = document.getElementById('qr-dialog');
  document.getElementById('show-install-qr').addEventListener('click', () => {
    window.ForgeMotion.showDialog(qr);
  });
  document
    .getElementById('close-install-qr')
    .addEventListener('click', () => window.ForgeMotion.hideDialog(qr));
  [about, qr].forEach((modal) =>
    modal.addEventListener('cancel', (event) => {
      event.preventDefault();
      window.ForgeMotion.hideDialog(modal);
    }),
  );
  const panel = document.getElementById('package-panel');
  const packages = {
    cia: panel.dataset.ciaTemplate || panel.innerHTML,
    '3dsx':
      '<ol class="setup-steps"><li><b>1</b><div><h3>Get the matching release files</h3><p>Download the complete SD ZIP from the release, which contains the 3DSX and its matching game data.</p></div></li><li><b>2</b><div><h3>Prepare the SD card</h3><p>Copy the ZIP’s <code>3ds</code> folder to the root of your SD card, merging folders. Keep its executable and data together in <code>sdmc:/3ds/legend-of-doom/</code>.</p></div></li><li><b>3</b><div><h3>Open Homebrew Launcher</h3><p>Launch Legend of Doom on a supported New Nintendo 3DS family console. No NES ROM or commercial DOOM IWAD is required.</p></div></li></ol>',
  };
  panel.dataset.ciaTemplate = packages.cia;
  document.querySelectorAll('[data-package]').forEach((button) =>
    button.addEventListener('click', () => {
      window.ForgeMotion.change(panel, [panel], () => {
        document
          .querySelectorAll('[data-package]')
          .forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
        panel.innerHTML = packages[button.dataset.package];
        document.getElementById('show-install-qr').hidden = button.dataset.package !== 'cia';
      });
    }),
  );

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
    document.querySelectorAll('.reveal-section').forEach((section) => {
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
