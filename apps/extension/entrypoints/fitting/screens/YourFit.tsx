// "Your fit": real values with fit marks, steppers for text and click areas, an Original/Fitted preview,
// then Save. Every number here comes from the derived fit; a step becomes an override.

import type { FitProfile } from '@webable/core';
import type { JSX } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  canStep,
  cloneFit,
  effectiveTextPx,
  fitRows,
  stepValue,
  TARGET_STEPS,
  TEXT_STEPS,
  type FitRow,
  type RowKey,
} from '../logic/fitview';
import type { TaskId } from '../logic/raw';
import { Btn, Check, Deck, Heading } from '../ui/common';
import { Preview } from './Preview';

export type FitOrigin = 'measured' | 'demo' | 'default';

/** "16 → 28 px": numbers in the display face with tabular figures; the unit is set smaller, in secondary ink. */
function Mark(props: { from: string; to: string; changed: boolean }): JSX.Element {
  if (!props.changed) return <span class="fx-mark-text is-same">{props.to}</span>;
  const num = /^(\d+(?:\.\d+)?)\s*(px)$/;
  const f = num.exec(props.from.trim());
  const t = num.exec(props.to.trim());
  if (f && t && f[2] === t[2]) {
    return (
      <span class="fx-mark" aria-label={`from ${props.from} to ${props.to}`}>
        <span class="fx-mark-from" aria-hidden="true">
          {f[1]}
        </span>
        <span class="fx-mark-arrow" aria-hidden="true">
          →
        </span>
        <span class="fx-mark-to is-changed" aria-hidden="true">
          {t[1]}
          <span class="fx-mark-unit">{t[2]}</span>
        </span>
      </span>
    );
  }
  return <span class="fx-mark-text is-changed">{props.to}</span>;
}

function Stepper(props: { label: string; onMinus: () => void; onPlus: () => void; canMinus: boolean; canPlus: boolean }): JSX.Element {
  return (
    <span class="fx-stepper" role="group" aria-label={props.label}>
      <button type="button" class="fx-step" onClick={props.onMinus} disabled={!props.canMinus} aria-label={`${props.label}: smaller`}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <line x1="5" y1="10" x2="15" y2="10" />
        </svg>
      </button>
      <button type="button" class="fx-step" onClick={props.onPlus} disabled={!props.canPlus} aria-label={`${props.label}: larger`}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <line x1="5" y1="10" x2="15" y2="10" />
          <line x1="10" y1="5" x2="10" y2="15" />
        </svg>
      </button>
    </span>
  );
}

const SOURCE_TASK: Partial<Record<RowKey, TaskId[]>> = {
  text: ['R1', 'R2'],
  contrast: ['R3'],
  weight: ['R3'],
  polarity: ['R4'],
  targets: ['P1'],
  steady: ['P1'],
  debounce: ['P1'],
  motion: ['F1', 'F3'],
  busy: ['F1', 'F2', 'F3'],
};

export function YourFit(props: {
  initial: FitProfile;
  origin: FitOrigin;
  demoName?: string;
  done: ReadonlySet<TaskId>;
  reducedMotion: boolean;
  saving: boolean;
  /** Called with the fit as shown (after any stepper change), so other Save buttons save the same thing. */
  onChange?: (fit: FitProfile) => void;
  onSave: (fit: FitProfile) => void;
  onRestart: () => void;
}): JSX.Element {
  const [fit, setFit] = useState<FitProfile>(() => cloneFit(props.initial));
  const [setByYou, setSetByYou] = useState<Set<RowKey>>(new Set());
  const [fitted, setFitted] = useState(true);
  const rows = useMemo(() => fitRows(fit), [fit]);
  useEffect(() => props.onChange?.(fit), [fit]);

  const textPx = effectiveTextPx(fit);
  const stepText = (dir: -1 | 1) => {
    const next = cloneFit(fit);
    next.text.override = stepValue(TEXT_STEPS, textPx, dir);
    setFit(next);
    setSetByYou((s) => new Set(s).add('text'));
  };
  const targetPx = fit.targets.minPx ?? 24;
  const stepTarget = (dir: -1 | 1) => {
    const next = cloneFit(fit);
    next.targets.minPx = fit.targets.minPx === null && dir > 0 ? 24 : stepValue(TARGET_STEPS, targetPx, dir);
    setFit(next);
    setSetByYou((s) => new Set(s).add('targets'));
  };

  const source = (r: FitRow): string => {
    if (setByYou.has(r.key)) return 'Set by you';
    if (props.origin === 'demo') return `From the ${props.demoName ?? 'demo'} sample fit`;
    if (r.key === 'motion' && props.reducedMotion) return 'From your system setting';
    if (r.key === 'text' && fit.text.source === 'stated' && !props.done.has('R2')) return 'Chosen by you today';
    const tasks = SOURCE_TASK[r.key] ?? [];
    if (tasks.some((t) => props.done.has(t))) return 'Measured today';
    return 'Starting point. Adjust any time.';
  };

  const changedCount = rows.filter((r) => r.changed).length;
  const deck =
    props.origin === 'demo'
      ? 'This is a sample fit for demos. Here’s what WebAble would change, and why.'
      : 'Here’s what WebAble will change, and why. You can adjust any of it.';

  return (
    <div class="fx-yourfit">
      <div class="fx-fit-head">
        <div class="fx-fit-head-text">
          <Heading>Your fit</Heading>
          <Deck>{deck}</Deck>
        </div>
        <div class="fx-seg fade-in" role="group" aria-label="See the difference on a sample page">
          <button type="button" class={`fx-seg-btn ${!fitted ? 'is-on' : ''}`} aria-pressed={!fitted} onClick={() => setFitted(false)}>
            Original
          </button>
          <button type="button" class={`fx-seg-btn ${fitted ? 'is-on' : ''}`} aria-pressed={fitted} onClick={() => setFitted(true)}>
            Fitted
          </button>
        </div>
      </div>

      <section class="fx-preview fade-in" aria-label="Sample page">
        <Preview fit={fit} fitted={fitted} />
      </section>

      <h2 class="fx-h2 fx-rows-h">What WebAble changes</h2>
      <ul class="fx-fitrows fade-in" aria-label={`${changedCount} changes`}>
        {rows.map((r) => (
          <li class={`fx-fitrow ${r.changed ? 'is-changed' : ''}`}>
            <div class="fx-fitrow-main">
              <span class="fx-fitrow-label">
                {r.changed ? <Check size={15} /> : null}
                {r.label}
              </span>
              {r.line ? <span class="fx-fitrow-line">{r.line}</span> : null}
              <span class="fx-fitrow-source">{source(r)}</span>
            </div>
            <div class="fx-fitrow-side">
              <Mark from={r.from} to={r.to} changed={r.changed} />
              {r.key === 'text' ? (
                <Stepper
                  label="Text size"
                  onMinus={() => stepText(-1)}
                  onPlus={() => stepText(1)}
                  canMinus={canStep(TEXT_STEPS, textPx, -1)}
                  canPlus={canStep(TEXT_STEPS, textPx, 1)}
                />
              ) : null}
              {r.key === 'targets' ? (
                <Stepper
                  label="Click areas"
                  onMinus={() => stepTarget(-1)}
                  onPlus={() => stepTarget(1)}
                  canMinus={fit.targets.minPx !== null && canStep(TARGET_STEPS, targetPx, -1)}
                  canPlus={fit.targets.minPx === null || canStep(TARGET_STEPS, targetPx, 1)}
                />
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <div class="fx-row fx-row-actions">
        <Btn kind="primary" onClick={() => props.onSave(fit)} disabled={props.saving} class="fx-btn-wide">
          {props.saving ? 'Saving…' : 'Save my fit'}
        </Btn>
        <Btn kind="tonal" onClick={props.onRestart} class="fx-btn-wide">
          Start over
        </Btn>
      </div>
    </div>
  );
}

export function Done(props: { onOpenDemo: () => void; onClose: () => void; saved: boolean }): JSX.Element {
  return (
    <div class="fx-done">
      <svg class="fx-done-mark" viewBox="0 0 96 96" aria-hidden="true">
        <circle cx="48" cy="48" r="44" />
        <path d="M30 49l12 12 25-27" />
      </svg>
      <Heading>{props.saved ? 'You’re all set.' : 'Your fit was not saved.'}</Heading>
      <Deck>
        {props.saved
          ? 'WebAble will fit pages to you from now on. The WebAble button on each page shows what changed, and the original page is always one click away.'
          : 'Something stopped the save. Go back and try again, or close this tab and run the fitting later.'}
      </Deck>
      <div class="fx-row fx-row-center fade-in">
        <Btn kind="primary" onClick={props.onOpenDemo} class="fx-btn-wide">
          Open a sample page
        </Btn>
        <Btn kind="tonal" onClick={props.onClose} class="fx-btn-wide">
          Close this tab
        </Btn>
      </div>
    </div>
  );
}
