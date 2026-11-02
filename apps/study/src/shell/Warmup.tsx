// Set up WebAble (protocol 4.0.0), in place of the 5-activity warm-up: what gets in the person's way on websites,
// the onboarding's own text size step (fitting/tasks/Size, unchanged), light or dark, and, with live AI, how they like
// to read. One question per screen, then a list of what WebAble will do for them. The fit is core's deriveFit over the
// size step, tuned by the answers and by how the person tapped on the study's screens so far (experiment/tuning.ts);
// it is frozen for both rounds, except for help the person accepts on a website, which the next websites keep.

import { defaultFit, deriveFit, type BrowserSettings, type FitProfile, type FittingRaw, type InputClass, type ReaderProfile } from '@webable/core';
import type { JSX } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { SENTENCES } from '../../../extension/entrypoints/fitting/content/sentences';
import { captureEnv, readBrowserSettings, readPageZoom, settingsUsed, type Env } from '../../../extension/entrypoints/fitting/logic/env';
import { makeRng } from '../../../extension/entrypoints/fitting/logic/rand';
import { RawCollector } from '../../../extension/entrypoints/fitting/logic/raw';
import { SizeTask } from '../../../extension/entrypoints/fitting/tasks/Size';
import { CheckIcon } from '../../../extension/entrypoints/fitting/ui/Chrome';
import { StepLabelsContext } from '../../../extension/entrypoints/fitting/ui/words';
import type { TapBaseline } from '../contracts';
import { readerFor, setupSummary, tuneFit, type Need, type SetupAnswers, type Shape, type Words } from '../experiment/tuning';
import { baselineNow } from './baseline';
import { Checks, Choices, ErrorLine, Header, Primary, Screen, Title } from './ui';
import { WARMUP_LABELS } from './warmupWords';

export interface WarmupResult {
  raw: FittingRaw;
  fit: FitProfile;
  durationSec: number;
  skipped: string[];
  input: InputClass;
  answers: SetupAnswers;
  reader: ReaderProfile | null;
  baseline: TapBaseline;
}

type View = 'needs' | 'size' | 'theme' | 'shape' | 'words' | 'summary';

const NEED_OPTIONS: Array<{ value: Need; label: string }> = [
  { value: 'small_text', label: 'Text that is too small' },
  { value: 'tap_wrong', label: 'Tapping the wrong thing' },
  { value: 'busy', label: 'Busy pages, ads and pop-ups' },
  { value: 'motion', label: 'Things that move or play by themselves' },
  { value: 'long_text', label: 'Long pages full of words' },
];

export function Warmup(props: { seed: number; live: boolean; onDone: (r: WarmupResult) => void; onLeave: () => void }): JSX.Element {
  const raw = useMemo(() => new RawCollector(), []);
  const rng = useMemo(() => makeRng(props.seed), [props.seed]);
  const [env, setEnv] = useState<Env | null>(null);
  const [settings, setSettings] = useState<BrowserSettings | null>(null);
  const [view, setView] = useState<View>('needs');
  const [needs, setNeeds] = useState<Array<Need | 'none'>>([]);
  const [polarity, setPolarity] = useState<'light' | 'dark' | null>(null);
  const [shape, setShape] = useState<Shape | null>(null);
  const [words, setWords] = useState<Words | null>(null);
  const [nudge, setNudge] = useState(false);
  const [done, setDone] = useState<WarmupResult | null>(null);

  useEffect(() => {
    void (async () => {
      const zoom = await readPageZoom();
      raw.zoom = zoom;
      setEnv(captureEnv(SENTENCES.map((s) => s.text).join(' '), zoom));
      setSettings(await readBrowserSettings().catch(() => null));
    })();
  }, []);

  useEffect(() => setNudge(false), [view]);

  const steps: View[] = props.live ? ['needs', 'size', 'theme', 'shape', 'words', 'summary'] : ['needs', 'size', 'theme', 'summary'];
  const sub: [number, number] = [steps.indexOf(view), steps.length];

  const startSize = () => {
    raw.inputClass = 'touch';
    raw.skippedSteps.add('find');
    raw.startClock();
    raw.beginBlock('read');
    setView('size');
  };

  /** Only the size step is measured: the other onboarding activities count as skipped, so deriveFit uses it alone. */
  const finish = (answers: SetupAnswers) => {
    raw.stopClock();
    raw.endBlock('read', { trials: raw.ladder.length, skipped: true });
    raw.endBlock('faint', { trials: 0, skipped: true });
    raw.skippedSteps.add('light or dark');
    raw.endBlock('point', { trials: 0, skipped: true });
    const metrics = raw.metrics({
      completed: true,
      corrections: { textSteps: 0, colours: false, rows: [] },
      settingsUsed: settings ? settingsUsed(settings) : [],
    });
    let base: FitProfile;
    try {
      base = deriveFit(raw.toRaw(), { settings, metrics });
    } catch {
      base = defaultFit();
    }
    const baseline = baselineNow();
    const r = raw.toRaw();
    setDone({
      raw: r,
      fit: tuneFit(base, answers, baseline),
      durationSec: r.durationSec,
      skipped: r.skipped,
      input: raw.inputClass,
      answers,
      reader: props.live ? readerFor(answers) : null,
      baseline,
    });
    setView('summary');
  };

  const answersNow = (): SetupAnswers => ({
    needs: needs.filter((n): n is Need => n !== 'none'),
    polarity: polarity ?? 'light',
    shape: shape ?? 'paragraphs',
    words: words ?? 'as_is',
  });

  /** Continue with nothing chosen says so, plainly, above the answers. */
  const next = (chosen: boolean, go: () => void) => (chosen ? go() : setNudge(true));

  if (!env) return <div class="fl-app" />;

  let page: JSX.Element;
  if (view === 'needs') {
    page = (
      <Screen onLeave={props.onLeave} sub={sub} focusKey="setup-needs" actions={<Primary onClick={() => next(needs.length > 0, startSize)}>Continue</Primary>}>
        <Title eyebrow="Set up WebAble" question deck="Tap all that apply. WebAble uses your answers to fit websites to you.">
          What gets in your way on websites?
        </Title>
        {nudge ? <ErrorLine>Tap at least one answer, or “None of these”.</ErrorLine> : null}
        <Checks options={NEED_OPTIONS} none={{ value: 'none', label: 'None of these' }} value={needs} onChange={setNeeds} label="What gets in your way on websites" />
      </Screen>
    );
  } else if (view === 'size') {
    page = (
      <div class="fl-app st-warmup">
        <Header onLeave={props.onLeave} sub={sub} />
        <main class="fl-main">
          <div class="fl-col">
            <SizeTask
              raw={raw}
              env={env}
              settings={settings}
              draft={defaultFit()}
              rng={rng}
              input={raw.inputClass}
              onAnswer={() => undefined}
              onDone={() => setView('theme')}
            />
          </div>
        </main>
      </div>
    );
  } else if (view === 'theme') {
    const sample = 'This is how websites would look.';
    page = (
      <Screen
        onLeave={props.onLeave}
        sub={sub}
        focusKey="setup-theme"
        actions={<Primary onClick={() => next(polarity !== null, () => (props.live ? setView('shape') : finish(answersNow())))}>Continue</Primary>}
      >
        <Title eyebrow="Set up WebAble" question>
          Which is easier for you to read?
        </Title>
        {nudge ? <ErrorLine>Tap the one that is easier to read.</ErrorLine> : null}
        <div class="st-themes" role="radiogroup" aria-label="Light or dark pages">
          {(['light', 'dark'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={polarity === p}
              class={`st-theme is-${p} ${polarity === p ? 'is-on' : ''}`}
              onClick={() => setPolarity(p)}
            >
              <span class="st-theme-sample">{sample}</span>
              <span class="st-theme-name">
                {p === 'light' ? 'Light page' : 'Dark page'}
                <CheckIcon size={20} />
              </span>
            </button>
          ))}
        </div>
      </Screen>
    );
  } else if (view === 'shape') {
    page = (
      <Screen onLeave={props.onLeave} sub={sub} focusKey="setup-shape" actions={<Primary onClick={() => next(shape !== null, () => setView('words'))}>Continue</Primary>}>
        <Title eyebrow="Set up WebAble" question deck="WebAble’s AI can lay out long text the way you like it.">
          How do you like information?
        </Title>
        {nudge ? <ErrorLine>Tap one answer.</ErrorLine> : null}
        <Choices<Shape>
          options={[
            { value: 'steps', label: 'As steps' },
            { value: 'points', label: 'As short points' },
            { value: 'paragraphs', label: 'As paragraphs' },
          ]}
          value={shape}
          onPick={setShape}
          label="How do you like information"
        />
      </Screen>
    );
  } else if (view === 'words') {
    page = (
      <Screen
        onLeave={props.onLeave}
        sub={sub}
        focusKey="setup-words"
        actions={<Primary onClick={() => next(words !== null, () => finish(answersNow()))}>Continue</Primary>}
      >
        <Title eyebrow="Set up WebAble" question deck="WebAble’s AI can rewrite long text for you. It keeps every fact and number.">
          How should websites be written for you?
        </Title>
        {nudge ? <ErrorLine>Tap one answer.</ErrorLine> : null}
        <Choices<Words>
          options={[
            { value: 'plain', label: 'Plain and short' },
            { value: 'as_is', label: 'As the website wrote it' },
          ]}
          value={words}
          onPick={setWords}
          label="How websites should be written for you"
        />
      </Screen>
    );
  } else {
    const r = done;
    page = (
      <Screen
        onLeave={null}
        sub={sub}
        focusKey="setup-summary"
        actions={<Primary onClick={() => r && props.onDone(r)}>Go to the practice website</Primary>}
      >
        <div class="st-warm-end">
          <span class="fl-closing-mark" aria-hidden="true">
            <CheckIcon size={36} />
          </span>
          <Title deck="You will see it on the websites in one of the two rounds.">WebAble is set up for you</Title>
        </div>
        {r ? (
          <ul class="st-setlist">
            {setupSummary(r.fit, r.answers, props.live).map((line) => (
              <li key={line}>
                <CheckIcon size={20} />
                {line}
              </li>
            ))}
          </ul>
        ) : null}
      </Screen>
    );
  }

  return <StepLabelsContext.Provider value={WARMUP_LABELS}>{page}</StepLabelsContext.Provider>;
}
