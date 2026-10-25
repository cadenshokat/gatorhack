// Onboarding: a welcome, five short games, then a results page.
// Each game opens with an instruction card. The saved fit is still the shared FitProfile.

import {
  DEMO_FITS, defaultFit, type BrowserSettings, type FitProfile, type InputClass, type WarmupBlock,
} from '@webable/core';
import type { JSX } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { copy, type SectionId } from './content/copy';
import { READ_LINES } from './content/lines';
import { BubbleGame } from './games/BubbleGame';
import { ColourGame } from './games/ColourGame';
import { FaintGame } from './games/FaintGame';
import { FindGame } from './games/FindGame';
import { ReadGame } from './games/ReadGame';
import { attentionFromRounds } from './logic/attention';
import { summarizeBubbles } from './logic/bubbles';
import { scoreArrangement } from './logic/colour';
import { captureEnv, readBrowserSettings, readPageZoom, settingsUsed } from './logic/env';
import { cloneFit, deriveSafely } from './logic/fitview';
import { makeRng, type Rng } from './logic/rand';
import { RawCollector } from './logic/raw';
import { estimateReading } from './logic/reading';
import { extrasOf, type OnboardingExtras } from './logic/needs';
import { applySession, emptyMeasures, type SessionMeasures } from './logic/session';
import { closeThisTab, loadFit, saveFit } from './logic/storage';
import { Results } from './screens/Results';
import { Button, useFocusTrap, useReducedMotion } from './ui/bits';
import { Instruction } from './ui/Instruction';

type Phase = 'boot' | 'welcome' | 'card' | 'play' | 'note' | 'results';
type Fit = FitProfile & OnboardingExtras;

const SECTIONS: ReadonlyArray<{ id: SectionId; block: WarmupBlock }> = [
  { id: 'read', block: 'read' },
  { id: 'faint', block: 'faint' },
  { id: 'bubbles', block: 'point' },
  { id: 'find', block: 'find' },
  { id: 'colours', block: 'pick' },
];

const BLOCK_OF: Record<SectionId, WarmupBlock> = {
  read: 'read',
  faint: 'faint',
  bubbles: 'point',
  find: 'find',
  colours: 'pick',
};

function sectionIndex(id: string | null): number {
  return SECTIONS.findIndex((s) => s.id === id);
}

function skippedSections(ids: readonly string[]): SectionId[] {
  const out: SectionId[] = [];
  for (const section of SECTIONS) {
    if (ids.includes(section.block)) out.push(section.id);
  }
  return out;
}

export function App(): JSX.Element {
  const raw = useMemo(() => new RawCollector(), []);
  const seed = useMemo(() => (Math.random() * 2 ** 31) | 0, []);
  const rng = useMemo(() => makeRng(seed), [seed]);
  const motion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('boot');
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState('');
  const [settings, setSettings] = useState<BrowserSettings | null>(null);
  const [existing, setExisting] = useState<Fit | null>(null);
  const [fit, setFit] = useState<Fit | null>(null);
  const [saved, setSaved] = useState(true);
  const [envReady, setEnvReady] = useState(false);
  const [skipped, setSkipped] = useState<SectionId[]>([]);
  const [returnTo, setReturnTo] = useState<'results' | null>(null);
  const [leave, setLeave] = useState(false);
  const measures = useRef<SessionMeasures>(emptyMeasures(false));
  const replayMeasures = useRef<SessionMeasures | null>(null);
  const input = useRef({ moved: false, tabFirst: false, pointer: null as string | null });
  const heading = useRef<HTMLHeadingElement>(null);

  const reduced = motion || !!settings?.reducedMotion;
  const section = SECTIONS[index] ?? SECTIONS[0];

  useEffect(() => {
    const move = () => {
      input.current.moved = true;
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && !input.current.moved) input.current.tabFirst = true;
    };
    const down = (e: PointerEvent) => {
      input.current.pointer ??= e.pointerType;
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

  useEffect(() => {
    void (async () => {
      const zoom = await readPageZoom();
      raw.zoom = zoom;
      captureEnv(READ_LINES.map((s) => s.text).join(' '), zoom);
      const browser = await readBrowserSettings().catch(() => null);
      setSettings(browser);
      const stored = await loadFit();
      const storedFit = stored ? ({ ...cloneFit(stored), ...extrasOf(stored as Fit) } as Fit) : null;
      setExisting(storedFit);
      const params = new URLSearchParams(location.search);
      const demo = params.get('demo');
      const screen = params.get('screen');
      if ((demo === 'rosa' || demo === 'typical' || demo === 'reader') && (!screen || screen === 'results')) {
        const demoFit = { ...cloneFit(DEMO_FITS[demo]), createdAt: new Date().toISOString() } as Fit;
        setFit(demoFit);
        setPhase('results');
        setEnvReady(true);
        return;
      }
      const play = screen?.startsWith('play-') ? screen.slice(5) : null;
      const asked = sectionIndex(play ?? screen);
      if (asked >= 0) {
        setIndex(asked);
        raw.startClock();
        const block = SECTIONS[asked]?.block;
        if (block) raw.beginBlock(block);
        setPhase(play ? 'play' : 'card');
        setEnvReady(true);
        return;
      }
      setPhase('welcome');
      setEnvReady(true);
    })();
  }, [raw]);

  useEffect(() => {
    if (phase === 'note') heading.current?.focus();
  }, [phase, note]);

  const classify = () => {
    const pt = input.current.pointer;
    const keyboard = input.current.tabFirst && !input.current.moved;
    const cls: InputClass = keyboard ? 'keyboard' : pt === 'touch' || settings?.pointer === 'coarse' ? 'touch' : pt === 'pen' ? 'other' : 'mouse';
    raw.inputClass = cls;
    measures.current.keyboard = keyboard;
  };

  const begin = (i: number, play: boolean) => {
    const block = SECTIONS[i]?.block;
    if (!block) return;
    setIndex(i);
    raw.beginBlock(block);
    setPhase(play ? 'play' : 'card');
  };

  const publish = useCallback(async (next: Fit) => {
    setFit(next);
    const ok = await saveFit(next);
    setSaved(ok);
    setPhase('results');
  }, []);

  const buildFit = useCallback((base: FitProfile, measured: SessionMeasures, skipIds: SectionId[]): Fit => {
    const metrics = raw.metrics({
      completed: skipIds.length === 0,
      corrections: { textSteps: 0, colours: false, rows: [] },
      settingsUsed: settings ? settingsUsed(settings) : [],
    });
    const next = applySession(base, measured, settings);
    next.createdAt = new Date().toISOString();
    next.calibration = {
      ...next.calibration,
      version: 'warmup-1',
      durationSec: raw.durationSec,
      skipped: skipIds.map((id) => BLOCK_OF[id]),
      warmup: metrics,
    } as FitProfile['calibration'];
    return next;
  }, [raw, settings]);

  const finishAll = useCallback((skipIds: SectionId[]) => {
    raw.beginBlock('confirm');
    raw.endBlock('confirm', { trials: 1, stop: 'person' });
    raw.stopClock();
    const base = deriveSafely(raw.toRaw(), settings, raw.metrics({
      completed: skipIds.length === 0,
      corrections: { textSteps: 0, colours: false, rows: [] },
      settingsUsed: settings ? settingsUsed(settings) : [],
    }));
    void publish(buildFit(base, measures.current, skipIds));
  }, [buildFit, publish, raw, settings]);

  const forward = useCallback(() => {
    if (returnTo === 'results') {
      replayMeasures.current = null;
      setReturnTo(null);
      setPhase('results');
      return;
    }
    const next = index + 1;
    if (next >= SECTIONS.length) finishAll(skipped);
    else begin(next, false);
  }, [finishAll, index, returnTo, skipped]);

  useEffect(() => {
    if (phase !== 'note' || reduced) return;
    const id = window.setTimeout(() => forward(), 1700);
    return () => window.clearTimeout(id);
  }, [forward, phase, reduced]);

  useEffect(() => {
    const onPop = () => {
      if (phase === 'card' || phase === 'play' || phase === 'note') {
        setLeave(true);
        history.pushState({ fitting: true }, '');
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [phase]);

  const showNote = (line: string) => {
    setNote(line);
    setPhase('note');
  };

  const skip = () => {
    const block = section?.block;
    const id = section?.id;
    if (!block || !id || phase === 'note' || phase === 'results') return;
    raw.endBlock(block, { trials: 0, skipped: true });
    const nextSkipped = skipped.includes(id) ? skipped : [...skipped, id];
    setSkipped(nextSkipped);
    if (returnTo === 'results') {
      showNote(copy.skippedNote);
      return;
    }
    showNote(copy.skippedNote);
  };

  const start = () => {
    classify();
    raw.reset();
    replayMeasures.current = null;
    raw.startClock();
    history.pushState({ fitting: true }, '');
    setSkipped([]);
    measures.current = emptyMeasures(measures.current.keyboard);
    begin(0, false);
  };

  const useStandard = () => {
    const skipIds = SECTIONS.map((s) => s.id);
    const base = defaultFit();
    base.inputClass = raw.inputClass;
    setSkipped(skipIds);
    void publish(buildFit(base, emptyMeasures(false), skipIds));
  };

  const continueSaved = () => {
    if (!existing) return;
    setFit(existing);
    setSkipped(skippedSections(existing.calibration?.skipped ?? []));
    setSaved(true);
    setPhase('results');
  };

  const playOne = (id: SectionId) => {
    const at = sectionIndex(id);
    if (at < 0) return;
    replayMeasures.current = emptyMeasures(measures.current.keyboard);
    setReturnTo('results');
    setSkipped((prev) => prev.filter((s) => s !== id));
    history.pushState({ fitting: true }, '');
    begin(at, false);
  };

  const stopForNow = () => {
    const base = fit ?? existing ?? deriveSafely(raw.toRaw(), settings);
    const next = buildFit(base, measures.current, skipped);
    void saveFit(next).then((ok) => {
      if (!ok) {
        setFit(next);
        setSaved(false);
        setLeave(false);
        setPhase('results');
        return;
      }
      void closeThisTab();
    });
  };

  const retrySave = () => {
    if (fit) void publish(fit);
  };

  useEffect(() => {
    const g = globalThis as { __warmup?: unknown };
    g.__warmup = {
      phase: () => phase,
      section: () => section?.id ?? null,
      fit: () => fit,
      raw: () => raw.toRaw(),
      saved: () => (saved ? fit : null),
    };
  });

  if (!envReady || phase === 'boot' || !section) return <div class="ob-app" />;

  const activeMeasures = replayMeasures.current ?? measures.current;

  return (
    <div class={`ob-app is-${phase}`} data-phase={phase} data-section={section.id} data-motion={reduced ? 'reduce' : 'ok'}>
      <header class="ob-top">
        <p class="ob-brand">WebAble</p>
        {phase === 'welcome' || phase === 'results' ? <span /> : (
          <ol class="ob-steps" aria-label={copy.header.step(index + 1, copy.sections[section.id].name)}>
            {SECTIONS.map((s, i) => {
              const wasSkipped = skipped.includes(s.id);
              return (
                <li
                  key={s.id}
                  class={i === index ? 'is-on' : wasSkipped ? 'is-skipped' : i < index ? 'is-done' : ''}
                  aria-current={i === index ? 'step' : undefined}
                  aria-label={wasSkipped ? `${copy.sections[s.id].name}. ${copy.header.skipped}` : undefined}
                >
                  <span class="ob-step-dot" aria-hidden="true" />
                  <span class="ob-step-name">{wasSkipped ? copy.header.skipped : copy.sections[s.id].name}</span>
                </li>
              );
            })}
          </ol>
        )}
        {phase === 'play' ? (
          <button type="button" class="ob-link" data-answer="skip-section" onClick={skip}>{copy.skip}</button>
        ) : <span />}
      </header>
      <main id="ob-main" class="ob-main">
        {phase === 'welcome' && existing ? (
          <Returning onContinue={continueSaved} onStartOver={start} />
        ) : null}
        {phase === 'welcome' && !existing ? (
          <section class="ob-welcome">
            <h1 class="ob-title">{copy.welcome.title}</h1>
            <p class="ob-lede">{copy.welcome.body}</p>
            <p>{copy.welcome.stays}</p>
            <div class="ob-actions">
              <Button kind="primary" onClick={start} data="start" focus>{copy.welcome.start}</Button>
            </div>
            <button type="button" class="ob-link" data-answer="later" onClick={useStandard}>{copy.welcome.skip}</button>
            <p class="ob-fine">{copy.welcome.menu}</p>
          </section>
        ) : null}
        {phase === 'card' ? <Instruction id={section.id} onStart={() => setPhase('play')} onSkip={skip} /> : null}
        {phase === 'play' ? (
          <Game
            id={section.id}
            rng={rng}
            reduced={reduced}
            onResult={(line) => {
              if (returnTo === 'results' && fit && replayMeasures.current) {
                const next = applySession(fit, replayMeasures.current, settings);
                const still = skipped.filter((id) => id !== section.id);
                next.calibration = { ...next.calibration, skipped: still.map((id) => BLOCK_OF[id]) };
                setFit(next);
                void saveFit(next).then(setSaved);
              }
              showNote(line);
            }}
            raw={raw}
            measures={activeMeasures}
          />
        ) : null}
        {phase === 'note' ? (
          <section class="ob-note-screen">
            <h1 class="ob-title" ref={heading} tabIndex={-1}>
              <button type="button" class="ob-note-go" onClick={forward} data-answer="continue">{note}</button>
            </h1>
          </section>
        ) : null}
        {phase === 'results' && fit ? (
          <Results
            fit={fit}
            saved={saved}
            skipped={skipped}
            onRetake={() => {
              setExisting(null);
              setFit(null);
              setSkipped([]);
              setPhase('welcome');
            }}
            onPlay={playOne}
            onSave={(next) => void publish(next)}
            onRetry={retrySave}
          />
        ) : null}
      </main>
      <p class="ob-live-region" aria-live="polite">{phase === 'note' ? note : phase === 'results' ? copy.results.status : ''}</p>
      {leave ? <Leave onKeep={() => setLeave(false)} onStop={stopForNow} /> : null}
    </div>
  );
}

function Returning(props: { onContinue: () => void; onStartOver: () => void }): JSX.Element {
  return (
    <section class="ob-welcome">
      <h1 class="ob-title">{copy.returning.title}</h1>
      <div class="ob-actions">
        <Button kind="primary" onClick={props.onContinue} data="continue" focus>{copy.returning.continue}</Button>
        <Button kind="quiet" onClick={props.onStartOver} data="start-over">{copy.returning.startOver}</Button>
      </div>
    </section>
  );
}

function Leave(props: { onKeep: () => void; onStop: () => void }): JSX.Element {
  const trap = useFocusTrap(true);
  return (
    <div class="ob-modal" role="dialog" aria-modal="true" aria-labelledby="ob-leave-title" ref={trap.ref}>
      <div class="ob-card">
        <h2 id="ob-leave-title" class="ob-title ob-title-card">{copy.leave.ask}</h2>
        <div class="ob-actions">
          <Button kind="primary" onClick={props.onKeep} data="keep-going" focus>{copy.leave.keep}</Button>
          <Button kind="quiet" onClick={props.onStop} data="stop-now">{copy.leave.stop}</Button>
        </div>
      </div>
    </div>
  );
}

function Game(props: {
  id: SectionId;
  rng: Rng;
  reduced: boolean;
  raw: RawCollector;
  measures: SessionMeasures;
  onResult: (line: string) => void;
}): JSX.Element {
  const done = (line: string, trials: number, stop: string) => {
    const block = SECTIONS.find((s) => s.id === props.id)?.block;
    if (block) props.raw.endBlock(block, { trials, stop });
    props.onResult(line);
  };
  if (props.id === 'read') {
    return (
      <ReadGame
        rng={props.rng}
        onDone={(result) => {
          for (const t of result.trials) {
            props.raw.ladder.push({
              px: props.raw.eff(t.px),
              ms: Math.round(t.ms * (56 / Math.max(1, t.chars))),
              correct: t.correct,
            });
          }
          const scaled = result.trials.map((t) => ({ ...t, px: props.raw.eff(t.px) }));
          props.measures.reading = estimateReading(scaled);
          done(copy.sections.read.encourage, result.trials.length, result.stop);
        }}
      />
    );
  }
  if (props.id === 'faint') {
    return (
      <FaintGame
        rng={props.rng}
        onDone={(result) => {
          for (const t of result.trials) props.raw.faint.push({ contrast: t.ratio, correct: t.correct });
          props.raw.stated = result.polarity === 'none' ? null : result.polarity;
          props.measures.band = result.band;
          props.measures.polarity = result.polarity;
          done(copy.sections.faint.encourage, result.trials.length, result.stop);
        }}
      />
    );
  }
  if (props.id === 'bubbles') {
    return (
      <BubbleGame
        rng={props.rng}
        onDone={(result) => {
          const summary = summarizeBubbles(result.taps);
          if (!props.measures.keyboard) {
            props.raw.blocks = summary.blocks;
            props.measures.minPx = summary.minPx;
            props.measures.steady = summary.steady;
            props.measures.debounce = summary.debounce;
          }
          done(copy.sections.bubbles.encourage, result.taps.length, result.reason);
        }}
      />
    );
  }
  if (props.id === 'find') {
    return (
      <FindGame
        reducedMotion={props.reduced}
        onDone={(result) => {
          props.raw.findTrials = [
            { clutter: false, motion: false, ms: result.cleanMs, found: result.cleanFound },
            { clutter: true, motion: false, ms: result.busyMs, found: result.busyFound },
            { clutter: true, motion: true, ms: result.movingMs, found: result.movingFound },
          ];
          const att = attentionFromRounds(
            { ms: result.cleanMs, found: result.cleanFound },
            { ms: result.busyMs, found: result.busyFound },
            { ms: result.movingMs, found: result.movingFound },
          );
          props.raw.preferredCalm = att.preferredCalm;
          props.raw.notes = att.gotInWay;
          props.measures.clutterP = att.clutterP;
          props.measures.structureLevel = att.structureLevel;
          props.measures.motionOn = att.motionOn;
          props.measures.motionP = att.motionP;
          done(copy.sections.find.encourage, 3, 'person');
        }}
      />
    );
  }
  return (
    <ColourGame
      rng={props.rng}
      onDone={(result) => {
        props.measures.colour = scoreArrangement(result.placed);
        done(copy.sections.colours.encourage, 1, 'person');
      }}
    />
  );
}
