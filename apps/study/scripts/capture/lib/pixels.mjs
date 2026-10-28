// Pixel comparison of two PNG screenshots in a browser canvas (no extra dependencies). A pixel differs when any
// channel differs by more than `threshold` (0-255). Writes a diff image: differing pixels red, the rest greyed.

import { readFileSync, writeFileSync } from 'node:fs';

export async function diffPng(browser, aPath, bPath, outPath, threshold = 24) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 400 } });
  const page = await ctx.newPage();
  await page.setContent('<body></body>');
  const A = readFileSync(aPath).toString('base64');
  const B = readFileSync(bPath).toString('base64');
  const r = await page.evaluate(
    async ({ A, B, threshold }) => {
      const load = (s) =>
        new Promise((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = rej;
          i.src = 'data:image/png;base64,' + s;
        });
      const [ia, ib] = await Promise.all([load(A), load(B)]);
      const w = Math.min(ia.width, ib.width);
      const h = Math.min(ia.height, ib.height);
      const ca = new OffscreenCanvas(w, h).getContext('2d');
      ca.drawImage(ia, 0, 0);
      const cb = new OffscreenCanvas(w, h).getContext('2d');
      cb.drawImage(ib, 0, 0);
      const da = ca.getImageData(0, 0, w, h).data;
      const db = cb.getImageData(0, 0, w, h).data;
      const out = new OffscreenCanvas(w, h);
      const co = out.getContext('2d');
      const od = co.createImageData(w, h);
      const rows = new Uint32Array(h);
      let d = 0;
      for (let i = 0; i < da.length; i += 4) {
        const m = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
        if (m > threshold) {
          d++;
          rows[(i / 4 / w) | 0]++;
          od.data[i] = 255;
          od.data[i + 1] = 0;
          od.data[i + 2] = 0;
        } else {
          const g = 200 + ((da[i] + da[i + 1] + da[i + 2]) / 3) * 0.2;
          od.data[i] = od.data[i + 1] = od.data[i + 2] = g;
        }
        od.data[i + 3] = 255;
      }
      // Bands of differing rows (gaps under 8 rows merged), largest first.
      const bands = [];
      let start = -1;
      let gap = 0;
      let count = 0;
      for (let y = 0; y < h; y++) {
        if (rows[y]) {
          if (start < 0) start = y;
          count += rows[y];
          gap = 0;
        } else if (start >= 0 && ++gap >= 8) {
          bands.push([start, y - gap, count]);
          start = -1;
          count = 0;
          gap = 0;
        }
      }
      if (start >= 0) bands.push([start, h - 1 - gap, count]);
      bands.sort((a, b) => b[2] - a[2]);
      co.putImageData(od, 0, 0);
      const blob = await out.convertToBlob({ type: 'image/png' });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return {
        size: [w, h],
        aSize: [ia.width, ia.height],
        bSize: [ib.width, ib.height],
        pct: Math.round((10000 * d) / (w * h)) / 100,
        bands: bands.slice(0, 8),
        png: btoa(bin),
      };
    },
    { A, B, threshold },
  );
  await ctx.close();
  if (outPath) writeFileSync(outPath, Buffer.from(r.png, 'base64'));
  delete r.png;
  return r;
}
