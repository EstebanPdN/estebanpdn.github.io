// forge.store catalog: category tabs, L/R keys and search over the static snapshot.
(() => {
  const grid = document.getElementById('store-grid');
  if (!grid) return;
  const results = document.getElementById('store-results');
  const tabs = [...document.querySelectorAll('[data-store-tab]')];
  const search = document.getElementById('store-search');
  const empty = document.getElementById('store-empty');
  const result = document.getElementById('store-result');
  const apps = [...grid.querySelectorAll('.store-app')];
  const strip = tabs[0].parentElement;
  let selected = tabs[0];
  function syncSelection() {
    window.ForgeUI.positionSelection(strip, selected);
  }
  syncSelection();
  const sizes = new ResizeObserver(syncSelection);
  sizes.observe(strip);
  tabs.forEach((tab) => sizes.observe(tab));
  requestAnimationFrame(() => strip.classList.add('is-ready'));

  const cardMotion = {
    leave: (part, index) =>
      part.animate(
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
    enter: (part, index) =>
      part.animate(
        [
          { opacity: 0, transform: 'translateY(20px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        {
          duration: 680,
          delay: Math.min(index * 38, 190),
          easing: 'cubic-bezier(.22,1,.36,1)',
          fill: 'backwards',
        },
      ),
  };
  function visibleResults() {
    return [result, ...(empty.hidden ? apps.filter((app) => !app.hidden) : [empty])];
  }

  function apply() {
    const query = search.value.trim().toLocaleLowerCase();
    let shown = 0;
    for (const app of apps) {
      const visible =
        (selected.dataset.storeTab === 'all' ||
          app.dataset.tags.split(' ').includes(selected.dataset.storeTab)) &&
        (!query || app.dataset.search.includes(query));
      app.hidden = !visible;
      if (visible) shown += 1;
    }
    empty.hidden = shown > 0;
    const count = `${shown} ${shown === 1 ? 'app' : 'apps'} shown`;
    if (result.textContent !== count) result.textContent = count;
  }

  function select(tab, focus = false) {
    if (selected === tab) return;
    selected = tab;
    syncSelection();
    tabs.forEach((button) => button.setAttribute('aria-pressed', String(button === tab)));
    // Reveal the tab inside its strip without scrolling the page.
    if (tab.offsetLeft < strip.scrollLeft) strip.scrollLeft = tab.offsetLeft - 8;
    else if (tab.offsetLeft + tab.offsetWidth > strip.scrollLeft + strip.clientWidth)
      strip.scrollLeft = tab.offsetLeft + tab.offsetWidth - strip.clientWidth + 8;
    if (focus) tab.focus({ preventScroll: true });
    window.ForgeMotion.change(results, visibleResults(), apply, visibleResults, cardMotion);
  }

  tabs.forEach((tab) => tab.addEventListener('click', () => select(tab)));
  search.addEventListener('input', () => {
    window.ForgeMotion.stabilize(results);
    apply();
  });
  document.addEventListener('keydown', (event) => {
    // L and R change tabs, as on the console, unless the visitor is typing.
    if (event.metaKey || event.ctrlKey || event.altKey || event.target.closest?.('input, textarea'))
      return;
    const key = event.key.toLowerCase();
    if (key !== 'l' && key !== 'r') return;
    const index = tabs.indexOf(selected);
    const next = tabs[(index + (key === 'r' ? 1 : -1) + tabs.length) % tabs.length];
    select(next, document.activeElement?.matches?.('[data-store-tab]'));
  });
  apply();
})();
