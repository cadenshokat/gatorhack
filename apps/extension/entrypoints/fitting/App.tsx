// The onboarding (docs/design/ONBOARDING.md): Welcome, then Reading · Pointing · Finding, one step at a time, each
// opened by an instruction card. Every press anywhere counts toward steady clicks. At the end, core's deriveFit turns
// the raw answers into the person's settings, which are saved and shown on Results.
//
// Routes: fitting.html opens Welcome; fitting.html#settings opens Results with the saved settings (Welcome if none).

import {
  DEMO_FITS, defaultFit, deriveFit, type BrowserSettings, type FitProfile, type InputClass, type WarmupMetrics,
} from '@webable/core';
import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { SENTENCES } from './content/sentences';
import { captureEnv, readBrowserSettings, readPageZoom, settingsUsed, type Env } from './logic/env';
import { makeRng } from './logic/rand';
import { RawCollector } from './logic/raw';
import {
  eyebrowFor, linesFor, mergeLines, PART_OF, partSetLine, PARTS, partsFor, planSteps, wordsFor,
  type LearnedLine, type PartId, type StepId,
} from './logic/steps';
import { closeThisTab, loadFit, saveFit } from './logic/storage';
import { Results } from './results/Results';
import { Welcome } from './screens/Welcome';
import { DotsTask } from './tasks/Dots';
import { FaintTask } from './tasks/Faint';
import { FindTask } from './tasks/Find';
import { LightDarkTask } from './tasks/LightDark';
import { SizeTask } from './tasks/Size';
import { TaskLayout, type StepOutcome, type TaskProps } from './tasks/Task';
import { TrueFalseTask } from './tasks/TrueFalse';
import { CheckIcon, Rail, TopBar } from './ui/Chrome';
import { Instruction } from './ui/Modal';

type View =
  | { kind: 'boot' }
  | { kind: 'welcome' }
  | { kind: 'intro'; step: StepId }
  | { kind: 'task'; step: StepId }
  | { kind: 'closing' }
  | { kind: 'results'; fit: FitProfile; measured: boolean };

const TASKS: Record<StepId, (p: TaskProps) => JSX.Element> = {
  size: SizeTask,
  truefalse: TrueFalseTask,
  faint: FaintTask,
  lightdark: LightDarkTask,
  dots: DotsTask,
  find: FindTask,
};

/** The stage size each step uses, so the card behind the instruction already has the right shape. */
const STAGE_CLASS: Record<StepId, string> = {
  size: 'is-size',
  truefalse: 'is-read',
  faint: 'is-faint',
  lightdark: 'is-read',
  dots: 'is-dots',
  find: 'is-find',
};

const CLOSING_MS = 1600;
const newSeed = (): number => (Math.random() * 2 ** 31) | 0;

function safeDerive(raw: RawCollector, settings: BrowserSettings | null, metrics?: WarmupMetrics): FitProfile {
  try {
    return deriveFit(raw.toRaw(), { settings, metrics: metrics ?? null });
  } catch {
    return defaultFit();
  }
}

export function App(): JSX.Element {
  const raw = useMemo(() => new RawCollector(), []);
  const [seed, setSeed] = useState(newSeed);
  const rng = useMemo(() => makeRng(seed), [seed]);
  const [env, setEnv] = useState<Env | null>(null);
  const [settings, setSettings] = useState<BrowserSettings | null>(null);
  const [view, setView] = useState<View>({ kind: 'boot' });
  const [steps, setSteps] = useState<StepId[]>([]);
  const [prev, setPrev] = useState<StepId | null>(null);
  const [doneParts, setDoneParts] = useState<Set<PartId>>(new Set());
  const [rail, setRail] = useState<LearnedLine[]>([]);
  const [chip, setChip] = useState<LearnedLine | null>(null);
  const [draft, setDraft] = useState<FitProfile>(defaultFit);
  const [ticking, setTicking] = useState(false);
  const [announce, setAnnounce] = useState('');
  const touchedParts = useRef(new Set<PartId>());
  const anyDone = useRef(false);
  const input = useRef<{ moved: boolean; pointerType: string | null }>({ moved: false, pointerType: null });
  const tickTimer = useRef(0);
  const closingTimer = useRef(0);

  /* ---------------- boot: the browser's own settings before any press ---------------- */

  useEffect(() => {
    void (async () => {
      const zoom = await readPageZoom();
      raw.zoom = zoom;
      setEnv(captureEnv(SENTENCES.map((s) => s.text).join(' '), zoom));
      const s = await readBrowserSettings().catch(() => null);
      setSettings(s);
      if (location.hash === '#settings') {
        const saved = await loadFit();
        if (saved) {
          setView({ kind: 'results', fit: saved, measured: false });
          return;
        }
      }
      setView({ kind: 'welcome' });
    })();
    return () => {
      window.clearTimeout(tickTimer.current);
      window.clearTimeout(closingTimer.current);
    };
  }, []);

  /* ---------------- input type: inferred from the first presses, never asked ---------------- */

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') input.current.moved = true;
    };
    const down = (e: PointerEvent) => {
      input.current.moved = true;
      input.current.pointerType ??= e.pointerType;
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', down, true);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', down, true);
    };
  }, []);

  /* ---------------- every press in the flow (Start buttons too), actions, hidden-tab time ---------------- */

  const inFlow = view.kind === 'welcome' || view.kind === 'intro' || view.kind === 'task';
  useEffect(() => {
    if (!inFlow) return;
    const down = (e: PointerEvent) => {
      raw.countAction();
      raw.onPointerDown(e);
    };
    const up = (e: PointerEvent) => raw.onPointerUp(e);
    const key = (e: KeyboardEvent) => {
      if (!e.repeat && !['Shift', 'Meta', 'Control', 'Alt'].includes(e.key)) raw.countAction();
    };
    const vis = () => {
      if (document.hidden) raw.stopClock();
      else if (view.kind !== 'welcome') raw.startClock();
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('keydown', key, true);
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('keydown', key, true);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [inFlow, view.kind]);

  /* ---------------- flow ---------------- */

  const openIntro = (step: StepId, plan: StepId[]) => {
    setView({ kind: 'intro', step });
    setAnnounce(`${eyebrowFor(step, plan)}. ${wordsFor(step, raw.inputClass).title}`);
  };

  const start = (e: MouseEvent) => {
    // Enter or Space on Start with no pointer movement: a keyboard user (click events from keys have detail 0).
    const keyboard = e.detail === 0 && !input.current.moved;
    const pt = input.current.pointerType;
    const cls: InputClass = keyboard
      ? 'keyboard'
      : pt === 'touch' || (pt == null && settings?.pointer === 'coarse')
        ? 'touch'
        : pt === 'pen'
          ? 'other'
          : 'mouse';
    raw.inputClass = cls;
    const plan = planSteps(cls, settings);
    if (cls === 'keyboard') raw.markBlock('point', 'not_run');
    if (settings?.forcedColors) {
      raw.markBlock('faint', 'prefilled');
      raw.skippedSteps.add('light or dark');
    }
    setSteps(plan);
    raw.startClock();
    const first = plan[0];
    if (first) openIntro(first, plan);
  };

  const beginStep = (step: StepId) => {
    if (step === 'size' || step === 'truefalse') raw.beginBlock('read');
    else if (step === 'faint') raw.beginBlock('faint');
    else if (step === 'dots') raw.beginBlock('point');
    else if (step === 'find') raw.beginBlock('find');
    setView({ kind: 'task', step });
  };

  /** Bookkeeping for a step the person skipped (or never reached when they skip the rest). */
  const markSkipped = (step: StepId) => {
    if (step === 'size') raw.skippedSteps.add('size');
    else if (step === 'truefalse') raw.endBlock('read', { trials: raw.ladder.length, skipped: true });
    else if (step === 'faint') raw.endBlock('faint', { trials: raw.faint.length, skipped: true });
    else if (step === 'lightdark') raw.skippedSteps.add('light or dark');
    else if (step === 'dots') raw.endBlock('point', { trials: 0, skipped: true });
    else if (step === 'find') {
      raw.endBlock('find', { trials: raw.findTrials.length, skipped: true });
      raw.endBlock('pick', { trials: 0, skipped: true });
    }
  };

  const finish = async (measured: boolean, completed: boolean) => {
    window.clearTimeout(closingTimer.current);
    raw.stopClock();
    const metrics = raw.metrics({
      completed,
      corrections: { textSteps: 0, colours: false, rows: [] },
      settingsUsed: settings ? settingsUsed(settings) : [],
    });
    const fit = safeDerive(raw, settings, metrics);
    await saveFit(fit);
    setView({ kind: 'results', fit, measured });
  };

  const advance = (step: StepId, added: LearnedLine | null) => {
    const i = steps.indexOf(step);
    const next = steps[i + 1];
    const part = PART_OF[step];
    if (!next || PART_OF[next] !== part) setDoneParts((s) => new Set(s).add(part));
    setPrev(step);
    setChip(added);
    if (next) {
      openIntro(next, steps);
      return;
    }
    setView({ kind: 'closing' });
    setAnnounce('You’re all set.');
    closingTimer.current = window.setTimeout(() => void finish(anyDone.current, true), CLOSING_MS);
  };

  const stepDone = (step: StepId, o: StepOutcome) => {
    if (step === 'truefalse') raw.endBlock('read', o);
    else if (step === 'faint') raw.endBlock('faint', o);
    else if (step === 'dots') raw.endBlock('point', o);
    else if (step === 'find') raw.endBlock('pick', { trials: 2, stop: 'person' });
    anyDone.current = true;
    touchedParts.current.add(PART_OF[step]);
    const d = safeDerive(raw, settings);
    setDraft(d);
    const add = linesFor(step, d);
    setRail((r) => mergeLines(r, add));
    advance(step, add[add.length - 1] ?? null);
  };

  const skipStep = (step: StepId) => {
    markSkipped(step);
    advance(step, null);
  };

  /** "Skip for now": keep what was learned so far and show what WebAble will do. */
  const skipAll = async () => {
    if (view.kind === 'welcome') {
      const saved = await loadFit();
      if (saved) {
        setView({ kind: 'results', fit: saved, measured: false });
        return;
      }
      for (const s of planSteps(raw.inputClass, settings)) markSkipped(s);
      await finish(false, false);
      return;
    }
    const at = view.kind === 'intro' || view.kind === 'task' ? steps.indexOf(view.step) : steps.length;
    for (const s of steps.slice(Math.max(0, at))) markSkipped(s);
    await finish(anyDone.current, false);
  };

  const onAnswer = () => {
    setTicking(true);
    window.clearTimeout(tickTimer.current);
    tickTimer.current = window.setTimeout(() => setTicking(false), 700);
  };

  const retake = () => {
    window.clearTimeout(closingTimer.current);
    raw.reset();
    setSeed(newSeed());
    setSteps([]);
    setPrev(null);
    setDoneParts(new Set());
    setRail([]);
    setChip(null);
    setDraft(defaultFit());
    touchedParts.current = new Set();
    anyDone.current = false;
    input.current = { moved: false, pointerType: null };
    try {
      history.replaceState(null, '', location.pathname);
    } catch {
      /* fine */
    }
    setView({ kind: 'welcome' });
  };

  // Test hook for automation (scripts/eval): `__fitting.phase()` names the screen ('welcome', 'intro:size',
  // 'task:find', 'results', ...); `__fitting.raw()` is the raw answers so far; `await __fitting.finish('rosa' | 'typical' | 'reader')` saves that demo fit from core's
  // DEMO_FITS and jumps straight to Results, as if the steps had run.
  useEffect(() => {
    (globalThis as { __fitting?: unknown }).__fitting = {
      phase: () => (view.kind === 'intro' || view.kind === 'task' ? `${view.kind}:${view.step}` : view.kind),
      raw: () => raw.toRaw(),
      finish: async (name: keyof typeof DEMO_FITS = 'rosa') => {
        window.clearTimeout(closingTimer.current);
        const fit: FitProfile = { ...(JSON.parse(JSON.stringify(DEMO_FITS[name])) as FitProfile), createdAt: new Date().toISOString() };
        await saveFit(fit);
        setView({ kind: 'results', fit, measured: true });
      },
    };
  });

  /* ---------------- render ---------------- */

  if (view.kind === 'boot' || !env) return <div class="fl-app" />;

  if (view.kind === 'results') {
    return (
      <div class="fl-results" key="results">
        <Results
          fit={view.fit}
          measured={view.measured}
          onChange={(next: FitProfile) => {
            void saveFit(next);
            setView((v) => (v.kind === 'results' ? { ...v, fit: next } : v));
          }}
          onRetake={retake}
          onDone={() => void closeThisTab()}
        />
      </div>
    );
  }

  const parts = steps.length ? partsFor(steps) : PARTS;
  const currentPart = view.kind === 'intro' || view.kind === 'task' ? PART_OF[view.step] : null;
  const showRail = view.kind !== 'welcome';

  let body: JSX.Element;
  if (view.kind === 'welcome') {
    body = <Welcome onStart={start} onSkip={() => void skipAll()} />;
  } else if (view.kind === 'task') {
    const Task = TASKS[view.step];
    const step = view.step;
    body = (
      <Task
        key={step}
        raw={raw}
        env={env}
        settings={settings}
        draft={draft}
        rng={rng}
        input={raw.inputClass}
        onAnswer={onAnswer}
        onDone={(o) => stepDone(step, o)}
      />
    );
  } else if (view.kind === 'intro') {
    // The step's empty stage waits behind the card, so Start reveals it in place.
    body = (
      <TaskLayout title={wordsFor(view.step, raw.inputClass).title} stageClass={STAGE_CLASS[view.step]} actions={<span class="fl-actions-ghost" />} />
    );
  } else {
    body = (
      <section class="fl-closing card">
        <span class="fl-closing-mark" aria-hidden="true">
          <CheckIcon size={36} />
        </span>
        <h2 class="fl-closing-title">You’re all set.</h2>
        <p class="fl-closing-deck">Here’s what WebAble will do for you.</p>
      </section>
    );
  }

  const intro = view.kind === 'intro' ? view.step : null;
  const setLine = intro && prev && touchedParts.current.has(PART_OF[prev]) ? partSetLine(prev, intro) : null;

  return (
    <div class="fl-app">
      <TopBar parts={parts} current={currentPart} done={doneParts} ticking={ticking} onSkip={view.kind === 'welcome' || view.kind === 'closing' ? null : () => void skipAll()} />
      <main class={`fl-main ${showRail ? 'has-rail' : ''}`}>
        <div class="fl-col" inert={intro != null}>
          {body}
        </div>
        {showRail ? <Rail lines={rail} /> : null}
      </main>
      {intro ? (
        <div class={`fl-scrim ${showRail ? 'has-rail' : ''}`}>
          <Instruction
            step={intro}
            eyebrow={eyebrowFor(intro, steps)}
            words={wordsFor(intro, raw.inputClass)}
            setLine={setLine}
            chip={chip}
            onStart={() => beginStep(intro)}
            onSkip={() => skipStep(intro)}
          />
        </div>
      ) : null}
      <div class="visually-hidden" aria-live="polite">
        {announce}
      </div>
    </div>
  );
}
