// Set the saved theme before the page paints. No network or account is involved.
(() => {
  let stored;
  try {
    stored = localStorage.getItem('forge-theme');
  } catch {}
  if (!['light', 'dark'].includes(stored)) stored = null;
  const preference = window.matchMedia('(prefers-color-scheme: dark)');
  const root = document.documentElement;
  root.dataset.theme =
    stored === 'dark' || stored === 'light' ? stored : preference.matches ? 'dark' : 'light';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let requestedTheme = root.dataset.theme,
    worker = null,
    transition = null;
  document
    .querySelector('meta[name=theme-color]')
    ?.setAttribute('content', root.dataset.theme === 'dark' ? '#202022' : '#edf3f5');
  function updateButton() {
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    const dark = root.dataset.theme === 'dark';
    document
      .querySelector('meta[name=theme-color]')
      ?.setAttribute('content', dark ? '#202022' : '#edf3f5');
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    button.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
  }
  async function changeTheme() {
    try {
      while (root.dataset.theme !== requestedTheme) {
        const next = requestedTheme;
        const commit = () => {
          root.dataset.theme = next;
          updateButton();
        };
        if (reduced.matches || !document.startViewTransition) {
          commit();
          continue;
        }
        root.classList.add('forge-theme-changing');
        transition = document.startViewTransition(commit);
        await Promise.allSettled([transition.finished]);
        transition = null;
        root.classList.remove('forge-theme-changing');
      }
    } finally {
      root.classList.remove('forge-theme-changing');
    }
  }
  function requestTheme(theme) {
    requestedTheme = theme;
    if (!worker)
      worker = changeTheme().finally(() => {
        worker = null;
        if (root.dataset.theme !== requestedTheme) requestTheme(requestedTheme);
      });
  }
  function bindButton() {
    updateButton();
    const button = document.getElementById('theme-toggle');
    if (!button || button.dataset.themeBound) return;
    button.dataset.themeBound = 'true';
    button.addEventListener('click', () => {
      stored = requestedTheme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('forge-theme', stored);
      } catch {}
      requestTheme(stored);
    });
  }
  document.addEventListener('DOMContentLoaded', bindButton);
  document.addEventListener('forge:page-mounted', bindButton);
  preference.addEventListener?.('change', (event) => {
    if (!stored) requestTheme(event.matches ? 'dark' : 'light');
  });
  reduced.addEventListener('change', () => {
    if (reduced.matches) transition?.skipTransition();
  });
})();
