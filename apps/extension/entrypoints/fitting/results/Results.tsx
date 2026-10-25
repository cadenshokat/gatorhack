// The last screen: what WebAble will now do for this person, shown on pages they know, and every setting in reach.
// One column of calm sections: the promise (status, three plain helps, the chart), a page before and after, the
// settings, and a footer. Every change saves at once through onChange and redraws the chart and the page live.
import type { FitProfile } from '@webable/core';
import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  BUTTON_SIZES,
  buttonChoice,
  currentText,
  faintLevel,
  nextTextSize,
  stepText,
  withButtons,
  withFaint,
  withMotion,
  withPolarity,
  withSteady,
  type ButtonChoice,
  type FaintLevel,
} from './adjust';
import { Segmented, Stepper, Switch } from './controls';
import { NeedIcon } from './icons';
import { NEED_ORDER, amountWords, needValues, topNeeds, helpLine, type HelpLine } from './needs';
import { Preview } from './Preview';
import { Radar } from './Radar';
import './results.css';
import type { Polarity } from '@webable/core';

export interface ResultsProps {
  fit: FitProfile; // what was just saved (or loaded)
  measured: boolean; // false when opened as settings without a fresh run
  onChange(next: FitProfile): void; // App saves via logic/storage.ts and re-renders
  onRetake(): void;
  onDone(): void; // closes the tab
}

const NEWS_URL = 'https://www.cnn.com';

function useReducedMotion(): boolean {
  const query = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const [reduced, setReduced] = useState(query?.matches ?? false);
  useEffect(() => {
    if (!query) return;
    const on = (): void => setReduced(query.matches);
    query.addEventListener('change', on);
    return () => query.removeEventListener('change', on);
  }, []);
  return reduced;
}

const listJoin = (xs: string[]): string =>
  xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

export function Results(props: ResultsProps): JSX.Element {
  const { measured, onRetake, onDone } = props;
  const [fit, setFit] = useState<FitProfile>(props.fit);
  useEffect(() => setFit(props.fit), [props.fit]);
  const reduced = useReducedMotion();
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    title.current?.focus({ preventScroll: true });
  }, []);

  const change = (next: FitProfile): void => {
    if (next === fit) return;
    setFit(next);
    props.onChange(next);
  };

  const values = useMemo(() => needValues(fit), [fit]);
  const top = useMemo(() => topNeeds(fit, values), [fit, values]);
  const helps: HelpLine[] = top.map((n) => helpLine(n.id, fit));
  const topIds = new Set(top.map((n) => n.id));
  const summary = `Where WebAble helps you: most with ${listJoin(top.map((n) => n.label))}.`;

  return (
    <div class="rs">
      <header class="rs-top">
        <div class="rs-wrap">
          <span class="rs-mark">WebAble</span>
        </div>
      </header>

      <main class="rs-wrap">
        <section class="rs-hero">
          <div class="rs-hero-text">
            <p class="rs-status">
              <span class="rs-status-dot" aria-hidden="true" />
              WebAble is on
            </p>
            <h1 class="rs-h1" ref={title} tabIndex={-1}>
              {measured ? 'Here’s what changes for you.' : 'Your WebAble settings'}
            </h1>
            <p class="rs-deck">{measured ? 'On every website you visit, WebAble will:' : 'WebAble uses these on every website.'}</p>
            <ul class="rs-helps">
              {helps.map((h) => (
                <li class="rs-help" key={h.id}>
                  <span class="rs-help-icon">
                    <NeedIcon id={h.id} />
                  </span>
                  <span>
                    {h.lead}
                    {h.strong && <strong>{h.strong}</strong>}
                    {h.tail}
                  </span>
                </li>
              ))}
            </ul>
            <div class="rs-actions">
              <a class="btn btn-primary rs-btn" href={NEWS_URL} target="_blank" rel="noopener noreferrer">
                Try it on a news site
              </a>
              <button type="button" class="btn btn-secondary rs-btn" onClick={onDone}>
                Done
              </button>
            </div>
          </div>

          <figure class="rs-chart card">
            <figcaption class="rs-chart-title">Where WebAble helps you</figcaption>
            <Radar
              values={values.map((n) => n.value)}
              labels={values.map((n) => n.label)}
              emphasis={NEED_ORDER.map((id) => topIds.has(id))}
              words={values.map((n) => amountWords(n.value))}
              summary={summary}
              reduced={reduced}
            />
            <p class="rs-chart-note">The further out, the more WebAble does for you there.</p>
          </figure>
        </section>

        <Preview fit={fit} reduced={reduced} />

        <Adjust fit={fit} onChange={change} />

        <footer class="rs-foot">
          <p>WebAble keeps learning as you browse. Change anything here, any time, from the WebAble button on any page.</p>
          <button type="button" class="btn-text rs-restart" onClick={onRetake}>
            Start over
          </button>
        </footer>
      </main>
    </div>
  );
}

/* ---------------- Adjust anything ---------------- */

function Row(props: {
  label: string;
  hint: string;
  change?: JSX.Element | string | null;
  wide?: boolean;
  children: JSX.Element;
}): JSX.Element {
  return (
    <div class={`rs-row${props.wide ? ' is-wide' : ''}`}>
      <div class="rs-row-text">
        <div class="rs-row-label">{props.label}</div>
        <div class="rs-row-hint">{props.hint}</div>
      </div>
      <div class="rs-row-change" aria-live="polite">
        {props.change}
      </div>
      <div class="rs-row-control">{props.children}</div>
    </div>
  );
}

function fromTo(from: number, to: number | null): JSX.Element | string {
  if (to == null || Math.round(to) <= from) return 'No change';
  return (
    <>
      {from} → <strong>{Math.round(to)} px</strong>
    </>
  );
}

const FAINT_WORDS: Record<FaintLevel, string | null> = { off: null, darker: 'Darker', darkest: 'Darkest' };
const POLARITY_WORDS: Record<Polarity, string | null> = { none: null, light: 'Light', dark: 'Dark' };

function wordChange(from: string, to: string | null): JSX.Element | string {
  if (!to) return 'No change';
  return (
    <>
      {from} → <strong>{to}</strong>
    </>
  );
}

function Adjust({ fit, onChange }: { fit: FitProfile; onChange(next: FitProfile): void }): JSX.Element {
  const text = currentText(fit);
  const buttons = buttonChoice(fit);
  const polarity: Polarity = fit.polarity?.value ?? 'none';
  return (
    <section class="rs-section" aria-labelledby="rs-adjust">
      <div class="rs-section-head">
        <div>
          <h2 class="rs-h2" id="rs-adjust">
            Adjust anything
          </h2>
          <p class="rs-sub">Changes save as you make them.</p>
        </div>
      </div>
      <div class="rs-rows card">
        <Row label="Text size" hint="How big words are on every page." change={fromTo(16, text)}>
          <Stepper
            canDown={nextTextSize(fit, -1) != null}
            canUp={nextTextSize(fit, 1) != null}
            downLabel="Smaller text"
            upLabel="Larger text"
            onStep={(d) => onChange(stepText(fit, d))}
          />
        </Row>
        <Row label="Faint text" hint="Light grey words, made darker." change={wordChange('Grey', FAINT_WORDS[faintLevel(fit)])} wide>
          <Segmented<FaintLevel>
            label="Faint text"
            wide
            options={[
              { value: 'off', label: 'Off' },
              { value: 'darker', label: 'Darker' },
              { value: 'darkest', label: 'Darkest' },
            ]}
            value={faintLevel(fit)}
            onChange={(v) => onChange(withFaint(fit, v))}
          />
        </Row>
        <Row label="Light or dark" hint="Bright pages turned dark, or the other way." change={wordChange('Pages', POLARITY_WORDS[polarity])} wide>
          <Segmented<Polarity>
            label="Light or dark"
            wide
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'none', label: 'As the site' },
            ]}
            value={polarity}
            onChange={(v) => onChange(withPolarity(fit, v))}
          />
        </Row>
        <Row
          label="Button size"
          hint="The smallest size for anything you click."
          change={fromTo(24, buttons === 'off' ? null : buttons)}
          wide
        >
          <Segmented<ButtonChoice>
            label="Button size"
            wide
            options={[{ value: 'off' as ButtonChoice, label: 'Off' }, ...BUTTON_SIZES.map((s) => ({ value: s as ButtonChoice, label: String(s) }))]}
            value={buttons}
            onChange={(v) => onChange(withButtons(fit, v))}
          />
        </Row>
        <Row
          label="Steady clicks"
          hint="Your click stays on what you meant, even if your hand moves."
          change={fit.clicks.steady.on ? <strong>On</strong> : 'Off'}
        >
          <Switch label="Steady clicks" checked={fit.clicks.steady.on} onChange={(on) => onChange(withSteady(fit, on))} />
        </Row>
        <Row
          label="Moving things"
          hint="Slideshows and moving ads are paused."
          change={fit.attention.motion.on ? <strong>Paused</strong> : 'Off'}
        >
          <Switch label="Pause moving things" checked={fit.attention.motion.on} onChange={(on) => onChange(withMotion(fit, on))} />
        </Row>
      </div>
    </section>
  );
}
