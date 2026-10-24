import { REFRESH_MS, refreshProjects, renderCatalog, catalogKey } from './community-data.mjs';
import { WORMS_FEED, readWormsTracker } from './tracker-feed.mjs';

const panel = document.getElementById('progress-community');
const grid = document.getElementById('community-grid');
const status = document.getElementById('community-sync');
const storageKey = 'forge-community-v2';
let catalog,
  snapshot,
  running,
  lastAttempt = 0,
  cachedAttempt = 0;
const selected = () => !panel.hidden && !document.getElementById('dual-progress').hidden;
const stopped = () => typeof scope !== 'undefined' && scope.signal.aborted;
const sourceFetch = (url, options = {}) =>
  url === WORMS_FEED
    ? readWormsTracker(
        document,
        window,
        options.signal,
        typeof scope !== 'undefined' ? scope.signal : null,
      )
    : fetch(url, options);
function readCache() {
  try {
    return JSON.parse(localStorage.getItem(storageKey));
  } catch {
    return null;
  }
}
function saveCache(value) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {}
}
function render() {
  const activeId = document.activeElement?.closest('[data-community-id]')?.dataset.communityId;
  const activeHref = document.activeElement?.getAttribute('href');
  const completed = grid.querySelector('[data-progress-completed]');
  const completedOpen = completed
    ? completed.dataset.forgeDisclosureOpen !== undefined
      ? completed.dataset.forgeDisclosureOpen === 'true'
      : completed.open
    : true;
  const summaryFocused = document.activeElement === completed?.querySelector('summary');
  window.ForgeMotion?.stabilize(grid);
  grid.innerHTML = renderCatalog(catalog, snapshot.projects, completedOpen);
  if (summaryFocused)
    grid.querySelector('[data-progress-completed] summary')?.focus({ preventScroll: true });
  if (activeId && activeHref)
    [...grid.querySelectorAll(`[data-community-id="${activeId}"] a`)]
      .find((a) => a.getAttribute('href') === activeHref)
      ?.focus({ preventScroll: true });
}
async function load() {
  const [projects, initial] = await Promise.all([
    fetch('data/community-projects.json').then((r) => {
      if (!r.ok) throw Error();
      return r.json();
    }),
    fetch('data/community-snapshot.json')
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .catch(() => ({ projects: {} })),
  ]);
  if (stopped()) return;
  catalog = projects;
  const cached = readCache();
  const validCache =
    cached?.schemaVersion === 2 &&
    cached.catalogKey === catalogKey(projects) &&
    cached.projects &&
    Number.isFinite(Date.parse(cached.attemptedAt));
  snapshot =
    validCache && Date.parse(cached.attemptedAt) > (Date.parse(initial.attemptedAt) || 0)
      ? cached
      : initial;
  cachedAttempt = validCache ? Date.parse(cached.attemptedAt) : 0;
  // Mark old bundled/cached measurements explicitly before the next request.
  for (const state of Object.values(snapshot.projects ?? {}))
    for (const field of [state.progress, state.activity, ...Object.values(state.related ?? {})])
      if (field && Date.now() - Date.parse(field.checkedAt) >= REFRESH_MS) field.stale = true;
  render();
}
async function update() {
  if (running || !selected() || document.hidden || Date.now() - lastAttempt < REFRESH_MS) return;
  lastAttempt = Date.now();
  running = (async () => {
    status.textContent = 'Checking project sources…';
    try {
      if (!catalog) await load();
      if (stopped()) return;
      // Reopening the section/page within an hour reuses the last browser check.
      // This avoids repeatedly consuming GitHub's public API allowance.
      if (Date.now() - cachedAttempt < REFRESH_MS) {
        lastAttempt = cachedAttempt;
        status.textContent = `Last source check ${new Date(cachedAttempt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · refreshes hourly`;
        return;
      }
      snapshot = await refreshProjects(catalog, snapshot.projects, sourceFetch);
      if (stopped()) return;
      cachedAttempt = Date.parse(snapshot.attemptedAt);
      saveCache(snapshot);
      render();
      const live = Object.values(snapshot.projects).filter(
        (p) => p.progress.checkedAt && !p.progress.stale,
      ).length;
      status.textContent = `Sources checked · ${live} of ${catalog.length} percentages refreshed · ${new Date(snapshot.attemptedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · refreshes hourly`;
    } catch {
      status.textContent =
        'Sources unavailable · showing the last saved data. Links remain available.';
    }
  })().finally(() => {
    running = null;
  });
  return running;
}
new MutationObserver(update).observe(document.getElementById('dual-progress'), {
  attributes: true,
  attributeFilter: ['hidden'],
  subtree: true,
});
document.addEventListener('visibilitychange', update);
window.addEventListener('online', () => {
  lastAttempt = 0;
  cachedAttempt = 0;
  update();
});
setInterval(update, 60000);
update();
