/* Shared accessible behavior; each project supplies its own visual language. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const motion = (el, frames, duration = 300) => {
    el.getAnimations().forEach((a) => a.cancel());
    return reduced.matches
      ? null
      : el.animate(frames, { duration, easing: 'cubic-bezier(.22,.68,.24,1)' });
  };
  document.querySelectorAll('[data-tabs]').forEach((group) => {
    const tabs = [...group.querySelectorAll('[role=tab]')];
    const activate = (tab, focus = false) => {
      if (focus) tab.focus();
      if (tab.getAttribute('aria-selected') === 'true') return;
      const previous = group.querySelector('[role=tabpanel]:not([hidden])');
      const next = document.getElementById(tab.getAttribute('aria-controls'));
      const commit = () => {
        group.dataset.selection = tab.dataset.selection || '';
        tabs.forEach((t) => {
          const active = t === tab;
          t.setAttribute('aria-selected', String(active));
          t.tabIndex = active ? 0 : -1;
          document.getElementById(t.getAttribute('aria-controls')).hidden = !active;
        });
      };
      if (group.classList.contains('cube-layout'))
        window.ForgeMotion.crossfadePanels(
          group.querySelector('.cube-pages'),
          previous,
          commit,
          next,
        );
      else window.ForgeMotion.change(group, [group], commit, () => [group]);
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => activate(tab));
      tab.addEventListener('keydown', (e) => {
        const next = {
          ArrowRight: (i + 1) % tabs.length,
          ArrowDown: (i + 1) % tabs.length,
          ArrowLeft: (i + tabs.length - 1) % tabs.length,
          ArrowUp: (i + tabs.length - 1) % tabs.length,
          Home: 0,
          End: tabs.length - 1,
        }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        activate(tabs[next], true);
      });
    });
  });
  const states = new WeakMap();
  const disclosure = (details, open) => {
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
      (s, p) => s + (parseFloat(style[p]) || 0),
      0,
    );
    const to = open
      ? details.getBoundingClientRect().height
      : details.querySelector('summary').getBoundingClientRect().height + frame;
    details.style.overflow = 'hidden';
    const animation = motion(details, [{ height: `${from}px` }, { height: `${to}px` }]);
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
  };
  const disclosures = [...document.querySelectorAll('[data-disclosure]')];
  disclosures.forEach((d) =>
    d.querySelector('summary').addEventListener('click', (e) => {
      e.preventDefault();
      disclosure(d, !(states.get(d)?.open ?? d.open));
    }),
  );
  if ('IntersectionObserver' in window && !reduced.matches) {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach(({ target, isIntersecting }) => {
          if (!isIntersecting) return;
          observer.unobserve(target);
          if (document.documentElement.matches('.forge-entering,.forge-arriving')) {
            target.classList.remove('reveal-pending');
            return;
          }
          const a = motion(target, [{ opacity: 0 }, { opacity: 1 }], 480);
          const done = () => target.classList.remove('reveal-pending');
          if (a) {
            a.onfinish = done;
            a.oncancel = done;
          } else done();
        }),
      { rootMargin: '0px 0px -15px 0px' },
    );
    document.querySelectorAll('[data-reveal]').forEach((el) => {
      if (el.getBoundingClientRect().top > innerHeight) {
        el.classList.add('reveal-pending');
        observer.observe(el);
      }
    });
    reduced.addEventListener('change', () => {
      if (reduced.matches) {
        observer.disconnect();
        document
          .querySelectorAll('.reveal-pending')
          .forEach((el) => el.classList.remove('reveal-pending'));
      }
    });
  }
  reduced.addEventListener('change', () => {
    if (reduced.matches) {
      disclosures.forEach((d) => disclosure(d, states.get(d)?.open ?? d.open));
      document
        .getAnimations()
        .filter((a) => Number.isFinite(a.effect.getTiming().iterations))
        .forEach((a) => a.finish());
    }
  });
})();
