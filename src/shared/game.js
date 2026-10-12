// The project pages are readable without JavaScript. This adds gallery navigation.
(() => {
  const thumbs = [...document.querySelectorAll('.gallery-thumb')];
  const stage = document.getElementById('gallery-image');
  if (!thumbs.length || !stage) return;
  const dialog = document.getElementById('gallery-lightbox');
  const title = document.getElementById('gallery-title');
  const caption = document.getElementById('gallery-caption');
  const counter = document.getElementById('gallery-current');
  const lightboxTitle = document.getElementById('lightbox-title');
  const lightboxImage = document.getElementById('lightbox-image');
  const lightboxCounter = document.getElementById('lightbox-counter');
  let current = Math.max(
    0,
    thumbs.findIndex((thumb) => thumb.getAttribute('aria-pressed') === 'true'),
  );
  let requestedIndex = current,
    request = 0;
  const ready = new Map();
  function decode(src) {
    if (ready.has(src)) return ready.get(src);
    const img = new Image();
    img.src = src;
    const promise = img.decode
      ? img.decode()
      : new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
    ready.set(src, promise);
    promise.catch(() => ready.delete(src));
    return promise;
  }
  function paint(svg, button) {
    return window.ForgeMotion.crossfadeSVG(svg, () => {
      const template = button.querySelector('svg');
      svg.setAttribute('viewBox', template.getAttribute('viewBox'));
      svg.setAttribute('aria-label', button.dataset.title);
      svg.replaceChildren(template.querySelector('image').cloneNode(true));
    });
  }
  async function select(index) {
    const selected = (index + thumbs.length) % thumbs.length;
    const button = thumbs[selected],
      id = ++request;
    requestedIndex = selected;
    try {
      await decode(button.querySelector('image').getAttribute('href'));
    } catch {
      if (id === request) requestedIndex = current;
      return;
    }
    await window.ForgeMotion.idle(stage);
    if (id !== request || !stage.isConnected || selected === current) return;
    current = selected;
    paint(stage, button);
    paint(lightboxImage, button);
    title.textContent = button.dataset.title;
    caption.textContent = button.dataset.caption;
    counter.textContent = String(current + 1).padStart(2, '0');
    lightboxTitle.textContent = button.dataset.title;
    lightboxCounter.textContent = `${current + 1} / ${thumbs.length} · Gallery preview`;
    thumbs.forEach((thumb, i) => thumb.setAttribute('aria-pressed', String(i === current)));
  }
  thumbs.forEach((button, index) => {
    button.addEventListener('click', () => select(index));
    button.addEventListener('keydown', (event) => {
      let target = index;
      if (event.key === 'ArrowRight') target = (index + 1) % thumbs.length;
      else if (event.key === 'ArrowLeft') target = (index - 1 + thumbs.length) % thumbs.length;
      else if (event.key === 'Home') target = 0;
      else if (event.key === 'End') target = thumbs.length - 1;
      else return;
      event.preventDefault();
      thumbs[target].focus();
      select(target);
    });
  });
  document.getElementById('gallery-open').addEventListener('click', () => {
    if (!dialog.open) window.ForgeMotion.showDialog(dialog);
  });
  const close = () => window.ForgeMotion.hideDialog(dialog);
  document.getElementById('lightbox-close').addEventListener('click', close);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  document
    .getElementById('lightbox-previous')
    .addEventListener('click', () => select(requestedIndex - 1));
  document
    .getElementById('lightbox-next')
    .addEventListener('click', () => select(requestedIndex + 1));
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      select(requestedIndex - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      select(requestedIndex + 1);
    }
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
      close();
  });
  // Native <dialog> supplies focus containment, Escape, and focus restoration.
  thumbs.forEach((button) =>
    decode(button.querySelector('image').getAttribute('href')).catch(() => {}),
  );
})();
