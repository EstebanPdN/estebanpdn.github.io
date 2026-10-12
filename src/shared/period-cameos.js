/* Brief, infrequent character cameos. Never run off screen or during reduced motion. */
(() => {
  const characters = [...document.querySelectorAll('[data-sprite-cameo]')];
  if (!characters.length) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const records = characters.map((element) => ({
    element,
    visible: false,
    timer: null,
    finish: null,
  }));
  const stop = (record) => {
    clearTimeout(record.timer);
    clearTimeout(record.finish);
    record.timer = record.finish = null;
    record.element.classList.remove('is-playing');
  };
  const allowed = (record) => record.visible && !document.hidden && !motion.matches;
  const schedule = (record, delay = 7500) => {
    if (!allowed(record) || record.timer !== null || record.finish !== null) return;
    record.timer = setTimeout(() => {
      record.timer = null;
      if (!allowed(record)) return;
      record.element.classList.add('is-playing');
      record.finish = setTimeout(() => {
        record.finish = null;
        record.element.classList.remove('is-playing');
        schedule(record, 42000);
      }, 4600);
    }, delay);
  };
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const record = records.find((item) => item.element === entry.target);
        record.visible = entry.isIntersecting;
        if (allowed(record)) schedule(record);
        else stop(record);
      }
    },
    { threshold: 0.1 },
  );
  records.forEach((record) => observer.observe(record.element));
  const refresh = () =>
    records.forEach((record) => {
      stop(record);
      if (allowed(record)) schedule(record);
    });
  document.addEventListener('visibilitychange', refresh);
  motion.addEventListener('change', refresh);
  window.addEventListener('pagehide', () => records.forEach(stop));
  window.addEventListener('pageshow', refresh);
})();
