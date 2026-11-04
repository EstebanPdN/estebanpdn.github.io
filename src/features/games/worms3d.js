// The console's upper screen and the enlarged viewer share one decoded capture.
(() => {
  const buttons = [...document.querySelectorAll('[data-w3-scene]')];
  const upper = document.getElementById('w3-upper');
  const dialog = document.getElementById('w3-lightbox'),
    enlarged = document.getElementById('w3-lightbox-image');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0,
    request = 0,
    requested = 0;
  const imageURL = (button) => `assets/worms/captures/${button.dataset.w3Scene}.webp`;
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
      await decode(imageURL(button));
    } catch {
      return false;
    }
    await Promise.all([upper, enlarged].map((target) => window.ForgeMotion.idle(target)));
    if (id !== request || !upper.isConnected) return false;
    current = selected;
    const label = button.dataset.title + ', upper screen';
    const animations = [paint(upper, imageURL(button), label)];
    if (dialog.open) animations.push(paint(enlarged, imageURL(button), label));
    document.getElementById('w3-gallery-title').textContent = button.dataset.title;
    document.getElementById('w3-gallery-mode').textContent = button.dataset.mode;
    document.getElementById('w3-gallery-caption').textContent = button.dataset.caption;
    document.getElementById('w3-lightbox-title').textContent =
      button.dataset.title + ' / Upper screen';
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
    .querySelectorAll('[data-w3-step]')
    .forEach((button) =>
      button.addEventListener('click', () => select(requested + Number(button.dataset.w3Step))),
    );
  document.getElementById('w3-open').addEventListener('click', async () => {
    if (!(await select(requested))) return;
    enlarged.querySelector('image').setAttribute('href', imageURL(buttons[current]));
    enlarged.setAttribute('aria-label', buttons[current].dataset.title + ', upper screen');
    window.ForgeMotion.showDialog(dialog);
  });
  document
    .getElementById('w3-lightbox-close')
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
