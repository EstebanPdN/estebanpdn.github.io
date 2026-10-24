import assert from 'node:assert/strict';
import { readWormsTracker } from '../src/features/community/tracker-feed.mjs';

const origin = 'https://worms-3d.estebanpdn.chatgpt.site';
function setup() {
  const frame = new EventTarget(),
    window = new EventTarget();
  let request,
    removed = false;
  Object.assign(frame, {
    setAttribute() {},
    remove() {
      removed = true;
    },
    contentWindow: {
      postMessage(data, target) {
        request = { data, target };
      },
    },
  });
  Object.assign(window, {
    crypto: { randomUUID: () => '12345678-1234-1234-1234-123456789abc' },
    setTimeout,
    clearTimeout,
  });
  const document = {
    createElement: () => frame,
    body: {
      append() {
        frame.dispatchEvent(new Event('load'));
      },
    },
  };
  const message = (changes = {}) =>
    window.dispatchEvent(
      Object.assign(new Event('message'), {
        origin,
        source: frame.contentWindow,
        data: { type: 'forge-progress-response', nonce: request.data.nonce, data: { schema: 1 } },
        ...changes,
      }),
    );
  return {
    frame,
    window,
    document,
    message,
    get removed() {
      return removed;
    },
    get request() {
      return request;
    },
  };
}
{
  const s = setup();
  let complete = false;
  const result = readWormsTracker(s.document, s.window).then((response) => {
    complete = true;
    return response;
  });
  assert.equal(s.request.target, origin);
  assert.equal(s.frame.src, `${origin}/forge-progress.html`);
  for (const bad of [
    { origin: 'https://example.com' },
    { source: {} },
    { data: { type: 'forge-progress-response', nonce: 'wrong' } },
  ])
    s.message(bad);
  await Promise.resolve();
  assert.equal(complete, false, 'Ignore spoofed origins, windows and nonces');
  s.message();
  const response = await result;
  assert.deepEqual(await response.json(), { schema: 1 });
  assert.equal(s.removed, true, 'Remove the iframe after success');
}
{
  const s = setup(),
    controller = new AbortController();
  const result = readWormsTracker(s.document, s.window, null, controller.signal);
  controller.abort();
  await assert.rejects(result, { name: 'AbortError' });
  assert.equal(s.removed, true, 'Unmounting a scene removes the pending iframe');
}
{
  const s = setup();
  const result = readWormsTracker(s.document, s.window);
  s.message({
    data: { type: 'forge-progress-response', nonce: s.request.data.nonce, error: 'Unavailable' },
  });
  await assert.rejects(result, /Public tracker unavailable/);
  assert.equal(s.removed, true);
}
console.log('Public tracker origin, nonce, cleanup and failure checks passed.');
