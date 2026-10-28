// The participant flow: welcome → who the study is for (age, trouble with websites; nothing saved, and someone it is
// not for stops here) → agreement → about you → setup → warm-up → practice → round 1 (three websites, then the ten
// statements and a comment) → break → round 2 → last questions → thank-you with the code. Each step is saved as it
// ends, so a reload picks up at the same step (a website in progress starts again, and that is noted).

import { DEMO_FITS, type FitProfile } from '@webable/core';
import type { JSX } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { AboutYou, FinalAnswers, Likert7, SessionRecord, TrialRecord } from '../contracts';
import { debriefFor } from '../experiment/debrief';
import { eligible, screened } from '../experiment/eligibility';
import { planFor, REPLICAS, type PlannedTask } from '../experiment/plan';
import { susResponse } from '../experiment/sus';
import { parseInvite, previewInvite, type Invite } from '../store/invite';
import { collecting, loadSession, newSession, SessionStore } from '../store/session';
import { onPending, pending } from '../store/remote';
import { inputsSeen, readDevice, watchInputs } from './device';
import {
  AboutScreens,
  AgreeScreen,
  BreakScreen,
  DoneScreen,
  EligibilityScreens,
  EndedScreen,
  FinalScreens,
  NotEligibleScreen,
  RoundIntro,
  SetupScreen,
  SusScreens,
  WelcomeScreen,
} from './screens';
import { TaskRunner } from './TaskRunner';
import { Dialog, Primary, ProgressContext, TextButton, type Progress } from './ui';
import { Warmup } from './Warmup';

type Stage =
  | 'welcome'
  | 'eligible'
  | 'not_eligible'
  | 'agree'
  | 'about'
  | 'setup'
  | 'warmup'
  | 'practice'
  | 'round1-intro'
  | 'round1'
  | 'sus1'
  | 'break'
  | 'round2-intro'
  | 'round2'
  | 'sus2'
  | 'final'
  | 'done'
  | 'declined'
  | 'withdrawn';

function boot(): { store: SessionStore; resumed: boolean } {
  const fromLink = parseInvite(location.hash);
  if (fromLink) {
    try {
      history.replaceState(null, '', location.pathname + location.search);
    } catch {
      /* fine */
    }
    try {
      sessionStorage.setItem('webable.study.code', JSON.stringify(fromLink));
    } catch {
      /* fine */
    }
  }
  let invite: Invite | null = fromLink;
  if (!invite) {
    try {
      invite = JSON.parse(sessionStorage.getItem('webable.study.code') ?? 'null') as Invite | null;
    } catch {
      invite = null;
    }
  }
  invite ??= previewInvite(location.search, Math.random);
  if (invite.cohort === 'preview') {
    try {
      sessionStorage.setItem('webable.study.code', JSON.stringify(invite));
    } catch {
      /* fine */
    }
  }
  const saved = loadSession(invite.code);
  if (saved) return { store: new SessionStore(saved), resumed: true };
  const store = new SessionStore(newSession(invite));
  previewShortcut(store);
  return { store, resumed: false };
}

/**
 * Previews only: `?fit=rosa|typical|reader` skips straight past the warm-up with that demo fit, and `&at=round1` or
 * `&at=round2` skips the practice too. For checking pages and adaptation strength; never available on an invitation.
 */
function previewShortcut(store: SessionStore): void {
  if (store.record.cohort !== 'preview') return;
  const q = new URLSearchParams(location.search);
  const name = q.get('fit');
  if (!name || !(name in DEMO_FITS)) return;
  const fit = JSON.parse(JSON.stringify(DEMO_FITS[name as keyof typeof DEMO_FITS])) as FitProfile;
  const at = q.get('at');
  store.update({
    consent: { version: 'preview', agreedAt: new Date().toISOString() },
    calibration: { raw: null, fit, durationSec: 0, skipped: [`demo:${name}`] },
    stage: at === 'round1' ? 'round1' : at === 'round2' ? 'round2' : 'practice',
  });
}

/** Answers to the questions on who the study is for are not kept for someone who stops before agreeing. */
const blankAbout: AboutYou = { ageBand: null, zoomToRead: null, tapWrong: null };

const RECORD_MODE = /[?&]record=1/.test(location.search) && location.hostname === '127.0.0.1';

/**
 * The progress bar's place for each step (parts in ui.tsx PARTS): `fill` is how much of the part is done when the step
 * opens, `to` how much when it ends (a screen with questions moves between the two). None on the first screen.
 */
function progressFor(
  stage: Stage,
  done: (r: 1 | 2) => number,
  total: (r: 1 | 2) => number,
): (Progress & { to?: number }) | null {
  const tasks = (r: 1 | 2) => (0.75 * done(r)) / Math.max(1, total(r));
  switch (stage) {
    case 'welcome':
      return { part: 0, fill: 0 };
    case 'eligible':
      return { part: 0, fill: 0.05, to: 0.2 };
    case 'agree':
      return { part: 0, fill: 0.2 };
    case 'about':
      return { part: 0, fill: 0.3, to: 0.85 };
    case 'setup':
      return { part: 0, fill: 0.85 };
    case 'warmup':
      return { part: 1, fill: 0, to: 1 };
    case 'practice':
      return { part: 2, fill: 0.5 };
    case 'round1-intro':
      return { part: 3, fill: 0 };
    case 'round1':
      return { part: 3, fill: tasks(1) };
    case 'sus1':
      return { part: 3, fill: 0.75, to: 1 };
    case 'break':
    case 'round2-intro':
      return { part: 4, fill: 0 };
    case 'round2':
      return { part: 4, fill: tasks(2) };
    case 'sus2':
      return { part: 4, fill: 0.75, to: 1 };
    case 'final':
      return { part: 5, fill: 0, to: 1 };
    case 'done':
      return { part: 6, fill: 0 };
    default:
      return null;
  }
}

export function App(): JSX.Element {
  const { store, resumed } = useMemo(boot, []);
  const [rec, setRec] = useState<SessionRecord>(store.record);
  const [leaving, setLeaving] = useState(false);
  /** "Leave and delete" could not reach the server: say so, with the code, instead of claiming the answers are gone. */
  const [deleteFailed, setDeleteFailed] = useState(false);
  /** The study reopened in the middle of a website: that website starts again, and its card says so. */
  const [restarted, setRestarted] = useState(() => resumed && /^(round[12]|practice)$/.test(store.record.stage));
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'retrying' | 'local'>('local');
  const plan = useMemo(() => planFor(rec.sequence, rec.seed), [rec.sequence, rec.seed]);
  const stage = rec.stage as Stage;
  const preview = rec.cohort === 'preview';

  useEffect(() => {
    watchInputs();
    if (resumed && /^(round|practice)/.test(stage)) store.note('resumed', stage);
  }, []);

  const go = (next: Stage, patch: Partial<SessionRecord> = {}) => setRec(store.update({ ...patch, stage: next }));

  /* ---------------- leaving ---------------- */

  const leave = () => setLeaving(true);
  const leaveDialog = leaving ? (
    <Dialog
      title="Do you want to leave the study?"
      actions={
        <>
          <Primary onClick={() => setLeaving(false)}>No, stay in the study</Primary>
          <TextButton
            onClick={() => {
              setLeaving(false);
              store.note('left', stage);
              go('withdrawn', {
                withdrawn: false,
                finishedAt: new Date().toISOString(),
              });
            }}
          >
            Leave and keep my answers
          </TextButton>
          <TextButton
            onClick={() => {
              setLeaving(false);
              void store.withdraw().then((ok) => {
                setDeleteFailed(!ok);
                setRec({ ...store.record });
              });
            }}
          >
            Leave and delete my answers
          </TextButton>
        </>
      }
    >
      <p>You can stop at any time. You do not have to give a reason.</p>
      <p>If you leave, you cannot come back to the study.</p>
      <p>If you delete your answers, we cannot get them back.</p>
    </Dialog>
  ) : null;

  /* ---------------- saving status on the last screen ---------------- */

  useEffect(() => {
    if (stage !== 'done') return;
    if (!collecting(rec)) {
      setSaveState('local');
      return;
    }
    const upd = (n: number) => setSaveState(n === 0 ? 'saved' : 'retrying');
    setSaveState(pending() === 0 ? 'saved' : 'saving');
    const off = onPending(upd);
    void store.flushed().then((ok) => setSaveState(ok ? 'saved' : 'retrying'));
    return off;
  }, [stage]);

  /* ---------------- the trial sequence ---------------- */

  const roundTasks = (r: 1 | 2): PlannedTask[] => plan.rounds[r - 1] ?? [];
  const doneIn = (r: 0 | 1 | 2): number => rec.trials.filter((t) => t.round === r).length;

  const onTrial = (t: TrialRecord) => {
    setRestarted(false);
    store.addTrial(t);
    const r = t.round;
    if (r === 0) return go('round1-intro');
    const total = roundTasks(r).length;
    const done = doneIn(r) + 1;
    if (done >= total) return go(r === 1 ? 'sus1' : 'sus2');
    setRec({ ...store.record });
  };

  const startRound = (r: 1 | 2) => {
    const d = readDevice();
    if (rec.device && d.inputsSeen.length && !inputsSeen().includes('touch')) store.note('no_touch', `round ${r}`);
    store.setDevice(d);
    go(r === 1 ? 'round1' : 'round2');
  };

  const fit = rec.calibration?.fit ?? null;
  const adaptedRound: 1 | 2 = plan.conditions[0] === 'adapted' ? 1 : 2;

  let body: JSX.Element;
  switch (stage) {
    case 'welcome':
      body = <WelcomeScreen preview={preview} onStart={() => go('eligible')} />;
      break;
    case 'eligible':
      body = (
        <EligibilityScreens
          onBack={() => go('welcome')}
          onDone={(age, troubles) =>
            eligible(age, troubles)
              ? go('agree', { about: screened(rec.about, age, troubles) })
              : go('not_eligible', { about: blankAbout })
          }
        />
      );
      break;
    case 'not_eligible':
      body = <NotEligibleScreen onBack={() => go('eligible')} />;
      break;
    case 'agree':
      body = (
        <AgreeScreen
          preview={preview}
          onAgree={() =>
            go('about', {
              consent: { version: '2.0.0', agreedAt: new Date().toISOString() },
            })
          }
          onDecline={() => go('declined', { about: blankAbout })}
        />
      );
      break;
    case 'about':
      body = <AboutScreens about={rec.about} onLeave={leave} onDone={(about: AboutYou) => go('setup', { about })} />;
      break;
    case 'setup':
      body = (
        <SetupScreen
          landscape={innerWidth > innerHeight}
          onLeave={leave}
          onBack={() => go('about')}
          onDone={() => {
            store.setDevice(readDevice());
            go('warmup');
          }}
        />
      );
      break;
    case 'warmup':
      body = (
        <Warmup
          seed={rec.seed}
          onLeave={leave}
          onDone={(w) =>
            go(plan.practice ? 'practice' : 'round1-intro', {
              calibration: {
                raw: w.raw,
                fit: w.fit,
                durationSec: w.durationSec,
                skipped: w.skipped,
              },
            })
          }
        />
      );
      break;
    case 'practice':
      body = plan.practice ? (
        <TaskRunner
          key="practice"
          planned={plan.practice}
          eyebrow="Practice"
          restarted={restarted}
          fit={fit}
          sessionId={rec.sessionId}
          mode={RECORD_MODE ? 'record' : 'replay'}
          note={(k, d) => store.note(k, d)}
          onDone={onTrial}
          onLeave={leave}
        />
      ) : (
        <EndedScreen title="Something went wrong" lines={['The practice website is missing. Email us to tell us.']} />
      );
      break;
    case 'round1-intro':
    case 'round2-intro': {
      const r = stage === 'round1-intro' ? 1 : 2;
      body = (
        <RoundIntro
          round={r}
          count={roundTasks(r).length}
          afterPractice={r === 1 && !!plan.practice}
          onLeave={leave}
          onStart={() => startRound(r)}
        />
      );
      break;
    }
    case 'round1':
    case 'round2': {
      const r = stage === 'round1' ? 1 : 2;
      const tasks = roundTasks(r);
      const next = tasks[doneIn(r)];
      body = next ? (
        <TaskRunner
          key={`${r}-${next.task.id}`}
          planned={next}
          eyebrow={`Round ${r}, website ${next.position} of ${tasks.length}`}
          restarted={restarted}
          fit={fit}
          sessionId={rec.sessionId}
          mode={RECORD_MODE ? 'record' : 'replay'}
          note={(k, d) => store.note(k, d)}
          onDone={onTrial}
          onLeave={leave}
        />
      ) : (
        <EndedScreen
          title="Something went wrong"
          lines={['The websites for this round are missing. Email us to tell us.']}
        />
      );
      break;
    }
    case 'sus1':
    case 'sus2': {
      const r = stage === 'sus1' ? 1 : 2;
      body = (
        <SusScreens
          key={stage}
          round={r}
          sites={roundTasks(r)
            .map((t) => t.task.label ?? REPLICAS[t.task.replicaId]?.siteName ?? '')
            .filter(Boolean)}
          onLeave={leave}
          onDone={(items: Array<Likert7 | null>, comment: string | null) => {
            const sus = {
              ...rec.sus,
              [r]: susResponse(items, new Date().toISOString()),
            };
            const comments = { ...(rec.comments ?? { 1: null, 2: null }), [r]: comment };
            go(r === 1 ? 'break' : 'final', { sus, comments });
          }}
        />
      );
      break;
    }
    case 'break':
      body = <BreakScreen count={roundTasks(2).length} onLeave={leave} onContinue={() => startRound(2)} />;
      break;
    case 'final':
      body = (
        <FinalScreens
          rounds={
            [1, 2].map((r) =>
              roundTasks(r as 1 | 2)
                .map((t) => t.task.tag ?? '')
                .filter(Boolean),
            ) as [string[], string[]]
          }
          sources={[
            ...new Set(
              [...roundTasks(1), ...roundTasks(2)]
                .map((t) => REPLICAS[t.task.replicaId]?.siteName ?? '')
                .filter(Boolean),
            ),
          ]}
          onLeave={leave}
          onDone={(final: FinalAnswers) => go('done', { final, finishedAt: new Date().toISOString() })}
        />
      );
      break;
    case 'done':
      body = (
        <DoneScreen
          code={rec.code}
          adaptedRound={adaptedRound}
          debrief={debriefFor(rec.trials)}
          saved={saveState}
          preview={preview}
        />
      );
      break;
    case 'declined':
      body = (
        <EndedScreen
          title="You have chosen not to take part"
          lines={['We have not recorded anything. You can close this page.']}
        />
      );
      break;
    case 'withdrawn':
    default:
      body = !rec.withdrawn ? (
        <EndedScreen
          title="You have left the study"
          lines={['We have kept your answers so far.', 'Thank you for your time. You can close this page.']}
          code={rec.code}
          preview={preview}
        />
      ) : deleteFailed ? (
        <EndedScreen
          title="You have left the study"
          lines={[
            'We could not delete your answers yet, because this phone could not reach us.',
            'Email us with your code and we will delete them.',
          ]}
          code={rec.code}
          preview={preview}
        />
      ) : (
        <EndedScreen
          title="You have left the study"
          lines={['We have deleted your answers.', 'Thank you for your time. You can close this page.']}
        />
      );
  }

  return (
    <ProgressContext.Provider value={progressFor(stage, doneIn, (r) => roundTasks(r).length)}>
      {body}
      {leaveDialog}
    </ProgressContext.Provider>
  );
}
