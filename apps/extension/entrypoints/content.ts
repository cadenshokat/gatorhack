// Owner: C1. The in-page entry: boots the engine, then mounts the in-page UI (pill, panel, Lens, Calm view).
import { createController } from '../src/engine/controller';
import { mountUi } from '../src/ui/mount';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  allFrames: false,
  main(ctx) {
    // Never on our own extension pages (fitting, popup) and only in the top frame.
    if (location.protocol === 'chrome-extension:' || location.href.startsWith(chrome.runtime.getURL(''))) return;
    if (window.top !== window) return;
    if (!document.documentElement || document.contentType && !/html|xml/i.test(document.contentType)) return;

    const engine = createController();
    // For the eval harness and debugging: visible to extension code in this isolated world only, never to the page.
    (globalThis as { __webableEngine?: typeof engine.api }).__webableEngine = engine.api;
    let unmount: (() => void) | null = null;
    try {
      unmount = mountUi(engine.api);
    } catch (err) {
      console.warn('[WebAble] the in-page UI could not mount', err);
    }
    void engine.start().catch((err: unknown) => console.warn('[WebAble] engine failed to start', err));

    ctx.onInvalidated(() => {
      engine.stop();
      try {
        unmount?.();
      } catch {
        /* already gone */
      }
    });
  },
});
