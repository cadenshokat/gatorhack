// Faint: one light word on the card → four word buttons or "I don't see one". QUEST+ picks each grey level;
// 1 + 6 trials (1 + 3 under "More contrast", to check for the strongest band).

import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { FAINT_WORDS } from '../content/sentences';
import { STIMULUS_FONT } from '../logic/env';
import { effectiveTextPx } from '../logic/fitview';
import { FaintQuest, type GrayStimulus } from '../logic/quest';
import { shuffle } from '../logic/rand';
import { Btn, useKeys, useTrialClock } from '../ui/common';
import { Instruction } from './Frame';
import type { BlockProps } from './types';

export function FaintBlock(props: BlockProps): JSX.Element {
  const { raw } = props;
  const body = effectiveTextPx(props.fit);
  const quest = useMemo(() => new FaintQuest(body >= 32, props.plan.faintTrials), []);
  const order = useMemo(() => shuffle(FAINT_WORDS, props.rng), []);
  const [trial, setTrial] = useState(0);
  const [stim, setStim] = useState<GrayStimulus | null>(() => quest.next());
  const clock = useTrialClock(props.paused, trial);
  const target = order[trial % order.length] ?? 'house';
  const options = useMemo(() => {
    const others = shuffle(
      FAINT_WORDS.filter((w) => w !== target),
      props.rng,
    ).slice(0, 3);
    return shuffle([target, ...others], props.rng);
  }, [trial]);
  // Big enough that size never limits seeing the word: twice the person's text size.
  const css = Math.max(40, Math.min(96, (2 * body) / (raw.zoom || 1)));

  const answer = (word: string | null) => {
    if (props.paused || !clock.armed() || !stim) return;
    const correct = word === target;
    quest.record(stim, correct);
    raw.faint.push({ contrast: Math.round(stim.ratio * 1000) / 1000, correct });
    if (quest.done) {
      const n = quest.trials.length;
      const ceiling = quest.trials.filter((t) => t.correct && t.stim.weber <= 0.02).length >= 3;
      props.onDone({ trials: n, stop: ceiling ? 'ceiling' : n - 1 >= props.plan.faintTrials ? 'max_trials' : 'sd' });
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
    <>
      <Instruction>Which word is this?</Instruction>
      <div class="wu-overlay is-veiled">
        <div class="wu-card wu-card-word" data-block="faint">
          <p
            class="wu-word"
            key={trial}
            aria-hidden="true"
            data-word={target}
            style={{ fontSize: `${css}px`, fontFamily: STIMULUS_FONT, color: `rgb(${g}, ${g}, ${g})` }}
          >
            {target}
          </p>
        </div>
      </div>
      <div class="wu-tray" key="tray-faint">
        {options.map((w, i) => (
          <Btn kind="answer" onClick={() => answer(w)} kbd={String(i + 1)} data={w}>
            {w}
          </Btn>
        ))}
        <Btn kind="quiet" onClick={() => answer(null)} kbd="0" data="none" class="wu-btn-pill">
          I don’t see one
        </Btn>
      </div>
    </>
  );
}
