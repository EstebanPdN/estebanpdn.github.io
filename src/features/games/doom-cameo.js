// A small, occasional NES cameo on the setup window. No animation offscreen.
(() => {
  const actor = document.querySelector('.setup-link');
  const installer = document.getElementById('install');
  if (!actor || !installer) return;
  const header = installer.querySelector('.win-titlebar');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false,
    timer = 0,
    raf = 0,
    resizing = 0;
  const ease = (p) => p * p * (3 - 2 * p);
  function stop() {
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    actor.hidden = true;
    actor.dataset.phase = 'idle';
  }
  function allowed() {
    return visible && !document.hidden && !reduced.matches;
  }
  function schedule(delay = 650) {
    stop();
    if (allowed()) timer = setTimeout(play, delay);
  }
  function play() {
    if (!allowed()) return;
    const start = performance.now();
    // Integer pixels and 2× native sprites avoid soft edges and half-pixel drift.
    const distance = Math.max(0, Math.floor((installer.clientWidth - 92) / 2) * 2);
    // Constant 80 CSS pixels/second; wider windows simply take longer.
    const walkDuration = distance / 0.08;
    const walkEnd = 2000 + walkDuration;
    const attackEnd = walkEnd + 650;
    const turnEnd = attackEnd + 450;
    const raiseEnd = turnEnd + 400;
    const duration = raiseEnd + 2000;

    actor.hidden = false;
    function tick(now) {
      if (!allowed()) {
        stop();
        return;
      }
      const t = now - start;
      let frame = 0,
        x = 0,
        opacity = 1,
        top = 0,
        bottom = 0,
        phase = 'arrive';
      if (t < 2000) {
        const p = ease(t / 2000);
        opacity = p;
        top = Math.floor((1 - p) * 36) * 2;
      } else if (t < walkEnd) {
        phase = 'walk';
        frame = 1 + (Math.floor((t - 2000) / 140) % 2);
        x = Math.round((distance * (t - 2000)) / walkDuration / 2) * 2;
      } else if (t < attackEnd) {
        phase = 'attack';
        x = distance;
        frame = [3, 4, 4, 5, 6][Math.min(4, Math.floor((t - walkEnd) / 130))];
      } else if (t < turnEnd) {
        phase = 'turn';
        x = distance;
        frame = t < attackEnd + 130 ? 8 : 7;
      } else if (t < raiseEnd) {
        phase = 'raise';
        x = distance;
        frame = 0;
      } else if (t < duration) {
        phase = 'depart';
        x = distance;
        frame = 0;
        const p = ease((t - raiseEnd) / 2000);
        opacity = 1 - p;
        bottom = Math.floor(p * 36) * 2;
      } else {
        actor.hidden = true;
        actor.dataset.phase = 'idle';
        // Rest after the complete sequence, independent of the walking distance.
        timer = setTimeout(play, 8000 + Math.random() * 4000);
        return;
      }
      actor.dataset.phase = phase;
      actor.style.transform = `translateX(${x}px)`;
      actor.style.backgroundPosition = `${-frame * 80}px 0`;
      actor.style.opacity = String(opacity);
      actor.style.clipPath = `inset(${top}px 0 ${bottom}px 0)`;
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  }
  const observer = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting && entries[0].intersectionRatio >= 0.5;
      schedule();
    },
    { threshold: [0, 0.5, 1], rootMargin: '-80px 0px -30px 0px' },
  );
  observer.observe(header);
  document.addEventListener('visibilitychange', () => schedule());
  reduced.addEventListener('change', () => schedule());
  window.addEventListener(
    'resize',
    () => {
      stop();
      clearTimeout(resizing);
      resizing = setTimeout(() => schedule(), 180);
    },
    { passive: true },
  );
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', () => schedule());
})();
