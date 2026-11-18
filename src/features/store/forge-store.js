// forge.store catalog: category tabs, L/R keys and search over the static snapshot.
(() => {
  const grid = document.getElementById('store-grid');
  if (!grid) return;
  const tabs = [...document.querySelectorAll('[data-store-tab]')];
  const search = document.getElementById('store-search');
  const empty = document.getElementById('store-empty');
  const result = document.getElementById('store-result');
  const apps = [...grid.querySelectorAll('.store-app')];
  let category = 'all';

  function apply() {
    const query = search.value.trim().toLocaleLowerCase();
    let shown = 0;
    for (const app of apps) {
      const visible =
        (category === 'all' || app.dataset.tags.split(' ').includes(category)) &&
        (!query || app.dataset.search.includes(query));
      app.hidden = !visible;
      if (visible) shown += 1;
    }
    empty.hidden = shown > 0;
    result.textContent = `${shown} ${shown === 1 ? 'app' : 'apps'} shown`;
  }

  function select(tab, focus = false) {
    category = tab.dataset.storeTab;
    tabs.forEach((button) => button.setAttribute('aria-pressed', String(button === tab)));
    // Reveal the tab inside its strip without scrolling the page.
    const strip = tab.parentElement;
    if (tab.offsetLeft < strip.scrollLeft) strip.scrollLeft = tab.offsetLeft - 8;
    else if (tab.offsetLeft + tab.offsetWidth > strip.scrollLeft + strip.clientWidth)
      strip.scrollLeft = tab.offsetLeft + tab.offsetWidth - strip.clientWidth + 8;
    if (focus) tab.focus({ preventScroll: true });
    apply();
  }

  tabs.forEach((tab) => tab.addEventListener('click', () => select(tab)));
  search.addEventListener('input', apply);
  document.addEventListener('keydown', (event) => {
    // L and R change tabs, as on the console, unless the visitor is typing.
    if (event.metaKey || event.ctrlKey || event.altKey || event.target.closest?.('input, textarea'))
      return;
    const key = event.key.toLowerCase();
    if (key !== 'l' && key !== 'r') return;
    const index = tabs.findIndex((tab) => tab.dataset.storeTab === category);
    const next = tabs[(index + (key === 'r' ? 1 : -1) + tabs.length) % tabs.length];
    select(next, document.activeElement?.matches?.('[data-store-tab]'));
  });
  apply();
})();
