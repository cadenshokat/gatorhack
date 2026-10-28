#!/usr/bin/env node
// Pulls the study's rows with the service key and writes the analysis files. Withdrawn sessions are left out, pilot
// and main cohorts are kept apart, and nothing is imputed. The summary is descriptive (paired intervals, outcome counts);
// which outcome is primary, and the models, are set in docs/STUDY.md ("Analysis") and run on trials.csv.
//
//   STUDY_SUPABASE_URL=https://<ref>.supabase.co STUDY_SUPABASE_SERVICE_KEY=... \
//     node scripts/export.mjs --cohort main --out ~/study-private/main-export
//   node scripts/export.mjs --in rows.json --out <dir>     (rows saved earlier, same shape as the table)

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const cohort = arg('cohort', 'main');
const outDir = arg('out', 'study-export');
const input = arg('in');

async function fetchRows() {
  if (input) return JSON.parse(readFileSync(input, 'utf8'));
  const url = process.env.STUDY_SUPABASE_URL;
  const key = process.env.STUDY_SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('Set STUDY_SUPABASE_URL and STUDY_SUPABASE_SERVICE_KEY (never commit the service key), or pass --in.');
    process.exit(1);
  }
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${url}/rest/v1/gatorhack_study_rows?select=*&order=created_at.asc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` },
    });
    if (!res.ok) throw new Error(`Supabase answered ${res.status}: ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

/* ---------------- SUS on 7 points (same rules as src/experiment/sus.ts) ---------------- */

const contribution = (item, r) => (item % 2 === 1 ? r - 1 : 7 - r);
const susScore = (items) =>
  items?.length === 10 && items.every((r) => r != null)
    ? Math.round(((items.reduce((s, r, i) => s + contribution(i + 1, r), 0) * 100) / 60) * 100) / 100
    : null;
const susProrated = (items) => {
  if (!items || items.length !== 10) return null;
  const missing = items.filter((r) => r == null).length;
  if (missing > 1) return null;
  if (missing === 0) return susScore(items);
  return Math.round(((items.reduce((s, r, i) => (r == null ? s : s + contribution(i + 1, r)), 0) * 100) / 54) * 100) / 100;
};

/* ---------------- small stats ---------------- */

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const sd = (xs) => {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};
// Two-sided 97.5% quantile of Student's t, by bisection on the regularized incomplete beta (enough for n >= 2).
function tQuantile975(df) {
  const betacf = (a, b, x) => {
    let c = 1, d = 1 - ((a + b) * x) / (a + 1);
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 200; m++) {
      const m2 = 2 * m;
      let aa = (m * (b - m) * x) / ((a - 1 + m2) * (a + m2));
      d = 1 / (1 + aa * d); c = 1 + aa / c; h *= d * c;
      aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + 1 + m2));
      d = 1 / (1 + aa * d); c = 1 + aa / c; h *= d * c;
    }
    return h;
  };
  const lgamma = (z) => {
    const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let x = z, y = z, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (const c of g) ser += c / ++y;
    return -tmp + Math.log((2.5066282746310005 * ser) / x);
  };
  const ibeta = (x, a, b) => {
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
  };
  const cdf = (t) => 1 - 0.5 * ibeta(df / (df + t * t), df / 2, 0.5);
  let lo = 0, hi = 100;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (cdf(mid) < 0.975) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
const pairedCI = (d) => {
  const n = d.length;
  if (n < 2) return null;
  const m = mean(d), s = sd(d), se = s / Math.sqrt(n), t = tQuantile975(n - 1);
  return { n, mean: m, sd: s, lo: m - t * se, hi: m + t * se, dz: m / s };
};

/* ---------------- shaping ---------------- */

const csvCell = (v) => {
  if (v == null) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows) => {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';
};

const rows = (await fetchRows()).filter((r) => cohort === 'all' || r.cohort === cohort);
const withdrawn = new Set(rows.filter((r) => r.kind === 'withdraw').map((r) => r.session_id));

const sessions = new Map();
const trialRows = new Map();
for (const r of rows) {
  if (withdrawn.has(r.session_id)) continue;
  if (r.kind === 'session') sessions.set(r.session_id, r.payload); // latest snapshot wins (rows are in time order)
  if (r.kind === 'trial') trialRows.set(`${r.session_id}:${r.payload.round}:${r.payload.taskId}`, r.payload);
}

/**
 * The SEQ in the standard direction, 1 = very difficult … 7 = very easy (higher is easier), whichever way it was asked:
 * builds since 27 Oct 2026 ask it 1 = very easy … 7 = very hard (seqScale 'easy-1').
 */
const seqEasy = (t) => (t.seq == null ? null : t.seqScale === 'easy-1' ? 8 - t.seq : t.seq);

/**
 * What happened on a website, beyond the multiple-choice answer: whether the answer's sentence was ever on screen
 * ("reached") and how the person ended. On screen is not the same as read; it is the best the logs can say.
 */
function outcomeOf(t) {
  if (t.endAction === 'technical') return 'technical';
  if (t.endAction === 'skipped') return 'skipped';
  const reached = t.metrics?.answerSeen === true;
  if (t.endAction === 'answered' && t.correct) return reached ? 'correct' : 'correct_not_seen';
  if (t.endAction === 'answered') return reached ? 'wrong_after_reaching' : 'wrong_without_reaching';
  return reached ? 'gave_up_after_reaching' : 'gave_up_without_reaching';
}
const OUTCOMES = [
  'correct', 'correct_not_seen', 'wrong_after_reaching', 'wrong_without_reaching', 'gave_up_after_reaching',
  'gave_up_without_reaching', 'skipped', 'technical',
];

/** Changes that stuck, by who decided them: the person's warm-up settings ('fit') or the AI's page read ('jev'). */
const opsFrom = (d, source) => (d.ops ? d.ops.filter((o) => o.status === 'applied' && o.source === source).length : null);

const participants = [];
const trials = [];
const pairs = { sus: [], susPro: [], seq: [], logTime: [] };

for (const s of sessions.values()) {
  const adaptedRound = s.trials?.find((t) => t.condition === 'adapted')?.round ?? null;
  const originalRound = adaptedRound ? 3 - adaptedRound : null;
  const susA = adaptedRound ? s.sus?.[adaptedRound] : null;
  const susO = originalRound ? s.sus?.[originalRound] : null;
  const scoreA = susScore(susA?.items), scoreO = susScore(susO?.items);
  const mine = [...trialRows.values()].filter((t) => t.sessionId === s.sessionId);
  const byCond = (c) => mine.filter((t) => t.condition === c);
  const seqMean = (c) => mean(byCond(c).map(seqEasy).filter((x) => x != null));
  const pref = s.final?.preferred;
  const prefCond = pref === 'round1' || pref === 'round2' ? (Number(pref.slice(-1)) === adaptedRound ? 'adapted' : 'original') : pref ?? null;
  const touch = (s.device?.inputsSeen ?? []).includes('touch');
  const excluded = s.final?.useMyData === 'no' ? 'said_not_to_use' : !touch ? 'no_touch' : null;

  participants.push({
    code: s.code, cohort: s.cohort, protocol: s.protocol, sequence: s.sequence, adapted_round: adaptedRound,
    finished: !!s.finishedAt && s.stage === 'done', excluded,
    age_band: s.about?.ageBand, troubles: (s.about?.troubles ?? []).join('|'),
    zoom_to_read: s.about?.zoomToRead, tap_wrong: s.about?.tapWrong, held: s.about?.held,
    fit_body_px: s.calibration?.fit?.text?.bodyPx ?? null, fit_target_px: s.calibration?.fit?.targets?.minPx ?? null,
    warmup_sec: s.calibration?.durationSec ?? null, warmup_skipped: (s.calibration?.skipped ?? []).join('|'),
    sus_original: scoreO, sus_adapted: scoreA, sus_diff: scoreA != null && scoreO != null ? Math.round((scoreA - scoreO) * 100) / 100 : null,
    sus_original_flag: susO?.flagged ?? null, sus_adapted_flag: susA?.flagged ?? null,
    seq_original: seqMean('original'), seq_adapted: seqMean('adapted'),
    preferred: prefCond, realism: s.final?.realism ?? null, use_my_data: s.final?.useMyData ?? null,
    comment_original: originalRound ? s.comments?.[originalRound] ?? null : null,
    comment_adapted: adaptedRound ? s.comments?.[adaptedRound] ?? null : null,
    deviations: (s.final?.deviations ?? []).join('|'),
    screen: s.device ? `${s.device.screen.w}x${s.device.screen.h}@${s.device.screen.dpr}` : null,
    ref_line_px: s.device?.refLinePx ?? null, reduced_motion: s.device?.reducedMotion ?? null, dark_mode: s.device?.darkMode ?? null,
    user_agent: s.device?.userAgent ?? null, engine: s.engineCommit,
  });

  if (!excluded && scoreA != null && scoreO != null) pairs.sus.push(scoreA - scoreO);
  const proA = susProrated(susA?.items), proO = susProrated(susO?.items);
  if (!excluded && proA != null && proO != null) pairs.susPro.push(proA - proO);
  if (!excluded && Number.isFinite(seqMean('adapted')) && Number.isFinite(seqMean('original'))) pairs.seq.push(seqMean('adapted') - seqMean('original'));

  for (const t of mine) {
    const m = t.metrics ?? {}, d = t.delivery ?? {};
    trials.push({
      code: s.code, sequence: s.sequence, round: t.round, position: t.position, family: t.family, set: t.set,
      condition: t.condition, replica: t.replicaId, task: t.taskId,
      active_s: t.hiddenMs >= 300000 ? null : Math.round(t.activeMs) / 1000,
      interrupted: t.hiddenMs >= 60000 || t.hiddenEpisodes > 3,
      end: t.endAction, outcome: outcomeOf(t), answer: t.answer, correct: t.correct,
      seq_as_asked: t.seq, seq_scale: t.seqScale ?? 'difficult-1', seq: seqEasy(t),
      taps: m.taps, misses: m.misses, near_misses: m.nearMisses, activations: m.activations, link_attempts: m.linkAttempts,
      repeat_taps: m.repeatTaps, rage: m.rageEpisodes, debounced: m.debounced, expands: m.expands,
      scroll_screens: m.scrollScreens, scroll_reversals: m.scrollReversals, answer_seen: m.answerSeen, answer_seen_s: m.answerSeenMs != null ? m.answerSeenMs / 1000 : null,
      simplified_at_end: m.simplifiedAtEnd, pinch_used: t.pinch?.used, pinch_max: t.pinch?.maxScale, pinch_s: t.pinch ? t.pinch.zoomedMs / 1000 : null,
      ready_ms: t.readyMs, ready_late: t.readyLate, orientation_changes: t.orientationChanges,
      delivered: d.delivered ?? null, page_zoom: d.pageZoom ?? null, body_px_after: d.bodyPxAfter ?? null,
      simplified_open: d.simplified?.open ?? null, compose_failed: d.compose?.failed ?? null,
      ops_applied: d.ops ? d.ops.filter((o) => o.status === 'applied').length : null,
      ops_reversed: d.ops ? d.ops.filter((o) => o.status === 'reversed').length : null,
      ops_from_warmup: opsFrom(d, 'fit'), ops_from_ai: opsFrom(d, 'jev'), ops_no_source: opsFrom(d, undefined),
      replay_misses: d.replayMisses ? d.replayMisses.length : null, excluded,
    });
  }
}

/* ---------------- summary ---------------- */

const fmt = (x, k = 1) => (x == null || Number.isNaN(x) ? '–' : x.toFixed(k));
const ci = pairedCI(pairs.sus);
const ciPro = pairedCI(pairs.susPro);
const ciSeq = pairedCI(pairs.seq);
const ok = trials.filter((t) => !t.excluded && t.round > 0);
const succ = (c) => ok.filter((t) => t.condition === c);
const rate = (c) => `${succ(c).filter((t) => t.correct).length} of ${succ(c).length}`;
const gm = (c) => Math.exp(mean(succ(c).filter((t) => t.correct && t.active_s > 0).map((t) => Math.log(t.active_s))));

const summary = `# WebAble mobile study export (${cohort})

Generated ${new Date().toISOString()}. Participants: ${participants.length} (finished ${participants.filter((p) => p.finished).length}, withdrawn ${withdrawn.size}, excluded ${participants.filter((p) => p.excluded).length}).

Sequences: ${[0, 1, 2, 3].map((q) => `${q}: ${participants.filter((p) => p.sequence === q).length}`).join(', ')}.

## SUS (7-point, 0–100), adapted minus original

Complete cases: n = ${ci?.n ?? 0}. Mean difference ${fmt(ci?.mean)} points, 95% CI ${fmt(ci?.lo)} to ${fmt(ci?.hi)}, dz ${fmt(ci?.dz, 2)}.
${pairs.sus.length ? `Rated the adapted round higher: ${pairs.sus.filter((d) => d > 0).length} of ${pairs.sus.length} (ties ${pairs.sus.filter((d) => d === 0).length}).` : ''}
Sensitivity (one missing item prorated): n = ${ciPro?.n ?? 0}, mean ${fmt(ciPro?.mean)}, 95% CI ${fmt(ciPro?.lo)} to ${fmt(ciPro?.hi)}.

## Per task

| | Original | Adapted |
|---|---|---|
| Correct answers | ${rate('original')} | ${rate('adapted')} |
| Answer's sentence on screen at some point | ${succ('original').filter((t) => t.answer_seen).length} of ${succ('original').length} | ${succ('adapted').filter((t) => t.answer_seen).length} of ${succ('adapted').length} |
| Geometric-mean active time, correct answers (s) | ${fmt(gm('original'))} | ${fmt(gm('adapted'))} |
| Mean SEQ (1–7, higher = easier) | ${fmt(mean(succ('original').map((t) => t.seq).filter((x) => x != null)), 2)} | ${fmt(mean(succ('adapted').map((t) => t.seq).filter((x) => x != null)), 2)} |
| Misses per tap | ${fmt(mean(succ('original').filter((t) => t.taps).map((t) => t.misses / t.taps)), 3)} | ${fmt(mean(succ('adapted').filter((t) => t.taps).map((t) => t.misses / t.taps)), 3)} |
| Pinch zoom used | ${succ('original').filter((t) => t.pinch_used).length} of ${succ('original').length} | ${succ('adapted').filter((t) => t.pinch_used).length} of ${succ('adapted').length} |
| WebAble delivered a change | – | ${succ('adapted').filter((t) => t.delivered).length} of ${succ('adapted').length} |

SEQ paired (person means): n = ${ciSeq?.n ?? 0}, mean difference ${fmt(ciSeq?.mean, 2)}, 95% CI ${fmt(ciSeq?.lo, 2)} to ${fmt(ciSeq?.hi, 2)}.

## How each website ended

| Outcome | Original | Adapted |
|---|---|---|
${OUTCOMES.map((o) => `| ${o.replace(/_/g, ' ')} | ${succ('original').filter((t) => t.outcome === o).length} | ${succ('adapted').filter((t) => t.outcome === o).length} |`).join('\n')}

Slow work, repeated taps and misses describe what happened on these pages. They are not measures of anyone's memory,
thinking, eyesight or hands, and must not be reported as such.

These numbers describe this sample and these pages. Run the preregistered models (docs/STUDY.md) before saying anything
about an effect. Never name a condition, and never say "people with" anything.
`;

mkdirSync(outDir, { recursive: true, mode: 0o700 });
writeFileSync(join(outDir, 'participants.csv'), toCsv(participants), { mode: 0o600 });
writeFileSync(join(outDir, 'trials.csv'), toCsv(trials), { mode: 0o600 });
writeFileSync(join(outDir, 'responses.json'), JSON.stringify([...sessions.values()], null, 2), { mode: 0o600 });
writeFileSync(join(outDir, 'summary.md'), summary, { mode: 0o600 });
console.log(summary);
console.log(`Files in ${outDir}`);
