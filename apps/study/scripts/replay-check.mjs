#!/usr/bin/env node
// Replays the recording matrix from replicas/<id>/fixtures.json, as a phone would (no server): each configuration
// loads in the dev host in the adapted condition with mode=replay. Reports replay misses and what WebAble delivered
// (simplified page, ops, zoom, compose groups) next to what the recording run delivered.
// Exits non-zero when the canonical configuration has any miss.
//
//   node scripts/replay-check.mjs <replicaId> [<replicaId>…] [--port 5192] [--engine chromium|webkit]
//        [--fits …] [--heights …] (default: the fixtures' own matrix)

import { pathToFileURL } from 'node:url';
import { CANONICAL, devHostUp, launch, matrix, openTrial, parseArgs, readFixtures, readManifest, waitDone, withRetry } from './record.mjs';

const opsKey = (d) => (d?.ops ?? []).map((o) => `${o.kind}:${o.status}`).sort().join(' ');

function compare(rec, rep) {
  if (!rec || !rep) return [];
  const diffs = [];
  if (!!rec.simplified?.open !== !!rep.simplified?.open) diffs.push(`calm ${rec.simplified?.open ? 'open' : 'closed'} -> ${rep.simplified?.open ? 'open' : 'closed'}`);
  if (Math.abs((rec.pageZoom ?? 1) - (rep.pageZoom ?? 1)) > 0.001) diffs.push(`zoom ${rec.pageZoom} -> ${rep.pageZoom}`);
  if ((rec.compose?.laidOut ?? 0) !== (rep.compose?.laidOut ?? 0) || (rec.compose?.groups ?? 0) !== (rep.compose?.groups ?? 0)) {
    diffs.push(`compose ${rec.compose?.laidOut}/${rec.compose?.groups} -> ${rep.compose?.laidOut}/${rep.compose?.groups}`);
  }
  if (opsKey(rec) !== opsKey(rep)) diffs.push(`ops [${opsKey(rec)}] -> [${opsKey(rep)}]`);
  const df = (x) => `${x?.decisions?.folded ?? 0}/${x?.decisions?.protected ?? 0}/${x?.decisions?.promoted ?? 0}`;
  if (df(rec) !== df(rep)) diffs.push(`decisions ${df(rec)} -> ${df(rep)}`);
  return diffs;
}

async function checkReplica(browser, opts, id) {
  const manifest = readManifest(id);
  const fx = readFixtures(id);
  if (!fx) throw new Error(`No replicas/${id}/fixtures.json (run scripts/record.mjs first)`);
  if (!fx.replicaHash) console.log(`  (the fixtures do not say which copy of the page they were recorded on)`);
  else if (fx.replicaHash !== manifest.contentHash) console.log(`  WARNING: the replica changed since recording (${fx.replicaHash.slice(0, 19)} -> ${String(manifest.contentHash).slice(0, 19)}): record it again`);
  const fits = opts.fitsGiven ? opts.fits : fx.matrix.fits;
  const heights = opts.heightsGiven ? opts.heights : fx.matrix.heights;
  console.log(`\n${id}: fixtures version ${fx.version} (${fx.recordedAt}), engine ${fx.engineCommit}, ${opts.engine}`);
  let canonicalMisses = 0;
  let total = 0;
  for (const run of matrix(fits, heights)) {
    const { t, done, d } = await withRetry(`${id} ${run.fit}@${run.h}`, async () => {
      const t = await openTrial(browser, { port: opts.port, id, condition: 'adapted', fit: run.fit, h: run.h, mode: 'replay', fresh: false });
      try {
        const done = await waitDone(t.frame, { timeoutMs: 30000, quietMs: 1500 });
        const d = await t.frame.evaluate(() => window.__studyFrame.delivery());
        return { t, done, d };
      } finally {
        await t.ctx.close();
      }
    });
    const status = done.status ?? {};
    const misses = d?.replayMisses ?? [];
    total += misses.length;
    if (run.canonical) canonicalMisses = misses.length;
    const recRun = fx.runs.find((r) => r.fit === run.fit && r.h === run.h);
    const diffs = compare(recRun?.delivery, d);
    const byWhat = {};
    for (const m of misses) byWhat[m.what] = (byWhat[m.what] ?? 0) + 1;
    console.log(
      `  ${run.canonical ? '*' : ' '} ${run.fit.padEnd(7)} ${String(run.h).padEnd(4)} ready ${status.settleMs ?? '?'} ms${status.late ? ' LATE' : ''}` +
      ` · misses ${misses.length}${misses.length ? ` ${JSON.stringify(byWhat)}` : ''}` +
      ` · calm ${d?.simplified?.open ? 'open' : 'closed'} zoom ${d?.pageZoom ?? '?'} groups ${d?.compose?.laidOut ?? 0}/${d?.compose?.groups ?? 0}` +
      ` · ops ${(d?.ops ?? []).filter((o) => o.status === 'applied').map((o) => o.kind).join(',') || 'none'}` +
      `${diffs.length ? `\n      differs from the recording: ${diffs.join('; ')}` : recRun ? ' · same as recorded' : ' · (no recorded run)'}` +
      `${t.errors.length ? `\n      page errors: ${t.errors.slice(0, 3).join(' | ')}` : ''}`,
    );
  }
  // The original condition never loads the engine: check it is ready too, at the canonical height.
  const { od, engineLoaded } = await withRetry(`${id} original`, async () => {
    const o = await openTrial(browser, { port: opts.port, id, condition: 'original', fit: CANONICAL.fit, h: CANONICAL.h, mode: 'replay', fresh: false });
    try {
      const od = await waitDone(o.frame, { timeoutMs: 15000, quietMs: 500 });
      const engineLoaded = await o.frame.evaluate(() => !!document.querySelector('webable-ui') || !!globalThis.chrome?.runtime?.id);
      return { od, engineLoaded };
    } finally {
      await o.ctx.close();
    }
  });
  console.log(`    original ${CANONICAL.h}: ready ${od.status?.settleMs ?? '?'} ms${od.status?.late ? ' LATE' : ''} · engine loaded: ${engineLoaded ? 'YES (wrong)' : 'no'}`);
  return { canonicalMisses, total, engineLoaded };
}

async function main() {
  const argv = process.argv.slice(2);
  const opts = parseArgs(argv);
  opts.fitsGiven = argv.includes('--fits');
  opts.heightsGiven = argv.includes('--heights');
  if (!(await devHostUp(opts.port))) {
    console.error(`No dev host on http://127.0.0.1:${opts.port}/dev.html`);
    process.exit(2);
  }
  const browser = await launch(opts.engine);
  let fail = false;
  try {
    for (const id of opts.ids) {
      const r = await checkReplica(browser, opts, id);
      if (r.canonicalMisses > 0 || r.engineLoaded) fail = true;
      console.log(`  => ${r.canonicalMisses ? `FAIL: ${r.canonicalMisses} misses in the canonical configuration` : 'canonical configuration: no misses'}; ${r.total} misses across the matrix`);
    }
  } finally {
    await browser.close();
  }
  process.exit(fail ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
