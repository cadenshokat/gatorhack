// A realistic sample page fragment (a fictional library) drawn as the original and as fitted, so the
// person sees their real values on a real-looking page before saving.

import { contrastRatio, liftToRatio, mapFontSize, parseColor, type FitProfile } from '@webable/core';
import type { JSX } from 'preact';
import { effectiveTextPx } from '../logic/fitview';

const ORIG = {
  body: 15,
  h1: 26,
  title: 16,
  small: 13,
  nav: 13,
  button: 13,
  buttonH: 26,
  ink: '#1D1D1F',
  body2: '#6E6E73',
  faint: '#A1A1A6',
  nav2: '#8E8E93',
};

function mapSize(s: number, base: number, target: number): number {
  if (target <= base * 1.02) return s;
  const k = target / base;
  const e = Math.min(1, Math.max(0.2, 1 - 0.48 * Math.log2(k)));
  try {
    const v = mapFontSize(s, base, target, e);
    if (Number.isFinite(v) && v > 0) return Math.max(s, v);
  } catch {
    /* core not ready: same formula locally */
  }
  const v = s >= base ? target * (s / base) ** e : Math.min(target, s * k);
  return Math.max(s, v);
}

const FALLBACK_LIFT: Record<string, string> = { '4.5': '#767676', '7': '#595959' };

function lift(fg: string, bg: string, floor: number, band: FitProfile['contrast']['band']): string {
  if (band === 'S') return '#111111';
  try {
    const f = parseColor(fg);
    const b = parseColor(bg);
    if (!f || !b) throw new Error('unparsed colour');
    if (contrastRatio(f, b) >= floor) return fg;
    return liftToRatio(f, b, floor);
  } catch {
    return FALLBACK_LIFT[String(floor)] ?? '#595959';
  }
}

function ratioOf(fg: string, bg: string): number | null {
  try {
    const f = parseColor(fg);
    const b = parseColor(bg);
    return f && b ? contrastRatio(f, b) : null;
  } catch {
    return null;
  }
}

export function Preview(props: { fit: FitProfile; fitted: boolean }): JSX.Element {
  const { fit, fitted } = props;
  const dark = fitted && fit.polarity.value === 'dark';
  const bg = dark ? '#121212' : '#FFFFFF';
  const target = effectiveTextPx(fit);
  const sz = (s: number) => (fitted ? Math.round(mapSize(s, ORIG.body, Math.max(ORIG.body, target)) * 10) / 10 : s);
  const floor = fit.contrast.floor;
  const col = (c: string) => {
    if (!fitted) return c;
    if (dark) return c === ORIG.ink ? '#EDEDED' : fit.contrast.band === 'S' ? '#EDEDED' : '#C7C7CC';
    return lift(c, bg, floor, fit.contrast.band);
  };
  const weight = fitted ? Math.max(400, Math.min(700, fit.weight.floor)) : 400;
  const lh = fitted ? Math.max(1.4, fit.spacing.lineHeight) : 1.4;
  const minHit = fitted ? fit.targets.minPx : null;
  const showHit = minHit !== null && minHit > ORIG.buttonH;
  const level = fit.attention.structureLevel;
  const motionOff = fitted && fit.attention.motion.on;

  const faintBefore = ratioOf(ORIG.faint, '#FFFFFF');
  const notes: string[] = [];
  if (fitted && target > ORIG.body + 0.5) notes.push(`Text ${ORIG.body} → ${Math.round(sz(ORIG.body))} px`);
  if (fitted && !dark && col(ORIG.faint) !== ORIG.faint)
    notes.push(`Faint text ${faintBefore ? faintBefore.toFixed(1) : '2.6'}:1 → ${fit.contrast.band === 'S' ? 'max' : `${floor}:1`}`);
  if (fitted && showHit) notes.push(`Click area ${ORIG.buttonH} → ${minHit} px`);

  const renew = (title: string, due: string) => (
    <li class="pv-item">
      <div class="pv-item-text">
        <span class="pv-title" style={{ fontSize: `${sz(ORIG.title)}px`, color: col(ORIG.ink), fontWeight: Math.max(600, weight) }}>
          {title}
        </span>
        <span class="pv-due" style={{ fontSize: `${sz(ORIG.small)}px`, color: col(ORIG.body2), fontWeight: weight }}>
          {due}
        </span>
      </div>
      <span class="pv-btn-wrap">
        {showHit ? (
          <span class="pv-hit" aria-hidden="true" style={{ width: `${Math.max(64, minHit ?? 0)}px`, height: `${minHit}px` }} />
        ) : null}
        <span class="pv-btn" style={{ fontSize: `${ORIG.button}px`, height: `${ORIG.buttonH}px` }}>
          Renew
        </span>
      </span>
    </li>
  );

  const promo = (
    <div class={`pv-promo ${fitted && level === 1 ? 'is-dimmed' : ''}`}>
      <div>
        <strong style={{ fontSize: `${sz(ORIG.title)}px` }}>Summer reading challenge</strong>
        <span style={{ fontSize: `${sz(ORIG.small)}px` }}>Read five books, win a tote bag.</span>
      </div>
      <span class="pv-promo-dots" aria-hidden="true">
        <i class="on" />
        <i />
        <i />
      </span>
      {motionOff ? <span class="pv-chip">Paused</span> : null}
    </div>
  );

  return (
    <div class={`pv ${fitted ? 'is-fitted' : ''} ${dark ? 'is-dark' : ''}`} style={{ background: bg, lineHeight: lh }}>
      <div class="pv-head" style={{ borderColor: dark ? '#2C2C2E' : '#E8E8ED' }}>
        <span class="pv-logo" style={{ color: col(ORIG.ink), fontSize: `${sz(ORIG.title)}px` }}>
          <i aria-hidden="true" /> Maple Grove Library
        </span>
        <span class="pv-nav" style={{ fontSize: `${sz(ORIG.nav)}px`, color: col(ORIG.nav2) }}>
          <span>Catalog</span>
          <span>Events</span>
          <span>Visit</span>
          <span>My account</span>
        </span>
      </div>

      {fitted && level === 2 ? null : promo}

      <div class="pv-main">
        <h3 class="pv-h1" style={{ fontSize: `${sz(ORIG.h1)}px`, color: col(ORIG.ink) }}>
          Renew your books
        </h3>
        <p
          class="pv-p"
          style={{ fontSize: `${sz(ORIG.body)}px`, color: col(ORIG.body2), fontWeight: weight, maxWidth: fitted ? `${fit.measure.maxCpl}ch` : undefined }}
        >
          Most items can be renewed up to three times, as long as nobody is waiting for them. Each renewal adds three weeks from
          today.
        </p>
        <ul class="pv-list">
          {renew('The Quiet Garden', 'Due Thursday, Oct 30')}
          {renew('Bread for Beginners', 'Due Saturday, Nov 1')}
        </ul>
        <p class="pv-fine" style={{ fontSize: `${sz(ORIG.small)}px`, color: col(ORIG.faint), fontWeight: weight }}>
          Items with a waiting list cannot be renewed. Fees stop growing after 14 days.
        </p>
        <p class="pv-help" style={{ fontSize: `${sz(ORIG.body)}px` }}>
          Questions? <span class="pv-link">Ask a librarian</span>
        </p>
        {fitted && level === 2 ? (
          <div class="pv-drawer" style={{ fontSize: `${sz(ORIG.small)}px`, color: col(ORIG.body2) }}>
            More on this page · 1 promotion
          </div>
        ) : null}
      </div>

      {notes.length ? (
        <ul class="pv-notes" aria-label="What changed in this preview">
          {notes.slice(0, 3).map((n) => (
            <li>{n}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
