// A post keeps its game's skin while its index uses the shared scene lifetime.
(() => {
  const navigation = document.querySelector('.blog-contents nav');
  if (!navigation) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let scrollFrame = 0;
  const cancelScroll = () => {
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
  };
  function syncIndex() {
    navigation.querySelectorAll('a[href^="#"]').forEach((link) => {
      if (link.hash === location.hash) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  navigation.addEventListener('click', (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link = event.target.closest('a[href^="#"]');
    const target = link && document.getElementById(decodeURIComponent(link.hash.slice(1)));
    if (!target) return;
    event.preventDefault();
    cancelScroll();
    const start = scrollY;
    // The shared header lives outside a mounted scene's scoped document. Its
    // responsive height is already resolved by the section's scroll margin.
    const offset = parseFloat(window.getComputedStyle(target).scrollMarginTop) || 138;
    const end = Math.max(
      0,
      Math.min(
        start + target.getBoundingClientRect().top - offset,
        document.documentElement.scrollHeight - innerHeight,
      ),
    );
    history.replaceState({ ...history.state, forgeScroll: [scrollX, start] }, '', location.href);
    history.pushState({}, '', link.hash);
    syncIndex();
    const finish = () => {
      scrollFrame = 0;
      const heading = target.querySelector('h2') || target;
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    };
    if (reduced.matches || Math.abs(end - start) < 2) {
      window.scrollTo({ top: end, behavior: 'instant' });
      finish();
      return;
    }
    const duration = 650;
    let began;
    const step = (now) => {
      began ??= now;
      const t = Math.min(1, (now - began) / duration),
        eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      window.scrollTo({ top: start + (end - start) * eased, behavior: 'instant' });
      if (t < 1) scrollFrame = requestAnimationFrame(step);
      else finish();
    };
    scrollFrame = requestAnimationFrame(step);
  });
  window.addEventListener('wheel', cancelScroll, { passive: true });
  window.addEventListener('touchstart', cancelScroll, { passive: true });
  window.addEventListener('popstate', () => {
    cancelScroll();
    syncIndex();
  });
  window.addEventListener('hashchange', syncIndex);
  syncIndex();
})();
