// The 70-second warm-up (fitting brief round 4): one news-page stage that fits itself while the person taps along.
// Browser settings answer what they can first; Read, Faint, Point, Find and Pick stop as soon as they are sure; the
// person ends on their own fitted page and can change anything. No Next buttons, no timers or scores.

import { DEMO_FITS, defaultFit, type BrowserSettings, type FitProfile, type InputClass, type WarmupMetrics } from '@webable/core';
import type { JSX } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { SENTENCES } from './content/sentences';
import { captureEnv, readBrowserSettings, readPageZoom, settingsUsed, type Env } from './logic/env';
import { cloneFit, deriveSafely, lookOf, markValue, type MarkState } from './logic/fitview';
import { MARK_OF, MARKS, planBlocks, type BlockId, type BlockPlan, type MarkId } from './logic/plan';
import { makeRng } from './logic/rand';
import { RawCollector } from './logic/raw';
import { closeThisTab, loadFit, loadServerOrigin, openPage, saveFit } from './logic/storage';
import { Confirm, Done } from './screens/Confirm';
import { ReaderPath, Skipped, Start } from './screens/Start';
import { FaintBlock } from './stage/Faint';
import { FindBlock } from './stage/Find';
import { FrameBar, Instruction } from './stage/Frame';
import { NewsPage } from './stage/NewsPage';
import { PickBlock } from './stage/Pick';
import { PointBlock } from './stage/Point';
import { ReadBlock } from './stage/Read';
import type { BlockOutcome, BlockProps } from './stage/types';
import { Btn, Wordmark } from './ui/common';
import { Strip, type StripMark } from './ui/Strip';

type Phase = 'boot' | 'start' | 'stage' | 'confirm' | 'done' | 'skipped' | 'reader';
type DemoName = 'rosa' | 'typical' | 'reader';

interface Beat {
  mark: MarkId;
  title: string;
  sub: string;
}

const BEAT_MS = 1100;
const IDLE_MS = 20_000;

function emptyMarks(): Record<MarkId, StripMark> {
  return { text: { state: 'pending', value: null }, contrast: { state: 'pending', value: null }, clicks: { state: 'pending', value: null }, calm: { state: 'pending', value: null }, colours: { state: 'pending', value: null } };
}

/** What the page just took on, in a few words (shown while the page changes). */
function beatFor(id: BlockId, fit: FitProfile): Beat | null {
  switch (id) {
    case 'read': {
      const px = fit.text.override ?? fit.text.bodyPx;
      return px > 16.25
        ? { mark: 'text', title: `Text: ${Math.round(px * 2) / 2} px.`, sub: 'The page grows to your size. Headings stay in proportion.' }
        : { mark: 'text', title: 'Text: the usual size suits you.', sub: 'Pages keep their own text size.' };
    }
    case 'faint':
      return fit.contrast.band === 'S'
        ? { mark: 'contrast', title: 'Contrast: strongest.', sub: 'Grey text is drawn near-black.' }
        : fit.contrast.band === 'M'
          ? { mark: 'contrast', title: 'Grey text: darker.', sub: 'Captions and faint text are darkened. Colours keep their hue.' }
          : { mark: 'contrast', title: 'Grey text: fine as it is.', sub: 'Only text too faint for anyone is darkened.' };
    case 'point': {
      const T = fit.targets.minPx;
      const steady = fit.clicks.steady.on ? ' Steady clicks on.' : '';
      return T != null && T > 24
        ? { mark: 'clicks', title: `Click areas: ${T} px.${steady}`, sub: 'Small buttons and links answer to a larger area. They look the same.' }
        : { mark: 'clicks', title: `Click areas: fine as they are.${steady}`, sub: 'Buttons and links keep their size.' };
    }
    case 'pick': {
      const l = fit.attention.structureLevel;
      return l === 2
        ? { mark: 'calm', title: 'Calm view on busy pages.', sub: 'Side panels and promotions step back. The original is one click away.' }
        : l === 1
          ? { mark: 'calm', title: 'Calm view offered on busy pages.', sub: 'Side panels step back when you ask.' }
          : { mark: 'calm', title: 'Busy pages stay as they are.', sub: 'A calmer layout is there when you ask for it.' };
    }
    default:
      return null;
  }
}

const BLOCKS: Record<BlockId, (p: BlockProps) => JSX.Element> = {
  read: ReadBlock,
  faint: FaintBlock,
  point: PointBlock,
  find: FindBlock,
  pick: PickBlock,
};

export function App(): JSX.Element {
  const raw = useMemo(() => new RawCollector(), []);
  const seed = useMemo(() => (Math.random() * 2 ** 31) | 0, []);
  const rng = useMemo(() => makeRng(seed), [seed]);
  const [phase, setPhase] = useState<Phase>('boot');
  const [env, setEnv] = useState<Env | null>(null);
  const [settings, setSettings] = useState<BrowserSettings | null>(null);
  const [existing, setExisting] = useState<FitProfile | null>(null);
  const [plan, setPlan] = useState<BlockPlan | null>(null);
  const [qi, setQi] = useState(0);
  const [beat, setBeat] = useState<Beat | null>(null);
  const [landed, setLanded] = useState<Set<MarkId>>(new Set());
  const [marks, setMarks] = useState<Record<MarkId, StripMark>>(emptyMarks);
  const [paused, setPaused] = useState(false);
  const [idle, setIdle] = useState(false);
  const [draft, setDraft] = useState<FitProfile>(() => defaultFit());
  const [stageStill, setStageStill] = useState(false);
  const [confirmBase, setConfirmBase] = useState<FitProfile | null>(null);
  const [demoName, setDemoName] = useState<DemoName | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [doneSeconds, setDoneSeconds] = useState<number | null>(null);
  const [serverOrigin, setServerOrigin] = useState('');
  const lastSaved = useRef<FitProfile | null>(null);
  const lastMetrics = useRef<WarmupMetrics | null>(null);
  const lastActivity = useRef(performance.now());
  const input = useRef<{ moved: boolean; tabFirst: boolean; pointerType: string | null }>({ moved: false, tabFirst: false, pointerType: null });

  const block: BlockId | null = plan && phase === 'stage' ? (plan.queue[qi] ?? null) : null;

  /* ---------------- boot: settings before any tap ---------------- */

  useEffect(() => {
    try {
      history.scrollRestoration = 'manual';
    } catch {
      /* not supported */
    }
    void (async () => {
      const zoom = await readPageZoom();
      raw.zoom = zoom;
      setEnv(captureEnv(SENTENCES.map((s) => s.text).join(' '), zoom));
      const s = await readBrowserSettings().catch(() => null);
      setSettings(s);
      setExisting(await loadFit());
      setServerOrigin(await loadServerOrigin());
      if (s) setDraft(deriveSafely(raw.toRaw(), s));
      const demo = new URLSearchParams(location.search).get('demo');
      if (demo === 'rosa' || demo === 'typical' || demo === 'reader') {
        setDemoName(demo);
        setConfirmBase({ ...cloneFit(DEMO_FITS[demo]), createdAt: new Date().toISOString() });
        setMarks(Object.fromEntries(MARKS.map((m) => [m.id, { state: 'done', value: markValue(m.id, DEMO_FITS[demo], s) }])) as Record<MarkId, StripMark>);
        setPhase('confirm');
        return;
      }
      setPhase('start');
    })();
  }, []);

  /* ---------------- input type: the first pointer, or Tab before any pointer move ---------------- */

  useEffect(() => {
    const move = () => {
      input.current.moved = true;
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && !input.current.moved) input.current.tabFirst = true;
    };
    const down = (e: PointerEvent) => {
      input.current.pointerType ??= e.pointerType;
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('keydown', key, true);
    window.addEventListener('pointerdown', down, true);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('pointerdown', down, true);
    };
  }, []);

  /* ---------------- presses, actions, activity, visibility ---------------- */

  useEffect(() => {
    const live = phase === 'stage' || phase === 'confirm';
    const down = (e: PointerEvent) => {
      lastActivity.current = performance.now();
      setIdle(false);
      if (!live) return;
      raw.countAction();
      if (phase === 'stage') raw.onPointerDown(e);
    };
    const up = (e: PointerEvent) => {
      if (phase === 'stage') raw.onPointerUp(e);
    };
    const key = (e: KeyboardEvent) => {
      lastActivity.current = performance.now();
      setIdle(false);
      if (live && !e.repeat && !['Shift', 'Meta', 'Control', 'Alt'].includes(e.key)) raw.countAction();
    };
    const vis = () => {
      if (document.hidden) raw.stopClock();
      else if (live && !paused) raw.startClock();
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
  }, [phase, paused]);

  useEffect(() => {
    if (phase !== 'stage' || paused || beat) {
      setIdle(false);
      return;
    }
    lastActivity.current = performance.now();
    const id = window.setInterval(() => {
      if (performance.now() - lastActivity.current > IDLE_MS) setIdle(true);
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, paused, qi, beat]);

  /* ---------------- marks ---------------- */

  const setMark = (id: MarkId, state: MarkState, value: string | null) => setMarks((m) => ({ ...m, [id]: { state, value } }));

  /* ---------------- start ---------------- */

  const start = () => {
    const pt = input.current.pointerType;
    const cls: InputClass = input.current.tabFirst && !input.current.moved ? 'keyboard' : pt === 'touch' || settings?.pointer === 'coarse' ? 'touch' : pt === 'pen' ? 'other' : 'mouse';
    raw.inputClass = cls;
    const p = planBlocks(settings, cls);
    setPlan(p);
    for (const [b] of Object.entries(p.prefilled)) raw.markBlock(b as BlockId, 'prefilled');
    for (const b of p.notRun) raw.markBlock(b, 'not_run');

    const d = deriveSafely(raw.toRaw(), settings);
    setDraft(d);
    const m = emptyMarks();
    const queued = new Set(p.queue.map((b) => MARK_OF[b]));
    const land = new Set<MarkId>();
    for (const mk of MARKS) {
      if (queued.has(mk.id)) continue;
      // Keyboard first: Point is not needed (WebAble never changes keyboard handling). Otherwise settings answered it.
      if (mk.id === 'clicks') m.clicks = cls === 'keyboard' ? { state: 'done', value: 'Keyboard' } : { state: 'skipped', value: null };
      else m[mk.id] = { state: 'setting', value: markValue(mk.id, d, settings) };
    }
    if (settings?.contrastMore || settings?.forcedColors) {
      m.contrast = { state: 'setting', value: markValue('contrast', d, settings) };
      land.add('contrast');
    }
    m.colours = { state: 'setting', value: p.colours === 'dark' ? 'Dark' : p.colours === 'light' ? 'Light' : settings?.forcedColors ? 'System' : 'Site' };
    const first = p.queue[0];
    if (first) m[MARK_OF[first]] = { ...m[MARK_OF[first]], state: 'active' };
    setMarks(m);
    setLanded(land);
    setStageStill(!!settings?.reducedMotion);
    raw.startClock();
    if (first) {
      raw.beginBlock(first);
      setQi(0);
      setPhase('stage');
    } else goConfirm();
  };

  const goConfirm = () => {
    raw.beginBlock('confirm');
    const base = deriveSafely(raw.toRaw(), settings);
    setConfirmBase(base);
    setMarks((m) => {
      const out = { ...m };
      for (const mk of MARKS) if (out[mk.id].state === 'active' || out[mk.id].state === 'pending') out[mk.id] = { state: 'done', value: markValue(mk.id, base, settings) };
      return out;
    });
    setPhase('confirm');
  };

  /* ---------------- blocks ---------------- */

  const advance = (from: number) => {
    if (!plan) return;
    const next = plan.queue[from + 1];
    if (!next) {
      goConfirm();
      return;
    }
    raw.beginBlock(next);
    setMarks((m) => {
      const mk = MARK_OF[next];
      return m[mk].state === 'active' ? m : { ...m, [mk]: { ...m[mk], state: 'active' } };
    });
    setQi(from + 1);
    lastActivity.current = performance.now();
  };

  const finishBlock = useCallback(
    (o: BlockOutcome, skipped = false) => {
      if (!plan || !block || beat) return;
      raw.endBlock(block, { trials: o.trials, stop: o.stop, skipped });
      const d = deriveSafely(raw.toRaw(), settings);
      setDraft(d);
      const mk = MARK_OF[block];
      const pickQueued = plan.queue.includes('pick');
      const fillsMark = block !== 'find' || !pickQueued;
      if (fillsMark) {
        const fromSettings = mk === 'text' && skipped && d.text.source === 'stated';
        const contrastSetting = mk === 'contrast' && skipped && (settings?.contrastMore || settings?.forcedColors);
        const state: MarkState = skipped ? (fromSettings || contrastSetting ? 'setting' : 'skipped') : 'done';
        setMark(mk, state, markValue(mk, d, settings));
        if (state !== 'skipped') setLanded((l) => new Set(l).add(mk));
      }
      const b = !skipped && fillsMark ? beatFor(block, d) : null;
      const at = qi;
      if (b) {
        setBeat(b);
        window.setTimeout(() => {
          setBeat(null);
          advance(at);
        }, BEAT_MS);
      } else advance(at);
    },
    [plan, block, beat, qi, settings],
  );

  const skipPart = () => {
    if (!block || beat) return;
    setPaused(false);
    raw.startClock();
    const trials = block === 'read' ? raw.ladder.length : block === 'faint' ? raw.faint.length : block === 'find' ? raw.findTrials.length : 0;
    finishBlock({ trials }, true);
  };

  const togglePause = useCallback(() => {
    if (phase !== 'stage') return;
    setPaused((p) => {
      if (p) raw.startClock();
      else raw.stopClock();
      return !p;
    });
  }, [phase]);

  useEffect(() => {
    if (phase !== 'stage') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, togglePause]);

  /* ---------------- save ---------------- */

  const onSave = async (fit: FitProfile, corrections: WarmupMetrics['corrections']) => {
    setSaving(true);
    let final: FitProfile;
    if (demoName) {
      final = { ...fit, createdAt: new Date().toISOString() };
    } else {
      raw.endBlock('confirm', { trials: 1, stop: 'person' });
      raw.stopClock();
      const metrics = raw.metrics({ completed: true, corrections, settingsUsed: settings ? settingsUsed(settings) : [] });
      lastMetrics.current = metrics;
      final = {
        ...fit,
        createdAt: new Date().toISOString(),
        calibration: { ...fit.calibration, version: 'warmup-1', durationSec: Math.round(metrics.activeMs / 1000), skipped: [...raw.skipped], warmup: metrics } as FitProfile['calibration'],
      };
      setDoneSeconds(Math.round(metrics.activeMs / 1000));
    }
    const ok = await saveFit(final);
    lastSaved.current = final;
    setSaving(false);
    setSaved(ok);
    setPhase('done');
  };

  const saveReader = async () => {
    setSaving(true);
    raw.inputClass = 'keyboard';
    for (const b of ['read', 'faint', 'point', 'find', 'pick'] as BlockId[]) raw.markBlock(b, 'not_run');
    const metrics = raw.metrics({ completed: true, corrections: { textSteps: 0, colours: false, rows: [] }, settingsUsed: settings ? settingsUsed(settings) : [] });
    const fit = deriveSafely(raw.toRaw(), settings, metrics);
    const ok = await saveFit(fit);
    lastSaved.current = fit;
    setSaving(false);
    setSaved(ok);
    if (ok) void closeThisTab();
    else setPhase('done');
  };

  const exportSession = () => {
    const data = { v: 'warmup-session.1', at: new Date().toISOString(), metrics: lastMetrics.current, raw: raw.toRaw(), fit: lastSaved.current };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `webable-warmup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  // For the eval harness and the pilot logger: read-only views of the session.
  useEffect(() => {
    (globalThis as { __warmup?: unknown }).__warmup = {
      phase: () => phase,
      block: () => block,
      beat: () => beat,
      draft: () => draft,
      raw: () => raw.toRaw(),
      metrics: () => lastMetrics.current,
      saved: () => lastSaved.current,
      settings: () => settings,
    };
  });

  /* ---------------- render ---------------- */

  if (phase === 'boot' || !env) return <div class="wu-app" />;

  const look = lookOf(draft, landed, { motionOff: stageStill });
  const inStage = phase === 'stage' && plan && block;
  const Block = block ? BLOCKS[block] : null;

  const top = (
    <header class="wu-top">
      <Wordmark />
      <div class="wu-top-center">{phase === 'stage' || phase === 'confirm' || phase === 'start' ? <Strip marks={marks} /> : null}</div>
      <div class="wu-top-right">
        {inStage ? (
          <>
            <Btn kind="quiet" onClick={togglePause} kbd="Esc" data="pause" disabled={!!beat}>
              Pause
            </Btn>
            <Btn kind="quiet" onClick={skipPart} data="skip-part" disabled={!!beat}>
              Skip this part
            </Btn>
          </>
        ) : null}
      </div>
    </header>
  );

  let body: JSX.Element;
  if (phase === 'start') {
    body = (
      <Start
        settings={settings}
        existing={existing}
        onStart={start}
        onSkip={() => setPhase('skipped')}
        onReader={() => setPhase('reader')}
      />
    );
  } else if (phase === 'skipped') {
    body = <Skipped onClose={() => void closeThisTab()} onBack={() => setPhase('start')} />;
  } else if (phase === 'reader') {
    body = <ReaderPath onSave={() => void saveReader()} onBack={() => setPhase('start')} saving={saving} />;
  } else if (phase === 'confirm' && confirmBase) {
    body = (
      <Confirm
        base={confirmBase}
        settings={settings}
        colourDefault={plan?.colours ?? (settings?.colorScheme === 'dark' ? 'dark' : 'light')}
        demoName={demoName ? demoName[0]!.toUpperCase() + demoName.slice(1) : undefined}
        saving={saving}
        onSave={(f, c) => void onSave(f, c)}
        onRestart={() => (location.href = location.pathname)}
      />
    );
  } else if (phase === 'done') {
    body = (
      <Done
        saved={saved}
        seconds={doneSeconds}
        onOpenDemo={() => void openPage(`${serverOrigin || 'http://127.0.0.1:41741'}/demo/`)}
        onClose={() => void closeThisTab()}
        onExport={lastMetrics.current ? exportSession : null}
      />
    );
  } else if (inStage && Block && plan) {
    body = (
      <div class={`wu-stagegrid ${beat ? 'is-beat' : ''}`} data-block={block}>
        <div class="wu-frame wu-stage-frame">
          <FrameBar site="The Daily Ledger" note="a made-up news page" />
          <div class="wu-viewport">
            <NewsPage look={look} showHits={beat?.mark === 'clicks'} />
          </div>
        </div>
        {beat ? (
          <>
            <Instruction sub={beat.sub}>{beat.title}</Instruction>
            <div class="wu-tray is-note" key={`beat-${beat.mark}`} />
          </>
        ) : (
          <Block
            key={block}
            raw={raw}
            env={env}
            plan={plan}
            settings={settings}
            fit={draft}
            paused={paused}
            rng={rng}
            onDone={(o) => finishBlock(o)}
            onStopMotion={() => setStageStill(true)}
          />
        )}
        <p class={`wu-idle ${idle ? 'is-on' : ''}`} aria-live="polite">
          {idle ? 'Take your time, or skip this part.' : ''}
        </p>
      </div>
    );
  } else {
    body = <div />;
  }

  return (
    <div class={`wu-app is-${phase}`}>
      {top}
      <main class="wu-main">{body}</main>
      {paused ? (
        <div class="wu-pause" role="dialog" aria-modal="true" aria-labelledby="wu-pause-h">
          <div class="wu-pause-card">
            <h1 id="wu-pause-h" class="wu-title">
              Paused
            </h1>
            <p class="wu-lede">Take as long as you like. Nothing is lost.</p>
            <div class="wu-start-actions is-center">
              <Btn kind="primary" onClick={togglePause} kbd="Esc" class="wu-btn-pill" data="resume">
                Continue
              </Btn>
              <Btn kind="tonal" onClick={skipPart} class="wu-btn-pill" data="pause-skip">
                Skip this part
              </Btn>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
