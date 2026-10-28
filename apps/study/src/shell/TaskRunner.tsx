// One website task. The replica loads in a same-origin iframe behind an opaque instruction card, so the person never
// sees the page (or WebAble preparing it) before Start, and the card stays up at least the same time in both
// conditions. Start begins the clock; the Single Ease Question follows the task. Time counts only while the page is
// visible, not paused, and no sheet is open.
//
// A 'go' task (protocol 2.1.0) is done on the website itself: the person taps the link that would open what they are
// looking for, by any route (the page's own, or WebAble's simplified page, which passes the tap to the page's link).
// Links never open; the frame reports the tap, and a sheet asks "Is this what you were looking for?". Yes ends the
// task; its success is whether that link reaches one of the task's destinations. "I cannot find it" is the way out.
// A 'find' task (protocol 1.0.0 to 2.0.0) ends with Answer and four choices.
//
// The shell is the frame's host (FrameHost in contracts.ts). On a phone the engine never zooms (it scales the page's
// text sizes and keeps the page at full width). On a wider screen its zoom is imitated as tab zoom: the iframe is laid
// out at width/f and drawn f times larger, so the replica reflows exactly as it would in a zoomed tab.
//
// The task bar (the task, Pause, and "I cannot find it" or Answer) always sits at the bottom of the screen: the website fills whatever height is
// left above it, so a browser toolbar that appears or hides never pushes the bar off screen, and while the person
// pinch-zooms, the bar and everything over the website follow what is on screen at their normal size.

import { defaultFit, type FitProfile } from '@webable/core';
import type { JSX } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { EndAction, FrameApi, FrameHost, Likert7, LinkPick, TrialConfig, TrialRecord } from '../contracts';
import { pageUrl, type PlannedTask } from '../experiment/plan';
import {
  Choices,
  Dialog,
  EASE_7,
  ErrorLine,
  Header,
  HelpLine,
  Primary,
  Scale7,
  TextButton,
  type ChoiceOption,
} from './ui';

/**
 * The frame draws its "Links are turned off" note in this document; when its frame goes away, the frame's timer that
 * hides the note goes with it. Every website starts and ends with none on screen.
 */
function clearLinkNotes(): void {
  for (const n of document.querySelectorAll('study-link-note')) n.remove();
}

/** The card stays up at least this long in every condition (WebAble usually settles well inside it). */
const MIN_CARD_MS = 2500;
/** After this, the page counts as slow and the person can retry or skip. */
const SLOW_MS = 15000;
/** The bar under the website: the task (up to 3 lines), then Pause and "I cannot find it" (or Answer). */
const BAR_H = 140;
/** Pinch zoom counts from this much zoom (see zoomedBy). */
const PINCH_AT = 1.1;

/**
 * How far the person has pinch-zoomed: the page's layout width over the width on screen (1 = not zoomed). Not
 * visualViewport.scale, which is above 1 before anyone zooms on a phone wider than the 390 px layout (1.10 on a 430 px
 * phone, enough to count as zoomed by itself).
 */
function zoomedBy(vv: VisualViewport): number {
  const w = document.documentElement.clientWidth;
  return w > 0 && vv.width > 0 ? w / vv.width : 1;
}

/** 'confirm': a 'go' task's "Is this what you were looking for?"; 'giveup': "Do you want to stop looking?". */
type Phase = 'card' | 'running' | 'answer' | 'confirm' | 'giveup' | 'paused' | 'seq';

type Pick = NonNullable<TrialRecord['picks']>[number];

interface Props {
  planned: PlannedTask;
  /** "Round 1, website 2 of 3", or "Practice". */
  eyebrow: string;
  /** The study reopened in the middle of this website, so it starts again: the card says so. */
  restarted?: boolean;
  fit: FitProfile | null;
  sessionId: string;
  mode: 'replay' | 'record';
  note: (kind: string, detail?: string) => void;
  onDone: (t: TrialRecord) => void;
  onLeave: () => void;
}

interface Clock {
  active: number;
  since: number | null;
  hidden: number;
  hiddenSince: number | null;
  episodes: number;
}

export function TaskRunner(props: Props): JSX.Element {
  const { task, condition, round, position } = props.planned;
  const go = task.kind === 'go';
  const frame = useRef<HTMLIFrameElement>(null);
  const [phase, setPhase] = useState<Phase>('card');
  const [ready, setReady] = useState<{
    settleMs: number;
    late: boolean;
  } | null>(null);
  const [minDone, setMinDone] = useState(false);
  const [slow, setSlow] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  /** The answer sheet's and the ease question's choice, kept until Continue; `nudge` when Continue had none. */
  const [picked, setPicked] = useState<number | null>(null);
  const [seqPick, setSeqPick] = useState<Likert7 | null>(null);
  const [nudge, setNudge] = useState(false);
  const [endAction, setEndAction] = useState<EndAction | null>(null);
  /** 'go': the link waiting on "Is this what you were looking for?", every link tapped so far, and the confirmed one. */
  const [pending, setPending] = useState<Omit<Pick, 'confirmed'> | null>(null);
  const picks = useRef<Pick[]>([]);
  const chosen = useRef<TrialRecord['chosen']>(null);
  const startedAt = useRef('');
  const loadStart = useRef(performance.now());
  const readyMs = useRef(0);
  const clock = useRef<Clock>({
    active: 0,
    since: null,
    hidden: 0,
    hiddenSince: null,
    episodes: 0,
  });
  const pinch = useRef({
    used: false,
    maxScale: 1,
    zoomedMs: 0,
    zoomedSince: null as number | null,
  });
  const orientation = useRef({ w: innerWidth, changes: 0 });
  const results = useRef<{
    metrics: TrialRecord['metrics'];
    delivery: TrialRecord['delivery'];
  }>({ metrics: null, delivery: null });
  const phaseRef = useRef<Phase>('card');
  const skippedFromCard = useRef(false);
  phaseRef.current = phase;
  const barRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  // The frame's box at zoom 1 when the trial starts: the full layout width and the height above the task bar. On a phone
  // the iframe then follows its box (a toolbar can change the height); the imitated tab zoom on wide screens uses these.
  const box = useMemo(
    () => ({
      w: document.documentElement.clientWidth || 390,
      h: Math.max(320, Math.round(innerHeight - BAR_H)),
    }),
    [],
  );
  const [zoom, setZoom] = useState(1);

  const trial: TrialConfig = useMemo(
    () => ({
      trialId: `${props.sessionId}:${round}:${task.id}`,
      task,
      condition,
      fit: props.fit ?? defaultFit(),
      frame: box,
      fixturesUrl: `/_r/${task.replicaId}/fixtures.json`,
      mode: props.mode,
    }),
    [task.id, condition, round],
  );

  const frameApi = (): FrameApi | null => {
    try {
      return (
        (
          (frame.current?.contentWindow as unknown as {
            __studyFrame?: FrameApi;
          }) ?? {}
        ).__studyFrame ?? null
      );
    } catch {
      return null;
    }
  };

  /* ---------------- the host the replica's frame runtime talks to ---------------- */

  useLayoutEffect(() => {
    const host: FrameHost = {
      trial: () => trial,
      zoom: (f: number) => {
        const z = Math.min(5, Math.max(0.25, Math.round(f * 100) / 100));
        setZoom(z);
        return z;
      },
      ready: (info) => {
        readyMs.current = Math.round(performance.now() - loadStart.current);
        setReady(info);
      },
      note: (kind, detail) => props.note(kind, `${task.id}${detail ? `: ${detail}` : ''}`),
      picked: (p: LinkPick) => onPick(p),
    };
    (window as unknown as { __studyHost?: FrameHost }).__studyHost = host;
    clearLinkNotes();
    loadStart.current = performance.now();
    setReady(null);
    setSlow(false);
    setZoom(1);
    const f = frame.current;
    if (f) f.src = `${pageUrl(task)}${loadKey ? `?reload=${loadKey}` : ''}`;
    const t1 = window.setTimeout(() => setMinDone(true), MIN_CARD_MS);
    const t2 = window.setTimeout(() => setSlow(true), SLOW_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [loadKey]);

  useEffect(
    () => () => {
      delete (window as unknown as { __studyHost?: FrameHost }).__studyHost;
      clearLinkNotes();
    },
    [],
  );

  /* ---------------- clock, visibility, pinch zoom, orientation ---------------- */

  const run = () => {
    if (clock.current.since == null) clock.current.since = performance.now();
  };
  const stop = () => {
    const c = clock.current;
    if (c.since != null) {
      c.active += performance.now() - c.since;
      c.since = null;
    }
  };

  useEffect(() => {
    const vis = () => {
      const c = clock.current;
      const now = performance.now();
      if (document.hidden) {
        c.hiddenSince = now;
        c.episodes++;
        stop();
      } else {
        if (c.hiddenSince != null) c.hidden += now - c.hiddenSince;
        c.hiddenSince = null;
        if (phaseRef.current === 'running') run();
      }
    };
    const vv = window.visualViewport;
    const onScale = () => {
      if (phaseRef.current !== 'running' || !vv) return;
      const s = zoomedBy(vv);
      const p = pinch.current;
      p.maxScale = Math.max(p.maxScale, s);
      if (s >= PINCH_AT) {
        p.used = true;
        p.zoomedSince ??= performance.now();
      } else if (p.zoomedSince != null) {
        p.zoomedMs += performance.now() - p.zoomedSince;
        p.zoomedSince = null;
      }
    };
    const poll = window.setInterval(onScale, 250);
    const onResize = () => {
      if (Math.abs(innerWidth - orientation.current.w) > 40) {
        orientation.current.changes++;
        orientation.current.w = innerWidth;
      }
    };
    document.addEventListener('visibilitychange', vis);
    vv?.addEventListener('resize', onScale);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      vv?.removeEventListener('resize', onScale);
      window.removeEventListener('resize', onResize);
      window.clearInterval(poll);
    };
  }, []);

  /* ---------------- pinch zoom: keep the bar and what covers the website on screen ---------------- */

  // Fixed things stay with the unzoomed page, so a zoomed-in person could lose the bar (and the answer sheet) off the
  // edge of the screen. While zoomed, move them onto the visible part and undo the zoom on them.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const place = () => {
      const bar = barRef.current;
      const layer = layerRef.current;
      const z = zoomedBy(vv);
      if (!(z > 1.01)) {
        if (bar) bar.style.transform = '';
        if (layer) layer.style.transform = '';
        return;
      }
      const k = 1 / z;
      if (layer) layer.style.transform = `translate(${vv.offsetLeft}px, ${vv.offsetTop}px) scale(${k})`;
      if (bar) {
        const y = vv.offsetTop + vv.height - bar.offsetHeight * k - bar.offsetTop;
        bar.style.transform = `translate(${vv.offsetLeft}px, ${y}px) scale(${k})`;
      }
    };
    vv.addEventListener('resize', place);
    vv.addEventListener('scroll', place);
    place();
    return () => {
      vv.removeEventListener('resize', place);
      vv.removeEventListener('scroll', place);
    };
  }, []);

  /* ---------------- actions ---------------- */

  const begin = () => {
    startedAt.current = new Date().toISOString();
    frameApi()?.begin();
    setPhase('running');
    run();
  };

  const openAnswer = () => {
    stop();
    setPhase('answer');
  };

  const resume = () => {
    setPhase('running');
    run();
  };

  /** Active time so far, in ms (the clock may be running). */
  const activeNow = () => {
    const c = clock.current;
    return Math.round(c.active + (c.since != null ? performance.now() - c.since : 0));
  };

  /**
   * 'go': the person tapped a link. Only while the website is in use; the frame calls this from the first render's
   * closure, so it reads refs and setters only.
   */
  const onPick = (p: LinkPick) => {
    if (phaseRef.current !== 'running') return;
    const meets = (task.targets ?? []).includes(p.href);
    setPending({ t: activeNow(), href: p.href, text: p.text, meets });
    stop();
    setPhase('confirm');
  };

  /** "Yes, this is it" ends the task on that link; "No, keep looking" goes back to the website. */
  const confirmPick = (yes: boolean) => {
    if (!pending) return resume();
    picks.current.push({ ...pending, confirmed: yes });
    setPending(null);
    if (!yes) return resume();
    chosen.current = { href: pending.href, text: pending.text, meets: pending.meets };
    end('chose', null);
  };

  const end = (action: EndAction, choice: number | null) => {
    stop();
    const p = pinch.current;
    if (p.zoomedSince != null) {
      p.zoomedMs += performance.now() - p.zoomedSince;
      p.zoomedSince = null;
    }
    const api = frameApi();
    try {
      results.current = {
        metrics: api ? api.end() : null,
        delivery: api ? api.delivery() : null,
      };
    } catch (err) {
      props.note('frame_end_failed', String(err));
      results.current = { metrics: null, delivery: null };
    }
    setAnswer(choice);
    setEndAction(action);
    setNudge(false);
    setPhase('seq');
  };

  const finish = (seq: Likert7 | null) => {
    const c = clock.current;
    const p = pinch.current;
    const action = endAction ?? 'technical';
    props.onDone({
      taskId: task.id,
      replicaId: task.replicaId,
      family: task.family,
      set: task.set,
      condition,
      round,
      position,
      startedAt: startedAt.current || new Date().toISOString(),
      activeMs: Math.round(c.active),
      hiddenMs: Math.round(c.hidden),
      hiddenEpisodes: c.episodes,
      endAction: action,
      kind: go ? 'go' : 'find',
      answer: go ? null : action === 'answered' ? answer : action === 'cant_find' ? -1 : null,
      correct: go ? action === 'chose' && chosen.current?.meets === true : action === 'answered' && answer === task.correct,
      ...(go ? { picks: picks.current, chosen: chosen.current ?? null } : {}),
      seq,
      seqScale: 'easy-1',
      pinch: {
        used: p.used,
        maxScale: Math.round(p.maxScale * 100) / 100,
        zoomedMs: Math.round(p.zoomedMs),
      },
      readyMs: readyMs.current,
      readyLate: ready?.late ?? true,
      orientationChanges: orientation.current.changes,
      metrics: results.current.metrics,
      delivery: results.current.delivery,
    });
  };

  const skip = (why: 'skipped' | 'technical') => {
    if (phaseRef.current !== 'card') return end(why, null);
    // Skipped before the website was opened: there is nothing to rate, so no ease question.
    startedAt.current = new Date().toISOString();
    skippedFromCard.current = true;
    end(why, null);
  };

  // A website skipped from its card goes straight on (finish reads the end action set by end()).
  useEffect(() => {
    if (phase === 'seq' && skippedFromCard.current) finish(null);
  }, [phase]);

  /* ---------------- render ---------------- */

  const canStart = ready != null && minDone;
  // At zoom 1 (every phone) the iframe fills its box, whatever height the box has now.
  const iframeStyle =
    zoom === 1
      ? { width: '100%', height: '100%', transform: 'none' }
      : {
          width: `${box.w / zoom}px`,
          height: `${box.h / zoom}px`,
          transform: `scale(${zoom})`,
        };

  if (phase === 'seq' && skippedFromCard.current) return <div class="fl-app st-app" />;

  if (phase === 'seq') {
    const seqTitle = go ? 'How easy or hard was this task?' : 'How easy or hard was it to find the answer?';
    return (
      <div class="fl-app st-app">
        <Header onLeave={props.onLeave} />
        <main class="st-main">
          <div class="st-col">
            <div class="st-head">
              <p class="fl-eyebrow">{props.eyebrow}</p>
              <h1 class="st-title st-title-q" tabIndex={-1}>
                {seqTitle}
              </h1>
            </div>
            {nudge ? <ErrorLine>Choose an answer, or tap Skip this question</ErrorLine> : null}
            <Scale7
              words={EASE_7}
              value={seqPick}
              onPick={(v) => (setSeqPick(v), setNudge(false))}
              label={seqTitle}
            />
            <HelpLine />
          </div>
        </main>
        <div class="st-actions">
          <Primary onClick={() => (seqPick != null ? finish(seqPick) : setNudge(true))}>Continue</Primary>
          <TextButton onClick={() => finish(null)}>Skip this question</TextButton>
        </div>
      </div>
    );
  }

  const choices: Array<ChoiceOption<number>> = [
    ...(task.choices ?? []).map((c, i) => ({ value: i, label: c })),
    { value: -1, label: 'I could not find it', quiet: true },
  ];

  return (
    <div class="st-task" data-phase={phase}>
      <div class="st-frame-box" inert={phase !== 'running'}>
        <iframe ref={frame} class="st-frame" style={iframeStyle} title="The website" key={loadKey} />
      </div>

      <div class="st-bar" ref={barRef} inert={phase !== 'running'}>
        <p class="st-bar-q">{task.prompt}</p>
        <div class="st-bar-row">
          <button type="button" class="btn-text st-bar-pause" onClick={() => (stop(), setPhase('paused'))}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <rect x="6.5" y="5" width="3.5" height="14" rx="1.2" fill="currentColor" />
              <rect x="14" y="5" width="3.5" height="14" rx="1.2" fill="currentColor" />
            </svg>
            Pause
          </button>
          {go ? (
            <button
              type="button"
              class="btn btn-secondary st-bar-answer"
              onClick={() => (stop(), setPhase('giveup'))}
            >
              I cannot find it
            </button>
          ) : (
            <button type="button" class="btn btn-primary st-bar-answer" onClick={openAnswer}>
              Answer
            </button>
          )}
        </div>
      </div>

      {/* What covers the website: the instruction page, the answer sheet, the pause dialog. */}
      <div class="st-layer" ref={layerRef}>
        {phase === 'card' ? (
          <div class="st-cover">
            <Header onLeave={props.onLeave} />
            <div class="fl-modal st-card" role="dialog" aria-modal="true" aria-labelledby="st-card-title">
              <p class="fl-eyebrow">{props.eyebrow}</p>
              <h2 id="st-card-title" class="fl-modal-title" tabIndex={-1}>
                {task.title ?? task.prompt}
              </h2>
              <div class="fl-modal-text st-card-text">
                {props.restarted ? (
                  <p>The study closed while you were on this website. It starts again from the beginning.</p>
                ) : null}
                {condition === 'practice' ? <p>This website is for practice.</p> : null}
                {task.context
                  ? task.context.split('\n').map((line) => (
                      <p key={line} class={line.startsWith('Your task:') ? 'st-card-goal' : undefined}>
                        {line}
                      </p>
                    ))
                  : null}
                {go ? (
                  <>
                    <h3 class="st-card-how">How to do it</h3>
                    <ol class="st-steps st-card-steps">
                      <li>
                        Tap <strong>Open the website</strong>.
                      </li>
                      <li>Look around the website the way you normally would. You can scroll and tap things.</li>
                      <li>When you find the right link, tap it. We will ask you to check it is the right one.</li>
                      <li>
                        If you cannot find it, tap <strong>I cannot find it</strong> at the bottom of the screen.
                      </li>
                    </ol>
                    <p>In this study, links do not take you to a new page. That is normal.</p>
                  </>
                ) : (
                  <>
                    <ol class="st-steps st-card-steps">
                      <li>Look for the answer on the website, the way you usually would.</li>
                      <li>
                        When you find it, tap <strong>Answer</strong>.
                      </li>
                      <li>
                        If you cannot find it, tap <strong>Answer</strong> and choose{' '}
                        <strong>I could not find it</strong>.
                      </li>
                    </ol>
                    <p>Links on this website are turned off. You can find the answer without them.</p>
                  </>
                )}
                <p>
                  To take a break, tap <strong>Pause</strong>.
                </p>
              </div>
              <div class="st-card-actions">
                {slow && !ready ? (
                  <>
                    <p class="st-card-note">This website is taking a long time to open.</p>
                    <Primary
                      onClick={() => {
                        props.note('reload', task.id);
                        setLoadKey((k) => k + 1);
                      }}
                    >
                      Try again
                    </Primary>
                    <TextButton onClick={() => skip('technical')}>Skip this website</TextButton>
                  </>
                ) : (
                  <>
                    {canStart ? (
                      <Primary onClick={begin}>Open the website</Primary>
                    ) : (
                      <p class="st-card-note">The website is opening.</p>
                    )}
                    <TextButton onClick={() => skip('skipped')}>Skip this website</TextButton>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {phase === 'confirm' && pending ? (
          <div class="st-sheet-scrim">
            <div class="st-sheet" role="dialog" aria-modal="true" aria-labelledby="st-sheet-title">
              <h2 id="st-sheet-title" class="st-sheet-title" tabIndex={-1}>
                Is this what you were looking for?
              </h2>
              <div class="st-pick">
                <p class="st-pick-label">You tapped</p>
                <p class="st-pick-words">{pending.text || 'a link with no words'}</p>
              </div>
              <div class="st-sheet-actions">
                <Primary onClick={() => confirmPick(true)}>Yes, this is it</Primary>
                <TextButton onClick={() => confirmPick(false)}>No, keep looking</TextButton>
              </div>
            </div>
          </div>
        ) : null}

        {phase === 'giveup' ? (
          <div class="st-sheet-scrim">
            <div class="st-sheet" role="dialog" aria-modal="true" aria-labelledby="st-sheet-title">
              <h2 id="st-sheet-title" class="st-sheet-title" tabIndex={-1}>
                Do you want to stop looking?
              </h2>
              <p class="st-sheet-text">That is fine. We will move on to the next question.</p>
              <div class="st-sheet-actions">
                <Primary onClick={() => end('cant_find', null)}>Yes, stop looking</Primary>
                <TextButton onClick={resume}>No, keep looking</TextButton>
              </div>
            </div>
          </div>
        ) : null}

        {phase === 'answer' ? (
          <div class="st-sheet-scrim">
            <div class="st-sheet" role="dialog" aria-modal="true" aria-labelledby="st-sheet-title">
              <h2 id="st-sheet-title" class="st-sheet-title" tabIndex={-1}>
                {task.question ?? task.prompt}
              </h2>
              {nudge ? <ErrorLine>Choose an answer, or choose I could not find it</ErrorLine> : null}
              <Choices
                options={choices}
                value={picked}
                label={task.question ?? task.prompt}
                onPick={(v) => (setPicked(v), setNudge(false))}
              />
              <div class="st-sheet-actions">
                <Primary
                  onClick={() => {
                    if (picked == null) return setNudge(true);
                    if (picked === -1) end('cant_find', null);
                    else end('answered', picked);
                  }}
                >
                  Continue
                </Primary>
                <TextButton onClick={() => (setNudge(false), resume())}>Go back to the website</TextButton>
              </div>
            </div>
          </div>
        ) : null}

        {phase === 'paused' ? (
          <Dialog
            title="You have paused this website"
            actions={
              <>
                <Primary onClick={resume}>Go back to the website</Primary>
                <TextButton onClick={() => skip('skipped')}>Skip this website</TextButton>
                <TextButton onClick={props.onLeave}>Leave the study</TextButton>
              </>
            }
          >
            <p>There is no time limit. We do not count the time you spend paused.</p>
          </Dialog>
        ) : null}
      </div>
    </div>
  );
}
