// Mario Kart 64: accessible cup selection, replay and interruptible handbook transitions.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const animate = (element, frames, options = {}) =>
    reduced.matches
      ? null
      : element.animate(frames, {
          duration: 280,
          easing: 'cubic-bezier(.22,.68,.24,1)',
          ...options,
        });
  const accordions = [...document.querySelectorAll('.kart-faq')];
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

  if ('IntersectionObserver' in window && !reduced.matches) {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach(({ target, isIntersecting }) => {
          if (!isIntersecting) return;
          if (document.documentElement.matches('.forge-entering,.forge-arriving')) {
            observer.unobserve(target);
            target.classList.remove('reveal-pending');
            return;
          }
          observer.unobserve(target);
          const animation = animate(target, [{ opacity: 0 }, { opacity: 1 }], { duration: 500 });
          const finish = () => target.classList.remove('reveal-pending');
          if (animation) {
            animation.onfinish = finish;
            animation.oncancel = finish;
          } else finish();
        }),
      { rootMargin: '0px 0px -20px 0px' },
    );
    document.querySelectorAll('.reveal-section').forEach((e) => {
      if (e.getBoundingClientRect().top > innerHeight) {
        e.classList.add('reveal-pending');
        observer.observe(e);
      }
    });
    reduced.addEventListener('change', () => {
      if (reduced.matches) {
        observer.disconnect();
        document
          .querySelectorAll('.reveal-pending')
          .forEach((e) => e.classList.remove('reveal-pending'));
      }
    });
  }
  reduced.addEventListener('change', () => {
    if (reduced.matches) {
      accordions.forEach((d) => expand(d, states.get(d)?.open ?? d.open));
      document.getAnimations().forEach((a) => a.finish());
    }
  });
})();

(() => {
  const tabs = [...document.querySelectorAll('.cup-tab')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function select(tab, focus = false) {
    if (focus) tab.focus();
    const group = document.querySelector('.course-select');
    if (tab.getAttribute('aria-selected') === 'true') return;
    group.dataset.cup = tab.id.replace('tab-', '');
    tabs.forEach((item) => {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
    });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      select(tabs[next], true);
    });
  });
})();
