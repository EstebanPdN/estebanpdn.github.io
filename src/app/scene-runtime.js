// Page controllers keep their DOM and lifetime even when another scene is mounted.
const activeScopes = new Set();
const eventMethods = new WeakMap();

export function inspect() {
  return [...activeScopes].map((scope) => scope.inspect());
}

export function createSceneScope(body) {
  if (!body?.ownerDocument) throw new TypeError('A scene body is required');
  const owner = body.ownerDocument;
  const nativeWindow = owner.defaultView;
  const eventPrototype = nativeWindow.EventTarget.prototype;
  if (!eventMethods.has(eventPrototype))
    eventMethods.set(eventPrototype, {
      add: eventPrototype.addEventListener,
      remove: eventPrototype.removeEventListener,
    });
  const { add: nativeAdd, remove: nativeRemove } = eventMethods.get(eventPrototype);
  const controller = new nativeWindow.AbortController();
  const signal = controller.signal;
  const listeners = [],
    timeouts = new Set(),
    intervals = new Set(),
    frames = new Set();
  const observers = new Set(),
    requests = new Set(),
    transitions = new Set();
  const boundWindow = new Map(),
    boundDocument = new Map();
  let disposed = false,
    scopedDocument,
    scopedWindow,
    scope;

  function combineSignal(other) {
    if (!other || other === signal) return { signal, cleanup() {} };
    if (nativeWindow.AbortSignal.any)
      return { signal: nativeWindow.AbortSignal.any([signal, other]), cleanup() {} };
    const combined = new nativeWindow.AbortController();
    const abort = () => combined.abort(signal.aborted ? signal.reason : other.reason);
    if (signal.aborted || other.aborted) {
      abort();
      return { signal: combined.signal, cleanup() {} };
    }
    nativeAdd.call(signal, 'abort', abort, { once: true });
    nativeAdd.call(other, 'abort', abort, { once: true });
    return {
      signal: combined.signal,
      cleanup() {
        nativeRemove.call(signal, 'abort', abort);
        nativeRemove.call(other, 'abort', abort);
      },
    };
  }

  function listen(target, type, listener, options) {
    if (disposed || !listener) return;
    const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
    // Preserve the callback identity so native element.removeEventListener still works.
    const existing = listeners.find(
      (record) =>
        record.target === target &&
        record.type === type &&
        record.listener === listener &&
        record.capture === capture,
    );
    const joined = combineSignal(typeof options === 'object' ? options?.signal : null);
    if (joined.signal.aborted) {
      joined.cleanup();
      return;
    }
    const config = typeof options === 'boolean' ? { capture: options } : { ...options };
    nativeAdd.call(target, type, listener, { ...config, signal: joined.signal });
    // Native once/removal may already have consumed a registration; let native add
    // decide whether it is a duplicate while retaining every signal's cleanup.
    if (existing) existing.lifetimes.push(joined);
    else listeners.push({ target, type, listener, capture, lifetimes: [joined] });
  }
  function unlisten(target, type, listener, options) {
    const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
    nativeRemove.call(target, type, listener, capture);
    for (let index = listeners.length - 1; index >= 0; index--) {
      const record = listeners[index];
      if (
        record.target !== target ||
        record.type !== type ||
        record.listener !== listener ||
        record.capture !== capture
      )
        continue;
      record.lifetimes.forEach((lifetime) => lifetime.cleanup());
      listeners.splice(index, 1);
    }
  }

  function run(callback) {
    if (disposed) return;
    const previousAdd = eventPrototype.addEventListener;
    const previousRemove = eventPrototype.removeEventListener;
    eventPrototype.addEventListener = function (type, listener, options) {
      listen(this, type, listener, options);
    };
    eventPrototype.removeEventListener = function (type, listener, options) {
      unlisten(this, type, listener, options);
    };
    try {
      return callback(scope);
    } finally {
      eventPrototype.addEventListener = previousAdd;
      eventPrototype.removeEventListener = previousRemove;
    }
  }

  const setTimeout = (callback, delay, ...args) => {
    if (disposed) return 0;
    const id = nativeWindow.setTimeout(() => {
      timeouts.delete(id);
      if (!disposed) callback.apply(scopedWindow, args);
    }, delay);
    timeouts.add(id);
    return id;
  };
  const clearTimeout = (id) => {
    timeouts.delete(id);
    nativeWindow.clearTimeout(id);
  };
  const setInterval = (callback, delay, ...args) => {
    if (disposed) return 0;
    const id = nativeWindow.setInterval(() => {
      if (!disposed) callback.apply(scopedWindow, args);
    }, delay);
    intervals.add(id);
    return id;
  };
  const clearInterval = (id) => {
    intervals.delete(id);
    nativeWindow.clearInterval(id);
  };
  const requestAnimationFrame = (callback) => {
    if (disposed) return 0;
    const id = nativeWindow.requestAnimationFrame((time) => {
      frames.delete(id);
      if (!disposed) callback(time);
    });
    frames.add(id);
    return id;
  };
  const cancelAnimationFrame = (id) => {
    frames.delete(id);
    nativeWindow.cancelAnimationFrame(id);
  };
  const addEventListener = (type, listener, options) =>
    listen(nativeWindow, type, listener, options);
  const removeEventListener = (type, listener, options) =>
    unlisten(nativeWindow, type, listener, options);

  function matchMedia(query) {
    const media = nativeWindow.matchMedia(query);
    let onchange = null;
    return new Proxy(media, {
      get(target, key) {
        if (key === 'onchange') return onchange;
        if (key === 'addEventListener')
          return (type, listener, options) => listen(target, type, listener, options);
        if (key === 'removeEventListener')
          return (type, listener, options) => unlisten(target, type, listener, options);
        if (key === 'addListener') return (listener) => listen(target, 'change', listener);
        if (key === 'removeListener') return (listener) => unlisten(target, 'change', listener);
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
      set(target, key, value) {
        if (disposed) return true;
        // Keep legacy onchange assignments inside the same disposable listener lifetime.
        if (key === 'onchange') {
          if (onchange) unlisten(target, 'change', onchange);
          onchange = typeof value === 'function' ? value : null;
          if (onchange) listen(target, 'change', onchange);
          return true;
        }
        return Reflect.set(target, key, value, target);
      },
    });
  }

  function observerClass(NativeObserver) {
    if (!NativeObserver) return undefined;
    function ScopedObserver(callback, options) {
      let proxy;
      const observer = new NativeObserver((...args) => {
        if (!disposed) callback(args[0], proxy);
      }, options);
      proxy = new Proxy(observer, {
        get(target, key) {
          if (key === 'observe')
            return (...args) => {
              if (!disposed) {
                observers.add(proxy);
                return target.observe(...args);
              }
            };
          if (key === 'disconnect')
            return () => {
              observers.delete(proxy);
              target.disconnect();
            };
          const value = Reflect.get(target, key, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
      observers.add(proxy);
      if (disposed) proxy.disconnect();
      return proxy;
    }
    ScopedObserver.prototype = NativeObserver.prototype;
    return ScopedObserver;
  }
  const IntersectionObserver = observerClass(nativeWindow.IntersectionObserver);
  const ResizeObserver = observerClass(nativeWindow.ResizeObserver);
  const MutationObserver = observerClass(nativeWindow.MutationObserver);

  function fetch(input, options = {}) {
    const joined = combineSignal(options.signal || input?.signal);
    const token = {};
    const promise = nativeWindow.fetch(input, { ...options, signal: joined.signal });
    requests.add(token);
    const finished = () => {
      requests.delete(token);
      joined.cleanup();
    };
    promise.then(finished, finished);
    return promise;
  }

  // Async continuations may retain the old documentElement. Guard its shared writers.
  const guardedObjects = new WeakMap();
  function guardShared(target) {
    if (!target || typeof target !== 'object') return target;
    if (guardedObjects.has(target)) return guardedObjects.get(target);
    const proxy = new Proxy(target, {
      get(object, key) {
        const value = Reflect.get(object, key, object);
        if (['classList', 'style', 'dataset'].includes(key)) return guardShared(value);
        if (typeof value !== 'function') return value;
        return (...args) => {
          if (
            disposed &&
            /^(?:add|remove|replace|toggle|set|append|prepend|insert|before|after)/.test(
              String(key),
            )
          )
            return;
          return value.apply(object, args);
        };
      },
      set(object, key, value) {
        return disposed ? true : Reflect.set(object, key, value, object);
      },
      deleteProperty(object, key) {
        return disposed ? true : Reflect.deleteProperty(object, key);
      },
    });
    guardedObjects.set(target, proxy);
    return proxy;
  }
  const guardedRoot = guardShared(owner.documentElement);
  const escapeID = (value) =>
    nativeWindow.CSS?.escape
      ? nativeWindow.CSS.escape(String(value))
      : [...String(value)]
          .map((character) => `\\${character.codePointAt(0).toString(16)} `)
          .join('');
  const queries = {
    querySelector: (selector) => (body.matches(selector) ? body : body.querySelector(selector)),
    querySelectorAll: (selector) => {
      const descendants = body.querySelectorAll(selector);
      if (!body.matches(selector)) return descendants;
      const result = [body, ...descendants];
      result.item = (index) => result[index] ?? null;
      return result;
    },
    getElementById: (id) =>
      !String(id) ? null : body.id === String(id) ? body : body.querySelector(`#${escapeID(id)}`),
    getElementsByTagName: (name) => body.getElementsByTagName(name),
    getElementsByClassName: (name) => body.getElementsByClassName(name),
    getElementsByName: (name) =>
      [...body.querySelectorAll('[name]')].filter(
        (element) => element.getAttribute('name') === String(name),
      ),
    getAnimations: () => body.getAnimations({ subtree: true }),
    addEventListener: (type, listener, options) => listen(owner, type, listener, options),
    removeEventListener: (type, listener, options) => unlisten(owner, type, listener, options),
    dispatchEvent: (event) => (disposed ? true : owner.dispatchEvent(event)),
  };
  if (owner.startViewTransition)
    queries.startViewTransition = (update) => {
      if (disposed) return undefined;
      const callback = typeof update === 'function' ? update : update?.update;
      const guarded = () => (disposed ? undefined : callback?.());
      const transition = owner.startViewTransition(
        typeof update === 'function' ? guarded : { ...update, update: guarded },
      );
      transitions.add(transition);
      transition.finished.then(
        () => transitions.delete(transition),
        () => transitions.delete(transition),
      );
      return transition;
    };
  scopedDocument = new Proxy(owner, {
    get(target, key) {
      if (key === 'body') return body;
      if (key === 'documentElement') return guardedRoot;
      if (key === 'defaultView') return scopedWindow;
      if (key === 'images') return body.getElementsByTagName('img');
      if (key === 'activeElement')
        return body.contains(target.activeElement) ? target.activeElement : null;
      if (key in queries) return queries[key];
      const value = Reflect.get(target, key, target);
      if (typeof value !== 'function') return value;
      if (!boundDocument.has(key)) boundDocument.set(key, value.bind(target));
      return boundDocument.get(key);
    },
    set(target, key, value) {
      return disposed ? true : Reflect.set(target, key, value, target);
    },
  });
  const windowOverrides = {
    document: scopedDocument,
    addEventListener,
    removeEventListener,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame,
    cancelAnimationFrame,
    matchMedia,
    IntersectionObserver,
    ResizeObserver,
    MutationObserver,
    fetch,
  };
  scopedWindow = new Proxy(nativeWindow, {
    get(target, key) {
      if (key in windowOverrides) return windowOverrides[key];
      const value = Reflect.get(target, key, target);
      if (value === nativeWindow) return scopedWindow;
      // Constructors keep their prototype; native window methods need their Window receiver.
      if (typeof value !== 'function' || /^[A-Z]/.test(String(key))) return value;
      if (!boundWindow.has(key)) boundWindow.set(key, value.bind(target));
      return boundWindow.get(key);
    },
    set(target, key, value) {
      return disposed ? true : Reflect.set(target, key, value, target);
    },
    has(target, key) {
      return key in windowOverrides ? windowOverrides[key] !== undefined : Reflect.has(target, key);
    },
  });

  function dispose() {
    if (disposed) return;
    disposed = true;
    controller.abort();
    requests.clear();
    listeners.forEach((record) => {
      nativeRemove.call(record.target, record.type, record.listener, record.capture);
      record.lifetimes.forEach((lifetime) => lifetime.cleanup());
    });
    listeners.length = 0;
    timeouts.forEach((id) => nativeWindow.clearTimeout(id));
    timeouts.clear();
    intervals.forEach((id) => nativeWindow.clearInterval(id));
    intervals.clear();
    frames.forEach((id) => nativeWindow.cancelAnimationFrame(id));
    frames.clear();
    [...observers].forEach((observer) => observer.disconnect());
    observers.clear();
    transitions.forEach((transition) => transition.skipTransition());
    transitions.clear();
    body.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
    body.querySelectorAll('video,audio').forEach((media) => media.pause());
    activeScopes.delete(scope);
  }
  scope = {
    document: scopedDocument,
    window: scopedWindow,
    addEventListener,
    removeEventListener,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame,
    cancelAnimationFrame,
    matchMedia,
    IntersectionObserver,
    ResizeObserver,
    MutationObserver,
    fetch,
    signal,
    run,
    dispose,
    get disposed() {
      return disposed;
    },
    inspect: () => ({
      disposed,
      listeners: listeners.filter((record) =>
        record.lifetimes.some((lifetime) => !lifetime.signal.aborted),
      ).length,
      timeouts: timeouts.size,
      intervals: intervals.size,
      frames: frames.size,
      observers: observers.size,
      requests: requests.size,
      transitions: transitions.size,
    }),
  };
  activeScopes.add(scope);
  return scope;
}
