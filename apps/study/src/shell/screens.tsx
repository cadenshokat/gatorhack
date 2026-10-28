// The study's screens around the tasks: start page, the 2 questions on who the study is for, agreement, 3 questions
// about you, get ready, round starts, the break, the 10 statements and a comment after each round, the last questions
// and the thank-you page. Wording follows the study's writing guide
// (GOV.UK question pages, W3C COGA, NN/g): one question per page, the question as the heading, everyday words,
// "cannot" in full, buttons named for what they do, and nothing moves on until the person taps Continue.

import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { AboutYou, FinalAnswers, Likert7, WebTrouble } from '../contracts';
import type { Debrief } from '../experiment/debrief';
import { TROUBLES, type AgeAnswer } from '../experiment/eligibility';
import { SUS_ITEMS } from '../experiment/sus';
import { CONFIG, collectionReady, withdrawAnyTime } from '../store/config';
import { Checks, Choices, ErrorLine, Primary, Scale7, Screen, TextButton, Title, type ChoiceOption } from './ui';

/** "‹ Back", above the heading, where going back is allowed. */
function BackLink(props: { onClick: () => void }): JSX.Element {
  return (
    <button type="button" class="btn-text st-back" onClick={props.onClick}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M15 5l-7 7 7 7"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      Back
    </button>
  );
}

/** How to ask for deletion with the code, from the study's settings. */
function deletionLine(): string {
  const email = CONFIG.contactEmail;
  if (!email) return '';
  if (withdrawAnyTime()) return `To delete your answers, email ${email} with this code. You can do this at any time.`;
  if (CONFIG.withdrawBy) return `To delete your answers, email ${email} with this code by ${CONFIG.withdrawBy}.`;
  return `To delete your answers, email ${email} with this code.`;
}

/* ---------------- start page ---------------- */

export function WelcomeScreen(props: { onStart: () => void; preview: boolean }): JSX.Element {
  return (
    <Screen onLeave={null} focusKey="welcome" actions={<Primary onClick={props.onStart}>Start now</Primary>}>
      <Title>Help us test websites on phones</Title>
      <div class="st-prose">
        <p>
          We are a research team at the University of Florida. We want to find out what makes websites easy or hard to
          use on a phone.
        </p>
        <p>This study is for people aged 50 or over who often have trouble using websites.</p>
        <p>This takes about 20 to 25 minutes. There is no time limit.</p>
        <h2>What you will do</h2>
        <ol class="st-steps">
          <li>Answer 5 questions about you.</li>
          <li>Warm-up. Read some text and tap some dots.</li>
          <li>Try one website for practice.</li>
          <li>Round 1. Find one fact on each of 3 websites. Then choose how much you agree with 10 statements.</li>
          <li>Round 2. The same again on 3 different websites.</li>
          <li>Answer 5 last questions.</li>
        </ol>
        <h2>You need</h2>
        <ul class="st-list">
          <li>your phone, held upright</li>
          <li>your glasses, if you use them to read</li>
          <li>a quiet place where nobody will interrupt you</li>
        </ul>
      </div>
      {props.preview ? <p class="st-preview">This is a preview. Your answers stay on this phone.</p> : null}
    </Screen>
  );
}

/* ---------------- who the study is for (before the agreement) ---------------- */

const AGES: Array<ChoiceOption<AgeAnswer>> = [
  { value: 'under_50', label: 'Under 50' },
  { value: '50-64', label: '50 to 64' },
  { value: '65-74', label: '65 to 74' },
  { value: '75-84', label: '75 to 84' },
  { value: '85+', label: '85 or over' },
];

const TROUBLE_WORDS: Record<WebTrouble, string> = {
  getting_around: 'I find it hard to get around a website',
  finding: 'I find it hard to find the information I need',
  understanding: 'I find it hard to understand what a website says',
};

const NO_TROUBLE = 'none' as const;

/**
 * Age, then the kinds of trouble with websites that often happen to the person. Nothing is saved here: the answers go
 * to the app, which keeps them only for someone who can take part and agrees.
 */
export function EligibilityScreens(props: {
  onDone: (age: AgeAnswer, troubles: WebTrouble[]) => void;
  onBack: () => void;
}): JSX.Element {
  const [i, setI] = useState(0);
  const [age, setAge] = useState<AgeAnswer | null>(null);
  const [ticked, setTicked] = useState<Array<WebTrouble | typeof NO_TROUBLE>>([]);
  const [nudge, setNudge] = useState(false);
  const go = (to: number) => {
    setNudge(false);
    setI(to);
  };
  if (i === 0) {
    const title = 'How old are you?';
    return (
      <Screen
        onLeave={null}
        sub={[0, 2]}
        focusKey="age"
        actions={<Primary onClick={() => (age ? go(1) : setNudge(true))}>Continue</Primary>}
      >
        <BackLink onClick={props.onBack} />
        <Title eyebrow="Question 1 of 5" question deck="This study is for people aged 50 or over">
          {title}
        </Title>
        {nudge ? <ErrorLine>Choose your age group</ErrorLine> : null}
        <Choices options={AGES} value={age} onPick={(v) => (setAge(v), setNudge(false))} label={title} />
      </Screen>
    );
  }
  const title = 'Which of these often happen to you when you use websites?';
  const troubles = ticked.filter((t): t is WebTrouble => t !== NO_TROUBLE);
  return (
    <Screen
      onLeave={null}
      sub={[1, 2]}
      focusKey="troubles"
      actions={<Primary onClick={() => (ticked.length && age ? props.onDone(age, troubles) : setNudge(true))}>Continue</Primary>}
    >
      <BackLink onClick={() => go(0)} />
      <Title eyebrow="Question 2 of 5" question deck="Choose all that apply">
        {title}
      </Title>
      {nudge ? <ErrorLine>Choose what often happens to you, or choose None of these</ErrorLine> : null}
      <Checks<WebTrouble | typeof NO_TROUBLE>
        options={TROUBLES.map((t) => ({ value: t, label: TROUBLE_WORDS[t] }))}
        none={{ value: NO_TROUBLE, label: 'None of these' }}
        value={ticked}
        onChange={(v) => (setTicked(v), setNudge(false))}
        label={title}
      />
    </Screen>
  );
}

/** For someone the study is not for: nothing was saved. Back, in case an answer was a slip. */
export function NotEligibleScreen(props: { onBack: () => void }): JSX.Element {
  return (
    <Screen onLeave={null} focusKey="not-eligible">
      <BackLink onClick={props.onBack} />
      <Title>You cannot take part in this study</Title>
      <div class="st-prose">
        <p>This study is only for people aged 50 or over who often have trouble using websites.</p>
        <p>We have not recorded anything. Thank you for your time. You can close this page.</p>
        <p>
          If you chose an answer by mistake, tap <strong>Back</strong>.
        </p>
      </div>
    </Screen>
  );
}

/* ---------------- agreement ---------------- */

export function AgreeScreen(props: { onAgree: () => void; onDecline: () => void; preview: boolean }): JSX.Element {
  const c = CONFIG;
  const ready = collectionReady();
  return (
    <Screen
      onLeave={null}
      focusKey="agree"
      actions={
        <>
          <Primary onClick={props.onAgree}>I agree to take part</Primary>
          <TextButton onClick={props.onDecline}>I do not want to take part</TextButton>
        </>
      }
    >
      <Title>Before you agree to take part</Title>
      {props.preview || !ready ? (
        <p class="st-preview">This is a preview. Nothing is sent anywhere. Your answers stay on this phone.</p>
      ) : null}
      <div class="st-prose">
        <h2>Who is doing this study and why</h2>
        <p>
          {c.team ?? 'The WebAble team'} is doing this study. We are testing WebAble, a program that uses AI to change
          how websites look and work. We want to find out how it affects using websites on a phone.
        </p>
        <p>This study is for people aged 50 or over who often have trouble using websites.</p>

        <h2>What you will do</h2>
        <p>You will:</p>
        <ul class="st-list">
          <li>do a warm-up, where you read some text and tap some dots</li>
          <li>look for one fact on each of 7 websites, including one for practice</li>
          <li>answer questions about you and about the websites</li>
        </ul>
        <p>It takes about 20 to 25 minutes.</p>
        <p>
          In one round, WebAble changes the websites. In the other round, they look as they normally do. We will tell
          you which round was which at the end.
        </p>

        <h2>What WebAble changes</h2>
        <p>WebAble changes the websites in 2 ways:</p>
        <ul class="st-list">
          <li>It uses your warm-up to set things like the text size and the size of buttons.</li>
          <li>
            Its AI looked at each website once, before the study. It decided things like what to move out of the way,
            whether to show a simpler version and how to lay it out. These decisions are the same for everyone.
          </li>
        </ul>
        <p>WebAble does not learn about you during the study. Nothing you do is sent to an AI.</p>

        <h2>The websites are copies</h2>
        <p>
          We saved copies of real websites so everyone sees the same thing. Links on them are turned off. You will not
          sign in, buy anything or type personal details.
        </p>

        <h2>What we record</h2>
        <ul class="st-list">
          <li>your answers</li>
          <li>how long each website takes you</li>
          <li>where you tap, scroll and zoom on the websites and in the warm-up</li>
          <li>what you do in the warm-up, such as the text size you choose</li>
          <li>your phone’s screen size and display settings</li>
          <li>the app you use to view this page, such as Safari or Chrome</li>
          <li>when you leave this page to use another app, and for how long</li>
          <li>your age group</li>
        </ul>

        <h2>What we do not record</h2>
        <ul class="st-list">
          <li>your name</li>
          <li>anything you type on the websites</li>
          <li>pictures or recordings of your screen</li>
          <li>what you do in other apps or on other websites</li>
          <li>where you are</li>
        </ul>

        <h2>How we store your answers</h2>
        <p>{c.retention ?? 'Only the study team can see your answers. We store them under a code, not your name.'}</p>

        <h2>Risks and benefits</h2>
        <p>Some websites may be tiring or annoying to use. You can take a break at any time.</p>
        <p>There is no payment. Taking part does not help you directly. Your answers help us test WebAble.</p>

        <h2>Taking part is your choice</h2>
        <p>
          You can skip most questions. You can stop at any time. You do not have to give a reason. To stop, tap{' '}
          <strong>Leave</strong> at the top of the page.
        </p>
        <p>
          This is not a test of your health, eyesight, hands or memory. We will not tell you anything about your
          health.
        </p>

        <h2>Deleting your answers</h2>
        <p>
          {withdrawAnyTime(c) ? (
            <>
              At the end, you get a code. Email us that code at any time and we will delete your answers. You can also
              delete your answers when you tap <strong>Leave</strong>.
            </>
          ) : c.withdrawBy ? (
            `At the end, you get a code. Email us that code by ${c.withdrawBy} and we will delete your answers.`
          ) : (
            'At the end, you get a code. Keep it in case you want us to delete your answers later.'
          )}
        </p>

        <h2>Questions or complaints</h2>
        <p>
          {c.contactEmail ? (
            <>
              Email <a href={`mailto:${c.contactEmail}`}>{c.contactEmail}</a>.
            </>
          ) : (
            'Contact details are added before the study starts.'
          )}
        </p>
        {c.approval ? <p>{c.approval}</p> : null}

        <h2>If you agree</h2>
        <p>
          By tapping <strong>I agree to take part</strong>, you confirm that:
        </p>
        <ul class="st-list">
          <li>you are 50 or over</li>
          <li>you have read this page</li>
          <li>you want to take part</li>
        </ul>
      </div>
    </Screen>
  );
}

/* ---------------- about you ---------------- */

type AboutKey = 'zoomToRead' | 'tapWrong' | 'held';

const NO_SAY: ChoiceOption<string> = {
  value: 'no_say',
  label: 'Prefer not to say',
  quiet: true,
};
const HOW_OFTEN: Array<ChoiceOption<string>> = [
  { value: 'never', label: 'Never' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'often', label: 'Often' },
  { value: 'always', label: 'Almost always' },
  NO_SAY,
];

const ABOUT: Array<{
  key: AboutKey;
  title: string;
  hint: string;
  error: string;
  options: Array<ChoiceOption<string>>;
}> = [
  {
    key: 'zoomToRead',
    title: 'How often do you zoom in to read on your phone?',
    hint: 'We ask this because people who zoom in may get different results',
    error: 'Choose how often you zoom in, or choose Prefer not to say',
    options: HOW_OFTEN,
  },
  {
    key: 'tapWrong',
    title: 'How often do you tap the wrong thing on your phone?',
    hint: 'We ask this because people who often tap the wrong thing may get different results',
    error: 'Choose how often you tap the wrong thing, or choose Prefer not to say',
    options: HOW_OFTEN,
  },
  {
    key: 'held',
    title: 'How will you hold your phone during the study?',
    hint: 'Hold it the same way until the end',
    error: 'Choose how you will hold your phone, or choose Another way',
    options: [
      { value: 'one_hand', label: 'In one hand, using my thumb' },
      { value: 'two_hands', label: 'In both hands' },
      { value: 'on_table', label: 'Flat on a table, using one finger' },
      { value: 'other', label: 'Another way', quiet: true },
    ],
  },
];

export function AboutScreens(props: {
  about: AboutYou;
  onDone: (a: AboutYou) => void;
  onLeave: () => void;
}): JSX.Element {
  const [i, setI] = useState(0);
  const [about, setAbout] = useState<AboutYou>(props.about);
  const [nudge, setNudge] = useState(false);
  const q = ABOUT[i]!;
  const value = (about[q.key] as string | null | undefined) ?? null;
  const go = (to: number) => {
    setNudge(false);
    setI(to);
  };
  const next = () => {
    if (value == null) return setNudge(true);
    if (i + 1 < ABOUT.length) go(i + 1);
    else props.onDone(about);
  };
  return (
    <Screen
      onLeave={props.onLeave}
      sub={[i, ABOUT.length]}
      focusKey={q.key}
      actions={<Primary onClick={next}>Continue</Primary>}
    >
      {i > 0 ? <BackLink onClick={() => go(i - 1)} /> : null}
      <Title eyebrow={`Question ${i + 3} of ${ABOUT.length + 2}`} question deck={q.hint}>
        {q.title}
      </Title>
      {nudge ? <ErrorLine>{q.error}</ErrorLine> : null}
      <Choices
        key={q.key}
        options={q.options}
        value={value}
        onPick={(v) => {
          setAbout({ ...about, [q.key]: v } as AboutYou);
          setNudge(false);
        }}
        label={q.title}
      />
    </Screen>
  );
}

/* ---------------- get ready ---------------- */

export function SetupScreen(props: {
  onDone: () => void;
  onBack: () => void;
  onLeave: () => void;
  landscape: boolean;
}): JSX.Element {
  return (
    <Screen onLeave={props.onLeave} focusKey="setup" actions={<Primary onClick={props.onDone}>Continue</Primary>}>
      <BackLink onClick={props.onBack} />
      <Title>Get ready</Title>
      <ol class="st-steps">
        <li>Hold your phone upright, the way you usually do.</li>
        <li>Put on your glasses if you use them to read.</li>
        <li>Sit somewhere quiet.</li>
      </ol>
      <div class="st-prose st-gap">
        <p>Keep this page open until the end. You can pause on any website.</p>
        <p>
          If this page closes by mistake, open your study link again on this phone, in the same app. Your answers so far
          will still be there.
        </p>
        <p>We are testing the websites, not you. Some websites are hard to use. That is what we want to find out.</p>
        <p>There is no time limit.</p>
      </div>
      {props.landscape ? <p class="st-preview">Your phone is sideways. Turn it upright before you continue.</p> : null}
    </Screen>
  );
}

/* ---------------- rounds ---------------- */

export function RoundIntro(props: {
  round: 1 | 2;
  count: number;
  /** Round 1 comes straight after the practice: say that it is finished. */
  afterPractice?: boolean;
  onStart: () => void;
  onLeave: () => void;
}): JSX.Element {
  return (
    <Screen
      onLeave={props.onLeave}
      focusKey={`round${props.round}`}
      actions={<Primary onClick={props.onStart}>Start round {props.round}</Primary>}
    >
      <Title eyebrow={props.afterPractice ? 'The practice is finished.' : undefined}>Round {props.round}</Title>
      <div class="st-prose">
        <p>You will see {props.count} websites. On each one, look for one fact.</p>
        <p>After each website, tell us how easy or hard it was.</p>
        <p>Then you choose how much you agree with 10 statements about the {props.count} websites.</p>
      </div>
    </Screen>
  );
}

export function BreakScreen(props: { count: number; onContinue: () => void; onLeave: () => void }): JSX.Element {
  return (
    <Screen
      onLeave={props.onLeave}
      focusKey="break"
      actions={<Primary onClick={props.onContinue}>Start round 2</Primary>}
    >
      <Title>Round 1 is finished</Title>
      <div class="st-prose">
        <p>Take a break if you want. There is no time limit.</p>
        <p>Round 2 has {props.count} different websites. It works the same way as round 1.</p>
      </div>
    </Screen>
  );
}

/* ---------------- the 10 statements (SUS, 7 points) ---------------- */

const AGREE_HINT = '1 means strongly disagree. 7 means strongly agree.';

export function SusScreens(props: {
  round: 1 | 2;
  /** The round's websites in words, so nobody has to remember them. */
  sites: string[];
  /** The 10 answers, then the round's comment (empty = none). */
  onDone: (items: Array<Likert7 | null>, comment: string | null) => void;
  onLeave: () => void;
}): JSX.Element {
  const [i, setI] = useState(-1);
  const [items, setItems] = useState<Array<Likert7 | null>>(() => Array.from({ length: 10 }, () => null));
  const [comment, setComment] = useState('');
  const [nudge, setNudge] = useState(false);
  const n = props.sites.length || 3;

  if (i < 0) {
    return (
      <Screen
        onLeave={props.onLeave}
        sub={[0, 12]}
        focusKey={`sus${props.round}-intro`}
        actions={<Primary onClick={() => setI(0)}>Continue</Primary>}
      >
        <Title>10 statements about round {props.round}</Title>
        <div class="st-prose">
          <p>These are about the {n} websites you just used:</p>
          {props.sites.length ? (
            <ul class="st-list">
              {props.sites.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : null}
          <p>Think only about these websites, not the warm-up or this page.</p>
          <p>For each statement, choose how much you agree.</p>
          <p>{AGREE_HINT}</p>
          <p>If you are not sure, choose 4.</p>
        </div>
      </Screen>
    );
  }

  const go = (to: number) => {
    setNudge(false);
    setI(to);
  };
  const advance = () => go(i + 1);

  // After the 10 statements: what it was like, in the person's own words, kept with this round (optional).
  if (i >= 10) {
    const title = `What was it like to use these ${n} websites? (optional)`;
    return (
      <Screen
        onLeave={props.onLeave}
        sub={[11, 12]}
        focusKey={`sus${props.round}-comment`}
        actions={<Primary onClick={() => props.onDone(items, comment.trim() || null)}>Continue</Primary>}
      >
        <BackLink onClick={() => go(9)} />
        <Title eyebrow={`Round ${props.round}`} question deck="Do not include any names">
          {title}
        </Title>
        <textarea
          class="st-text"
          rows={5}
          maxLength={1500}
          value={comment}
          onInput={(e) => setComment((e.currentTarget as HTMLTextAreaElement).value)}
          aria-label={title}
        />
      </Screen>
    );
  }
  const skip = () => {
    const next = items.slice();
    next[i] = null;
    setItems(next);
    advance();
  };

  return (
    <Screen
      onLeave={props.onLeave}
      sub={[i + 1, 12]}
      focusKey={`sus${props.round}-${i}`}
      actions={
        <>
          <Primary onClick={() => (items[i] != null ? advance() : setNudge(true))}>Continue</Primary>
          <TextButton onClick={skip}>Skip this question</TextButton>
        </>
      }
    >
      <BackLink onClick={() => go(i - 1)} />
      <Title eyebrow={`Statement ${i + 1} of 10`} question deck={AGREE_HINT}>
        {SUS_ITEMS[i]}
      </Title>
      {nudge ? <ErrorLine>Choose a number from 1 to 7, or tap Skip this question</ErrorLine> : null}
      <Scale7
        key={i}
        low="Strongly disagree"
        high="Strongly agree"
        value={items[i] ?? null}
        onPick={(v) => {
          const next = items.slice();
          next[i] = v;
          setItems(next);
          setNudge(false);
        }}
        label={SUS_ITEMS[i]!}
      />
    </Screen>
  );
}

/* ---------------- last questions ---------------- */

type FinalStep = 'preferred' | 'different' | 'noticed' | 'deviations' | 'realism' | 'useMyData';

/**
 * The numbers people see: always "of 5"; "What was different?" (asked only after Yes) shares number 2. "Anything that
 * was hard" is asked after each round instead (protocol 2.0.0), so it can be told apart by round.
 */
const FINAL_NUMBER: Record<FinalStep, number> = {
  preferred: 1,
  different: 2,
  noticed: 2,
  deviations: 3,
  realism: 4,
  useMyData: 5,
};

const DEVIATIONS: Array<{ id: string; label: string }> = [
  { id: 'helped', label: 'Someone helped me' },
  { id: 'changed_setting', label: 'I changed a setting on my phone' },
  { id: 'interrupted', label: 'Someone or something interrupted me' },
  { id: 'broken', label: 'Something did not work' },
];

/** The realism question's way out ("I have not used the real websites before"), kept apart from the 1 to 7 answers. */
const NOT_USED = 0;

/** "The Mars story, the LSU football results and the Biscayne park information". */
function listWords(xs: string[]): string {
  const t = xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : (xs[0] ?? '');
  return t ? t[0]!.toUpperCase() + t.slice(1) : '';
}

export function FinalScreens(props: {
  /** Each round's websites, short ("the Mars story"), so the round choices say what was in them. */
  rounds: [string[], string[]];
  /** The real websites the copies came from ("AP News", "Florida Gators", …). */
  sources: string[];
  onDone: (f: FinalAnswers) => void;
  onLeave: () => void;
}): JSX.Element {
  const [i, setI] = useState(0);
  const [nudge, setNudge] = useState(false);
  const [notUsed, setNotUsed] = useState(false);
  const [f, setF] = useState<FinalAnswers>({
    preferred: null,
    different: null,
    noticed: '',
    deviations: [],
    other: '',
    realism: null,
    useMyData: null,
  });
  // "What was different?" is asked only after "Yes".
  const order: FinalStep[] = [
    'preferred',
    'different',
    ...(f.different === 'yes' ? (['noticed'] as const) : []),
    'deviations',
    'realism',
    'useMyData',
  ];
  const step = order[Math.min(i, order.length - 1)]!;
  const sub: [number, number] = [i, order.length];
  const go = (to: number) => {
    setNudge(false);
    setI(to);
  };
  const next = () => go(i + 1);
  const set = (patch: Partial<FinalAnswers>) => {
    setF({ ...f, ...patch });
    setNudge(false);
  };
  const back = i > 0 ? <BackLink onClick={() => go(i - 1)} /> : null;
  const eyebrow = `Question ${FINAL_NUMBER[step]} of 5`;
  const skipLink = <TextButton onClick={next}>Skip this question</TextButton>;

  if (step === 'preferred') {
    const title = 'Which round would you choose for using websites every day?';
    const round = (n: 1 | 2) => (
      <span class="st-choice-two">
        <span>Round {n}</span>
        {props.rounds[n - 1]?.length ? <span class="st-choice-sub">{listWords(props.rounds[n - 1] ?? [])}</span> : null}
      </span>
    );
    return (
      <Screen
        onLeave={props.onLeave}
        sub={sub}
        focusKey={step}
        actions={
          <>
            <Primary onClick={() => (f.preferred ? next() : setNudge(true))}>Continue</Primary>
            {skipLink}
          </>
        }
      >
        <Title eyebrow={eyebrow} question>
          {title}
        </Title>
        {nudge ? <ErrorLine>Choose a round, or choose I am not sure</ErrorLine> : null}
        <Choices<NonNullable<FinalAnswers['preferred']>>
          options={[
            { value: 'round1', label: round(1) },
            { value: 'round2', label: round(2) },
            { value: 'same', label: 'No difference' },
            { value: 'unsure', label: 'I am not sure', quiet: true },
          ]}
          value={f.preferred}
          onPick={(v) => set({ preferred: v })}
          label={title}
        />
      </Screen>
    );
  }

  if (step === 'different') {
    const title = 'Did the 2 rounds feel different?';
    return (
      <Screen
        onLeave={props.onLeave}
        sub={sub}
        focusKey={step}
        actions={
          <>
            <Primary onClick={() => (f.different ? next() : setNudge(true))}>Continue</Primary>
            {skipLink}
          </>
        }
      >
        {back}
        <Title eyebrow={eyebrow} question>
          {title}
        </Title>
        {nudge ? <ErrorLine>Choose Yes or No, or choose I am not sure</ErrorLine> : null}
        <Choices<'yes' | 'no' | 'unsure'>
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'unsure', label: 'I am not sure', quiet: true },
          ]}
          value={f.different ?? null}
          onPick={(v) => set({ different: v })}
          label={title}
        />
      </Screen>
    );
  }

  if (step === 'noticed') {
    const title = 'What was different? (optional)';
    return (
      <Screen onLeave={props.onLeave} sub={sub} focusKey={step} actions={<Primary onClick={next}>Continue</Primary>}>
        {back}
        <Title eyebrow={eyebrow} question deck="Do not include any names">
          {title}
        </Title>
        <textarea
          class="st-text"
          rows={5}
          maxLength={1500}
          value={f[step]}
          onInput={(e) => setF({ ...f, [step]: (e.currentTarget as HTMLTextAreaElement).value })}
          aria-label={title}
        />
      </Screen>
    );
  }

  if (step === 'deviations') {
    const title = 'Did any of these happen during the study?';
    const none = f.deviations.includes('nothing');
    return (
      <Screen
        onLeave={props.onLeave}
        sub={sub}
        focusKey={step}
        actions={
          <>
            <Primary onClick={() => (f.deviations.length ? next() : setNudge(true))}>Continue</Primary>
            {skipLink}
          </>
        }
      >
        {back}
        <Title eyebrow={eyebrow} question deck="Choose all that happened">
          {title}
        </Title>
        {nudge ? <ErrorLine>Choose what happened, or choose None of these</ErrorLine> : null}
        <Checks
          options={DEVIATIONS.map((d) => ({ value: d.id, label: d.label }))}
          none={{ value: 'nothing', label: 'None of these' }}
          value={f.deviations}
          onChange={(d) => set({ deviations: d })}
          label={title}
        />
        {!none ? (
          <>
            <label class="st-label" for="st-other">
              Is there anything else you want to tell us? (optional)
            </label>
            <p class="st-hint st-hint-tight" id="st-other-hint">
              Do not include any names
            </p>
            <textarea
              id="st-other"
              class="st-text is-short"
              rows={3}
              maxLength={800}
              aria-describedby="st-other-hint"
              value={f.other}
              onInput={(e) => setF({ ...f, other: (e.currentTarget as HTMLTextAreaElement).value })}
            />
          </>
        ) : null}
      </Screen>
    );
  }

  if (step === 'realism') {
    const title = 'How much did these websites look and work like the real ones?';
    const options: Array<ChoiceOption<number>> = [
      ...([1, 2, 3, 4, 5, 6, 7] as const).map((n) => ({
        value: n,
        label: (
          <>
            <span class="st-num">{n}</span>
            <span class="st-num-label">{n === 1 ? 'Not at all like them' : n === 7 ? 'Exactly like them' : ''}</span>
          </>
        ),
      })),
      { value: NOT_USED, label: 'I have not used the real websites before', quiet: true },
    ];
    const value = notUsed ? NOT_USED : f.realism;
    return (
      <Screen
        onLeave={props.onLeave}
        sub={sub}
        focusKey={step}
        actions={
          <>
            <Primary onClick={() => (value != null ? next() : setNudge(true))}>Continue</Primary>
            {skipLink}
          </>
        }
      >
        {back}
        <Title
          eyebrow={eyebrow}
          question
          deck={
            <>
              1 means not at all like them. 7 means exactly like them.
              {props.sources.length ? (
                <>
                  <br />
                  The websites came from {listWords(props.sources)}.
                </>
              ) : null}
            </>
          }
        >
          {title}
        </Title>
        {nudge ? <ErrorLine>Choose a number from 1 to 7, or tap Skip this question</ErrorLine> : null}
        <Choices
          options={options}
          value={value}
          onPick={(v) => {
            setNotUsed(v === NOT_USED);
            set({ realism: v === NOT_USED ? null : (v as Likert7) });
          }}
          label={title}
          compact
        />
      </Screen>
    );
  }

  const title = 'Should we use your answers in our study?';
  return (
    <Screen
      onLeave={props.onLeave}
      sub={sub}
      focusKey={step}
      actions={<Primary onClick={() => (f.useMyData ? props.onDone(f) : setNudge(true))}>Send my answers</Primary>}
    >
      {back}
      <Title eyebrow={eyebrow} question deck="If you choose No, we leave your answers out of our results">
        {title}
      </Title>
      {nudge ? <ErrorLine>Choose Yes or No</ErrorLine> : null}
      <Choices<'yes' | 'no'>
        options={[
          { value: 'yes', label: 'Yes, I took part carefully' },
          { value: 'no', label: 'No, I rushed or was not paying attention' },
        ]}
        value={f.useMyData}
        onPick={(v) => set({ useMyData: v })}
        label={title}
      />
    </Screen>
  );
}

/* ---------------- thank-you page ---------------- */

/** "K7M4 P2XR": the code in 2 groups of 4, easier to copy. */
function grouped(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code;
}

/** The code, large, with what it is for and how to use it. */
function CodeBlock(props: { code: string; preview: boolean }): JSX.Element {
  const [copied, setCopied] = useState(false);
  const canCopy = typeof navigator !== 'undefined' && !!navigator.clipboard;
  const del = deletionLine();
  return (
    <>
      <p class="st-code" aria-label={`Your code is ${props.code.split('').join(' ')}`}>
        {grouped(props.code)}
      </p>
      <p>You need this code if you want us to delete your answers. Write it down or take a photo of this screen.</p>
      {!props.preview && del ? <p>{del}</p> : null}
      {canCopy ? (
        <TextButton
          onClick={() => {
            void navigator.clipboard
              .writeText(props.code)
              .then(() => setCopied(true))
              .catch(() => undefined);
          }}
        >
          {copied ? 'Code copied' : 'Copy the code'}
        </TextButton>
      ) : null}
    </>
  );
}

export function DoneScreen(props: {
  code: string;
  adaptedRound: 1 | 2;
  /** What WebAble did for this person, from the adapted round's delivery records, by where each change came from. */
  debrief: Debrief;
  saved: 'saving' | 'saved' | 'retrying' | 'local';
  preview: boolean;
}): JSX.Element {
  const status =
    props.saved === 'saved'
      ? 'Your answers are saved.'
      : props.saved === 'saving'
        ? 'We are still saving your answers. Keep this page open.'
        : props.saved === 'retrying'
          ? 'Your answers have not been sent yet. Keep this page open. We will keep trying.'
          : 'This was a preview. Your answers stayed on this phone.';
  const other = props.adaptedRound === 1 ? 2 : 1;
  return (
    <Screen onLeave={null} focusKey="done">
      <section class="st-done">
        <div class="st-panel" role="status">
          <h1 class="st-title" tabIndex={-1}>
            You have finished the study
          </h1>
          <p class="st-deck">{status}</p>
        </div>
        <div class="st-prose">
          <h2>Your code</h2>
          <CodeBlock code={props.code} preview={props.preview} />

          <h2>Which round used WebAble</h2>
          <p>Round {props.adaptedRound} used WebAble, the program we are testing.</p>
          {props.debrief.warmup.length ? (
            <>
              <p>From your warm-up, WebAble:</p>
              <ul class="st-list">
                {props.debrief.warmup.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </>
          ) : null}
          {props.debrief.ai.length ? (
            <>
              <p>
                WebAble’s AI looked at each website once, before the study. Its decisions were the same for everyone. On
                your websites, it:
              </p>
              <ul class="st-list">
                {props.debrief.ai.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </>
          ) : null}
          {!props.debrief.warmup.length && !props.debrief.ai.length ? (
            <p>On these websites, it made only small changes.</p>
          ) : null}
          <p>In round {other}, the websites looked as they normally do.</p>
          <p>The websites were copies we saved, so everyone saw the same pages.</p>
          <p>Thank you for taking part. You can close this page.</p>
        </div>
      </section>
    </Screen>
  );
}

export function EndedScreen(props: { title: string; lines: string[]; code?: string; preview?: boolean }): JSX.Element {
  return (
    <Screen onLeave={null} focusKey="ended">
      <Title>{props.title}</Title>
      <div class="st-prose">
        {props.lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
        {props.code ? (
          <>
            <h2>Your code</h2>
            <CodeBlock code={props.code} preview={!!props.preview} />
          </>
        ) : null}
      </div>
    </Screen>
  );
}
