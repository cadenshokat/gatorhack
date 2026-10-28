// Waiting for the page to be drawn the same way every time: loaded, fonts in, and the images on the first screen
// decoded. Font and image timing then never reaches the engine's read of the page, nor the moment the page is shown.

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function waitLoad(): Promise<void> {
  if (document.readyState === 'complete') return Promise.resolve();
  return new Promise((resolve) => window.addEventListener('load', () => resolve(), { once: true }));
}

export async function waitFonts(): Promise<void> {
  try {
    await document.fonts?.ready;
  } catch {
    /* no font loading API */
  }
}

/** Decode every image that is on the first screen (lazy ones included: they load there anyway). */
export async function waitFirstScreenImages(): Promise<void> {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const imgs = Array.from(document.images).filter((img) => {
    const r = img.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
  });
  await Promise.all(imgs.map((img) => (typeof img.decode === 'function' ? img.decode().catch(() => undefined) : Promise.resolve())));
}

/** Load, fonts and first-screen images, capped. `capped` when the cap ran out first. */
export async function pageDrawn(capMs: number): Promise<{ capped: boolean }> {
  let capped = false;
  const all = (async () => {
    await waitLoad();
    await waitFonts();
    await waitFirstScreenImages();
    // Fonts that loaded with the images (a second round of @font-face) are in too.
    await waitFonts();
  })();
  await Promise.race([all, sleep(capMs).then(() => (capped = true))]);
  return { capped };
}

/** One frame painted after the given work (so "ready" means drawn, not only laid out). */
export function nextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}
