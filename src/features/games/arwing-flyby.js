// Saved, inactive prototype. The page does not load this script.
// A 52-triangle SNES Arwing. Draw only during a visible, occasional fly-by.
(() => {
  const section = document.querySelector('#mission');
  const canvas = section?.querySelector('.arwing-flyby');
  const context = canvas?.getContext('2d');
  const wingman = section?.querySelector('.arwing-wingman');
  const wingContext = wingman?.getContext('2d');
  const sky = section?.querySelector('.arwing-sky');
  if (!context || !wingContext || !('IntersectionObserver' in window)) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const REST = 40000;
  let mesh,
    loading,
    timer,
    frame,
    inView = false,
    flown = false;
  let variants = [],
    previous = -1;
  function nextVariant() {
    if (!variants.length) {
      variants = [0, 1, 2];
      for (let i = variants.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [variants[i], variants[j]] = [variants[j], variants[i]];
      }
      if (variants[0] === previous) [variants[0], variants[1]] = [variants[1], variants[0]];
    }
    previous = variants.shift();
    return previous;
  }
  const eligible = () => inView && !document.hidden && !reduced.matches;

  function cancel() {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    timer = frame = null;
    canvas.hidden = wingman.hidden = true;
    sky.dataset.flight = 'rest';
  }
  async function load() {
    if (!loading)
      loading = fetch('assets/starfox/arwing.json')
        .then((response) => {
          if (!response.ok) throw new Error('Arwing unavailable');
          return response.json();
        })
        .then((value) => {
          mesh = value;
        })
        .catch(() => {});
    await loading;
  }
  function schedule() {
    cancel();
    if (!eligible()) return;
    load();
    timer = setTimeout(fly, flown ? REST : 6000);
  }
  function draw(context, progress, size, variant, follower = false) {
    context.clearRect(0, 0, size, size);
    const roll = Math.max(0, Math.min(1, (progress - 0.18) / 0.6));
    const smoothRoll = roll * roll * (3 - 2 * roll);
    const bank =
      variant === 1
        ? smoothRoll * Math.PI * 2 - 0.16
        : -0.22 + Math.sin(progress * Math.PI * 2 + (follower ? 0.55 : 0)) * 0.38;
    const pitch = 0.48;
    const heading = Math.PI / 2 - 0.12;
    const cb = Math.cos(bank),
      sb = Math.sin(bank);
    const cp = Math.cos(pitch),
      sp = Math.sin(pitch);
    const ch = Math.cos(heading),
      sh = Math.sin(heading);
    const scale = size / 7.6;
    const vertices = mesh.vertices.map(([x, y, z]) => {
      const bx = x * cb + z * sb,
        bz = -x * sb + z * cb;
      const py = y * cp - bz * sp,
        pz = y * sp + bz * cp;
      const px = bx * ch - py * sh,
        sy = bx * sh + py * ch;
      const perspective = 12 / (12 - pz);
      return [size / 2 + px * scale * perspective, size / 2 + sy * scale * perspective, pz];
    });
    const triangles = mesh.faces.map((face) => ({
      face,
      depth: face.slice(0, 3).reduce((sum, i) => sum + vertices[i][2], 0),
    }));
    triangles.sort((a, b) => a.depth - b.depth);
    for (const {
      face: [a, b, c, material],
    } of triangles) {
      context.beginPath();
      context.moveTo(vertices[a][0], vertices[a][1]);
      context.lineTo(vertices[b][0], vertices[b][1]);
      context.lineTo(vertices[c][0], vertices[c][1]);
      context.closePath();
      context.fillStyle = `rgb(${mesh.colors[material].join(',')})`;
      context.fill();
      // Seal subpixel seams between adjacent flat-shaded triangles.
      context.strokeStyle = context.fillStyle;
      context.lineWidth = 0.45;
      context.stroke();
    }
  }
  async function fly() {
    timer = null;
    await load();
    if (!eligible() || !mesh) return;
    const box = section.getBoundingClientRect();
    const variant = nextVariant();
    const size = box.width > 760 ? 180 : 125;
    // Clear space below the briefing lets the whole pass remain visible.
    const lane = box.height - (box.width > 760 ? 67 : 54);
    const ratio = Math.min(devicePixelRatio || 1, 2);
    for (const [surface, ctx] of [
      [canvas, context],
      [wingman, wingContext],
    ]) {
      surface.width = surface.height = Math.round(size * ratio);
      surface.style.width = surface.style.height = `${size}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    const offset = variant === 2 ? size * 0.9 : 0;
    const travel = box.width + size * 2 + offset;
    const duration = Math.max(1800, (travel / 560) * 1000);
    const started = performance.now();
    flown = true;
    canvas.hidden = false;
    wingman.hidden = variant !== 2;
    sky.dataset.flight = ['cruise', 'barrel-roll', 'formation'][variant];
    function tick(now) {
      if (!eligible()) {
        cancel();
        return;
      }
      const p = Math.min((now - started) / duration, 1);
      const x = -size + travel * p;
      const y = lane - size / 2 - Math.sin(p * Math.PI) * 12;
      const depth = 0.86 + Math.sin(p * Math.PI) * 0.14;
      canvas.style.transform = `translate3d(${x}px,${y}px,0) scale(${depth})`;
      canvas.style.opacity = String(Math.min(1, p / 0.08, (1 - p) / 0.12) * 0.88);
      draw(context, p, size, variant);
      if (variant === 2) {
        wingman.style.transform = `translate3d(${x - offset}px,${y + 22}px,0) scale(${depth * 0.72})`;
        wingman.style.opacity = canvas.style.opacity;
        draw(wingContext, p, size, variant, true);
      }
      if (p < 1) frame = requestAnimationFrame(tick);
      else {
        canvas.hidden = wingman.hidden = true;
        sky.dataset.flight = 'rest';
        frame = null;
        timer = setTimeout(fly, REST);
      }
    }
    frame = requestAnimationFrame(tick);
  }
  const observer = new IntersectionObserver(
    ([entry]) => {
      const visible = entry.isIntersecting && entry.intersectionRatio >= 0.2;
      if (visible !== inView) {
        inView = visible;
        schedule();
      }
    },
    { threshold: [0, 0.2] },
  );
  observer.observe(section);
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', schedule);
  window.addEventListener('pagehide', cancel);
  window.addEventListener('pageshow', schedule);
})();
