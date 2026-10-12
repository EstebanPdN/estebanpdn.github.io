// System controls belong to the permanent header, not to a disposable game scene.
(() => {
  let soundEnabled = false,
    soundMuted = false,
    audio,
    welcomeSound,
    entrySound,
    welcomePending = false,
    welcomeAttempt = 0;
  function syncSound() {
    document.querySelectorAll('.site-header .sound').forEach((button) => {
      button.setAttribute('aria-pressed', String(soundEnabled));
      button.setAttribute('aria-label', soundEnabled ? 'Disable sound' : 'Enable sound');
      button.title = soundEnabled ? 'Disable sound' : 'Enable sound';
    });
  }
  function stopWelcomeSound({ keepPending = false } = {}) {
    welcomeAttempt++;
    if (!keepPending) welcomePending = false;
    if (welcomeSound) {
      welcomeSound.pause();
      welcomeSound.currentTime = 0;
    }
  }
  function playWelcomeSound() {
    if (!welcomePending || soundMuted || document.hidden || !document.querySelector('#dual'))
      return;
    const attempt = ++welcomeAttempt;
    try {
      // Call play synchronously so the welcome button can satisfy browser activation.
      Promise.resolve(welcomeSound.play())
        .then(() => {
          if (attempt !== welcomeAttempt) return;
          welcomePending = false;
          soundEnabled = true;
          syncSound();
        })
        .catch(() => {});
    } catch {}
  }
  function beginWelcomeSound() {
    stopWelcomeSound();
    if (soundMuted) return;
    welcomeSound ??= new Audio(new URL('assets/audio/05-terminal.mp3', location.href).href);
    welcomeSound.preload = 'auto';
    welcomeSound.volume = 0.5;
    welcomePending = true;
    playWelcomeSound();
  }
  function playEntrySound() {
    stopWelcomeSound();
    if (soundMuted || document.hidden) return;
    entrySound ??= new Audio(new URL('assets/audio/forge-entry.mp3', location.href).href);
    entrySound.preload = 'auto';
    entrySound.currentTime = 0;
    entrySound.volume = 0.35;
    Promise.resolve(entrySound.play())
      .then(() => {
        soundEnabled = true;
        syncSound();
      })
      .catch(() => {});
  }
  function chime(frequency = 640) {
    if (!soundEnabled) return;
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      audio.resume();
      const oscillator = audio.createOscillator(),
        gain = audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.4, audio.currentTime + 0.06);
      gain.gain.setValueAtTime(0.028, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0008, audio.currentTime + 0.14);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.15);
    } catch {}
  }
  window.ForgeUI = { chime, beginWelcomeSound, playWelcomeSound, playEntrySound };
  const navigation = document.querySelector('.site-header .dual-navigation');
  function syncNavigation() {
    const selected = navigation?.querySelector('button[aria-pressed="true"]');
    if (!selected?.offsetWidth) return;
    navigation.style.setProperty('--nav-selection-left', selected.offsetLeft + 'px');
    navigation.style.setProperty('--nav-selection-width', selected.offsetWidth + 'px');
  }
  if (navigation) {
    new MutationObserver(syncNavigation).observe(navigation, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-pressed'],
    });
    if ('ResizeObserver' in window) new ResizeObserver(syncNavigation).observe(navigation);
    syncNavigation();
    requestAnimationFrame(() => navigation.classList.add('is-ready'));
  }
  function clock() {
    document.querySelectorAll('[data-clock]').forEach(
      (element) =>
        (element.textContent = new Intl.DateTimeFormat('en', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(new Date())),
    );
  }
  function sync() {
    clock();
    syncSound();
    if (!document.querySelector('#dual')) {
      stopWelcomeSound();
      entrySound?.pause();
    }
    const page =
      document.querySelector('#dual') && ['#progress', '#info'].includes(location.hash)
        ? location.hash.slice(1)
        : 'collection';
    document
      .querySelectorAll('.site-header [data-dual-page]')
      .forEach((button) =>
        button.setAttribute('aria-pressed', String(button.dataset.dualPage === page)),
      );
  }
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('.site-header button');
    if (!button) return;
    if (button.matches('.sound')) {
      soundEnabled = !soundEnabled;
      soundMuted = !soundEnabled;
      syncSound();
      if (soundMuted) {
        stopWelcomeSound();
        entrySound?.pause();
      } else if (welcomePending) playWelcomeSound();
      else chime();
    } else if (button.dataset.dualPage && !document.querySelector('#dual')) {
      document.dispatchEvent(
        new CustomEvent('forge:navigate', {
          detail: { url: new URL('index.html#' + button.dataset.dualPage, location.href).href },
        }),
      );
      chime();
    }
  });
  document.addEventListener('DOMContentLoaded', sync);
  document.addEventListener('forge:page-mounted', sync);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopWelcomeSound({ keepPending: true });
      entrySound?.pause();
    }
  });
  setInterval(clock, 60000);
})();
