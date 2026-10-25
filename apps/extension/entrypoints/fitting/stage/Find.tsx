// Find: four made-up sites, one per calm/busy × still/moving cell → tap the named link. 12 s each at most, then the
// link is shown. "Stop the moving parts" pauses motion for the rest of the warm-up (and counts as a choice).

import type { JSX } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { TEMPLATES } from '../content/mock';
import { effectiveTextPx } from '../logic/fitview';
import { FIND_TIMEOUT_MS, planFind, type FindTrial } from '../logic/finding';
import { clamp } from '../logic/rand';
import { MockPage } from '../screens/MockPage';
import { Btn, useTrialClock } from '../ui/common';
import { FrameBar, Instruction } from './Frame';
import type { BlockProps } from './types';

export function FindBlock(props: BlockProps): JSX.Element {
  const { raw, plan } = props;
  const trials = useMemo(() => planFind(props.rng), []);
  const [i, setI] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [note, setNote] = useState('');
  const [stopped, setStopped] = useState(raw.stoppedMotion);
  const clock = useTrialClock(props.paused, i);
  const scroller = useRef<HTMLDivElement>(null);
  const trial = trials[i] as FindTrial;
  const reduced = plan.stillOnly;
  const moving = trial.motion && !reduced && !stopped;
  const zoom = raw.zoom || 1;
  // The pages use the text size measured so far (clamped so the 24 links stay on one screen) and the click size.
  const fontPx = clamp(effectiveTextPx(props.fit) / zoom, 15, 22);
  const targetPx = clamp((props.fit.targets.minPx ?? 32) / zoom, 32, 64);

  useLayoutEffect(() => {
    scroller.current?.scrollTo(0, 0);
    setReveal(false);
    setNote('');
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
      setNote('Not that one. Keep looking.');
      return;
    }
    raw.findTrials.push({
      clutter: trial.clutter,
      // What was on screen: after Stop nothing moves (under Reduce motion the cell shows a bright still promo).
      motion: reduced ? trial.motion : trial.motion && !stopped,
      ms: reveal ? FIND_TIMEOUT_MS : Math.round(clock.elapsed()),
      found: !reveal,
    });
    if (i + 1 >= trials.length) {
      props.onDone({ trials: raw.findTrials.length, stop: 'max_trials' });
      return;
    }
    setI(i + 1);
  };

  const stop = () => {
    raw.stoppedMotion = true;
    setStopped(true);
    props.onStopMotion?.();
  };

  const brand = TEMPLATES[trial.template].brand;
  return (
    <>
      <Instruction sub={reveal ? 'Here it is. Click it to go on.' : note || undefined}>
        <span class="wu-find-verb">Find:</span> {trial.target}
      </Instruction>
      <div class="wu-overlay is-page" data-block="find" data-target={trial.target} data-trial={i}>
        <FrameBar site={brand} note="a made-up site" />
        <div class="wu-viewport" ref={scroller}>
          <MockPage
            trial={{ ...trial, index: i + 1 }}
            still={!moving}
            salientInsteadOfMotion={reduced}
            fontPx={fontPx}
            targetPx={targetPx}
            reveal={reveal}
            onLink={onLink}
          />
        </div>
      </div>
      <div class="wu-tray" key="tray-find">
        {moving ? (
          <Btn kind="tonal" onClick={stop} class="wu-btn-pill" data="stop">
            Stop the moving parts
          </Btn>
        ) : (
          <p class="wu-tray-note">Click the link on the page when you see it.</p>
        )}
      </div>
    </>
  );
}
