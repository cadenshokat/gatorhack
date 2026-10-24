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

function chip(label, value, tone = '', title = '') {
  return `<span class="chip ${tone}"${title ? ` title="${h(title)}"` : ''}><span class="chip-k">${h(label)}</span><span class="chip-v">${h(value)}</span></span>`;
}

const tone = (ok) => (ok === true ? 'good' : ok === false ? 'bad' : '');

/** First-screen chips for one site: heading, main action, overlays, pill, Lens chips, Calm first screen. */
function firstScreenChips(r) {
  const fs = r.firstScreen ?? {};
  const out = [];
  const after = fs.after?.page;
  const before = fs.before?.page;
  if (after?.h1) out.push(chip('Heading top', `${after.h1.top} px`, '', after.h1.text));
  if (after) {
    const m = after.main;
    if (m) {
      const where = m.coveredBy ? `under ${m.coveredBy}` : m.inView ? 'in view' : m.below ? `below the fold (${m.top} px)` : 'partly off screen';
      out.push(chip('Main action', `${where}`, m.coveredBy ? 'bad' : m.inView ? 'good' : 'warn', `“${m.label}” ${m.top}–${m.bottom} px`));
    } else out.push(chip('Main action', 'none marked', 'warn'));
  }
  if (before || after) {
    const b = before?.overlayPct;
    const a = after?.overlayPct;
    const t = a == null ? '' : a <= 10 ? 'good' : b != null && a < b ? '' : 'warn';
    const what = (after?.overlayBy ?? before?.overlayBy ?? []).map((x) => `${x.what} ${x.pct}%`).join(', ');
    out.push(chip('Page overlays', `${b ?? '—'}% → ${a ?? '—'}%`, t, what || 'fixed boxes over the page'));
  }
  if (after) out.push(chip('WebAble UI', `${after.webablePct}%`, after.webablePct > 15 ? 'warn' : '', 'share of the first screen under WebAble’s own chrome'));
  if (after) out.push(chip('Pill over a control', after.pillOver?.length ? after.pillOver.join(', ') : 'none', after.pillOver?.length ? 'bad' : 'good'));
  const floats = fs.after?.ui?.floatOverlaps ?? [];
  if (floats.length) out.push(chip('Chips overlap', floats.slice(0, 2).join('; '), 'bad'));
  const lens = fs.lens?.lens;
  if (lens) out.push(chip('Lens chips', `${lens.chips} · ${lens.overlapping.length} overlapping`, lens.on ? tone(lens.overlapping.length === 0) : 'warn', lens.overlapping.join('; ')));
  else if (fs.lens) out.push(chip('Lens', 'did not open', 'bad'));
  const c = fs.calm?.calm;
  if (c?.open) {
    out.push(chip('Calm h1 top', c.h1Top != null ? `${c.h1Top} px` : 'no h1', tone(c.h1Ok), `${c.h1Text ?? ''} (rule: ≤ 140 px)`));
    out.push(chip('Calm task', c.task ? (c.taskOk ? 'on first screen' : `at ${c.task.top} px`) : 'none', tone(c.taskOk), c.task ? `${c.task.kind} “${c.task.text}”` : ''));
    out.push(chip('Filled buttons', `${c.filled?.length ?? 0}`, tone(c.filledOk), (c.filled ?? []).join(', ')));
  }
  return out.join('');
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
  <div class="chips chips-first"><span class="chips-label">First screen</span>${firstScreenChips(r)}</div>
  <div class="shots">${SHOTS.map(([k, label]) => shotCell(r, k, label)).join('')}</div>
  <div class="details">
    <details${ledger.length ? ' open' : ''}><summary>What WebAble did (${ledger.length})</summary>${ledgerHtml}</details>
    <details${m.checksFailed.length ? ' open' : ''}><summary>Checks failed (${m.checksFailed.length})</summary>${checksHtml}</details>
    <details${m.errors.length ? ' open' : ''}><summary>Errors (${m.errors.length})</summary>${errorsHtml}</details>
  </div>
</article>`;
}

function checkList(checks) {
  const cs = (checks ?? []).filter((c) => c);
  if (!cs.length) return '';
  return `<ul class="checks">${cs
    .map((c) => `<li class="${c.ok === true ? 'ok' : c.ok === false ? 'no' : 'na'}"><span class="mark">${c.ok === true ? '✓' : c.ok === false ? '✗' : '–'}</span>${h(c.name)}${c.detail ? `<span class="muted"> · ${h(c.detail)}</span>` : ''}</li>`)
    .join('')}</ul>`;
}

function fittingSection(f) {
  if (!f) return '';
  const bad = f.screens.filter((x) => !x.ok).length;
  const fit = f.fit;
  const fitLine = fit
    ? `Saved fit: text ${fit.text?.override ?? fit.text?.bodyPx} px · targets ${fit.targets?.minPx ?? '—'} px · contrast ${fit.contrast?.band} · calm level ${fit.attention?.structureLevel}`
    : 'No fit saved';
  const cards = f.screens
    .map((x) => {
      const m = x.checks ?? {};
      const lines = [
        ...x.problems.map((p) => `<li class="no"><span class="mark">✗</span>${h(p)}</li>`),
        ...(x.notes ?? []).map((p) => `<li class="na"><span class="mark">–</span>${h(p)}</li>`),
      ].join('');
      const meta2 = [m.chromeScale ? `chrome ×${m.chromeScale}` : null, m.actionBar ? `Pause/Skip ${m.actionBar === 'fixed' ? 'floating' : 'in flow'}` : null, m.docHeight && m.vh ? `page ${m.docHeight} / ${m.vh} px` : null]
        .filter(Boolean)
        .join(' · ');
      return `<figure class="frame ${x.ok ? '' : 'has-problem'}"><a href="${h(x.file)}" target="_blank" rel="noopener"><img src="${h(x.file)}" alt="${h(x.title)}" loading="lazy"></a>
  <figcaption><b>${x.ok ? '✓' : '✗'} ${h(x.title)}</b><span class="muted">${h(meta2)}</span>${lines ? `<ul class="checks">${lines}</ul>` : ''}</figcaption></figure>`;
    })
    .join('');
  const errs = f.errors.length ? `<ul class="plain errs">${f.errors.map((e) => `<li>${h(e)}</li>`).join('')}</ul>` : '';
  return `<section class="block" id="fitting">
  <header class="block-head"><h2>Fitting flow</h2><p class="muted">${f.screens.length} screens · ${bad} with problems · ${f.seconds ?? '—'} s to “Your fit” · ${h(fitLine)}</p></header>
  ${errs}
  <div class="frames">${cards}</div>
</section>`;
}

function interactSection(x) {
  if (!x) return '';
  const bad = x.steps.filter((s) => !s.ok).length;
  const cards = x.steps
    .map(
      (s) => `<figure class="frame ${s.ok ? '' : 'has-problem'}"><a href="${h(s.file)}" target="_blank" rel="noopener"><img src="${h(s.file)}" alt="${h(s.title)}" loading="lazy"></a>
  <figcaption><b>${s.ok ? '✓' : '✗'} ${h(s.title)}</b>${(s.notes ?? []).length ? `<span class="muted">${h(s.notes.join(' · '))}</span>` : ''}${checkList(s.checks)}</figcaption></figure>`,
    )
    .join('');
  const t = x.timings ?? {};
  const line = [
    t.toUnderstoodMs != null ? `understood in ${fmtMs(t.toUnderstoodMs)}` : null,
    t.explainMs != null ? `Explain ${fmtMs(t.explainMs)}` : null,
    t.struggleRounds != null ? `${t.struggleRounds} near-misses${t.offerAfterMs != null ? `, offer after ${fmtMs(t.offerAfterMs)}` : ', no offer'}` : null,
    x.mainLabel ? `main action “${x.mainLabel}”` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const errs = x.errors.length ? `<ul class="plain errs">${x.errors.map((e) => `<li>${h(e)}</li>`).join('')}</ul>` : '';
  return `<section class="block" id="interact">
  <header class="block-head"><h2>Interactions · ${h(x.site)}</h2><p class="muted">${x.steps.length} steps · ${bad} with a failed check · ${h(line)}</p></header>
  ${errs}
  <div class="frames">${cards}</div>
</section>`;
}

export function renderSheet(meta, results, extra = {}) {
  const ms = results.map(siteMetrics);
  const sum = (k) => ms.reduce((a, m) => a + (typeof m[k] === 'number' ? m[k] : 0), 0);
  const understood = ms.filter((m) => m.phase === 'understood' || m.phase === 'calm').length;
  const mainSeen = results.filter((r) => r.firstScreen?.after?.page?.main?.inView && !r.firstScreen.after.page.main.coveredBy).length;
  const calmOk = results.filter((r) => r.firstScreen?.calm?.calm?.h1Ok && r.firstScreen.calm.calm.taskOk).length;
  const calmN = results.filter((r) => r.firstScreen?.calm?.calm?.open).length;
  const tiles = !results.length ? '' : [
    ['Sites', `${results.length}`, `${understood} reached “understood”`],
    ['Jev decisions', `${sum('decisions')}`, `${sum('jevCalls')} calls · ${sum('jevQuestions')} questions`],
    ['Median Jev time', fmtMs(median(ms.map((m) => m.jevMs))), 'per page, wall clock'],
    ['Jev cost', fmtUsd(sum('jevUsd')), `${sum('jevTokens').toLocaleString('en-US')} input tokens`],
    ['Changes', `${sum('opsApplied')} applied`, `${sum('opsReversed')} reversed by checks`],
    ['Problems', `${ms.reduce((a, m) => a + m.errors.length, 0)} errors`, `${ms.reduce((a, m) => a + m.checksFailed.length, 0)} checks failed`],
    ['First screen', `${mainSeen} of ${results.length}`, `main action in view · Calm first screen right on ${calmOk} of ${calmN}`],
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
  .tiles { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 12px; margin-bottom: 28px; }
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
  .chips-first { margin-top: -6px; }
  .chips-label { font-size: 12px; font-weight: 600; color: var(--muted); align-self: center; margin-right: 4px; }
  .block { background: var(--card); border-radius: 18px; padding: 20px; margin-bottom: 20px; }
  .block-head h2 { font-size: 20px; font-weight: 600; margin: 0; }
  .block-head p { margin: 4px 0 14px; font-size: 13px; }
  .frames { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
  @media (max-width: 1100px) { .frames { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .frame { margin: 0; }
  .frame img { width: 100%; height: auto; display: block; border-radius: 8px; border: 1px solid var(--line); background: #fafafa; }
  .frame.has-problem img { border-color: #F5C2BD; box-shadow: 0 0 0 2px #FEF3F2; }
  .frame figcaption { margin-top: 6px; font-size: 12px; display: flex; flex-direction: column; gap: 2px; }
  .frame figcaption .muted { margin: 0; }
  .checks { list-style: none; margin: 4px 0 0; padding: 0; font-size: 12px; }
  .checks li { padding: 1px 0; }
  .checks .mark { display: inline-block; width: 14px; font-weight: 700; }
  .checks .ok .mark { color: var(--good); }
  .checks .no { color: var(--bad); }
  .checks .na .mark { color: var(--muted); }
</style>
</head>
<body>
<main>
  <h1>WebAble eval · ${h(meta.run)}</h1>
  <div class="meta">${metaLine}</div>
  ${tiles ? `<section class="tiles" aria-label="Totals">${tiles}</section>` : ''}
  <nav class="toc" aria-label="Sections">${extra.fitting ? '<a href="#fitting">Fitting flow</a>' : ''}${extra.interact ? '<a href="#interact">Interactions</a>' : ''}${results.map((r) => `<a href="#${h(r.slug)}">${h(r.name)}</a>`).join('')}</nav>
  ${interactSection(extra.interact)}
  ${fittingSection(extra.fitting)}
  ${results.map(siteCard).join('\n')}
</main>
</body>
</html>
`;
}
