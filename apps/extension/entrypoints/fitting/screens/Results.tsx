// The results page: a petal chart, up to four benefits with one-tap adjustments, and a before/after slider.

import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { FitProfile } from '@webable/core';
import { benefitLine, copy, PETAL_EXPLAIN, PETAL_LABEL, type SectionId } from '../content/copy';
import { effectiveTextPx } from '../logic/fitview';
import { adjustNeed, type AdjustDir } from '../logic/adjust';
import { extrasOf, NEED_IDS, needScores, topBenefits, type NeedId, type OnboardingExtras } from '../logic/needs';
import { Button, useFocusTrap } from '../ui/bits';
import { Compare } from '../ui/Compare';
import { PetalChart } from '../ui/Petals';

type Fit = FitProfile & OnboardingExtras;

export function Results(props: {
  fit: Fit;
  saved: boolean;
  skipped: SectionId[];
  onRetake: () => void;
  onPlay: (id: SectionId) => void;
  onSave: (fit: Fit) => void;
  onRetry: () => void;
}): JSX.Element {
  const scores = needScores(props.fit, extrasOf(props.fit));
  const benefits = topBenefits(scores);
  const [changed, setChanged] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const allSkipped = props.skipped.length >= 5;

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const apply = (id: NeedId, dir: AdjustDir) => {
    setChanged(true);
    props.onSave(adjustNeed(props.fit, id, dir));
  };

  const extraIds = showAll ? NEED_IDS.filter((id) => !benefits.some((row) => row.id === id)) : [];

  return (
    <div class="ob-results">
      <h1 class="ob-title" ref={heading} tabIndex={-1}>{copy.results.title}</h1>
      <p class="ob-subline">{copy.results.subline}</p>
      <PetalChart scores={scores} />
      <section class="ob-benefits" aria-labelledby="ob-benefits-title">
        <h2 id="ob-benefits-title" tabIndex={-1}>{copy.results.benefits}</h2>
        {changed ? <p class="ob-changed" aria-live="polite">{copy.results.changed}</p> : null}
        {benefits.length === 0 && !showAll ? <p class="ob-none">{copy.results.settled}</p> : (
          <ol>
            {benefits.map((row) => <Benefit key={row.id} id={row.id} fit={props.fit} onAdjust={apply} />)}
            {extraIds.map((id) => <Benefit key={id} id={id} fit={props.fit} onAdjust={apply} />)}
          </ol>
        )}
      </section>
      <Compare fit={props.fit} />
      <footer class="ob-done">
        <p class="ob-status">{copy.results.status}</p>
        {allSkipped ? <p>{copy.results.allSkipped}</p> : <p>{copy.results.where}</p>}
        {allSkipped ? null : props.skipped.map((id) => (
          <p key={id}>
            {copy.results.skipped(copy.sections[id].name)}{' '}
            <button type="button" class="ob-link" data-answer={`play-${id}`} onClick={() => props.onPlay(id)}>{copy.results.playNow}</button>.
          </p>
        ))}
        <p class="ob-done-links">
          <button
            type="button"
            class="ob-link"
            data-answer="change"
            onClick={() => {
              if (benefits.length === 0) setShowAll(true);
              window.setTimeout(() => document.getElementById('ob-benefits-title')?.focus(), 0);
            }}
          >
            {copy.results.change}
          </button>
          <button type="button" class="ob-link" data-answer="retake" onClick={props.onRetake}>{copy.results.retake}</button>
        </p>
      </footer>
      {props.saved ? null : (
        <SaveDialog onRetry={props.onRetry} />
      )}
    </div>
  );
}

function Benefit(props: { id: NeedId; fit: Fit; onAdjust: (id: NeedId, dir: AdjustDir) => void }): JSX.Element {
  const line = benefitLine(props.id, props.fit, extrasOf(props.fit));
  return (
    <li>
      <div>
        <h3>{PETAL_LABEL[props.id]}</h3>
        {line ? <p>{line}</p> : <p class="ob-explain">{PETAL_EXPLAIN[props.id]}</p>}
      </div>
      <Tiny id={props.id} fit={props.fit} />
      <div class="ob-actions ob-adjust">
        <Button kind="choice" onClick={() => props.onAdjust(props.id, 'less')} data={`less-${props.id}`}>{copy.results.less}</Button>
        <Button kind="choice" onClick={() => props.onAdjust(props.id, 'more')} data={`more-${props.id}`}>{copy.results.more}</Button>
        <Button kind="quiet" onClick={() => props.onAdjust(props.id, 'off')} data={`off-${props.id}`}>{copy.results.off}</Button>
      </div>
    </li>
  );
}

function Tiny(props: { id: NeedId; fit: FitProfile }): JSX.Element {
  const px = Math.min(32, Math.max(16, effectiveTextPx(props.fit)));
  const label = `${PETAL_LABEL[props.id]}. ${PETAL_EXPLAIN[props.id]}`;
  if (props.id === 'small_text') {
    return (
      <span class="ob-pair" aria-label={label}>
        <span style={{ fontSize: '13px' }}>Aa</span>
        <span style={{ fontSize: `${px}px` }}>Aa</span>
      </span>
    );
  }
  if (props.id === 'faint_text') {
    const after = props.fit.contrast.band === 'S' ? '#111111' : props.fit.contrast.band === 'M' ? '#3f3f3f' : '#6b6b6b';
    return (
      <span class="ob-pair" aria-label={label}>
        <span style={{ color: '#b5b5b5' }}>grey</span>
        <span style={{ color: after, fontWeight: props.fit.contrast.band === 'S' ? 650 : 450 }}>grey</span>
      </span>
    );
  }
  if (props.id === 'small_buttons') {
    return (
      <span class="ob-pair" aria-label={label}>
        <span class="ob-mini-btn">Go</span>
        <span class="ob-mini-btn is-big">Go</span>
      </span>
    );
  }
  if (props.id === 'steady_clicking') {
    return (
      <span class="ob-pair" aria-label={label}>
        <span class="ob-slip">×</span>
        <span class="ob-slip is-hit">✓</span>
      </span>
    );
  }
  if (props.id === 'moving_things') {
    return (
      <span class="ob-pair" aria-label={label}>
        <span class="ob-mover" />
        <span class="ob-mover is-still" />
      </span>
    );
  }
  if (props.id === 'busy_pages') {
    return (
      <span class="ob-pair ob-pair-pages" aria-label={label}>
        <span class="ob-crowd"><i /><i /><i /></span>
        <span class="ob-crowd is-clear"><i /></span>
      </span>
    );
  }
  if (props.id === 'long_reading') {
    return (
      <span class="ob-pair" aria-label={label}>
        <span class="ob-lines"><i /><i /><i /><i /></span>
        <span class="ob-lines is-open"><i /><i /><i /></span>
      </span>
    );
  }
  return (
    <span class="ob-pair" aria-label={label}>
      <span class="ob-dots"><i /><i /></span>
      <span class="ob-dots is-shaped"><i /><b>A</b></span>
    </span>
  );
}

function SaveDialog(props: { onRetry: () => void }): JSX.Element {
  const trap = useFocusTrap(true);
  return (
    <div class="ob-modal" role="dialog" aria-modal="true" aria-labelledby="ob-save-title" ref={trap.ref}>
      <div class="ob-card">
        <h2 id="ob-save-title" class="ob-title ob-title-card">{copy.saveError.ask}</h2>
        <div class="ob-actions">
          <Button kind="primary" onClick={props.onRetry} data="retry" focus>{copy.saveError.retry}</Button>
        </div>
      </div>
    </div>
  );
}
