// Owner: D2. What each Lens chip says, from Jev's judgment and the policy's verdict.
import type { ElementDecision, ElementEvidence, PageUnderstanding, Role, Verdict } from '@webable/core';
import { roleLabel } from '../panel/format';

export type ChipVerdict = Verdict | 'pending';

/** The demo's band legend: act at or above 0.85, offer 0.5 to 0.85, leave below 0.5. */
export const ACT_P = 0.85;
export const OFFER_P = 0.5;

export type Band = 'act' | 'offer' | 'leave';
export function bandOf(p: number | null): Band {
  if (p == null) return 'leave';
  if (p >= ACT_P) return 'act';
  if (p >= OFFER_P) return 'offer';
  return 'leave';
}

export interface ChipModel {
  id: string;
  verdict: ChipVerdict;
  /** Short role text, e.g. 'main action', 'advertising', 'help'. */
  role: string;
  p: number | null;
  /** What WebAble did with it: 'protected', 'folded', 'kept in view', 'left alone', 'promoted'. */
  word: string;
  dashed: boolean;
  /** The element's own (redacted) label from the digest, for the decision log. */
  label: string;
  tag: string;
  reasons: string[];
}

const FOLD_ROLES: Role[] = ['advertising', 'recommendations', 'popup_overlay'];

function n(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export function chipFor(
  ev: ElementEvidence,
  decision: ElementDecision | undefined,
  u: PageUnderstanding | null,
): ChipModel {
  const base = { id: ev.id, label: ev.label || ev.role_hint || ev.tag, tag: ev.tag };
  if (!decision) {
    return {
      ...base,
      verdict: 'pending',
      role: ev.role_hint ? ev.role_hint.replace(/_/g, ' ') : ev.tag,
      p: null,
      word: 'reading',
      dashed: true,
      reasons: [],
    };
  }
  const j = decision.judgment;
  const reasons = Array.isArray(decision.reasons) ? decision.reasons : [];
  switch (decision.verdict) {
    case 'promote': {
      const pick = u && u.mainPick && u.mainPick.id === ev.id ? n(u.mainPick.p) : n(j?.main);
      return { ...base, verdict: 'promote', role: 'main action', p: pick, word: 'promoted', dashed: false, reasons };
    }
    case 'protect': {
      const helpish = n(j?.help) >= 0.3 || j?.role === 'help_contact';
      if (helpish) {
        return { ...base, verdict: 'protect', role: 'help', p: Math.max(n(j?.help), j?.role === 'help_contact' ? n(j?.roleP) : 0), word: 'protected', dashed: false, reasons };
      }
      if (j?.role === 'consent_notice') {
        return { ...base, verdict: 'protect', role: 'consent', p: n(j?.roleP), word: 'protected', dashed: false, reasons };
      }
      return { ...base, verdict: 'protect', role: roleLabel(j?.role), p: n(j?.roleP), word: 'protected', dashed: false, reasons };
    }
    case 'fold': {
      const probs = j?.roleProbs ?? {};
      const summed = FOLD_ROLES.reduce((s, r) => s + n(probs[r]), 0);
      const p = summed > 0 ? Math.min(1, summed) : n(j?.roleP);
      return { ...base, verdict: 'fold', role: roleLabel(j?.role), p, word: 'folded', dashed: false, reasons };
    }
    case 'keep_popup':
      return { ...base, verdict: 'keep_popup', role: 'popup', p: n(j?.task), word: 'kept in view', dashed: false, reasons };
    case 'keep':
    default: {
      const p = n(j?.roleP);
      const unsure = p < ACT_P;
      return { ...base, verdict: 'keep', role: roleLabel(j?.role), p, word: unsure ? 'left alone' : 'kept', dashed: unsure, reasons };
    }
  }
}

export function verdictCounts(decisions: ElementDecision[]): { folded: number; protected: number; promoted: number; keptPopup: number; leftAlone: number } {
  const c = { folded: 0, protected: 0, promoted: 0, keptPopup: 0, leftAlone: 0 };
  for (const d of decisions) {
    if (d.verdict === 'fold') c.folded++;
    else if (d.verdict === 'protect') c.protected++;
    else if (d.verdict === 'promote') c.promoted++;
    else if (d.verdict === 'keep_popup') c.keptPopup++;
    else if (n(d.judgment?.roleP) < ACT_P) c.leftAlone++;
  }
  return c;
}
