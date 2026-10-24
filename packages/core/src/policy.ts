// Code decides on Jev's raw probabilities (research-jev §4.4). Owner: A1.
//
//   promote     main_pick p >= 0.90 (duplicate-label links summed first), element's main Noul >= 0.70, not off-site;
//               `none` >= 0.60 promotes nothing.
//   keep_popup  role popup_overlay but task >= 0.70 (e.g. a session-timeout warning).
//   protect     P(main_content + form_field + action_button + navigation + help_contact + consent_notice +
//               account_utility) >= 0.05, or task >= 0.30, or help >= 0.30, or a local rule (focus inside,
//               required field, has a typed value, consent notice). Never folded, dimmed or moved off-screen.
//   fold        P(advertising + recommendations + popup_overlay) >= 0.90 and task <= 0.20 and help <= 0.10 and not
//               protected.
//   keep        everything else, including elements Jev did not answer (fail closed).
import type { ElementDecision, ElementEvidence, ElementJudgment, OverlayKind, PageDigest, PageUnderstanding, Role } from './types';

export interface LocalFacts { focusedIds: string[]; requiredIds: string[]; filledIds: string[]; consentIds: string[]; offsiteIds: string[] }

export const POLICY = Object.freeze({
  acceptRole: 0.9,
  protectRoleSum: 0.05,
  protectTask: 0.3,
  protectHelp: 0.3,
  foldRoleSum: 0.9,
  foldTaskMax: 0.2,
  foldHelpMax: 0.1,
  keepPopupTask: 0.7,
  promotePick: 0.9,
  promoteMainNoul: 0.7,
  noneVeto: 0.6,
});

const PROTECT_ROLES: readonly Role[] = [
  'main_content', 'form_field', 'action_button', 'navigation', 'help_contact', 'consent_notice', 'account_utility',
];
const FOLD_ROLES: readonly Role[] = ['advertising', 'recommendations', 'popup_overlay'];

const ROLE_WORDS: Record<Role, string> = {
  main_content: 'main content', form_field: 'form field', action_button: 'action button', navigation: 'navigation',
  search: 'search', advertising: 'advertising', recommendations: 'recommendations', popup_overlay: 'popup',
  consent_notice: 'consent notice', help_contact: 'help', account_utility: 'account', legal_footer: 'legal links',
  other: 'other',
};

const f2 = (p: number): string => p.toFixed(2);
// Probabilities are quantized to 0.01; round sums so 0.02 + 0.03 compares as exactly 0.05.
const sum = (j: ElementJudgment, roles: readonly Role[]): number =>
  Math.round(roles.reduce((t, r) => t + (j.roleProbs[r] ?? 0), 0) * 1e6) / 1e6;

/** The role Jev answered with p_max >= 0.90, or null when it was not sure enough to name one. */
export function acceptedRole(j: ElementJudgment): Role | null {
  return j.roleP >= POLICY.acceptRole ? j.role : null;
}

function normLabel(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\[\] ]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Main-action pick with duplicate links merged: candidates with the same label and link target split Jev's
 * probability (FPL: 0.48 / 0.24 / 0.22 over three "Report an Outage" links), so their probabilities are summed
 * before the threshold and the best member of the winning group is promoted.
 */
export function resolveMainPick(
  u: PageUnderstanding, digest: PageDigest, local: LocalFacts,
): { id: string | null; groupP: number; noneP: number; members: string[]; reason: string } {
  const probs = u.mainPick?.probs ?? {};
  const noneP = probs.none ?? 0;
  const byId = new Map<string, ElementEvidence>(digest.elements.map((e) => [e.id, e]));
  const judged = new Map(u.elements.map((j) => [j.id, j]));
  const offsite = new Set(local.offsiteIds);
  const consent = new Set(local.consentIds);
  const groups = new Map<string, { p: number; ids: string[] }>();
  for (const [id, p] of Object.entries(probs)) {
    if (id === 'none') continue;
    const e = byId.get(id);
    if (!e) continue;
    const key = `${normLabel(e.label)}|${e.link_target ?? ''}|${e.tag === 'a' ? 'a' : 'control'}`;
    const g = groups.get(key) ?? { p: 0, ids: [] };
    g.p += p;
    g.ids.push(id);
    groups.set(key, g);
  }
  let best: { p: number; ids: string[] } | null = null;
  for (const g of groups.values()) if (!best || g.p > best.p) best = g;
  if (noneP >= POLICY.noneVeto) return { id: null, groupP: best?.p ?? 0, noneP, members: [], reason: `no single main action (none ${f2(noneP)})` };
  if (!best || best.p < POLICY.promotePick) {
    return { id: null, groupP: best?.p ?? 0, noneP, members: best?.ids ?? [], reason: `main action unsure (${f2(best?.p ?? 0)})` };
  }
  const eligible = best.ids
    .filter((id) => {
      const e = byId.get(id);
      const j = judged.get(id);
      return e && j && j.main >= POLICY.promoteMainNoul && e.link_target !== 'another website' && !offsite.has(id) && !consent.has(id);
    })
    .sort((a, b) => (judged.get(b)!.main - judged.get(a)!.main) || ((probs[b] ?? 0) - (probs[a] ?? 0)));
  const id = eligible[0] ?? null;
  return {
    id,
    groupP: best.p,
    noneP,
    members: best.ids,
    reason: id ? `main action ${f2(best.p)}${best.ids.length > 1 ? ` over ${best.ids.length} matching links` : ''}` : 'main action failed a code veto',
  };
}

/** One decision per digest element, in digest order. */
export function decideElements(u: PageUnderstanding, digest: PageDigest, local: LocalFacts): ElementDecision[] {
  const judged = new Map(u.elements.map((j) => [j.id, j]));
  const focused = new Set(local.focusedIds);
  const required = new Set(local.requiredIds);
  const filled = new Set(local.filledIds);
  const consent = new Set(local.consentIds);
  const pick = resolveMainPick(u, digest, local);
  const out: ElementDecision[] = [];

  for (const e of digest.elements) {
    const j = judged.get(e.id);
    const localReasons: string[] = [];
    if (consent.has(e.id)) localReasons.push('consent notice (rule)');
    if (focused.has(e.id)) localReasons.push('focus is inside (rule)');
    if (required.has(e.id)) localReasons.push('required field (rule)');
    if (filled.has(e.id)) localReasons.push('has a typed value (rule)');

    if (!j) {
      out.push({
        id: e.id,
        verdict: localReasons.length ? 'protect' : 'keep',
        reasons: localReasons.length ? localReasons : ['no answer from Jev: left as is'],
        judgment: { id: e.id, role: 'other', roleP: 0, roleProbs: {}, task: 0, main: 0, help: 0 },
      });
      continue;
    }

    const roleText = `${ROLE_WORDS[j.role]} ${f2(j.roleP)}`;
    const protectSum = sum(j, PROTECT_ROLES);
    const foldSum = sum(j, FOLD_ROLES);

    if (pick.id === e.id) {
      out.push({ id: e.id, verdict: 'promote', reasons: [pick.reason, `main ${f2(j.main)}`, roleText], judgment: j });
      continue;
    }
    if (j.role === 'popup_overlay' && j.task >= POLICY.keepPopupTask && !consent.has(e.id)) {
      out.push({ id: e.id, verdict: 'keep_popup', reasons: [`popup that affects the task (task ${f2(j.task)})`, ...localReasons], judgment: j });
      continue;
    }
    const why: string[] = [...localReasons];
    if (j.help >= POLICY.protectHelp) why.push(`help ${f2(j.help)}`);
    if (j.task >= POLICY.protectTask) why.push(`task ${f2(j.task)}`);
    if (protectSum >= POLICY.protectRoleSum) {
      const top = PROTECT_ROLES.filter((r) => (j.roleProbs[r] ?? 0) > 0).sort((a, b) => (j.roleProbs[b] ?? 0) - (j.roleProbs[a] ?? 0))[0];
      why.push(top === j.role ? roleText : `${ROLE_WORDS[top ?? j.role]} ${f2(j.roleProbs[top ?? j.role] ?? 0)}`);
    }
    if (why.length > 0) {
      out.push({ id: e.id, verdict: 'protect', reasons: dedupe(why), judgment: j });
      continue;
    }
    if (foldSum >= POLICY.foldRoleSum && j.task <= POLICY.foldTaskMax && j.help <= POLICY.foldHelpMax) {
      const reasons = [roleText];
      if (!FOLD_ROLES.includes(j.role) || Math.abs(foldSum - j.roleP) >= 0.005) reasons.push(`ads, teasers and popups ${f2(foldSum)}`);
      reasons.push(`task ${f2(j.task)}`, `help ${f2(j.help)}`);
      out.push({ id: e.id, verdict: 'fold', reasons, judgment: j });
      continue;
    }
    out.push({ id: e.id, verdict: 'keep', reasons: [roleText, `task ${f2(j.task)}`], judgment: j });
  }
  return out;
}

function dedupe(xs: string[]): string[] {
  return [...new Set(xs)];
}

/* ------------------------------------------------------------------ */
/* Overlays that cover the task ("make room", round 2)                 */
/* ------------------------------------------------------------------ */
//
// Code decides from local facts plus Jev's v1 answers (overlays brief):
//   act when       something the task needs is blocked, one overlay covers >= 0.12, or all together >= 0.25
//                  (largest first, until under 0.15); folded popups (survey, newsletter, promo) at any coverage.
//   warning        alertdialog or task >= 0.70 (the session timeout scored 0.81): kept in front, never moved.
//   consent        1-4 site choices (a lone "Close" counts), no toggles, not a full-page wall: docked into a bar,
//                  never answered.
//   chat           opened by itself, nothing focused or typed inside, launcher in the DOM: minimised with its own
//                  button once Jev finds it; otherwise tucked with a chip.
//   survey/newsletter/promo  Jev's v1 fold rule and not modal: tucked to the nearest edge with a chip.
//   modal          offered only.
//   promo_bar      advertising >= 0.90: unpinned at the top, tucked at the bottom.
//   header         taller than 20% of the screen: unpinned.
// Never touched: overlays the person opened (< 1.5 s after their last press or key), ones in use (focus or typing
// inside), kinds the person undid on this site in the last 30 days, and any overlay after 2 automatic actions.

export interface OverlayFacts {
  id: string;
  kind: OverlayKind;
  /** Share of the viewport grid where this overlay is on top (0..1). */
  coverage: number;
  /** It covers the main action, a main-form field, the focused element or the h1. */
  blocks: boolean;
  /** It appeared more than 1.5 s after the person's last press or key. */
  selfOpened: boolean;
  /** Focus, a press or typing inside it. */
  touched: boolean;
  /** Site buttons inside it (consent: the choices). */
  choices: number;
  /** Visible checkboxes or switches inside it. */
  toggles: boolean;
  /** A full-page wall (covers most of the screen or has a backdrop). */
  wall: boolean;
  modal: boolean;
  /** Jev's v1 fold rule fired on it (popup / advertising >= 0.90, task <= 0.20, help <= 0.10). */
  folded: boolean;
  /** Highest task probability Jev gave the overlay itself (0 when unknown). */
  task: number;
  alertdialog: boolean;
  /** Jev's advertising probability for it (promo bars). */
  advertising: number;
  /** Where it is anchored on screen. */
  edge: 'top' | 'bottom' | 'side' | 'center';
  /** Its height as a share of the screen (headers). */
  heightShare: number;
  /** A chat launcher is already in the DOM. */
  launcher: boolean;
  /** The person undid this kind on this site within 30 days. */
  leave: boolean;
  /** Automatic actions WebAble already took on this overlay. */
  actions: number;
}

export type OverlayPlan = 'dock' | 'minimise' | 'tuck' | 'unpin' | 'offer' | 'keep' | 'none';

export const OVERLAY_POLICY = Object.freeze({
  actOne: 0.12,
  actAll: 0.25,
  actUntil: 0.15,
  warningTask: 0.7,
  promoAd: 0.9,
  headerShare: 0.2,
  maxActions: 2,
  consentMin: 1,
  consentMax: 4,
});

const ACTION_KINDS: readonly OverlayKind[] = ['consent', 'chat', 'survey', 'newsletter', 'promo_bar', 'modal', 'header', 'other'];

function isWarning(f: OverlayFacts): boolean {
  return f.kind === 'warning' || f.alertdialog || f.task >= OVERLAY_POLICY.warningTask;
}

function canAct(f: OverlayFacts): boolean {
  if (isWarning(f)) return false;
  if (f.leave || f.actions >= OVERLAY_POLICY.maxActions || f.touched || !f.selfOpened) return false;
  return ACTION_KINDS.includes(f.kind);
}

/** One plan per overlay, in input order. Pure: the engine measures, this decides. */
export function planOverlays(facts: OverlayFacts[]): Array<{ id: string; plan: OverlayPlan; reason: string }> {
  const need = new Set<string>();
  for (const f of facts) if (f.blocks || f.coverage >= OVERLAY_POLICY.actOne) need.add(f.id);
  const total = facts.reduce((s, f) => s + Math.max(0, f.coverage), 0);
  if (total >= OVERLAY_POLICY.actAll) {
    let left = total;
    for (const f of [...facts].sort((a, b) => b.coverage - a.coverage)) {
      if (left < OVERLAY_POLICY.actUntil) break;
      if (!canAct(f) || f.coverage <= 0) continue;
      need.add(f.id);
      left -= f.coverage;
    }
  }
  return facts.map((f) => {
    const pct = `${Math.round(f.coverage * 100)}%`;
    if (isWarning(f)) {
      return { id: f.id, plan: 'keep' as const, reason: f.task > 0 ? `a warning (task ${f.task.toFixed(2)})` : 'a warning' };
    }
    if (f.leave) return { id: f.id, plan: 'none' as const, reason: 'you brought this kind back on this site before' };
    if (f.actions >= OVERLAY_POLICY.maxActions) return { id: f.id, plan: 'none' as const, reason: 'already moved twice' };
    if (!f.selfOpened) return { id: f.id, plan: 'none' as const, reason: 'you opened it' };
    if (f.touched) return { id: f.id, plan: 'none' as const, reason: 'in use' };
    const needed = need.has(f.id);
    const why = f.blocks ? `it covered part of the task (${pct} of the screen)` : `it covered ${pct} of the screen`;
    switch (f.kind) {
      case 'consent':
        if (!needed) return { id: f.id, plan: 'none' as const, reason: `small (${pct})` };
        if (f.wall) return { id: f.id, plan: 'keep' as const, reason: 'a full-page consent wall' };
        if (f.toggles) return { id: f.id, plan: 'keep' as const, reason: 'it has switches to set' };
        if (f.choices < OVERLAY_POLICY.consentMin || f.choices > OVERLAY_POLICY.consentMax) {
          return { id: f.id, plan: 'keep' as const, reason: `${f.choices} choices` };
        }
        return { id: f.id, plan: 'dock' as const, reason: why };
      case 'chat':
        if (!needed) return { id: f.id, plan: 'none' as const, reason: `small (${pct})` };
        return { id: f.id, plan: f.launcher ? ('minimise' as const) : ('tuck' as const), reason: why };
      case 'modal':
        return needed || f.folded
          ? { id: f.id, plan: 'offer' as const, reason: why }
          : { id: f.id, plan: 'none' as const, reason: `small (${pct})` };
      case 'survey':
      case 'newsletter':
      case 'other':
        // A floating panel the page did not ask the person about, sitting on the main action or a main field
        // (an "Alerts" flyout over "Apply now"): tucked with a chip, so it is one press away.
        if (!f.folded && f.kind === 'other' && f.blocks && !f.modal && !f.wall && f.edge !== 'center' && f.coverage < 0.35) {
          return { id: f.id, plan: 'tuck' as const, reason: why };
        }
        if (!f.folded) return { id: f.id, plan: 'none' as const, reason: 'Jev has not folded it' };
        if (f.modal || f.wall) return { id: f.id, plan: 'offer' as const, reason: 'a popup over the whole page' };
        return { id: f.id, plan: 'tuck' as const, reason: f.kind === 'other' ? 'Jev folded it' : `Jev folded the ${f.kind}` };
      case 'promo_bar':
        if (f.advertising < OVERLAY_POLICY.promoAd && !f.folded) return { id: f.id, plan: 'none' as const, reason: `advertising ${f.advertising.toFixed(2)}` };
        if (f.edge === 'top') return { id: f.id, plan: 'unpin' as const, reason: 'a pinned promotion bar' };
        if (f.edge === 'bottom') return { id: f.id, plan: 'tuck' as const, reason: 'a pinned promotion bar' };
        return { id: f.id, plan: 'none' as const, reason: 'not at an edge' };
      case 'header':
        return f.heightShare > OVERLAY_POLICY.headerShare
          ? { id: f.id, plan: 'unpin' as const, reason: `it took ${Math.round(f.heightShare * 100)}% of the screen` }
          : { id: f.id, plan: 'none' as const, reason: 'short enough' };
      default:
        return { id: f.id, plan: 'none' as const, reason: 'unknown kind' };
    }
  });
}

export function summarizeDecisions(d: ElementDecision[]): { folded: number; protected: number; mainId: string | null } {
  let folded = 0;
  let prot = 0;
  let mainId: string | null = null;
  for (const x of d) {
    if (x.verdict === 'fold') folded++;
    else if (x.verdict === 'protect' || x.verdict === 'keep_popup') prot++;
    else if (x.verdict === 'promote' && mainId === null) mainId = x.id;
  }
  return { folded, protected: prot, mainId };
}
