/* The clock and calendar follow the visitor's local Nintendo DS-style menu. */
(() => {
  const clock = document.querySelector('.ds-analog-clock');
  if (!clock) return;
  const time = document.getElementById('ds-system-time');
  const shortDate = document.getElementById('ds-system-short-date');
  const month = document.getElementById('ds-calendar-month');
  const days = document.getElementById('ds-calendar-days');
  const hero = document.querySelector('.ds-hero-content');
  const fitHeroGrid = () => {
    if (!hero) return;
    // Give the game card its own grid; the menu's width must not crop its cells.
    hero.style.minHeight = '0px';
    const step = hero.getBoundingClientRect().width / 16;
    const rows = Math.ceil(hero.getBoundingClientRect().height / step - 0.001);
    hero.style.setProperty('--ds-hero-step', step + 'px');
    hero.style.minHeight = rows * step + 'px';
  };
  const screenPixels = () => {
    const menuWidth = document.querySelector('.ds-authentic-menu').getBoundingClientRect().width;
    // Fit whole cells to the LCD bounds; rounding each tile crops the last row.
    const topStep = menuWidth / 16;
    document.documentElement.style.setProperty('--ds-grid-top-step', topStep + 'px');
    document.documentElement.style.setProperty('--ds-grid-bottom-step', topStep * 2 + 'px');
    document.documentElement.style.setProperty('--ds-native-unit', topStep / 16 + 'px');
    fitHeroGrid();
  };
  screenPixels();
  addEventListener('resize', screenPixels);
  document.fonts.ready.then(fitHeroGrid);
  let heroWidth = 0;
  let fitFrame = 0;
  if (hero)
    new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      if (width !== heroWidth) {
        heroWidth = width;
        cancelAnimationFrame(fitFrame);
        fitFrame = requestAnimationFrame(() => {
          fitFrame = 0;
          fitHeroGrid();
        });
      }
    }).observe(hero);
  let calendarKey = '';
  const two = (n) => String(n).padStart(2, '0');
  const refresh = () => {
    const now = new Date();
    time.textContent = two(now.getHours()) + ':' + two(now.getMinutes());
    shortDate.textContent = two(now.getMonth() + 1) + '/' + two(now.getDate());
    time.dateTime = two(now.getHours()) + ':' + two(now.getMinutes());
    shortDate.dateTime =
      now.getFullYear() + '-' + two(now.getMonth() + 1) + '-' + two(now.getDate());
    document.getElementById('ds-clock-hour').style.transform =
      'rotate(' + ((now.getHours() % 12) * 30 + now.getMinutes() / 2) + 'deg)';
    document.getElementById('ds-clock-minute').style.transform =
      'rotate(' + now.getMinutes() * 6 + 'deg)';
    document.getElementById('ds-clock-second').style.transform =
      'rotate(' + now.getSeconds() * 6 + 'deg)';
    if (calendarKey === shortDate.dateTime) return;
    calendarKey = shortDate.dateTime;
    month.textContent = two(now.getMonth() + 1) + ' / ' + now.getFullYear();
    month.dateTime = now.getFullYear() + '-' + two(now.getMonth() + 1);
    const offset = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
    const count = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const fragment = document.createDocumentFragment();
    for (let row = 0; row < Math.ceil((offset + count) / 7); row++) {
      const tr = document.createElement('tr');
      for (let col = 0; col < 7; col++) {
        const td = document.createElement('td');
        const day = row * 7 + col - offset + 1;
        if (day > 0 && day <= count) {
          td.textContent = day;
          if (day === now.getDate()) {
            td.className = 'today';
            td.setAttribute('aria-current', 'date');
          }
        }
        tr.append(td);
      }
      fragment.append(tr);
    }
    days.replaceChildren(fragment);
  };
  let timer;
  const visibility = () => {
    clearInterval(timer);
    if (!document.hidden) {
      refresh();
      timer = setInterval(refresh, 1000);
    }
  };
  document.addEventListener('visibilitychange', visibility);
  addEventListener('pageshow', visibility);
  addEventListener('pagehide', () => clearInterval(timer));
  visibility();
})();
