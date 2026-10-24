// The frame around every screen: top bar with the activity ruler, the action bar, the fit slip and pause.

import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Btn, Check } from './common';

export type Part = 'reading' | 'pointing' | 'finding';
export const PARTS: Part[] = ['reading', 'pointing', 'finding'];
export const PART_LABEL: Record<Part, string> = { reading: 'Reading', pointing: 'Pointing', finding: 'Finding' };
/** Typical seconds per part (brief §1), used for proportions only. */
const PART_WEIGHT: Record<Part, number> = { reading: 55, pointing: 20, finding: 32 };

export function Wordmark(): JSX.Element {
  return (
    <div class="fx-wordmark">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <circle cx="11" cy="11" r="9" fill="none" stroke="currentColor" stroke-width="2" />
        <circle cx="11" cy="11" r="4" fill="var(--accent)" />
      </svg>
      <span>WebAble</span>
    </div>
  );
}

export interface RulerState {
  part: Part | null;
  /** 0..1 inside the current part. */
  within: number;
  done: Part[];
  secondsLeft: number;
}

function timeLeft(s: number): string {
  if (s <= 45) return 'less than a minute left';
  const m = Math.round(s / 60);
  return m <= 1 ? 'about 1 minute left' : `about ${m} minutes left`;
}

export function Ruler(props: { state: RulerState }): JSX.Element {
  const { part, within, done } = props.state;
  const W = 480;
  const gap = 14;
  const total = PARTS.reduce((a, p) => a + PART_WEIGHT[p], 0);
  const usable = W - gap * (PARTS.length - 1) - 12;
  let x = 6;
  const sections = PARTS.map((p) => {
    const w = (PART_WEIGHT[p] / total) * usable;
    const s = { p, x0: x, x1: x + w };
    x += w + gap;
    return s;
  });
  const cur = sections.find((s) => s.p === part);
  const dotX = cur ? cur.x0 + (cur.x1 - cur.x0) * Math.min(1, Math.max(0, within)) : null;
  const idx = part ? PARTS.indexOf(part) : -1;
  const y = 12;
  return (
    <div class="fx-ruler">
      <svg viewBox={`0 0 ${W} 24`} aria-hidden="true" preserveAspectRatio="none">
        {sections.map((s) => {
          const isDone = done.includes(s.p) || (idx >= 0 && PARTS.indexOf(s.p) < idx);
          const ticks: JSX.Element[] = [];
          for (let t = s.x0; t <= s.x1 + 0.01; t += 12) {
            ticks.push(<line x1={t} x2={t} y1={y - 3} y2={y + 3} class="fx-ruler-tick" />);
          }
          if (s.p === part && dotX !== null) {
            return (
              <g>
                {ticks}
                <line x1={s.x0} x2={dotX} y1={y} y2={y} class="fx-ruler-done" />
                <line x1={dotX} x2={s.x1} y1={y} y2={y} class="fx-ruler-todo" />
              </g>
            );
          }
          return (
            <g>
              {ticks}
              <line x1={s.x0} x2={s.x1} y1={y} y2={y} class={isDone ? 'fx-ruler-done' : 'fx-ruler-todo'} />
            </g>
          );
        })}
        {dotX !== null ? <circle cx={dotX} cy={y} r="6" class="fx-ruler-dot" /> : null}
      </svg>
      <ol class="sr-only">
        {PARTS.map((p) => (
          <li aria-current={p === part ? 'step' : undefined}>{PART_LABEL[p]}</li>
        ))}
      </ol>
    </div>
  );
}

export function TopBar(props: { ruler: RulerState | null; title?: string }): JSX.Element {
  const r = props.ruler;
  const partIdx = r?.part ? PARTS.indexOf(r.part) + 1 : 0;
  return (
    <header class="fx-top">
      <Wordmark />
      <div class="fx-top-center">
        {r ? (
          <>
            <Ruler state={r} />
            <div class="fx-ruler-text">
              {r.part ? (
                <>
                  <span class="fx-only-wide">Part {partIdx} of 3 · </span>
                  <span>{PART_LABEL[r.part]}</span>
                  <span class="fx-only-wide"> · {timeLeft(r.secondsLeft)}</span>
                </>
              ) : (
                <span>{props.title ?? ''}</span>
              )}
            </div>
          </>
        ) : null}
      </div>
      <div class="fx-top-right" />
    </header>
  );
}

export function ActionBar(props: { onPause: () => void; onSkip: () => void; idle: boolean; skipLabel?: string }): JSX.Element {
  return (
    <div class="fx-actionbar" role="group" aria-label="Pause or skip">
      <div class="fx-actionbar-inner">
        <Btn kind="quiet" onClick={props.onPause} kbd="Esc">
          Pause
        </Btn>
        <Btn kind="quiet" onClick={props.onSkip}>
          {props.skipLabel ?? 'Skip this part'}
        </Btn>
      </div>
      <p class={`fx-idle ${props.idle ? 'is-on' : ''}`} aria-live="polite">
        {props.idle ? 'Take your time, or skip this part.' : ''}
      </p>
    </div>
  );
}

export interface SlipLine {
  key: string;
  label: string;
  value: string | null;
}

export function FitSlip(props: { lines: SlipLine[] }): JSX.Element {
  return (
    <aside class="fx-slip" aria-label="Your fit so far">
      <p class="fx-slip-title">Your fit</p>
      <ul>
        {props.lines.map((l) => (
          <li class={l.value ? 'is-filled' : ''}>
            <span class="fx-slip-label">{l.label}</span>
            <span class="fx-slip-value">
              {l.value ? (
                <>
                  {l.value}
                  <Check size={14} />
                </>
              ) : (
                <span class="fx-slip-blank" aria-label="not yet" />
              )}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function PauseOverlay(props: { onResume: () => void; onSkip: () => void; canSkip: boolean }): JSX.Element {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div class="fx-overlay" role="dialog" aria-modal="true" aria-labelledby="fx-pause-h">
      <div class="fx-overlay-card fade-in">
        <h1 id="fx-pause-h" ref={ref} tabIndex={-1} class="fx-h1">
          Paused
        </h1>
        <p class="fx-deck">Take as long as you like. Nothing is lost.</p>
        <div class="fx-row">
          <Btn kind="primary" onClick={props.onResume} kbd="Esc">
            Continue
          </Btn>
          {props.canSkip ? (
            <Btn kind="tonal" onClick={props.onSkip}>
              Skip this part
            </Btn>
          ) : null}
        </div>
      </div>
    </div>
  );
}
