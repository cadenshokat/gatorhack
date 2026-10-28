#!/usr/bin/env node
// Round-trip check: does the HTML parser rebuild the tree we serialised? Scripts can build trees the parser can't
// (an <a> inside an <a>, a <div> inside a <p>, a table without <tbody>); re-parsing then moves elements and the copy
// renders differently from the live page. Compares the saved HTML, parsed fresh, with reference/live-tree.json.
//   node scripts/capture/roundtrip.mjs <id>
// Fix what it reports with the config's fixDom(root) hook (see README), then capture again.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, replicaDir } from './lib/context.mjs';
import { reparseSignature } from './lib/inpage.mjs';

const BLOCK = new Set(['div', 'p', 'ul', 'ol', 'table', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'figure', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'dl', 'hr', 'main', 'address', 'details', 'fieldset']);

function causeOf(rid, live) {
  const tagOf = (r) => live[r]?.[0];
  const chain = [];
  for (let p = live[rid]?.[1]; p; p = live[p]?.[1]) chain.push(p);
  const tag = tagOf(rid);
  const parent = tagOf(live[rid]?.[1]);
  if (tag === 'a' && chain.some((r) => tagOf(r) === 'a')) return { cause: 'nested <a>', fix: 'move the inner content out of the outer <a> (or turn one of them into a <span>) in fixDom' };
  if (tag === 'form' && chain.some((r) => tagOf(r) === 'form')) return { cause: 'nested <form>', fix: 'unwrap the inner <form> in fixDom' };
  if (tag === 'button' && chain.some((r) => tagOf(r) === 'button')) return { cause: 'nested <button>', fix: 'turn the outer one into a <span role=button> in fixDom' };
  if (/^h[1-6]$/.test(tag) && chain.some((r) => /^h[1-6]$/.test(tagOf(r) ?? ''))) return { cause: 'heading inside a heading', fix: 'unwrap in fixDom' };
  if (parent === 'p' && BLOCK.has(tag)) return { cause: `<${tag}> inside <p>`, fix: 'change the <p> to a <div class=same> in fixDom' };
  if (['tr', 'td', 'th', 'tbody', 'thead', 'tfoot', 'caption', 'colgroup', 'col'].includes(tag) || parent === 'table' || parent === 'tr') {
    return { cause: 'table structure (implied <tbody> or foster parenting)', fix: 'add the <tbody> or move the stray element out of the table in fixDom' };
  }
  if (['li', 'dt', 'dd', 'option', 'optgroup'].includes(tag)) return { cause: `<${tag}> auto-closing`, fix: 'check the list/select structure' };
  return { cause: 'parser re-parenting', fix: 'inspect the element in the live DOM' };
}

function pathOf(rid, live) {
  const parts = [];
  for (let r = rid; r && parts.length < 6; r = live[r]?.[1]) parts.unshift(`${live[r]?.[0] ?? '?'}[${r}]`);
  return parts.join(' > ');
}

/** Runs the check for one replica; writes reference/roundtrip.json and returns a summary. */
export async function roundtrip(browser, id) {
  const dir = replicaDir(id);
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  const html = readFileSync(join(dir, 'site', manifest.file), 'utf8');
  const live = JSON.parse(readFileSync(join(dir, 'reference', 'live-tree.json'), 'utf8'));
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const { sig, extra } = await page.evaluate(reparseSignature, html);
  await ctx.close();

  const moved = [];
  for (const [rid, [tag, parent, index]] of Object.entries(live)) {
    const got = sig[rid];
    if (!got) moved.push({ rid, tag, kind: 'missing' });
    else if (got[1] !== parent) moved.push({ rid, tag, kind: 'parent', liveParent: parent, copyParent: got[1] });
    else if (got[2] !== index) moved.push({ rid, tag, kind: 'index' });
  }
  const movedSet = new Set(moved.map((m) => m.rid));
  // Root causes: moved elements whose own parent didn't move.
  const rootCauses = moved
    .filter((m) => m.kind !== 'index' && !movedSet.has(live[m.rid]?.[1]))
    .map((m) => ({ rid: m.rid, tag: m.tag, kind: m.kind, path: pathOf(m.rid, live), ...causeOf(m.rid, live) }));
  const result = {
    at: new Date().toISOString(),
    elements: Object.keys(live).length,
    mismatches: moved.length,
    rootCauses,
    extra: extra.length,
    extraSample: extra.slice(0, 10).map(([t, p]) => `<${t}> under ${p ? pathOf(p, live) : 'root'}`),
  };
  writeFileSync(join(dir, 'reference', 'roundtrip.json'), JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const id = process.argv[2];
  if (!id) {
    console.error('usage: node scripts/capture/roundtrip.mjs <replica-id>');
    process.exit(2);
  }
  const browser = await launch();
  const r = await roundtrip(browser, id);
  await browser.close();
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.mismatches ? 1 : 0);
}
