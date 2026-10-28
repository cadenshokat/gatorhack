// The study's own building blocks, in the onboarding's design (fitting/ui/tokens.css and flow.css): white page, the
// WebAble wordmark, one thing per screen, big quiet type, 64 px pills and full-width answer buttons.

import { createContext, Fragment, type ComponentChildren, type JSX } from 'preact';
import { useContext, useEffect, useRef } from 'preact/hooks';
import { Wordmark } from '../../../extension/entrypoints/fitting/ui/Chrome';
import type { Likert7 } from '../contracts';
import { CONFIG } from '../store/config';

/** The study's parts, in order: each an equal share of the progress line. */
export const PARTS = ['Getting started', 'Warm-up', 'Practice', 'Round 1', 'Round 2', 'Last questions'] as const;

/** Where the person is: the part (index into PARTS) and how much of it is done, 0 to 1. */
export interface Progress {
  part: number;
  fill: number;
}

/** The app's place in the study; a screen inside a part narrows it with `sub` (question i of n). */
export const ProgressContext = createContext<Progress | null>(null);

/** Question `i` (0-based) of `n` inside the part, taking the slice of the part that `at` and `to` set. */
export function within(at: Progress & { to?: number }, sub: [number, number] | null | undefined): Progress {
  if (!sub) return at;
  const [i, n] = sub;
  const to = at.to ?? 1;
  return {
    part: at.part,
    fill: at.fill + ((to - at.fill) * Math.max(0, Math.min(n, i))) / Math.max(1, n),
  };
}

/**
 * One thin line across the top of the screen, filled in ink as the study goes (each part an equal share). Nothing
 * visible says it in words; a screen reader hears "Part 4 of 6: Round 1" (or "Finished").
 */
export function ProgressBar(props: { at: Progress }): JSX.Element {
  const { part, fill } = props.at;
  const done = part >= PARTS.length ? PARTS.length : part + Math.max(0, Math.min(1, fill));
  const words = part >= PARTS.length ? 'Finished' : `Part ${part + 1} of ${PARTS.length}: ${PARTS[part]}`;
  return (
    <div
      class="st-progress"
      role="progressbar"
      aria-label="How far you are in the study"
      aria-valuemin={0}
      aria-valuemax={PARTS.length}
      aria-valuenow={Math.round(done * 10) / 10}
      aria-valuetext={words}
    >
      <span class="st-progress-fill" style={{ width: `${Math.round((done / PARTS.length) * 1000) / 10}%` }} />
    </div>
  );
}

/** The progress line, then the wordmark and one quiet button on the right (Leave). */
export function Header(props: {
  onLeave: (() => void) | null;
  sub?: [number, number] | null;
  /** The right-hand button when it isn't Leave (the warm-up's "Skip the warm-up"). */
  end?: { label: string; onClick: () => void } | null;
}): JSX.Element {
  const at = useContext(ProgressContext) as (Progress & { to?: number }) | null;
  const end = props.end ?? (props.onLeave ? { label: 'Leave', onClick: props.onLeave } : null);
  return (
    <div class="st-header">
      {at ? <ProgressBar at={within(at, props.sub)} /> : null}
      <header class="fl-top st-top">
        <Wordmark />
        <div class="fl-top-end">
          {end ? (
            <button type="button" class="btn-text fl-skip" onClick={end.onClick}>
              {end.label}
            </button>
          ) : null}
        </div>
      </header>
    </div>
  );
}

/** "Questions? Email …": on every page, so a person on their own always has someone to ask. */
export function HelpLine(): JSX.Element | null {
  const email = CONFIG.contactEmail;
  if (!email) return null;
  return (
    <p class="st-help">
      Questions? Email <a href={`mailto:${email}`}>{email}</a>
    </p>
  );
}

/** A full screen with the header, a reading column, the main action pinned under the content, and the help line. */
export function Screen(props: {
  onLeave: (() => void) | null;
  /** Question i (0-based) of n inside this part, for the progress bar. */
  sub?: [number, number] | null;
  children: ComponentChildren;
  actions?: ComponentChildren;
  /** Move focus to the screen's heading when it opens. */
  focusKey?: string;
}): JSX.Element {
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
    const h = main.current?.querySelector<HTMLElement>('h1, h2');
    h?.focus({ preventScroll: true });
    // The tab's title copies the heading ("How old are you? – WebAble study").
    const words = h?.textContent?.trim();
    if (words) document.title = `${words} – WebAble study`;
  }, [props.focusKey]);
  return (
    <div class="fl-app st-app">
      <Header onLeave={props.onLeave} sub={props.sub} />
      <main class="st-main" ref={main}>
        <div class="st-col">
          {props.children}
          <HelpLine />
        </div>
      </main>
      {props.actions ? <div class="st-actions">{props.actions}</div> : null}
    </div>
  );
}

export function Title(props: {
  eyebrow?: string;
  children: ComponentChildren;
  deck?: ComponentChildren;
  question?: boolean;
}): JSX.Element {
  return (
    <div class="st-head">
      {props.eyebrow ? <p class="fl-eyebrow">{props.eyebrow}</p> : null}
      <h1 class={`st-title ${props.question ? 'st-title-q' : ''}`} tabIndex={-1}>
        {props.children}
      </h1>
      {props.deck ? <p class="st-deck">{props.deck}</p> : null}
    </div>
  );
}

/** What to do when Continue was tapped with nothing chosen: said plainly, above the answers, read out at once. */
export function ErrorLine(props: { children: ComponentChildren }): JSX.Element {
  return (
    <p class="st-error" role="alert">
      {props.children}
    </p>
  );
}

export interface ChoiceOption<T extends string | number> {
  value: T;
  label: ComponentChildren;
  /** The honest way out ("I could not find it", "Prefer not to say"): last, after the word "or". */
  quiet?: boolean;
}

/**
 * Full-width answer buttons, one per row. A tap only chooses (the choice stays marked with a tick); nothing moves on
 * until the page's Continue, so a shaky tap can be put right.
 */
export function Choices<T extends string | number>(props: {
  options: Array<ChoiceOption<T>>;
  value: T | null;
  onPick: (v: T) => void;
  label: string;
  compact?: boolean;
}): JSX.Element {
  const firstQuiet = props.options.findIndex((o) => o.quiet);
  return (
    <div class={`st-choices ${props.compact ? 'is-compact' : ''}`} role="radiogroup" aria-label={props.label}>
      {props.options.map((o, i) => (
        <Fragment key={String(o.value)}>
          {i === firstQuiet && i > 0 ? (
            <p class="st-or" aria-hidden="true">
              or
            </p>
          ) : null}
          <button
            type="button"
            role="radio"
            aria-checked={props.value === o.value}
            class={`answer st-choice ${o.quiet ? 'is-quiet' : ''} ${props.value === o.value ? 'is-on' : ''}`}
            onClick={() => props.onPick(o.value)}
          >
            <span class="st-choice-text">{o.label}</span>
            <svg class="st-tick" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                fill="none"
                stroke="currentColor"
                stroke-width="2.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </Fragment>
      ))}
    </div>
  );
}

/**
 * Full-width tick boxes, one per row, then "or" and a last box that clears the others ("None of these"). Like Choices,
 * a tap only ticks; the page's Continue moves on.
 */
export function Checks<T extends string>(props: {
  options: Array<{ value: T; label: ComponentChildren }>;
  none: { value: T; label: string };
  value: T[];
  onChange: (v: T[]) => void;
  label: string;
}): JSX.Element {
  const toggle = (id: T) => {
    const has = props.value.includes(id);
    if (id === props.none.value) return props.onChange(has ? [] : [id]);
    const next = has ? props.value.filter((x) => x !== id) : [...props.value.filter((x) => x !== props.none.value), id];
    props.onChange(next);
  };
  const box = (id: T, label: ComponentChildren, quiet: boolean) => (
    <button
      key={id}
      type="button"
      role="checkbox"
      aria-checked={props.value.includes(id)}
      class={`answer st-choice ${props.value.includes(id) ? 'is-on' : ''} ${quiet ? 'is-quiet' : ''}`}
      onClick={() => toggle(id)}
    >
      <span class="st-choice-text">{label}</span>
      <svg class="st-tick" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path
          d="M5 12.5l4.5 4.5L19 7.5"
          fill="none"
          stroke="currentColor"
          stroke-width="2.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  );
  return (
    <div class="st-choices" role="group" aria-label={props.label}>
      {props.options.map((o) => box(o.value, o.label, false))}
      <p class="st-or" aria-hidden="true">
        or
      </p>
      {box(props.none.value, props.none.label, true)}
    </div>
  );
}

/** The words for each of a 1 to 7 scale's answers, 1 first: every answer carries words (protocol 2.1.0). */
export type Scale7Words = readonly [string, string, string, string, string, string, string];

/** The 10 statements (SUS). */
export const AGREE_7: Scale7Words = [
  'Strongly disagree',
  'Disagree',
  'Somewhat disagree',
  'Neither agree nor disagree',
  'Somewhat agree',
  'Agree',
  'Strongly agree',
];

/** The ease question after each website (SEQ), 1 = very easy (the owner's direction, 27 Oct 2026). */
export const EASE_7: Scale7Words = [
  'Very easy',
  'Easy',
  'Somewhat easy',
  'Neither easy nor hard',
  'Somewhat hard',
  'Hard',
  'Very hard',
];

/** How much the copies looked and worked like the real websites. */
export const LIKE_7: Scale7Words = [
  'Not at all like them',
  'Very little like them',
  'A little like them',
  'Somewhat like them',
  'Mostly like them',
  'Very much like them',
  'Exactly like them',
];

/** One of a scale's answers: its words only (no number shown; the value stored is still 1 to 7). */
export function scaleOption(n: Likert7, words: Scale7Words): ChoiceOption<Likert7> {
  return {
    value: n,
    label: (
      <>
        <span class="st-num-label">{words[n - 1]}</span>
      </>
    ),
  };
}

/** Seven answers, the 1 end at the top, each shown by its words (SUS, SEQ). */
export function Scale7(props: {
  words: Scale7Words;
  value: Likert7 | null;
  onPick: (v: Likert7) => void;
  label: string;
}): JSX.Element {
  const options = ([1, 2, 3, 4, 5, 6, 7] as Likert7[]).map((n) => scaleOption(n, props.words));
  return <Choices options={options} value={props.value} onPick={props.onPick} label={props.label} compact />;
}

export function Primary(props: { onClick: () => void; children: ComponentChildren; disabled?: boolean }): JSX.Element {
  return (
    <button type="button" class="btn btn-primary st-wide" onClick={props.onClick} disabled={props.disabled}>
      {props.children}
    </button>
  );
}

export function TextButton(props: { onClick: () => void; children: ComponentChildren }): JSX.Element {
  return (
    <button type="button" class="btn-text st-text-btn" onClick={props.onClick}>
      {props.children}
    </button>
  );
}

/** A blocking dialog on a white scrim: the page behind is inert and focus stays inside. */
export function Dialog(props: {
  title: string;
  children?: ComponentChildren;
  actions: ComponentChildren;
  eyebrow?: string;
}): JSX.Element {
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    h.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div class="fl-scrim st-scrim">
      <div class="fl-modal-wrap">
        <div class="fl-modal st-modal" role="dialog" aria-modal="true" aria-labelledby="st-dialog-title">
          {props.eyebrow ? <p class="fl-eyebrow">{props.eyebrow}</p> : null}
          <h2 id="st-dialog-title" class="fl-modal-title" ref={h} tabIndex={-1}>
            {props.title}
          </h2>
          {props.children ? <div class="fl-modal-text st-modal-text">{props.children}</div> : null}
          <div class="st-modal-actions">{props.actions}</div>
        </div>
      </div>
    </div>
  );
}
