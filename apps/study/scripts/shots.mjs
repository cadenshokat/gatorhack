#!/usr/bin/env node
// Pictures of each study website as a participant first sees it, without WebAble ("original") and with it ("adapted",
// replayed AI answers at the typical fit), for the last questions (protocol 4.3.0): people see which round was which
// and how the websites differed. Writes public/shots/<replicaId>-<original|adapted>.jpg. Run with the dev server up:
//
//   node scripts/shots.mjs [<replicaId>…] [--port 5190]

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { devices, webkit } from 'playwright';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const base = `http://127.0.0.1:${opt('port', '5190')}`;
const named = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const ids = named.length ? named : readdirSync('replicas').filter((d) => existsSync(join('replicas', d, 'task.json')));
const out = join('public', 'shots');
mkdirSync(out, { recursive: true });

const browser = await webkit.launch();
for (const id of ids) {
  for (const c of ['original', 'adapted']) {
    const ctx = await browser.newContext({ ...devices['iPhone 15'], deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(`${base}/dev.html?r=${id}&c=${c}&fit=typical&h=664&mode=replay`);
    for (let i = 0; i < 600; i++) {
      if (await page.evaluate(() => !!window.__devHost?.ready).catch(() => false)) break;
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(4000);
    const file = join(out, `${id}-${c}.jpg`);
    await page.locator('iframe').first().screenshot({ path: file, type: 'jpeg', quality: 70 });
    console.log(file);
    await ctx.close();
  }
}
await browser.close();
