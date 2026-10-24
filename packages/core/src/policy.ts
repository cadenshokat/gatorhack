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
import type { ElementDecision, ElementEvidence, ElementJudgment, PageDigest, PageUnderstanding, Role } from './types';

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
