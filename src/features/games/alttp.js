// Gallery, inventory and field-guide motion for A Link to the Past.
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

  // In-game inventory language, with ordinary keyboard-accessible tabs.
  const kit = {
    map: [
      'THE LOWER SCREEN',
      'Never lose your way.',
      'Follow your position on a live overworld map, or check the floor you are exploring inside a dungeon. Hyrule stays close at hand.',
      'Overworld map · Dungeon floors · Gear',
    ],
    items: [
      'EQUIPMENT & TOUCH',
      'The right tool. Within reach.',
      'Select an item on the lower touchscreen and keep track of your equipment without covering the adventure on the upper display.',
      'Touch item selection · Equipment overview',
    ],
    screen: [
      'YOUR OWN PERSPECTIVE',
      'A little more room to explore.',
      'Choose Wide, Original or Stretch in Settings → Screen. Each ROM profile remembers its own display preferences and saves.',
      '400 × 240 Wide · 256 × 224 Original · Stretch',
    ],
  };
  const kitButtons = [...document.querySelectorAll('[data-kit]')];
  const kitPanel = document.getElementById('kit-panel');
  function selectKit(button) {
    window.ForgeMotion.change(kitPanel, [kitPanel], () => {
      kitButtons.forEach((b) => {
        b.setAttribute('aria-selected', String(b === button));
        b.tabIndex = b === button ? 0 : -1;
      });
      kitPanel.setAttribute('aria-labelledby', button.id);
      ['kit-label', 'kit-title', 'kit-copy', 'kit-foot'].forEach(
        (id, i) => (document.getElementById(id).textContent = kit[button.dataset.kit][i]),
      );
    });
  }
  kitButtons.forEach((b, i) => {
    b.addEventListener('click', () => selectKit(b));
    b.addEventListener('keydown', (event) => {
      const next = { ArrowRight: (i + 1) % 3, ArrowLeft: (i + 2) % 3, Home: 0, End: 2 }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      kitButtons[next].focus();
      selectKit(kitButtons[next]);
    });
  });
  const modes = {
    wide: [
      'A wider window into Hyrule.',
      'Native 400 × 240. Choose Standard or Fixed camera behavior in Settings → Screen.',
    ],
    original: [
      'The original proportions.',
      'Keep the 256 × 224 view within the upper display, with space around the original game image.',
    ],
    stretch: [
      'Fill the upper screen.',
      'Expand the original view to fill the display. Image proportions change to use the available space.',
    ],
  };
  document.querySelectorAll('[data-mode]').forEach((button) =>
    button.addEventListener('click', () => {
      const diagram = document.querySelector('.mode-diagram');
      const description = document.querySelector('.mode-description');
      if (diagram.dataset.selected === button.dataset.mode) return;
      document
        .querySelectorAll('[data-mode]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      diagram.dataset.selected = button.dataset.mode;
      window.ForgeMotion.replaceText(description, () => {
        document.getElementById('mode-title').textContent = modes[button.dataset.mode][0];
        document.getElementById('mode-copy').textContent = modes[button.dataset.mode][1];
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
