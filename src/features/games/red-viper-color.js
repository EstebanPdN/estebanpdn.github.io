// One scene owns the upper capture and lower menu; decoded assets commit together.
(() => {
  const space = document.querySelector('.vb-space'),
    hero = document.querySelector('.vb-hero');
  let backgroundFrame = 0;
  function shadeBackground() {
    backgroundFrame = 0;
    if (!space.isConnected) return;
    const depth = Math.min(1, Math.max(0, window.scrollY) / (hero.offsetHeight * 0.95));
    space.style.setProperty('--vb-depth', String(0.16 + depth * 0.66));
  }
  window.addEventListener(
    'scroll',
    () => {
      if (!backgroundFrame) backgroundFrame = requestAnimationFrame(shadeBackground);
    },
    { passive: true },
  );
  window.addEventListener('resize', shadeBackground);
  shadeBackground();
  const buttons = [...document.querySelectorAll('[data-vb-scene]')];
  const left = document.getElementById('vb-left-image'),
    right = document.getElementById('vb-right-image');
  const dialog = document.getElementById('vb-lightbox'),
    enlarged = document.getElementById('vb-lightbox-image');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0,
    request = 0,
    requested = 0,
    eye = 'left';
  const imageURL = (button, side) =>
    side === 'right'
      ? button.dataset.vbScene === 'new-menu'
        ? 'assets/red-viper/new-home-menu.png'
        : 'assets/red-viper/new-menu.png'
      : `assets/red-viper/captures/${button.dataset.vbScene}-${button.dataset.vbScene === 'new-menu' ? 'left' : 'screen'}.webp`;
  const decode = (src) => {
    const image = new Image();
    image.src = src;
    return image.decode();
  };
  function paint(target, src, title) {
    return window.ForgeMotion.crossfadeSVG(target, () => {
      target.querySelector('image').setAttribute('href', src);
      target.setAttribute('aria-label', title);
    });
  }
  async function select(index, focus = false) {
    requested = (index + buttons.length) % buttons.length;
    const selected = requested,
      button = buttons[selected],
      id = ++request;
    if (focus) button.focus();
    try {
      await Promise.all(['left', 'right'].map((side) => decode(imageURL(button, side))));
    } catch {
      return false;
    }
    await Promise.all([left, right, enlarged].map((target) => window.ForgeMotion.idle(target)));
    if (id !== request || !left.isConnected) return false;
    current = selected;
    const animations = [
      paint(left, imageURL(button, 'left'), button.dataset.title + ', upper screen'),
      paint(right, imageURL(button, 'right'), button.dataset.title + ', new menu preview'),
    ];
    if (dialog.open)
      animations.push(
        paint(enlarged, imageURL(button, eye), button.dataset.title + ', upper screen'),
      );
    document.getElementById('vb-gallery-title').textContent = button.dataset.title;
    document.getElementById('vb-gallery-mode').textContent = button.dataset.mode.toUpperCase();
    document.getElementById('vb-gallery-caption').textContent = button.dataset.caption;
    document.getElementById('vb-lightbox-title').textContent =
      button.dataset.title + ' / UPPER SCREEN';
    buttons.forEach((item, i) => item.setAttribute('aria-pressed', String(i === current)));
    const rail = button.parentElement,
      a = rail.getBoundingClientRect(),
      b = button.getBoundingClientRect();
    if (b.left < a.left || b.right > a.right)
      rail.scrollBy({
        left: b.left < a.left ? b.left - a.left : b.right - a.right,
        behavior: reduced.matches ? 'instant' : 'smooth',
      });
    await Promise.all(animations);
    return id === request;
  }
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => select(index));
    button.addEventListener('keydown', (event) => {
      const next = {
        ArrowLeft: index - 1,
        ArrowRight: index + 1,
        Home: 0,
        End: buttons.length - 1,
      }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      select(next, true);
    });
  });
  document
    .querySelectorAll('[data-vb-step]')
    .forEach((button) =>
      button.addEventListener('click', () => select(requested + Number(button.dataset.vbStep))),
    );
  document.querySelectorAll('[data-vb-open]').forEach((button) =>
    button.addEventListener('click', async () => {
      eye = button.dataset.vbOpen;
      if (!(await select(requested))) return;
      enlarged.querySelector('image').setAttribute('href', imageURL(buttons[current], eye));
      enlarged.setAttribute('aria-label', buttons[current].dataset.title + ', ' + eye + ' eye');
      window.ForgeMotion.showDialog(dialog);
    }),
  );
  document
    .getElementById('vb-lightbox-close')
    .addEventListener('click', () => window.ForgeMotion.hideDialog(dialog));
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    window.ForgeMotion.hideDialog(dialog);
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    )
      window.ForgeMotion.hideDialog(dialog);
  });
  dialog.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    select(requested + (event.key === 'ArrowRight' ? 1 : -1));
  });
})();
