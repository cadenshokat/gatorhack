// The warm-up: the onboarding's own Reading and Pointing steps (fitting/tasks, unchanged), each opened by its own
// instruction page, then core's deriveFit. This is the same measurement the extension's onboarding makes; the Finding
// part (real websites in a task tab) needs the extension and is left out. The resulting fit is frozen for both rounds.
// The start, instruction and closing pages are ordinary study pages (Screen): the page itself scrolls, nothing sits
// behind it, and Start stays pinned to the bottom of the screen. (The onboarding's floating card let a phone scroll the
// page underneath instead of the card, so its Start button could end up out of reach.)

import {
  defaultFit,
  deriveFit,
  type BrowserSettings,
  type FitProfile,
  type FittingRaw,
  type InputClass,
} from '@webable/core';
import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { SENTENCES } from '../../../extension/entrypoints/fitting/content/sentences';
import {
  captureEnv,
  readBrowserSettings,
  readPageZoom,
  settingsUsed,
  type Env,
} from '../../../extension/entrypoints/fitting/logic/env';
import { makeRng } from '../../../extension/entrypoints/fitting/logic/rand';
import { RawCollector } from '../../../extension/entrypoints/fitting/logic/raw';
import { planSteps, type StepId } from '../../../extension/entrypoints/fitting/logic/steps';
import { DotsTask } from '../../../extension/entrypoints/fitting/tasks/Dots';
import { FaintTask } from '../../../extension/entrypoints/fitting/tasks/Faint';
import { LightDarkTask } from '../../../extension/entrypoints/fitting/tasks/LightDark';
import { SizeTask } from '../../../extension/entrypoints/fitting/tasks/Size';
import type { StepOutcome, TaskProps } from '../../../extension/entrypoints/fitting/tasks/Task';
import { TrueFalseTask } from '../../../extension/entrypoints/fitting/tasks/TrueFalse';
import { CheckIcon } from '../../../extension/entrypoints/fitting/ui/Chrome';
import { Demo } from '../../../extension/entrypoints/fitting/ui/Demo';
import { useKeys } from '../../../extension/entrypoints/fitting/ui/hooks';
import { StepLabelsContext } from '../../../extension/entrypoints/fitting/ui/words';
import type { StepWords } from '../../../extension/entrypoints/fitting/logic/steps';
import { Header, Primary, Screen, TextButton, Title } from './ui';
import { WARMUP_LABELS, warmupEyebrow, warmupSetLine, warmupWords } from './warmupWords';

type Step = Exclude<StepId, 'find' | 'context'>;

const TASKS: Record<Step, (p: TaskProps) => JSX.Element> = {
  size: SizeTask,
  truefalse: TrueFalseTask,
  faint: FaintTask,
  lightdark: LightDarkTask,
  dots: DotsTask,
};

/** The words may name a button in **bold**. */
function rich(text: string): JSX.Element {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return <>{parts.map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p))}</>;
}

/** What to do in the next activity: a page of its own, with its tiny moving picture, and Start pinned at the bottom. */
function InstructionPage(props: {
  step: Step;
  eyebrow: string;
  words: StepWords;
  setLine: string | null;
  sub: [number, number];
  onStart: () => void;
  onSkip: () => void;
  onLeave: () => void;
}): JSX.Element {
  // Enter starts, as on the onboarding's card; Enter on a focused button does that button's job.
  useKeys(true, (key, e) => {
    if (key !== 'Enter' || e.target instanceof HTMLButtonElement) return;
    e.preventDefault();
    props.onStart();
  });
  return (
    <Screen
      onLeave={props.onLeave}
      sub={props.sub}
      focusKey={`instr-${props.step}`}
      actions={
        <>
          <Primary onClick={props.onStart}>{WARMUP_LABELS.startStep}</Primary>
          <TextButton onClick={props.onSkip}>{WARMUP_LABELS.skipStep}</TextButton>
        </>
      }
    >
      {props.setLine ? (
        <p class="st-instr-set">
          <CheckIcon size={18} />
          {props.setLine}
        </p>
      ) : null}
      <Title eyebrow={props.eyebrow}>{props.words.title}</Title>
      <div class="st-instr">
        <p class="st-instr-todo">{rich(props.words.todo)}</p>
        <p class="st-instr-success">{rich(props.words.success)}</p>
        <Demo step={props.step} />
      </div>
    </Screen>
  );
}

export interface WarmupResult {
  raw: FittingRaw;
  fit: FitProfile;
  durationSec: number;
  skipped: string[];
  input: InputClass;
}

type View = { kind: 'start' } | { kind: 'intro'; step: Step } | { kind: 'task'; step: Step } | { kind: 'closing' };

export function Warmup(props: { seed: number; onDone: (r: WarmupResult) => void; onLeave: () => void }): JSX.Element {
  const raw = useMemo(() => new RawCollector(), []);
  const rng = useMemo(() => makeRng(props.seed), [props.seed]);
  const [env, setEnv] = useState<Env | null>(null);
  const [settings, setSettings] = useState<BrowserSettings | null>(null);
  const [view, setView] = useState<View>({ kind: 'start' });
  const [steps, setSteps] = useState<Step[]>([]);
  const [prev, setPrev] = useState<Step | null>(null);
  const [draft, setDraft] = useState<FitProfile>(defaultFit);
  const input = useRef<{ pointerType: string | null }>({ pointerType: null });

  useEffect(() => {
    void (async () => {
      const zoom = await readPageZoom();
      raw.zoom = zoom;
      setEnv(captureEnv(SENTENCES.map((s) => s.text).join(' '), zoom));
      setSettings(await readBrowserSettings().catch(() => null));
    })();
  }, []);

  // Every press in the warm-up counts toward steady clicks, as in the onboarding; hidden time stops its clock.
  const inFlow = view.kind !== 'closing';
  useEffect(() => {
    if (!inFlow) return;
    const down = (e: PointerEvent) => {
      input.current.pointerType ??= e.pointerType;
      if (view.kind === 'start') return;
      raw.countAction();
      raw.onPointerDown(e);
    };
    const up = (e: PointerEvent) => raw.onPointerUp(e);
    const vis = () => {
      if (document.hidden) raw.stopClock();
      else if (view.kind !== 'start') raw.startClock();
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up, true);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [inFlow, view.kind]);

  const derive = (): FitProfile => {
    try {
      return deriveFit(raw.toRaw(), { settings });
    } catch {
      return defaultFit();
    }
  };

  const inputNow = (): InputClass => {
    const pt = input.current.pointerType;
    return pt === 'touch' || (pt == null && settings?.pointer === 'coarse')
      ? 'touch'
      : pt === 'pen'
        ? 'other'
        : 'mouse';
  };
  const planFor = (cls: InputClass): Step[] =>
    planSteps(cls, settings).filter((s): s is Step => s !== 'find' && s !== 'context');

  const start = () => {
    const cls = inputNow();
    raw.inputClass = cls;
    raw.skippedSteps.add('find');
    const plan = planFor(cls);
    if (settings?.forcedColors) {
      raw.markBlock('faint', 'prefilled');
      raw.skippedSteps.add('light or dark');
    }
    setSteps(plan);
    raw.startClock();
    if (plan[0]) setView({ kind: 'intro', step: plan[0] });
  };

  const beginStep = (step: Step) => {
    if (step === 'size' || step === 'truefalse') raw.beginBlock('read');
    else if (step === 'faint') raw.beginBlock('faint');
    else if (step === 'dots') raw.beginBlock('point');
    setView({ kind: 'task', step });
  };

  const markSkipped = (step: Step) => {
    if (step === 'size') raw.skippedSteps.add('size');
    else if (step === 'truefalse') raw.endBlock('read', { trials: raw.ladder.length, skipped: true });
    else if (step === 'faint') raw.endBlock('faint', { trials: raw.faint.length, skipped: true });
    else if (step === 'lightdark') raw.skippedSteps.add('light or dark');
    else if (step === 'dots') raw.endBlock('point', { trials: 0, skipped: true });
  };

  const finish = (completed: boolean) => {
    raw.stopClock();
    const metrics = raw.metrics({
      completed,
      corrections: { textSteps: 0, colours: false, rows: [] },
      settingsUsed: settings ? settingsUsed(settings) : [],
    });
    let fit: FitProfile;
    try {
      fit = deriveFit(raw.toRaw(), { settings, metrics });
    } catch {
      fit = defaultFit();
    }
    const r = raw.toRaw();
    props.onDone({
      raw: r,
      fit,
      durationSec: r.durationSec,
      skipped: r.skipped,
      input: raw.inputClass,
    });
  };

  const advance = (step: Step) => {
    const i = steps.indexOf(step);
    const next = steps[i + 1];
    setPrev(step);
    if (next) {
      setView({ kind: 'intro', step: next });
      return;
    }
    setView({ kind: 'closing' });
  };

  const stepDone = (step: Step, o: StepOutcome) => {
    if (step === 'truefalse') raw.endBlock('read', o);
    else if (step === 'faint') raw.endBlock('faint', o);
    else if (step === 'dots') raw.endBlock('point', o);
    setDraft(derive());
    advance(step);
  };

  /** "Skip the warm-up" on its start page: every activity is marked skipped, and the fit is the default. */
  const skipAll = () => {
    const cls = inputNow();
    raw.inputClass = cls;
    raw.skippedSteps.add('find');
    for (const s of planFor(cls)) markSkipped(s);
    finish(false);
  };

  if (!env) return <div class="fl-app" />;

  // The progress bar's warm-up section fills one step at a time.
  const stepAt =
    view.kind === 'intro' || view.kind === 'task'
      ? steps.indexOf(view.step)
      : view.kind === 'closing'
        ? steps.length
        : 0;

  const sub: [number, number] = [stepAt, Math.max(1, steps.length)];
  let page: JSX.Element;
  if (view.kind === 'start') {
    page = (
      <Screen
        onLeave={props.onLeave}
        sub={sub}
        focusKey="warmup-start"
        actions={
          <>
            <Primary onClick={start}>Start the warm-up</Primary>
            <TextButton onClick={skipAll}>Skip the warm-up</TextButton>
          </>
        }
      >
        <Title>Warm-up</Title>
        <div class="st-prose">
          <p>The warm-up has 2 parts. First you read some text. Then you tap some dots.</p>
          <p>It tells us what text size is comfortable for you. It also tells us how big buttons need to be for you.</p>
          <p>
            There are {planFor(inputNow()).length} activities. Before each one, we show you what to do. If you cannot
            read a sentence or see a word, there is a button to say so.
          </p>
          <p>This takes about 5 minutes.</p>
        </div>
      </Screen>
    );
  } else if (view.kind === 'intro') {
    const step = view.step;
    page = (
      <InstructionPage
        step={step}
        eyebrow={warmupEyebrow(step, steps)}
        words={warmupWords(step)}
        setLine={warmupSetLine(prev, step)}
        sub={sub}
        onStart={() => beginStep(step)}
        onSkip={() => {
          markSkipped(step);
          advance(step);
        }}
        onLeave={props.onLeave}
      />
    );
  } else if (view.kind === 'closing') {
    page = (
      <Screen
        onLeave={null}
        sub={sub}
        focusKey="warmup-end"
        actions={<Primary onClick={() => finish(true)}>Go to the practice website</Primary>}
      >
        <div class="st-warm-end">
          <span class="fl-closing-mark" aria-hidden="true">
            <CheckIcon size={36} />
          </span>
          <Title>The warm-up is finished.</Title>
          <p class="st-deck">Next: one practice website.</p>
        </div>
      </Screen>
    );
  } else {
    // An activity: the onboarding's own step, with its answer buttons pinned to the bottom (study.css).
    const Task = TASKS[view.step];
    const step = view.step;
    page = (
      <div class="fl-app st-warmup">
        <Header onLeave={props.onLeave} sub={sub} />
        <main class="fl-main">
          <div class="fl-col">
            <Task
              key={step}
              raw={raw}
              env={env}
              settings={settings}
              draft={draft}
              rng={rng}
              input={raw.inputClass}
              onAnswer={() => undefined}
              onDone={(o) => stepDone(step, o)}
            />
          </div>
        </main>
      </div>
    );
  }

  return <StepLabelsContext.Provider value={WARMUP_LABELS}>{page}</StepLabelsContext.Provider>;
}
