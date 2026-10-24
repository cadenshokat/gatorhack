// Part 3, Finding: F1 "Find it" on mock pages, F2 which page was easier, F3 what got in the way.

import type { JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { FIND_TIMEOUT_MS, type FindPlan, type FindTrial } from '../logic/finding';
import type { GotInWay } from '../logic/raw';
import { clamp } from '../logic/rand';
import { Btn, Check, Deck, Heading, useTrialClock } from '../ui/common';
import { MockPage } from './MockPage';
import { comfortableCssPx, type ScreenProps } from './types';

function mockSizes(props: ScreenProps): { fontPx: number; targetPx: number } {
  const zoom = props.raw.zoom || 1;
  const fontPx = clamp(comfortableCssPx(props) * 0.85, 14, 22);
  const target = (props.raw.roughTargetPx ?? 36) / zoom;
  return { fontPx, targetPx: clamp(target, 32, 64) };
}

/* ------------------------------------------------------------------ */
/* F1: Find it                                                         */
/* ------------------------------------------------------------------ */

export function Find(props: ScreenProps & { plan: FindPlan; motionStopped: boolean; onStopMotion: () => void }): JSX.Element {
  const trials = props.plan.trials;
  const [i, setI] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [note, setNote] = useState('');
  const clock = useTrialClock(props.paused, i);
  const trial = trials[i] as FindTrial;
  const reduced = props.env.reducedMotion;
  const sizes = mockSizes(props);
  const moving = trial.motion && !reduced && !props.motionStopped;

  useEffect(() => {
    setReveal(false);
    setNote('');
    props.onProgress(i / trials.length);
  }, [i]);

  useEffect(() => {
    if (props.paused || reveal) return;
    const id = window.setInterval(() => {
      if (clock.elapsed() >= FIND_TIMEOUT_MS) setReveal(true);
    }, 200);
    return () => window.clearInterval(id);
  }, [i, props.paused, reveal]);

  const onLink = (label: string) => {
    if (props.paused || !clock.armed()) return;
    if (label !== trial.target) {
      setNote('Not that one.');
      return;
    }
    if (!trial.practice) {
      props.raw.findTrials.push({
        clutter: trial.clutter,
        // Record what was actually on screen: after "Stop motion" nothing moves.
        motion: reduced ? trial.motion : trial.motion && !props.motionStopped,
        ms: reveal ? FIND_TIMEOUT_MS : Math.round(clock.elapsed()),
        found: !reveal,
      });
    }
    if (i + 1 >= trials.length) {
      props.raw.complete('F1');
      props.onDone();
      return;
    }
    setI(i + 1);
  };

  const deck = reveal
    ? 'Here it is. Click it to go on.'
    : trial.practice
      ? 'Let’s try one first. Click the link when you see it.'
      : 'Click it when you see it.';

  return (
    <div class="fx-find">
      <div class="fx-find-head">
        <div>
          <Heading class="fx-h1-find">
            <span class="fx-find-verb">Find:</span> {trial.target}
          </Heading>
          <p class="fx-deck fx-deck-tight" aria-live="polite">
            {note ? <span class="fx-note">{note}</span> : null} {deck}
          </p>
        </div>
        {moving ? (
          <Btn kind="tonal" onClick={props.onStopMotion} class="fx-stopmotion">
            Stop motion
          </Btn>
        ) : null}
      </div>
      <div class="fx-stage fx-stage-mock">
        <MockPage
          trial={trial}
          still={!moving}
          salientInsteadOfMotion={reduced}
          fontPx={sizes.fontPx}
          targetPx={sizes.targetPx}
          reveal={reveal}
          onLink={onLink}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* F2: Which page was easier?                                          */
/* ------------------------------------------------------------------ */

function Thumb(props: { trial: FindTrial; label: string; reduced: boolean; fontPx: number; targetPx: number }): JSX.Element {
  const boxRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const [h, setH] = useState(200);
  const NATURAL = 1040;
  useLayoutEffect(() => {
    const box = boxRef.current;
    const page = pageRef.current;
    if (!box || !page) return;
    const measure = () => {
      const s = box.clientWidth / NATURAL;
      setScale(s);
      setH(page.scrollHeight * s);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(page);
    return () => ro.disconnect();
  }, []);
  return (
    <figure class="fx-thumb">
      <div class="fx-thumb-box" ref={boxRef} style={{ height: `${h}px` }} aria-hidden="true">
        <div class="fx-thumb-page" ref={pageRef} style={{ width: `${NATURAL}px`, transform: `scale(${scale})` }}>
          <MockPage
            trial={props.trial}
            still
            salientInsteadOfMotion={props.reduced}
            fontPx={props.fontPx}
            targetPx={props.targetPx}
            interactive={false}
          />
        </div>
      </div>
      <figcaption>{props.label}</figcaption>
    </figure>
  );
}

const SCALE: Array<{ label: string; v: -2 | -1 | 0 | 1 | 2 }> = [
  { label: 'Page 1, much easier', v: -2 },
  { label: 'Page 1, a little easier', v: -1 },
  { label: 'About the same', v: 0 },
  { label: 'Page 2, a little easier', v: 1 },
  { label: 'Page 2, much easier', v: 2 },
];

export function Prefer(props: ScreenProps & { plan: FindPlan }): JSX.Element {
  const { plan } = props;
  const trialsFor = (tpl: string) => plan.trials.filter((t) => !t.practice && t.template === tpl);
  const questions = [
    { tpl: plan.clutterPair, calmer: (t: FindTrial) => !t.clutter, h: 'Which page was easier to find things on?' },
    { tpl: plan.motionPair, calmer: (t: FindTrial) => !t.motion, h: 'Which page was easier to keep your place on?' },
  ].filter((q) => trialsFor(q.tpl).length === 2);
  const [qi, setQi] = useState(0);
  const [flip] = useState(() => questions.map(() => Math.random() < 0.5));
  const sizes = mockSizes(props);

  useEffect(() => {
    if (questions.length === 0) props.onDone();
  }, []);
  useEffect(() => props.onProgress(qi / Math.max(1, questions.length)), [qi]);

  const q = questions[qi];
  if (!q) return <div />;
  const pair = trialsFor(q.tpl);
  const [a, b] = (flip[qi] ? [pair[1], pair[0]] : [pair[0], pair[1]]) as [FindTrial, FindTrial];

  const answer = (v: -2 | -1 | 0 | 1 | 2) => {
    // v < 0 favours page 1 (a). Oriented so + means the calmer page was easier.
    const calmerIsA = q.calmer(a);
    const rating = calmerIsA ? -v : v;
    if (rating > 0) props.raw.preferredCalm += rating === 2 ? 1 : 0.5;
    if (qi + 1 >= questions.length) {
      props.raw.complete('F2');
      props.onDone();
      return;
    }
    setQi(qi + 1);
  };

  return (
    <div key={qi}>
      <Heading>{q.h}</Heading>
      <Deck>These are pages you just used.</Deck>
      <div class="fx-thumbs fade-in">
        <Thumb trial={a} label="Page 1" reduced={props.env.reducedMotion} {...sizes} />
        <Thumb trial={b} label="Page 2" reduced={props.env.reducedMotion} {...sizes} />
      </div>
      <div class="fx-scale fade-in" role="group" aria-label={q.h}>
        {SCALE.map((s) => (
          <button type="button" class={`fx-btn fx-btn-tonal fx-scale-btn ${s.v === 0 ? 'is-mid' : ''}`} onClick={() => answer(s.v)}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* F3: Did anything get in your way?                                   */
/* ------------------------------------------------------------------ */

const CHIPS: Array<{ id: GotInWay | 'nothing'; label: string }> = [
  { id: 'moving things', label: 'Moving things' },
  { id: 'too much on the page', label: 'Too much on the page' },
  { id: 'long blocks of text', label: 'Long blocks of text' },
  { id: 'hard to tell what to click', label: 'Hard to tell what to click' },
  { id: 'popups', label: 'Pop-ups' },
  { id: 'nothing', label: 'Nothing' },
];

export function GotInWayScreen(props: ScreenProps & { general: boolean }): JSX.Element {
  const [sel, setSel] = useState<Set<string>>(new Set());
  useEffect(() => props.onProgress(0.5), []);
  const toggle = (id: string) => {
    setSel((prev) => {
      const next = new Set(prev);
      if (id === 'nothing') return next.has('nothing') ? new Set() : new Set(['nothing']);
      next.delete('nothing');
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const done = () => {
    props.raw.gotInWay = [...sel].filter((s) => s !== 'nothing');
    props.raw.complete('F3');
    props.onDone();
  };
  return (
    <div>
      <Heading>{props.general ? 'Does anything on web pages get in your way?' : 'Did anything get in your way?'}</Heading>
      <Deck>Pick any that apply, or none.</Deck>
      <div class="fx-chips fade-in" role="group" aria-label="Things that got in the way">
        {CHIPS.map((c) => {
          const on = sel.has(c.id);
          return (
            <button type="button" class={`fx-chip ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggle(c.id)}>
              <span class="fx-chip-box" aria-hidden="true">
                {on ? <Check size={16} /> : null}
              </span>
              {c.label}
            </button>
          );
        })}
      </div>
      <div class="fx-responses fade-in">
        <Btn kind="primary" onClick={done} class="fx-btn-wide">
          Continue
        </Btn>
      </div>
    </div>
  );
}
