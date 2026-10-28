// The manipulation check for one adapted page view: what WebAble delivered, from the engine's state and its last
// TabReport (engine-seams §6.10).

import type { OpKind, TabReport } from '@webable/core';
import type { EngineState } from '../../../extension/src/contracts';
import type { ChangeSource, DeliveryRecord } from '../contracts';
import type { ReplayMiss } from '../replay/types';

/** Ops a person can see or feel on the page (not the click helpers). */
const VISIBLE_OPS: ReadonlySet<OpKind> = new Set<OpKind>([
  'page_zoom', 'text_map', 'spacing', 'contrast', 'weight', 'measure', 'targets', 'motion', 'dim', 'promote_main',
  'unpin_sticky', 'calm_view', 'unobstruct', 'column', 'heading_scale',
]);

export interface DeliveryInput {
  state: EngineState;
  report: TabReport | null;
  engineCommit: string;
  fixturesVersion: string;
  settleMs: number;
  bodyPxBefore: number | null;
  /** The simplified page's body size (calmMetrics F), when it is open. */
  calmBodyPx: number | null;
  replayMisses: ReplayMiss[];
  toastsSeen: number;
  offersSeen: number;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function buildDelivery(i: DeliveryInput): DeliveryRecord {
  const s = i.state;
  // Who decided each op, from the ledger line logged with it: the person's warm-up settings, or the AI's page read.
  const ledger = s.ledger?.length ? s.ledger : i.report?.ledger ?? [];
  const sourceOf = new Map<string, ChangeSource>();
  for (const e of ledger) if (e.opId && (!sourceOf.has(e.opId) || e.action === 'applied')) sourceOf.set(e.opId, e.source);
  const ops = (s.ops?.length ? s.ops : i.report?.ops ?? []).map((o) => {
    const source = sourceOf.get(o.id);
    return { kind: o.kind, status: o.status, ...(o.reason ? { reason: o.reason } : {}), ...(source ? { source } : {}) };
  });
  const checks = s.checks?.length ? s.checks : i.report?.checks ?? [];
  const pageZoom = Number.isFinite(s.pageZoom) ? s.pageZoom : 1;
  const textZoom = Number.isFinite(s.textZoom) ? (s.textZoom as number) : pageZoom;
  // The text map (a phone whose width capped the zoom): every text size × textScale on top of the zoom.
  const textMapOn = (s.ops ?? []).some((o) => o.kind === 'text_map' && o.status === 'applied');
  const textScale = textMapOn && typeof s.textScale === 'number' && Number.isFinite(s.textScale) && s.textScale > 0 ? s.textScale : 1;
  const open = !!s.calm?.open;
  const bodyPxAfter = open && i.calmBodyPx !== null ? i.calmBodyPx : i.bodyPxBefore === null ? null : r1(i.bodyPxBefore * textZoom * textScale);
  const groups = Object.values(s.compose?.groups ?? {});
  const decisions = s.decisions ?? [];
  const applied = (s.ops ?? []).filter((o) => o.status === 'applied');
  const measurable = open || Math.abs(textZoom * textScale - 1) >= 0.01 || applied.some((o) => VISIBLE_OPS.has(o.kind));
  return {
    engineCommit: i.engineCommit,
    fixturesVersion: i.fixturesVersion,
    settleMs: Math.round(i.settleMs),
    phase: s.phase,
    pageZoom,
    textZoom,
    ...(textScale !== 1 ? { textScale } : {}),
    bodyPxBefore: i.bodyPxBefore,
    bodyPxAfter,
    simplified: { open, auto: !!s.calm?.auto },
    compose: {
      groups: groups.length,
      laidOut: groups.filter((g) => g.state === 'ready').length,
      kept: groups.filter((g) => g.state === 'kept').length,
      failed: groups.filter((g) => g.state === 'failed').length,
    },
    ops,
    checksFailed: checks.filter((c) => !c.pass).length,
    decisions: {
      folded: decisions.filter((d) => d.verdict === 'fold').length,
      protected: decisions.filter((d) => d.verdict === 'protect').length,
      promoted: decisions.filter((d) => d.verdict === 'promote').length,
    },
    overlays: (s.overlays?.length ? s.overlays : i.report?.overlays ?? []).length,
    toasts: i.toastsSeen,
    offers: i.offersSeen,
    replayMisses: i.replayMisses.map((m) => (m.id ? { what: m.what, id: m.id } : { what: m.what })),
    delivered: applied.length > 0 && measurable,
  };
}

/** The page's body text size in CSS px: the length-weighted median font size of its running text. */
export function measureBodyPx(doc: Document = document): number | null {
  const samples: Array<{ px: number; n: number }> = [];
  const pick = (sel: string) => {
    for (const el of Array.from(doc.querySelectorAll(sel))) {
      if (el.closest('nav, header, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"]')) continue;
      const n = (el.textContent ?? '').replace(/\s+/g, ' ').trim().length;
      if (n < 40) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (Number.isFinite(px) && px > 0) samples.push({ px, n });
    }
  };
  pick('main p, article p, [role="main"] p');
  if (samples.length < 3) {
    samples.length = 0;
    pick('p, li');
  }
  if (!samples.length) return null;
  samples.sort((a, b) => a.px - b.px);
  const total = samples.reduce((t, s) => t + s.n, 0);
  let acc = 0;
  for (const s of samples) {
    acc += s.n;
    if (acc * 2 >= total) return Math.round(s.px * 2) / 2;
  }
  return Math.round((samples[samples.length - 1] as { px: number }).px * 2) / 2;
}
