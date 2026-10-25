// Read: a true/false sentence, #111 on a white card over the page. The size starts at 40 px (or twice what the
// person's Chrome settings ask for) and each answer picks the next size from the posterior. No Next buttons.

import { ReadPosterior, type ReadTrial } from '@webable/core';
import type { JSX } from 'preact';
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { SENTENCES, type Sentence } from '../content/sentences';
import { STIMULUS_FONT } from '../logic/env';
import { shuffle } from '../logic/rand';
import { maxSentenceCss, normalizedMs } from '../logic/read';
import { Btn, useKeys, useTrialClock } from '../ui/common';
import { Instruction } from './Frame';
import type { BlockProps } from './types';

type Answer = 'true' | 'false' | 'cant';

function useBox(): [preact.RefObject<HTMLDivElement>, { w: number; h: number }] {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 420 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      setBox({
        w: el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
        h: el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, box];
}

export function ReadBlock(props: BlockProps): JSX.Element {
  const { raw, env, plan } = props;
  const post = useMemo(() => new ReadPosterior(plan.textPriorPx), []);
  const pool = useMemo(() => shuffle(SENTENCES, props.rng), []);
  const k = useRef(0);
  const nextSentence = (): Sentence => {
    const s = pool[k.current % pool.length] as Sentence;
    k.current += 1;
    return s;
  };
  const [sentence, setSentence] = useState<Sentence>(() => nextSentence());
  const [practice, setPractice] = useState(true);
  const [wantEff, setWantEff] = useState(plan.readStartPx);
  const [trial, setTrial] = useState(0);
  const clock = useTrialClock(props.paused, trial);
  const scoredMs = useRef(0);
  const [cardRef, box] = useBox();

  const zoom = raw.zoom || 1;
  const minEff = Math.max(9, props.settings?.minFontPx ?? 0);
  const maxEff = Math.max(minEff, maxSentenceCss(box.w, box.h, env.charRatio, 13) * zoom);
  const shownEff = Math.round(Math.min(maxEff, Math.max(minEff, wantEff)) * 10) / 10;
  const css = shownEff / zoom;

  const answer = (a: Answer) => {
    if (props.paused || !clock.armed()) return;
    const rt = clock.elapsed();
    if (practice) {
      setPractice(false);
      // Could not read the practice sentence: start the scored ones a step and a half larger.
      if (a === 'cant') setWantEff(Math.min(maxEff, shownEff * 1.58));
    } else {
      const t: ReadTrial = {
        px: shownEff,
        ms: normalizedMs(sentence.text.length, rt),
        correct: a !== 'cant' && (a === 'true') === sentence.truth,
      };
      if (a === 'cant') t.cant = true;
      raw.ladder.push(t);
      post.add(t);
      scoredMs.current += rt;
      const stop = post.shouldStop(scoredMs.current);
      if (stop) {
        props.onDone({ trials: post.n, stop });
        return;
      }
      setWantEff(post.nextPx(minEff, maxEff));
    }
    setSentence(nextSentence());
    setTrial((n) => n + 1);
  };

  useKeys(!props.paused, (key) => {
    const c = key.toLowerCase();
    if (c === 't') answer('true');
    else if (c === 'f') answer('false');
    else if (c === 'c') answer('cant');
  });

  return (
    <>
      <Instruction sub={practice ? 'A practice one first.' : undefined}>True or false? Read like you normally do.</Instruction>
      <div class="wu-overlay is-veiled">
        <div class="wu-card wu-card-read" ref={cardRef} data-block="read">
          <p
            class="wu-sentence"
            key={trial}
            style={{ fontSize: `${css}px`, fontFamily: STIMULUS_FONT, maxWidth: css <= 40 ? '22ch' : '100%' }}
            data-truth={sentence.truth ? 'true' : 'false'}
            data-px={shownEff}
          >
            {sentence.text}
          </p>
        </div>
      </div>
      <div class="wu-tray" key="tray-read">
        <Btn kind="answer" onClick={() => answer('true')} kbd="T" data="true">
          True
        </Btn>
        <Btn kind="answer" onClick={() => answer('false')} kbd="F" data="false">
          False
        </Btn>
        <Btn kind="quiet" onClick={() => answer('cant')} kbd="C" data="cant" class="wu-btn-pill">
          Can’t read it
        </Btn>
      </div>
    </>
  );
}
