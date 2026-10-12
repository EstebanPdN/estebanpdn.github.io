// One lifetime for each interaction: prepare first, then dissolve complete surfaces.
(() => {
  if (window.ForgeMotion) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Map();
  const easing = 'cubic-bezier(.32,0,.24,1)';
  const wait = (animations) =>
    Promise.allSettled(animations.map((animation) => animation.finished));
  const visible = (element) => element?.isConnected && element.getBoundingClientRect().width > 0;
  function idle(element) {
    return active.get(element)?.finished || Promise.resolve();
  }
  function finish(element) {
    active.get(element)?.finish();
  }
  function stabilize(root = document.body) {
    [...active].forEach(([element, state]) => {
      if (root === element || root.contains(element)) state.finish();
    });
    root.querySelectorAll('[data-forge-disclosure-open]').forEach((details) => {
      details.getAnimations().forEach((animation) => animation.cancel());
      details.open = details.dataset.forgeDisclosureOpen === 'true';
      details.style.height = '';
      details.style.overflow = '';
      delete details.dataset.forgeDisclosureOpen;
    });
  }
  function crossfadeSVG(element, update, duration = 420) {
    finish(element);
    if (reduced.matches || !visible(element)) {
      update();
      return Promise.resolve();
    }
    const previous = element.cloneNode(true);
    update();
    const incoming = element.cloneNode(true);
    const finalBox = element.getAttribute('viewBox'),
      finalAspect = element.getAttribute('preserveAspectRatio');
    const bounds = element.getBoundingClientRect();
    // Each image owns its crop within a stable viewport, including differently sized artwork.
    [previous, incoming].forEach((layer, index) => {
      layer.removeAttribute('id');
      layer.removeAttribute('class');
      layer.removeAttribute('style');
      layer.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
      layer.setAttribute('aria-hidden', 'true');
      layer.setAttribute('focusable', 'false');
      layer.setAttribute('data-forge-motion-layer', index ? 'incoming' : 'previous');
      layer.setAttribute('x', '0');
      layer.setAttribute('y', '0');
      layer.setAttribute('width', bounds.width);
      layer.setAttribute('height', bounds.height);
    });
    element.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    element.setAttribute('preserveAspectRatio', 'none');
    element.replaceChildren(previous, incoming);
    const animation = incoming.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration,
      easing,
      fill: 'both',
    });
    let resolve,
      done = false;
    const finished = new Promise((complete) => {
      resolve = complete;
    });
    const state = {
      finished,
      finish() {
        if (done) return;
        done = true;
        animation.cancel();
        element.replaceChildren(...incoming.childNodes);
        element.setAttribute('viewBox', finalBox);
        if (finalAspect === null) element.removeAttribute('preserveAspectRatio');
        else element.setAttribute('preserveAspectRatio', finalAspect);
        if (active.get(element) === state) active.delete(element);
        resolve();
      },
    };
    active.set(element, state);
    animation.finished.then(state.finish, state.finish);
    return finished;
  }
  // A single worker keeps rapid tab requests from stacking or painting stale content.
  function change(key, outgoing, commit, incoming = () => outgoing) {
    const existing = active.get(key);
    const request = { outgoing: outgoing.filter(Boolean), commit, incoming };
    if (existing?.kind === 'change') {
      existing.pending = request;
      return existing.finished;
    }
    finish(key);
    if (reduced.matches || !visible(key)) {
      commit();
      return Promise.resolve();
    }
    let resolve,
      done = false;
    const finished = new Promise((complete) => {
      resolve = complete;
    });
    const state = {
      kind: 'change',
      finished,
      pending: request,
      animations: [],
      current: null,
      committed: false,
      finish() {
        if (done) return;
        done = true;
        state.animations.forEach((animation) => animation.cancel());
        if (state.pending) state.pending.commit();
        else if (!state.committed) state.current?.commit();
        if (active.get(key) === state) active.delete(key);
        resolve();
      },
    };
    active.set(key, state);
    (async () => {
      while (state.pending && !done) {
        state.current = state.pending;
        state.pending = null;
        state.committed = false;
        state.animations = state.current.outgoing.filter(visible).map((element) =>
          element.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 150,
            easing: 'ease-in-out',
            fill: 'forwards',
          }),
        );
        await wait(state.animations);
        if (done) return;
        if (state.pending) {
          state.current = state.pending;
          state.pending = null;
        }
        state.current.commit();
        state.committed = true;
        state.animations.forEach((animation) => animation.cancel());
        state.animations = state.current
          .incoming()
          .filter(visible)
          .map((element) =>
            element.animate([{ opacity: 0 }, { opacity: 1 }], {
              duration: 290,
              easing,
              fill: 'both',
            }),
          );
        await wait(state.animations);
        if (done) return;
        state.animations.forEach((animation) => animation.cancel());
      }
      state.finish();
    })().catch(state.finish);
    return finished;
  }
  function dialogMotion(dialog, opening) {
    const opacity = dialog.open ? getComputedStyle(dialog).opacity : '0';
    finish(dialog);
    if (opening && !dialog.open) dialog.showModal();
    if (!opening && !dialog.open) return Promise.resolve();
    if (reduced.matches) {
      if (!opening) dialog.close();
      return Promise.resolve();
    }
    dialog.dataset.forgeDialogPhase = opening ? 'opening' : 'closing';
    const animation = dialog.animate(
      [{ opacity: opening ? 0 : Number(opacity) }, { opacity: opening ? 1 : 0 }],
      { duration: opening ? 340 : 300, easing, fill: 'both' },
    );
    let resolve,
      done = false;
    const finished = new Promise((complete) => {
      resolve = complete;
    });
    const state = {
      finished,
      finish() {
        if (done) return;
        done = true;
        animation.cancel();
        delete dialog.dataset.forgeDialogPhase;
        if (!opening && dialog.open) dialog.close();
        if (active.get(dialog) === state) active.delete(dialog);
        resolve();
      },
    };
    active.set(dialog, state);
    animation.finished.then(state.finish, state.finish);
    return finished;
  }
  function crossfadePanels(key, outgoing, commit, incoming) {
    finish(key);
    if (reduced.matches || !visible(key) || !outgoing) {
      commit();
      return Promise.resolve();
    }
    const previous = outgoing.cloneNode(true);
    previous.removeAttribute('id');
    previous.removeAttribute('aria-labelledby');
    previous.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
    previous.hidden = false;
    previous.inert = true;
    previous.setAttribute('aria-hidden', 'true');
    previous.setAttribute('data-forge-motion-layer', 'previous-panel');
    previous.style.pointerEvents = 'none';
    commit();
    key.append(previous);
    const animations = [
      previous.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing, fill: 'both' }),
      incoming.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing, fill: 'both' }),
    ];
    let resolve,
      done = false;
    const finished = new Promise((complete) => {
      resolve = complete;
    });
    const state = {
      finished,
      finish() {
        if (done) return;
        done = true;
        animations.forEach((animation) => animation.cancel());
        previous.remove();
        if (active.get(key) === state) active.delete(key);
        resolve();
      },
    };
    active.set(key, state);
    wait(animations).then(state.finish, state.finish);
    return finished;
  }
  reduced.addEventListener('change', () => {
    if (reduced.matches) [...active.values()].forEach((state) => state.finish());
  });
  // Text changes overlap in one fixed surface; the frame never disappears between modes.
  function replaceText(element, commit, duration = 320) {
    finish(element);
    if (reduced.matches || !visible(element)) {
      commit();
      return Promise.resolve();
    }
    const previous = element.cloneNode(true);
    previous.removeAttribute('id');
    previous.removeAttribute('aria-live');
    previous.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
    previous.setAttribute('aria-hidden', 'true');
    previous.setAttribute('data-forge-motion-layer', 'previous-text');
    Object.assign(previous.style, {
      position: 'absolute',
      inset: '0',
      margin: '0',
      pointerEvents: 'none',
    });
    commit();
    const incoming = document.createElement('div');
    incoming.setAttribute('data-forge-motion-layer', 'incoming-text');
    incoming.append(...element.childNodes);
    element.append(previous, incoming);
    const animations = [
      previous.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing, fill: 'both' }),
      incoming.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing, fill: 'both' }),
    ];
    let resolve,
      done = false;
    const finished = new Promise((complete) => {
      resolve = complete;
    });
    const state = {
      finished,
      finish() {
        if (done) return;
        done = true;
        animations.forEach((a) => a.cancel());
        previous.remove();
        incoming.replaceWith(...incoming.childNodes);
        if (active.get(element) === state) active.delete(element);
        resolve();
      },
    };
    active.set(element, state);
    wait(animations).then(state.finish, state.finish);
    return finished;
  }
  function toggleDisclosure(details, open) {
    const from = details.getBoundingClientRect().height;
    finish(details);
    const content = details.querySelector('.progress-grid');
    if (reduced.matches || !visible(details)) {
      details.open = open;
      if (content) content.inert = !open;
      return;
    }
    details.open = true;
    details.dataset.forgeDisclosureOpen = String(open);
    if (content) content.inert = !open;
    const style = getComputedStyle(details);
    const frame = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce(
      (sum, property) => sum + (parseFloat(style[property]) || 0),
      0,
    );
    const to = open
      ? details.getBoundingClientRect().height
      : details.querySelector('summary').getBoundingClientRect().height + frame;
    details.style.overflow = 'hidden';
    const animation = details.animate([{ height: `${from}px` }, { height: `${to}px` }], {
      duration: 360,
      easing,
      fill: 'both',
    });
    let resolve,
      done = false;
    const finished = new Promise((complete) => {
      resolve = complete;
    });
    const state = {
      finished,
      finish() {
        if (done) return;
        done = true;
        animation.cancel();
        details.open = open;
        details.style.height = '';
        details.style.overflow = '';
        delete details.dataset.forgeDisclosureOpen;
        if (active.get(details) === state) active.delete(details);
        resolve();
      },
    };
    active.set(details, state);
    animation.finished.then(state.finish, state.finish);
  }
  window.ForgeMotion = {
    crossfadeSVG,
    crossfadePanels,
    replaceText,
    change,
    toggleDisclosure,
    idle,
    stabilize,
    showDialog: (dialog) => dialogMotion(dialog, true),
    hideDialog: (dialog) => dialogMotion(dialog, false),
  };
})();
