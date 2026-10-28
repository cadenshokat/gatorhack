// Fingerprints and hashes that key the frozen answers. Only evidence that does not depend on layout goes into a
// fingerprint: the same element must get the same key on every phone, at every frame height and zoom.

import type { ElementEvidence, OverlayButtonEvidence, OverlayEvidence, PageDigest } from '@webable/core';

const SEP = '|';

/** tag|role_hint|label|landmark|class words|link target|iframe kind. No size, position, zone or text length. */
export function elementFp(e: ElementEvidence): string {
  return [e.tag, e.role_hint, e.label, e.landmark, (e.class_words ?? []).join(' '), e.link_target ?? '', e.iframe_kind ?? ''].join(SEP);
}

/** Every piece of evidence in a digest (elements, then content regions), first occurrence of an id wins. */
export function digestEvidence(d: PageDigest): ElementEvidence[] {
  const seen = new Set<string>();
  const out: ElementEvidence[] = [];
  for (const e of [...(d.elements ?? []), ...(d.regions ?? [])]) {
    if (!e || typeof e.id !== 'string' || seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}

/** id -> [fingerprint, appears once in this digest]. */
export function fingerprintTable(d: PageDigest): Map<string, [string, boolean]> {
  const ev = digestEvidence(d);
  const counts = new Map<string, number>();
  const fps = ev.map((e) => elementFp(e));
  for (const fp of fps) counts.set(fp, (counts.get(fp) ?? 0) + 1);
  const out = new Map<string, [string, boolean]>();
  ev.forEach((e, i) => {
    const fp = fps[i] as string;
    out.set(e.id, [fp, counts.get(fp) === 1]);
  });
  return out;
}

export function overlayFp(o: OverlayEvidence): string {
  return ['overlay', o.kind_hint, o.label, (o.class_words ?? []).join(' '), o.iframe_kind ?? '', o.opened_by_itself ? 'self' : 'person'].join(SEP);
}

export function buttonFp(b: OverlayButtonEvidence): string {
  return [
    b.tag, b.label, b.visible_text, (b.class_words ?? []).join(' '), b.link_target ?? '', b.form_submit ? 'submit' : '',
    b.aria_expanded === undefined ? '' : String(b.aria_expanded),
  ].join(SEP);
}

/** The key of one overlayClose request: the overlay and its candidate buttons (in order), all by fingerprint. */
export function overlayKeyText(overlay: OverlayEvidence, candidates: OverlayButtonEvidence[]): string {
  return [overlayFp(overlay), ...candidates.slice(0, 8).map(buttonFp)].join('\n');
}

/** Which of the candidates with the same fingerprint this one is (0-based). */
export function nthOfFp(candidates: OverlayButtonEvidence[], id: string): { fp: string; nth: number } | null {
  const at = candidates.findIndex((c) => c.id === id);
  if (at < 0) return null;
  const fp = buttonFp(candidates[at] as OverlayButtonEvidence);
  let nth = 0;
  for (let i = 0; i < at; i++) if (buttonFp(candidates[i] as OverlayButtonEvidence) === fp) nth++;
  return { fp, nth };
}

/** The live candidate for a recorded pick, or null. */
export function candidateFor(candidates: OverlayButtonEvidence[], pick: { fp: string; nth: number }): OverlayButtonEvidence | null {
  let n = 0;
  for (const c of candidates) {
    if (buttonFp(c) !== pick.fp) continue;
    if (n === pick.nth) return c;
    n++;
  }
  return null;
}

/** JSON with object keys sorted at every depth (undefined dropped, as JSON.stringify does). */
export function canonicalJson(x: unknown): string {
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map((y) => (y === undefined ? null : walk(y)));
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) if (o[k] !== undefined) out[k] = walk(o[k]);
    return out;
  };
  return JSON.stringify(walk(x));
}

export async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
