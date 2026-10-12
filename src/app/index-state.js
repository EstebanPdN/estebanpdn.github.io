visiblePage = requestedPage = ['#progress', '#info'].includes(location.hash)
  ? location.hash.slice(1)
  : 'collection';
document.getElementById('dual-collection').hidden = visiblePage !== 'collection';
document.getElementById('dual-progress').hidden = visiblePage !== 'progress';
document.getElementById('dual-info').hidden = visiblePage !== 'info';
rootBackdrop.style.opacity = visiblePage === 'collection' ? '1' : '0';
document
  .querySelectorAll('[data-dual-page]')
  .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.dualPage === visiblePage)));
if (saved.game) showConsoleProject(saved.game, { animate: false });
if (saved.filter) {
  visibleFilter = requestedFilter = saved.filter;
  document.getElementById('progress-ports').hidden = visibleFilter !== 'ports';
  document.getElementById('progress-community').hidden = visibleFilter !== 'community';
  dual
    .querySelectorAll('[data-progress-filter]')
    .forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.progressFilter === visibleFilter)),
    );
  document.getElementById('progress-context').textContent =
    visibleFilter === 'community'
      ? 'Live progress from the teams behind the games, with links to their code and PC projects.'
      : 'My work adapting games to Nintendo 3DS.';
}
