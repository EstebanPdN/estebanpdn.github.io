const chime = (...args) => window.ForgeUI?.chime(...args);
document.querySelectorAll('#dual [data-project]').forEach((button) =>
  button.addEventListener('click', () => {
    document.getElementById('announcement').textContent = button.dataset.project + ' selected';
    chime(780);
  }),
);
