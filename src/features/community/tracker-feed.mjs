export const WORMS_FEED = 'https://worms-3d.estebanpdn.chatgpt.site/progress.json';
const trackerOrigin = new URL(WORMS_FEED).origin;

// The public tracker is static and does not send CORS headers. Read its small
// summary through an isolated, same-origin reader instead of loading remote JS.
export function readWormsTracker(document, window, requestSignal, sceneSignal) {
  return new Promise((resolve, reject) => {
    const signals = [requestSignal, sceneSignal].filter(Boolean);
    if (signals.some((signal) => signal.aborted)) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const nonce = window.crypto.randomUUID();
    const frame = document.createElement('iframe');
    frame.hidden = true;
    frame.title = 'Worms 3D public progress reader';
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    frame.referrerPolicy = 'no-referrer';
    let timeout,
      settled = false;
    function finish(error, data) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      window.removeEventListener('message', receive);
      frame.removeEventListener('load', request);
      frame.removeEventListener('error', failed);
      signals.forEach((signal) => signal.removeEventListener('abort', abort));
      frame.remove();
      if (error) reject(error);
      else resolve({ ok: true, json: async () => data });
    }
    function receive(event) {
      if (
        event.source !== frame.contentWindow ||
        event.origin !== trackerOrigin ||
        event.data?.nonce !== nonce ||
        event.data?.type !== 'forge-progress-response'
      )
        return;
      if (event.data.error) finish(new Error('Public tracker unavailable'));
      else finish(null, event.data.data);
    }
    function request() {
      frame.contentWindow.postMessage({ type: 'forge-progress-request', nonce }, trackerOrigin);
    }
    function abort() {
      finish(new DOMException('Aborted', 'AbortError'));
    }
    function failed() {
      finish(new Error('Public tracker unavailable'));
    }
    window.addEventListener('message', receive);
    frame.addEventListener('load', request);
    frame.addEventListener('error', failed);
    signals.forEach((signal) => signal.addEventListener('abort', abort, { once: true }));
    timeout = window.setTimeout(() => finish(new Error('Public tracker timed out')), 15000);
    frame.src = `${trackerOrigin}/forge-progress.html`;
    document.body.append(frame);
  });
}
