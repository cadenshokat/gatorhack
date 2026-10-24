// Contact sheet for one eval run: before | after | lens | calm per site, plus the numbers that matter.
import { escapeHtml as h, median } from './common.mjs';

const SHOTS = [
  ['before', 'Before (paused)'],
  ['after', 'After (fitted)'],
  ['lens', 'Jev Lens'],
  ['calm', 'Calm view'],
];

const fmtMs = (ms) => (typeof ms === 'number' && Number.isFinite(ms) ? (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`) : '—');
const fmtUsd = (x) => (typeof x === 'number' && Number.isFinite(x) ? `$${x < 0.01 ? x.toFixed(5) : x.toFixed(4)}` : '—');
const fmtP = (p) => (typeof p === 'number' && Number.isFinite(p) ? p.toFixed(2) : '');

/** Numbers for one site, derived from its final TabReport. */
export function siteMetrics(r) {
  const rep = r.report ?? null;
  const u = rep?.understanding ?? null;
  const ops = Array.isArray(rep?.ops) ? rep.ops : [];
  const checks = Array.isArray(rep?.checks) ? rep.checks : [];
  return {
    phase: rep?.phase ?? null,
    decisions: u?.decisions ?? null,
    folded: u?.folded ?? null,
    protected: u?.protected ?? null,
    mainId: u?.mainId ?? null,
    jevMs: u?.metrics?.wallMs ?? null,
    jevServerMs: u?.metrics?.serverMs ?? null,
    jevUsd: u?.metrics?.costUsd ?? null,
    jevCalls: u?.metrics?.calls ?? null,
    jevQuestions: u?.metrics?.questions ?? null,
    jevTokens: u?.metrics?.inputTokens ?? null,
    opsApplied: ops.filter((o) => o?.status === 'applied').length,
    opsReversed: ops.filter((o) => o?.status === 'reversed').length,
    opsOffered: ops.filter((o) => o?.status === 'offered').length,
    checksRun: checks.length,
    checksFailed: checks.filter((c) => c && c.pass === false),
    redesign: rep?.redesign ?? null,
    struggleLevel: rep?.struggle?.level ?? null,
    errors: [...(r.errors ?? []), ...(Array.isArray(rep?.errors) ? rep.errors.map((e) => `report: ${e}`) : [])],
  };
}

function chip(label, value, tone = '') {
  return `<span class="chip ${tone}"><span class="chip-k">${h(label)}</span><span class="chip-v">${h(value)}</span></span>`;
}

function shotCell(r, key, label) {
  const file = r.shots?.[key];
  const sub = r.shotNotes?.[key] ? `<span class="shot-note">${h(r.shotNotes[key])}</span>` : '';
  if (!file) {
    return `<figure class="shot missing"><div class="shot-empty">${h(r.shotErrors?.[key] ?? 'Not captured')}</div><figcaption>${h(label)}${sub}</figcaption></figure>`;
  }
  return `<figure class="shot"><a href="${h(file)}" target="_blank" rel="noopener"><img src="${h(file)}" alt="${h(`${r.name}: ${label}`)}" loading="lazy"></a><figcaption>${h(label)}${sub}</figcaption></figure>`;
}

function siteCard(r) {
  const m = siteMetrics(r);
  const phaseTone = m.phase === 'error' ? 'bad' : m.phase === 'understood' || m.phase === 'calm' ? 'good' : 'warn';
  const chips = [
    chip('Phase', m.phase ?? 'no report', phaseTone),
    chip('To understood', fmtMs(r.msToUnderstood)),
    chip('Jev decisions', m.decisions ?? '—', m.decisions ? 'good' : ''),
    chip('Jev', m.jevMs != null ? `${fmtMs(m.jevMs)}${m.jevServerMs != null ? ` (server ${fmtMs(m.jevServerMs)})` : ''}` : '—'),
    chip('Jev cost', fmtUsd(m.jevUsd)),
    chip('Folded / protected', m.folded != null ? `${m.folded} / ${m.protected}` : '—'),
    chip('Ops applied', m.opsApplied),
    chip('Reversed', m.opsReversed, m.opsReversed ? 'warn' : ''),
    chip('Checks failed', `${m.checksFailed.length} of ${m.checksRun}`, m.checksFailed.length ? 'warn' : ''),
    chip('Calm layout', m.redesign ? `${m.redesign.chosen}${m.redesign.autoApply ? ' · auto' : ''} · ${fmtMs(m.redesign.ms)}` : '—'),
    chip('Errors', m.errors.length, m.errors.length ? 'bad' : ''),
  ].join('');

  const ledger = Array.isArray(r.report?.ledger) ? r.report.ledger : [];
  const ledgerHtml = ledger.length
    ? `<ol class="ledger">${ledger
        .slice(0, 40)
        .map((e) => `<li><span class="src">${h(e.source)}</span>${e.action ? `<span class="act act-${h(e.action)}">${h(e.action)}</span>` : ''}<span class="t">${h(e.title)}</span>${e.p != null ? `<span class="p">${h(fmtP(e.p))}</span>` : ''}${e.detail ? `<span class="d">${h(e.detail)}</span>` : ''}</li>`)
        .join('')}</ol>`
    : '<p class="muted">No ledger entries.</p>';
  const checksHtml = m.checksFailed.length
    ? `<ul class="plain">${m.checksFailed.map((c) => `<li><b>${h(c.name)}</b> ${h(c.detail)}${c.opId ? ` <span class="muted">(${h(c.opId)})</span>` : ''}</li>`).join('')}</ul>`
    : '<p class="muted">None failed.</p>';
  const errorsHtml = m.errors.length ? `<ul class="plain errs">${m.errors.slice(0, 30).map((e) => `<li>${h(e)}</li>`).join('')}</ul>` : '<p class="muted">None.</p>';

  return `<article class="site" id="${h(r.slug)}">
  <header class="site-head">
    <div>
      <h2>${h(r.name)}</h2>
      <a class="url" href="${h(r.url)}" target="_blank" rel="noopener">${h(r.finalUrl && r.finalUrl !== r.url ? `${r.url} → ${r.finalUrl}` : r.url)}</a>
      ${r.note ? `<p class="note">${h(r.note)}</p>` : ''}
    </div>
    <a class="raw" href="${h(r.slug)}/report.json" target="_blank" rel="noopener">report.json</a>
  </header>
  <div class="chips">${chips}</div>
  <div class="shots">${SHOTS.map(([k, label]) => shotCell(r, k, label)).join('')}</div>
  <div class="details">
    <details${ledger.length ? ' open' : ''}><summary>What WebAble did (${ledger.length})</summary>${ledgerHtml}</details>
    <details${m.checksFailed.length ? ' open' : ''}><summary>Checks failed (${m.checksFailed.length})</summary>${checksHtml}</details>
    <details${m.errors.length ? ' open' : ''}><summary>Errors (${m.errors.length})</summary>${errorsHtml}</details>
  </div>
</article>`;
}

export function renderSheet(meta, results) {
  const ms = results.map(siteMetrics);
  const sum = (k) => ms.reduce((a, m) => a + (typeof m[k] === 'number' ? m[k] : 0), 0);
  const understood = ms.filter((m) => m.phase === 'understood' || m.phase === 'calm').length;
  const tiles = [
    ['Sites', `${results.length}`, `${understood} reached “understood”`],
    ['Jev decisions', `${sum('decisions')}`, `${sum('jevCalls')} calls · ${sum('jevQuestions')} questions`],
    ['Median Jev time', fmtMs(median(ms.map((m) => m.jevMs))), 'per page, wall clock'],
    ['Jev cost', fmtUsd(sum('jevUsd')), `${sum('jevTokens').toLocaleString('en-US')} input tokens`],
    ['Changes', `${sum('opsApplied')} applied`, `${sum('opsReversed')} reversed by checks`],
    ['Problems', `${ms.reduce((a, m) => a + m.errors.length, 0)} errors`, `${ms.reduce((a, m) => a + m.checksFailed.length, 0)} checks failed`],
  ]
    .map(([k, v, s]) => `<div class="tile"><p class="tile-k">${h(k)}</p><p class="tile-v">${h(v)}</p><p class="tile-s">${h(s)}</p></div>`)
    .join('');
  const metaLine = [
    `Fit: ${meta.fit}`,
    `Viewport: ${meta.viewport.width} × ${meta.viewport.height}`,
    meta.browser ? `Browser: ${meta.browser}` : null,
    meta.extensionId ? `Extension: ${meta.extensionId}` : 'Extension: not loaded',
    meta.server ? `Server: ${meta.server}` : null,
    `Took ${fmtMs(meta.durationMs)}`,
  ]
    .filter(Boolean)
    .map((x) => `<span>${h(x)}</span>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WebAble eval · ${h(meta.run)}</title>
<style>
  :root { --bg: #F5F5F7; --card: #fff; --ink: #1D1D1F; --muted: #6E6E73; --line: #E3E3E8; --blue: #0071E3; --good: #2E7D32; --warn: #9A6700; --bad: #B42318; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.45 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif; }
  main { max-width: 1440px; margin: 0 auto; padding: 40px 24px 80px; }
  h1 { font-size: 34px; font-weight: 600; letter-spacing: -.4px; margin: 0 0 6px; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px 18px; color: var(--muted); font-size: 13px; margin-bottom: 24px; }
  .tiles { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; margin-bottom: 28px; }
  @media (max-width: 1000px) { .tiles { grid-template-columns: repeat(3, 1fr); } }
  .tile { background: var(--card); border-radius: 14px; padding: 14px 16px; }
  .tile p { margin: 0; }
  .tile-k { font-size: 12px; color: var(--muted); }
  .tile-v { font-size: 22px; font-weight: 600; letter-spacing: -.2px; margin: 2px 0; }
  .tile-s { font-size: 12px; color: var(--muted); }
  .toc { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
  .toc a { font-size: 13px; color: var(--blue); text-decoration: none; background: #fff; border: 1px solid var(--line); border-radius: 999px; padding: 4px 12px; }
  .site { background: var(--card); border-radius: 18px; padding: 20px 20px 16px; margin-bottom: 20px; }
  .site-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
  .site h2 { font-size: 20px; font-weight: 600; margin: 0 0 2px; }
  .url { font-size: 12px; color: var(--muted); word-break: break-all; }
  .note { margin: 4px 0 0; font-size: 13px; color: var(--muted); }
  .raw { font-size: 12px; color: var(--blue); white-space: nowrap; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 14px; }
  .chip { display: inline-flex; gap: 6px; align-items: baseline; border: 1px solid var(--line); border-radius: 999px; padding: 3px 10px; font-size: 12px; }
  .chip-k { color: var(--muted); }
  .chip-v { font-weight: 600; }
  .chip.good { border-color: #BFE3C4; background: #F1FAF2; } .chip.good .chip-v { color: var(--good); }
  .chip.warn { border-color: #F0D97A; background: #FFFBEB; } .chip.warn .chip-v { color: var(--warn); }
  .chip.bad { border-color: #F5C2BD; background: #FEF3F2; } .chip.bad .chip-v { color: var(--bad); }
  .shots { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  @media (max-width: 1000px) { .shots { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .shot { margin: 0; }
  .shot img { width: 100%; height: auto; display: block; border-radius: 8px; border: 1px solid var(--line); background: #fafafa; }
  .shot a:hover img { border-color: var(--blue); }
  .shot figcaption { margin-top: 6px; font-size: 12px; font-weight: 600; display: flex; flex-direction: column; }
  .shot-note { font-weight: 400; color: var(--muted); }
  .shot-empty { aspect-ratio: ${meta.viewport.width} / ${meta.viewport.height}; border-radius: 8px; border: 1px dashed var(--line); display: grid; place-items: center; color: var(--muted); font-size: 12px; text-align: center; padding: 12px; }
  .details { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 12px; margin-top: 14px; }
  @media (max-width: 1000px) { .details { grid-template-columns: 1fr; } }
  details { background: var(--bg); border-radius: 10px; padding: 8px 12px; font-size: 13px; }
  summary { cursor: pointer; font-weight: 600; }
  .ledger { margin: 8px 0 4px; padding-left: 20px; max-height: 320px; overflow: auto; }
  .ledger li { padding: 2px 0; }
  .ledger .src { font-size: 11px; color: var(--muted); margin-right: 6px; text-transform: uppercase; letter-spacing: .4px; }
  .ledger .act { font-size: 11px; border-radius: 4px; padding: 0 5px; margin-right: 6px; background: #E8E8ED; }
  .ledger .act-applied, .ledger .act-protected, .ledger .act-kept { background: #E3F2E5; color: var(--good); }
  .ledger .act-reversed { background: #FEECEB; color: var(--bad); }
  .ledger .act-offered, .ledger .act-waiting { background: #FFF4D6; color: var(--warn); }
  .ledger .p { margin-left: 6px; font-variant-numeric: tabular-nums; color: var(--muted); }
  .ledger .d { display: block; color: var(--muted); font-size: 12px; }
  .plain { margin: 8px 0 4px; padding-left: 18px; }
  .errs li { color: var(--bad); word-break: break-word; }
  .muted { color: var(--muted); margin: 8px 0 4px; }
</style>
</head>
<body>
<main>
  <h1>WebAble eval · ${h(meta.run)}</h1>
  <div class="meta">${metaLine}</div>
  <section class="tiles" aria-label="Totals">${tiles}</section>
  <nav class="toc" aria-label="Sites">${results.map((r) => `<a href="#${h(r.slug)}">${h(r.name)}</a>`).join('')}</nav>
  ${results.map(siteCard).join('\n')}
</main>
</body>
</html>
`;
}
