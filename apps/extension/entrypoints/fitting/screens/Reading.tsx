// Part 1, Reading: R1 comfortable size, R2 "Is it true?" ladder, R3 faint words, R4 light or dark.
// Stimuli are #111 on a white stage (or the fixed dark pair in R4), in px, never themed or animated.

import type { Polarity } from '@webable/core';
import type { JSX } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { COMFORT_PARAGRAPH, FAINT_WORDS, type Sentence } from '../content/sentences';
import { STIMULUS_FONT } from '../logic/env';
import { normalizedMs, ReadingLadder, roundPx } from '../logic/ladder';
import { FaintQuest, type GrayStimulus } from '../logic/quest';
import { makeRng, shuffle } from '../logic/rand';
import { Btn, Deck, Heading, useKeys, useTrialClock } from '../ui/common';
import { comfortableCssPx, seedCssPx, type ScreenProps, type SentenceSource } from './types';

const STEP = 10 ** 0.1; // one ladder level, x1.26

/* ------------------------------------------------------------------ */
/* R1: Make this comfortable to read                                   */
/* ------------------------------------------------------------------ */

export function Comfort(props: ScreenProps & { onSize: (cssPx: number) => void }): JSX.Element {
  const start = Math.max(1.5 * props.env.defaultFontPx, 24);
  const [level, setLevel] = useState(0);
  const px = roundPx(start * STEP ** level);
  const ref = useRef<HTMLParagraphElement>(null);
  const minLevel = Math.ceil(Math.log(10 / start) / Math.log(STEP));
  const maxLevel = Math.floor(Math.log(120 / start) / Math.log(STEP));

  // Text that no longer fits the fixed box runs under a soft fade; text that fits is never faded.
  const [clipped, setClipped] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) setClipped(el.scrollHeight > el.clientHeight + 1);
  }, [px]);

  const smaller = () => setLevel((l) => Math.max(minLevel, l - 1));
  const larger = () => setLevel((l) => Math.min(maxLevel, l + 1));
  const confirm = () => {
    // Record what was rendered, not what was asked for (minimum font settings can clamp it).
    const rendered = ref.current ? parseFloat(getComputedStyle(ref.current).fontSize) : px;
    props.raw.comfortCssPx = Number.isFinite(rendered) && rendered > 0 ? rendered : px;
    props.raw.largePrint = props.raw.comfortCssPx >= 2 * props.env.defaultFontPx;
    props.raw.complete('R1');
    props.onSize(props.raw.comfortCssPx);
    props.onDone();
  };

  useKeys(!props.paused, (key) => {
    if (key === '-' || key === '_') smaller();
    else if (key === '+' || key === '=') larger();
  });

  useEffect(() => props.onProgress(0.5), []);

  return (
    <div>
      <Heading>Make this comfortable to read.</Heading>
      <div class="fx-stage fx-stage-comfort">
        <p ref={ref} class={`fx-stim fx-comfort ${clipped ? 'is-clipped' : ''}`} style={{ fontSize: `${px}px`, fontFamily: STIMULUS_FONT }}>
          {COMFORT_PARAGRAPH}
        </p>
      </div>
      <div class="fx-responses fade-in">
        <Btn onClick={smaller} kbd="−" disabled={level <= minLevel}>
          Smaller
        </Btn>
        <Btn onClick={larger} kbd="+" disabled={level >= maxLevel}>
          Larger
        </Btn>
        <Btn kind="primary" onClick={confirm} class="fx-grow2">
          This is comfortable
        </Btn>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared: one true/false sentence on the stage                        */
/* ------------------------------------------------------------------ */

function useStageWidth(): [preact.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      setW(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

type Answer = 'true' | 'false' | 'cant';

function TrueFalseButtons(props: { onAnswer: (a: Answer) => void; enabled: boolean }): JSX.Element {
  useKeys(props.enabled, (key) => {
    const k = key.toLowerCase();
    if (k === 't') props.onAnswer('true');
    else if (k === 'f') props.onAnswer('false');
    else if (k === 'c') props.onAnswer('cant');
  });
  return (
    <div class="fx-responses">
      <Btn onClick={() => props.onAnswer('true')} kbd="T">
        True
      </Btn>
      <Btn onClick={() => props.onAnswer('false')} kbd="F">
        False
      </Btn>
      <Btn onClick={() => props.onAnswer('cant')} kbd="C">
        Can’t read it
      </Btn>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* R2: Is it true? (reading ladder)                                    */
/* ------------------------------------------------------------------ */

export function Ladder(props: ScreenProps & { sentences: SentenceSource }): JSX.Element {
  const [stageRef, stageW] = useStageWidth();
  const minCh = props.raw.largePrint ? 8 : 13;
  const sFit = Math.max(16, (0.9 * stageW) / (minCh * props.env.charRatio));
  const minPx = 4 / (props.env.xRatio * props.raw.zoom);

  // S0 = twice the comfortable size, capped so a 13-character line still fits the stage.
  const startPx = Math.min(seedCssPx(props) * 10 ** 0.3, sFit, 160);
  const ladderRef = useRef<ReadingLadder | null>(null);
  const [practice, setPractice] = useState(true);
  const [sentence, setSentence] = useState<Sentence>(() => props.sentences.next());
  const [trial, setTrial] = useState(0);
  const clock = useTrialClock(props.paused, trial);

  const px = practice ? roundPx(startPx) : (ladderRef.current?.currentPx() ?? roundPx(startPx));

  const answer = (a: Answer) => {
    if (props.paused || !clock.armed()) return;
    const rt = clock.elapsed();
    if (practice) {
      ladderRef.current = new ReadingLadder(startPx, Math.min(minPx, startPx), Math.max(startPx, sFit));
      setPractice(false);
    } else {
      const ladder = ladderRef.current;
      if (!ladder) return;
      const correct = a !== 'cant' && (a === 'true') === sentence.truth;
      const chars = sentence.text.length;
      ladder.record({ correct, cantRead: a === 'cant', rtMs: rt, chars }, rt);
      props.raw.ladder.push({ px: props.raw.eff(px), ms: normalizedMs(chars, rt), correct });
      props.onProgress(ladder.progress());
      if (ladder.done) {
        props.raw.roughCriticalCssPx = ladder.roughCriticalPx();
        props.raw.ladderMedianRtMs = ladder.medianRtMs();
        props.raw.complete('R2');
        props.onDone();
        return;
      }
    }
    setSentence(props.sentences.next());
    setTrial((t) => t + 1);
  };

  return (
    <div>
      <Heading>Is it true?</Heading>
      <Deck>{practice ? 'Let’s try one first. Read at your usual pace.' : 'Read at your usual pace.'}</Deck>
      <div class="fx-stage fx-stage-text" ref={stageRef}>
        <p class="fx-stim fx-sentence" style={{ fontSize: `${px}px`, fontFamily: STIMULUS_FONT, maxWidth: `${Math.max(minCh, 22)}ch` }}>
          {sentence.text}
        </p>
      </div>
      <TrueFalseButtons onAnswer={answer} enabled={!props.paused} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* R3: Which word is it? (faint words)                                 */
/* ------------------------------------------------------------------ */

export function Faint(props: ScreenProps): JSX.Element {
  const quest = useMemo(() => new FaintQuest(props.raw.largePrint), []);
  const rng = useMemo(() => makeRng((Math.random() * 2 ** 31) | 0), []);
  const wordOrder = useMemo(() => shuffle(FAINT_WORDS, rng), []);
  const [trial, setTrial] = useState(0);
  const [stim, setStim] = useState<GrayStimulus | null>(() => quest.next());
  const clock = useTrialClock(props.paused, trial);

  const target = wordOrder[trial % wordOrder.length] ?? 'house';
  const options = useMemo(() => {
    const others = shuffle(
      FAINT_WORDS.filter((w) => w !== target),
      rng,
    ).slice(0, 3);
    return shuffle([target, ...others], rng);
  }, [trial]);
  const px = Math.max(20, Math.min(96, comfortableCssPx(props) * 1.6));

  const answer = (word: string | null) => {
    if (props.paused || !clock.armed() || !stim) return;
    const correct = word === target;
    quest.record(stim, correct);
    props.raw.faint.push({ contrast: Math.round(stim.ratio * 1000) / 1000, correct });
    props.onProgress(quest.progress());
    if (quest.done) {
      props.raw.complete('R3');
      props.onDone();
      return;
    }
    setStim(quest.next());
    setTrial((t) => t + 1);
  };

  useKeys(!props.paused, (key) => {
    const n = Number(key);
    if (n >= 1 && n <= 4) answer(options[n - 1] ?? null);
    else if (key === '0') answer(null);
  });

  const g = stim?.gray ?? 128;
  return (
    <div>
      <Heading>Which word is it?</Heading>
      <Deck>Some words are very light. Pick the one you see.</Deck>
      <div class="fx-stage fx-stage-word">
        <p
          class="fx-stim fx-word"
          style={{ fontSize: `${px}px`, fontFamily: STIMULUS_FONT, color: `rgb(${g}, ${g}, ${g})` }}
          aria-hidden="true"
        >
          {target}
        </p>
      </div>
      <div class="fx-responses fx-grid2">
        {options.map((w, i) => (
          <Btn onClick={() => answer(w)} kbd={String(i + 1)}>
            {w}
          </Btn>
        ))}
        <Btn kind="tonal" onClick={() => answer(null)} class="fx-span2" kbd="0">
          I can’t see a word
        </Btn>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* R4: Light or dark                                                   */
/* ------------------------------------------------------------------ */

export function PolarityTrials(props: ScreenProps & { sentences: SentenceSource }): JSX.Element {
  const order = useMemo<Array<'L' | 'D'>>(() => {
    const lightFirst = Math.random() < 0.5;
    if (props.raw.express) return lightFirst ? ['L', 'D'] : ['D', 'L'];
    return lightFirst ? ['L', 'D', 'D', 'L'] : ['D', 'L', 'L', 'D'];
  }, []);
  const [i, setI] = useState(0);
  const [sentence, setSentence] = useState<Sentence>(() => props.sentences.next());
  const clock = useTrialClock(props.paused, i);
  const px = Math.max(14, Math.min(72, comfortableCssPx(props)));
  const pol = order[i] ?? 'L';

  const answer = (a: Answer) => {
    if (props.paused || !clock.armed()) return;
    const rt = clock.elapsed();
    const correct = a !== 'cant' && (a === 'true') === sentence.truth;
    if (correct) {
      const ms = normalizedMs(sentence.text.length, rt);
      (pol === 'L' ? props.raw.lightMs : props.raw.darkMs).push(ms);
    }
    const next = i + 1;
    props.onProgress(next / order.length);
    if (next >= order.length) {
      props.onDone();
      return;
    }
    setSentence(props.sentences.next());
    setI(next);
  };

  return (
    <div>
      <Heading>Is it true?</Heading>
      <Deck>A few more, some on a dark background.</Deck>
      <div class={`fx-stage fx-stage-text ${pol === 'D' ? 'fx-stage-dark' : ''}`}>
        <p class="fx-stim fx-sentence" style={{ fontSize: `${px}px`, fontFamily: STIMULUS_FONT, maxWidth: '22ch' }}>
          {sentence.text}
        </p>
      </div>
      <TrueFalseButtons onAnswer={answer} enabled={!props.paused} />
    </div>
  );
}

export function PolarityQuestion(props: ScreenProps): JSX.Element {
  const pick = (p: Polarity) => {
    props.raw.stated = p;
    props.raw.complete('R4');
    props.onDone();
  };
  useEffect(() => props.onProgress(0.5), []);
  return (
    <div>
      <Heading>Which felt easier to read?</Heading>
      <div class="fx-pol fade-in">
        <button type="button" class="fx-pol-tile" onClick={() => pick('light')}>
          <span class="fx-pol-sample fx-pol-light" aria-hidden="true">
            Aa
          </span>
          <span class="fx-pol-label">Light</span>
        </button>
        <button type="button" class="fx-pol-tile" onClick={() => pick('dark')}>
          <span class="fx-pol-sample fx-pol-dark" aria-hidden="true">
            Aa
          </span>
          <span class="fx-pol-label">Dark</span>
        </button>
      </div>
      <div class="fx-responses fade-in">
        <Btn onClick={() => pick('none')}>About the same</Btn>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Express offer (after R2 when sentences took a while)                */
/* ------------------------------------------------------------------ */

export function ExpressOffer(props: ScreenProps): JSX.Element {
  const choose = (express: boolean) => {
    props.raw.express = express;
    props.onDone();
  };
  return (
    <div>
      <Heading>Want the shorter version?</Heading>
      <Deck>It uses fewer sentences and dots, and takes about a minute less. Either way is fine.</Deck>
      <div class="fx-responses fade-in">
        <Btn kind="primary" onClick={() => choose(true)}>
          Shorter version
        </Btn>
        <Btn onClick={() => choose(false)}>Keep going</Btn>
      </div>
    </div>
  );
}
