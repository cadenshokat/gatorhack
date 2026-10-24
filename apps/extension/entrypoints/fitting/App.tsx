// The fitting flow: Welcome → how you point → Reading (R1–R4) → Pointing (P1) → Finding (F1–F3) → Your fit.
// One instruction per screen, no timers or scores, every part skippable, Pause any time (Esc).

import { DEMO_FITS, type FitProfile, type InputClass } from '@webable/core';
import type { JSX } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { SENTENCES, type Sentence } from './content/sentences';
import { captureEnv, type Env } from './logic/env';
import { planFinding } from './logic/finding';
import { cloneFit, deriveSafely, effectiveTextPx, fallbackFit } from './logic/fitview';
import { makeRng, shuffle } from './logic/rand';
import { RawCollector, type TaskId } from './logic/raw';
import { closeThisTab, loadFit, loadServerOrigin, openPage, readZoom, saveFit } from './logic/storage';
import { Find, GotInWayScreen, Prefer } from './screens/Finding';
import { Dots } from './screens/Pointing';
import { Comfort, ExpressOffer, Faint, Ladder, PolarityQuestion, PolarityTrials } from './screens/Reading';
import type { ScreenProps, SentenceSource } from './screens/types';
import { PointerChoice, Welcome, type DemoName } from './screens/Welcome';
import { Done, YourFit, type FitOrigin } from './screens/YourFit';
import { ActionBar, FitSlip, PART_LABEL, PARTS, PauseOverlay, TopBar, type Part, type RulerState, type SlipLine } from './ui/chrome';

type StepId = 'welcome' | 'pointer' | 'R1' | 'R2' | 'express' | 'R3' | 'R4' | 'R4q' | 'P1' | 'F1' | 'F2' | 'F3' | 'fit' | 'done';
type Mode = 'full' | 'quick' | 'listen';

const STEP_PART: Partial<Record<StepId, Part>> = {
  R1: 'reading', R2: 'reading', express: 'reading', R3: 'reading', R4: 'reading', R4q: 'reading',
  P1: 'pointing', F1: 'finding', F2: 'finding', F3: 'finding',
};
const STEP_TASK: Partial<Record<StepId, TaskId>> = {
  R1: 'R1', R2: 'R2', R3: 'R3', R4: 'R4', R4q: 'R4', P1: 'P1', F1: 'F1', F2: 'F2', F3: 'F3',
};
/** Typical seconds per screen (brief §1), for "about N minutes left". */
const TYPICAL_S: Partial<Record<StepId, number>> = {
  R1: 8, R2: 24, express: 4, R3: 9, R4: 10, R4q: 4, P1: 20, F1: 22, F2: 6, F3: 4,
};
const ALL_TASKS: TaskId[] = ['R1', 'R2', 'R3', 'R4', 'P1', 'F1', 'F2', 'F3'];

interface PlanCtx {
  mode: Mode;
  keyboard: boolean;
  forced: boolean;
  offerExpress: boolean;
}

function plannedSteps(c: PlanCtx): StepId[] {
  if (c.mode === 'quick') return c.keyboard ? ['R1'] : ['R1', 'P1'];
  if (c.mode === 'listen') return ['F3'];
  const s: StepId[] = ['R1', 'R2'];
  if (c.offerExpress) s.push('express');
  if (!c.forced) s.push('R3', 'R4', 'R4q');
  if (!c.keyboard) s.push('P1');
  s.push('F1', 'F2', 'F3');
  return s;
}

function demoFit(name: DemoName): FitProfile | null {
  try {
    const f = (DEMO_FITS as Partial<Record<DemoName, FitProfile>> | undefined)?.[name];
    if (f) return { ...cloneFit(f), createdAt: new Date().toISOString() };
  } catch {
    /* core not ready */
  }
  return null;
}

export function App(): JSX.Element {
  const raw = useMemo(() => new RawCollector(), []);
  const [env, setEnv] = useState<Env | null>(null);
  const [step, setStep] = useState<StepId>('welcome');
  const [mode, setMode] = useState<Mode>('full');
  const [paused, setPaused] = useState(false);
  const [within, setWithin] = useState(0);
  const [idle, setIdle] = useState(false);
  const [existing, setExisting] = useState<FitProfile | null>(null);
  const [fit, setFit] = useState<FitProfile | null>(null);
  const [origin, setOrigin] = useState<FitOrigin>('measured');
  const [demoName, setDemoName] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [motionStopped, setMotionStopped] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [serverOrigin, setServerOrigin] = useState('');
  const [, force] = useState(0);
  const [chromeScale, setChromeScale] = useState(1);
  const [vw, setVw] = useState(() => window.innerWidth);
  const lastActivity = useRef(performance.now());
  const started = useRef(false);

  const seed = useMemo(() => (Math.random() * 2 ** 31) | 0, []);
  const plan = useMemo(() => planFinding(makeRng(seed)), [seed]);
  const sentences = useMemo<SentenceSource>(() => {
    const rng = makeRng(seed ^ 0x5bd1e995);
    let pool: Sentence[] = shuffle(SENTENCES, rng);
    let k = 0;
    return {
      next: () => {
        if (k >= pool.length) {
          pool = shuffle(SENTENCES, rng);
          k = 0;
        }
        return pool[k++] as Sentence;
      },
    };
  }, [seed]);

  /* ---------------- boot ---------------- */

  useEffect(() => {
    const e = captureEnv(SENTENCES.map((s) => s.text).join(' '));
    setEnv(e);
    raw.inputClass = e.coarse ? 'touch' : 'mouse';
    void readZoom().then((z) => (raw.zoom = z));
    void loadFit().then(setExisting);
    void loadServerOrigin().then(setServerOrigin);

    const q = new URLSearchParams(location.search);
    const demo = q.get('demo');
    if (demo === 'rosa' || demo === 'typical' || demo === 'reader') {
      const f = demoFit(demo);
      if (f) {
        setFit(f);
        setOrigin('demo');
        setDemoName(demo === 'rosa' ? 'Rosa' : demo === 'typical' ? 'Typical' : 'Reader');
        setStep('fit');
      }
    }
  }, []);

  /* ---------------- presses, activity, visibility ---------------- */

  useEffect(() => {
    const down = (e: PointerEvent) => {
      lastActivity.current = performance.now();
      setIdle(false);
      if (started.current) raw.onPointerDown(e);
    };
    const up = (e: PointerEvent) => {
      if (started.current) raw.onPointerUp(e);
    };
    const key = () => {
      lastActivity.current = performance.now();
      setIdle(false);
    };
    const vis = () => {
      if (document.hidden) raw.stopClock();
      else if (started.current && !paused && STEP_PART[step]) raw.startClock();
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
  }, [paused, step]);

  const inTask = STEP_PART[step] !== undefined;

  useEffect(() => {
    if (!inTask || paused) {
      setIdle(false);
      return;
    }
    lastActivity.current = performance.now();
    const id = window.setInterval(() => {
      if (performance.now() - lastActivity.current > 20_000) setIdle(true);
    }, 1000);
    return () => window.clearInterval(id);
  }, [step, paused, inTask]);

  /* ---------------- navigation ---------------- */

  const ctx = (): PlanCtx => ({
    mode,
    keyboard: raw.inputClass === 'keyboard',
    forced: env?.forcedColors ?? false,
    offerExpress: mode === 'full' && raw.done.has('R2') && (raw.ladderMedianRtMs ?? 0) > 8000,
  });

  const finish = useCallback(
    (m: Mode) => {
      raw.stopClock();
      // Whatever was not done counts as skipped, so core knows which values are measured.
      for (const t of ALL_TASKS) if (!raw.done.has(t)) raw.skip(t);
      const { fit: f } = deriveSafely(raw.toRaw(), env);
      setFit(f);
      setOrigin(raw.done.size ? 'measured' : 'default');
      setDemoName(undefined);
      setStep('fit');
      void m;
    },
    [env],
  );

  const goNext = (from: StepId, m: Mode = mode) => {
    setWithin(0);
    const c = { ...ctx(), mode: m };
    const steps = plannedSteps(c);
    let i = steps.indexOf(from);
    let next: StepId | undefined;
    for (;;) {
      i += 1;
      next = steps[i];
      if (!next) break;
      // R4's question needs its sentences; F2 needs the pages from F1.
      if (next === 'R4q' && raw.skipped.has('R4')) continue;
      if (next === 'F2' && !raw.done.has('F1')) {
        raw.skip('F2');
        continue;
      }
      break;
    }
    if (!next) {
      finish(m);
      return;
    }
    const part = STEP_PART[next];
    if (part && part !== STEP_PART[from]) setAnnounce(`Part ${PARTS.indexOf(part) + 1} of 3: ${PART_LABEL[part]}`);
    setStep(next);
  };

  const begin = (m: Mode) => {
    setMode(m);
    started.current = true;
    setStep('pointer');
  };

  const onPointer = (id: InputClass) => {
    raw.inputClass = id;
    raw.startClock();
    const first = plannedSteps({ ...ctx(), mode, keyboard: id === 'keyboard' })[0] ?? 'F3';
    setAnnounce(`Part ${PARTS.indexOf(STEP_PART[first] ?? 'reading') + 1} of 3: ${PART_LABEL[STEP_PART[first] ?? 'reading']}`);
    setStep(first);
  };

  const skipCurrent = () => {
    setPaused(false);
    const task = STEP_TASK[step];
    if (step === 'express') raw.express = false;
    if (task) raw.skip(task);
    if (step === 'R4') {
      goNext('R4q');
      return;
    }
    goNext(step);
  };

  const togglePause = useCallback(() => {
    setPaused((p) => {
      if (p) raw.startClock();
      else raw.stopClock();
      return !p;
    });
  }, []);

  useEffect(() => {
    if (!inTask) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inTask]);

  const setChromeSize = (cssPx: number) => {
    const scale = Math.round(Math.min(1.6, Math.max(1, cssPx / 24)) * 100) / 100;
    document.documentElement.style.setProperty('--chrome-scale', String(scale));
    setChromeScale(scale);
  };

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* ---------------- welcome actions ---------------- */

  const onSkipAll = () => {
    started.current = true;
    for (const t of ALL_TASKS) raw.skip(t);
    finish('full');
  };

  const onDemo = (name: DemoName) => {
    const f = demoFit(name);
    setFit(f ?? fallbackFit(raw.toRaw()));
    setOrigin('demo');
    setDemoName(name === 'rosa' ? 'Rosa' : name === 'typical' ? 'Typical' : 'Reader');
    setStep('fit');
  };

  const onSave = async (f: FitProfile) => {
    setSaving(true);
    const ok = await saveFit({ ...f, createdAt: new Date().toISOString() });
    setSaving(false);
    setSaved(ok);
    setExisting(ok ? f : existing);
    setStep('done');
  };

  const restart = () => {
    location.href = location.pathname;
  };

  /* ---------------- ruler and slip ---------------- */

  const ruler: RulerState | null = useMemo(() => {
    const part = STEP_PART[step];
    if (!part) return null;
    const steps = plannedSteps(ctx());
    const idx = steps.indexOf(step);
    const inPart = steps.filter((s) => STEP_PART[s] === part);
    const k = inPart.indexOf(step);
    const frac = inPart.length ? (k + Math.min(1, within)) / inPart.length : 0;
    const rest = steps.slice(idx + 1).reduce((a, s) => a + (TYPICAL_S[s] ?? 5), 0) + (TYPICAL_S[step] ?? 5) * (1 - within);
    const done = PARTS.filter((p) => PARTS.indexOf(p) < PARTS.indexOf(part));
    return { part, within: frac, done, secondsLeft: rest };
  }, [step, within, mode]);

  const slip: SlipLine[] = useMemo(() => {
    const lines: SlipLine[] = [
      { key: 'text', label: 'Text', value: null },
      { key: 'contrast', label: 'Faint text', value: null },
      { key: 'polarity', label: 'Light or dark', value: null },
      { key: 'targets', label: 'Click areas', value: null },
      { key: 'busy', label: 'Busy pages', value: null },
    ];
    if (!raw.done.size) return lines;
    const { fit: f } = deriveSafely(raw.toRaw(), env);
    const set = (key: string, v: string) => {
      const l = lines.find((x) => x.key === key);
      if (l) l.value = v;
    };
    if (raw.done.has('R2') || raw.done.has('R1')) set('text', `${Math.round(effectiveTextPx(f))} px`);
    if (raw.done.has('R3')) set('contrast', f.contrast.band === 'S' ? 'max' : `${f.contrast.floor}:1`);
    if (raw.done.has('R4')) set('polarity', f.polarity.value === 'none' ? 'site colors' : f.polarity.value);
    if (raw.done.has('P1') && f.targets.minPx) set('targets', `${f.targets.minPx} px`);
    if (raw.done.has('F3') || raw.done.has('F2')) {
      const l = f.attention.structureLevel;
      set('busy', l === 2 ? 'calmer' : l === 1 ? 'offered' : 'as is');
    }
    return lines;
  }, [step]);

  /* ---------------- render ---------------- */

  if (!env) return <div class="fx-app" />;

  const screenProps: ScreenProps = {
    raw,
    env,
    paused,
    onProgress: (f: number) => setWithin(f),
    onDone: () => {
      force((n) => n + 1);
      goNext(step);
    },
  };

  let body: JSX.Element;
  let wide = false;
  switch (step) {
    case 'welcome':
      body = <Welcome existing={existing} onStart={begin} onSkipAll={onSkipAll} onDemo={onDemo} />;
      break;
    case 'pointer':
      body = <PointerChoice suggested={env.coarse ? 'touch' : 'mouse'} onPick={onPointer} />;
      break;
    case 'R1':
      body = <Comfort {...screenProps} onSize={setChromeSize} />;
      break;
    case 'R2':
      body = <Ladder {...screenProps} sentences={sentences} />;
      break;
    case 'express':
      body = <ExpressOffer {...screenProps} />;
      break;
    case 'R3':
      body = <Faint {...screenProps} />;
      break;
    case 'R4':
      body = <PolarityTrials {...screenProps} sentences={sentences} />;
      break;
    case 'R4q':
      body = <PolarityQuestion {...screenProps} />;
      break;
    case 'P1':
      body = <Dots {...screenProps} />;
      break;
    case 'F1':
      wide = true;
      body = (
        <Find
          {...screenProps}
          plan={plan}
          motionStopped={motionStopped}
          onStopMotion={() => {
            raw.stoppedMotion = true;
            setMotionStopped(true);
          }}
        />
      );
      break;
    case 'F2':
      wide = true;
      body = <Prefer {...screenProps} plan={plan} />;
      break;
    case 'F3':
      body = <GotInWayScreen {...screenProps} general={mode === 'listen'} />;
      break;
    case 'fit':
      wide = true;
      body = fit ? (
        <YourFit
          initial={fit}
          origin={origin}
          demoName={demoName}
          done={raw.done}
          reducedMotion={env.reducedMotion}
          saving={saving}
          onSave={(f) => void onSave(f)}
          onRestart={restart}
        />
      ) : (
        <div />
      );
      break;
    default:
      body = (
        <Done
          saved={saved}
          onOpenDemo={() => void openPage(`${serverOrigin || 'http://127.0.0.1:41741'}/demo/`)}
          onClose={() => void closeThisTab()}
        />
      );
  }

  return (
    <div class="fx-app">
      <TopBar ruler={ruler} title={step === 'fit' ? 'Your fit' : undefined} />
      <main class={`fx-main ${wide ? 'is-wide' : ''} ${step === 'fit' ? 'is-fit' : ''}`} key={step}>
        {body}
      </main>
      {inTask && !wide && vw >= 1184 * chromeScale + 96 ? <FitSlip lines={slip} /> : null}
      {inTask ? <ActionBar onPause={togglePause} onSkip={skipCurrent} idle={idle} /> : null}
      {paused ? <PauseOverlay onResume={togglePause} onSkip={skipCurrent} canSkip /> : null}
      <div class="sr-only" aria-live="polite">
        {announce}
      </div>
    </div>
  );
}
