// F1, "Find it": a made-up page in the stage and a chip above it ("Find: Gift cards"). 1 practice plus 8 trials,
// busy × moving. After 12 s the link is shown and the trial counts as not found. Then F2 ("Which page was easier to
// find things on?") and F3 ("Did anything get in your way?") on the same card. Fills finding.

import type { JSX } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { FIND_TIMEOUT_MS, planFind, type FindTrial } from '../logic/finding';
import { clamp } from '../logic/rand';
import { IN_THE_WAY } from '../logic/steps';
import { CheckIcon } from '../ui/Chrome';
import { useKeys, usePressed, useTrialClock } from '../ui/hooks';
import { MockPage } from './MockPage';
import { Answer, TaskLayout, type TaskProps } from './Task';

type Phase = 'search' | 'which' | 'inway';

export function FindTask(props: TaskProps): JSX.Element {
  const { raw } = props;
  const plan = useMemo(() => planFind(props.rng), []);
  const [phase, setPhase] = useState<Phase>('search');
  const [i, setI] = useState(-1); // -1: the practice page
  const [reveal, setReveal] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const clock = useTrialClock(i);
  const scroller = useRef<HTMLDivElement>(null);
  const [pressed, press] = usePressed();
  const reduced = !!props.settings?.reducedMotion;
  const trial = (i < 0 ? plan.practice : plan.trials[i]) as FindTrial;
  const zoom = raw.zoom || 1;
  // The pages use the text and button sizes learned so far, clamped so the links stay on one screen.
  const fontPx = clamp((props.draft.text.override ?? props.draft.text.bodyPx) / zoom, 15, 20);
  const targetPx = clamp((props.draft.targets.minPx ?? 36) / zoom, 36, 56);

  // F2: the calm and busy twins of one site, in a random order.
  const pair = useMemo(() => {
    const busy = plan.trials.find((t) => t.clutter) as FindTrial;
    const calm = plan.trials.find((t) => !t.clutter && t.template === busy.template) as FindTrial;
    const calmFirst = props.rng() < 0.5;
    return { first: calmFirst ? calm : busy, second: calmFirst ? busy : calm, calmFirst };
  }, []);
  const [chips, setChips] = useState<string[]>([]);
  const [nothing, setNothing] = useState(false);

  useLayoutEffect(() => {
    scroller.current?.scrollTo(0, 0);
    setReveal(false);
    setNote(null);
  }, [i]);

  useEffect(() => {
    if (phase !== 'search' || reveal) return;
    const id = window.setInterval(() => {
      if (clock.elapsed() >= FIND_TIMEOUT_MS) {
        setReveal(true);
        // Keyboard users land on it, so Enter goes on.
        scroller.current?.querySelector<HTMLButtonElement>('[data-target="1"]')?.focus({ preventScroll: false });
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [i, phase, reveal]);

  const onLink = (label: string) => {
    if (!clock.armed()) return;
    if (label !== trial.target) {
      setNote('Not that one. Keep looking.');
      return;
    }
    props.onAnswer();
    if (i >= 0) {
      raw.findTrials.push({
        clutter: trial.clutter,
        // What was on screen (under Reduce motion the moving cell shows a bright still promo).
        motion: trial.motion,
        ms: reveal ? FIND_TIMEOUT_MS : Math.round(clock.elapsed()),
        found: !reveal,
      });
    }
    if (i + 1 >= plan.trials.length) {
      raw.endBlock('find', { trials: raw.findTrials.length, stop: 'max_trials' });
      raw.beginBlock('pick');
      setPhase('which');
      return;
    }
    setI(i + 1);
  };

  const which = (choice: 'first' | 'same' | 'second') => {
    press(choice);
    const choseCalm = (choice === 'first' && pair.calmFirst) || (choice === 'second' && !pair.calmFirst);
    raw.preferredCalm = choseCalm ? 2 : 0;
    props.onAnswer();
    setPhase('inway');
  };

  const toggle = (id: string) => {
    setNothing(false);
    setChips((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  };

  const finish = () => {
    raw.notes = nothing ? [] : chips.slice();
    props.onAnswer();
    props.onDone({ trials: raw.findTrials.length + 2, stop: 'person' });
  };

  useKeys(phase === 'which', (key) => {
    if (key === '1') which('first');
    else if (key === '2') which('same');
    else if (key === '3') which('second');
  });

  if (phase === 'which') {
    const thumb = (t: FindTrial, label: string) => (
      <figure class="fl-thumb">
        <div class="fl-thumb-frame">
          <div class="fl-thumb-page">
            <MockPage trial={t} still salientInsteadOfMotion={false} fontPx={16} targetPx={40} interactive={false} />
          </div>
        </div>
        <figcaption>{label}</figcaption>
      </figure>
    );
    return (
      <TaskLayout
        title="Which page was easier to find things on?"
        stageClass="is-which"
        focusTitle
        actions={
          <>
            <Answer id="first" pressed={pressed} onClick={() => which('first')} keys="1">
              The first
            </Answer>
            <Answer id="same" kind="quiet" pressed={pressed} onClick={() => which('same')} keys="2">
              About the same
            </Answer>
            <Answer id="second" pressed={pressed} onClick={() => which('second')} keys="3">
              The second
            </Answer>
          </>
        }
      >
        <div class="fl-thumbs" aria-hidden="true" data-calm={pair.calmFirst ? 'first' : 'second'}>
          {thumb(pair.first, 'First')}
          {thumb(pair.second, 'Second')}
        </div>
      </TaskLayout>
    );
  }

  if (phase === 'inway') {
    return (
      <TaskLayout
        title="Did anything get in your way?"
        stageClass="is-inway"
        focusTitle
        actions={
          <button type="button" class="btn btn-primary fl-btn-wide" onClick={finish} data-answer="done-find">
            Done
          </button>
        }
      >
        <div class="fl-chips" role="group" aria-label="Pick any that apply">
          {IN_THE_WAY.map((c) => {
            const on = chips.includes(c.id);
            return (
              <button type="button" class={`fl-toggle ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggle(c.id)} data-answer={c.id}>
                {on ? <CheckIcon size={20} /> : null}
                {c.label}
              </button>
            );
          })}
          <button
            type="button"
            class={`fl-toggle ${nothing ? 'is-on' : ''}`}
            aria-pressed={nothing}
            onClick={() => {
              setChips([]);
              setNothing(!nothing);
            }}
            data-answer="nothing"
          >
            {nothing ? <CheckIcon size={20} /> : null}
            Nothing
          </button>
        </div>
      </TaskLayout>
    );
  }

  return (
    <TaskLayout
      title={
        <span class="fl-findchip">
          Find: <b>{trial.target}</b>
        </span>
      }
      sub={reveal ? 'Here it is.' : note ?? (i < 0 ? 'This first one is for practice.' : null)}
      stageClass="is-find"
      focusTitle={i < 0}
      data={{ 'data-target': trial.target, 'data-trial': i + 1 }}
    >
      <div class="fl-find-scroll" ref={scroller}>
        <MockPage
          key={i}
          trial={trial}
          still={false}
          salientInsteadOfMotion={reduced}
          fontPx={fontPx}
          targetPx={targetPx}
          reveal={reveal}
          onLink={(label) => onLink(label)}
        />
      </div>
    </TaskLayout>
  );
}
