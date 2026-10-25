// Confirm: "This is your fit." The fitted page with Before/After, Smaller · Just right · Bigger, Light · Dark · Site
// colours, and plain rows naming what changes on pages, each with its source and Change. The person overrides the
// measurement (one correction wins: comfortable size repeats within ±0.09 log).

import type { BrowserSettings, FitProfile, Polarity, StructureLevel, WarmupMetrics } from '@webable/core';
import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  applyOverrides, effectiveTextPx, fitRows, lookOf, SITE_LOOK, sourceLabel, stepText, TEXT_LADDER,
  type FitRow, type Overrides, type RowKey,
} from '../logic/fitview';
import type { MarkId } from '../logic/plan';
import { FrameBar } from '../stage/Frame';
import { NewsPage } from '../stage/NewsPage';
import { Btn, Check } from '../ui/common';

const ALL: ReadonlySet<MarkId> = new Set<MarkId>(['text', 'contrast', 'clicks', 'calm', 'colours']);
const COLOURS: Array<{ v: Polarity; label: string }> = [
  { v: 'light', label: 'Light' },
  { v: 'dark', label: 'Dark' },
  { v: 'none', label: 'Site colours' },
];

function SourceTag(props: { row: FitRow }): JSX.Element | null {
  if (props.row.source === 'default') return null;
  return <span class={`wu-src is-${props.row.source}`}>{sourceLabel(props.row.source)}</span>;
}

export function Confirm(props: {
  base: FitProfile;
  settings: BrowserSettings | null;
  colourDefault: Polarity;
  demoName?: string;
  saving: boolean;
  onSave: (fit: FitProfile, corrections: WarmupMetrics['corrections']) => void;
  onRestart: () => void;
}): JSX.Element {
  const [ov, setOv] = useState<Overrides>({});
  const [colour, setColour] = useState<Polarity>(props.base.polarity.stated ?? props.colourDefault);
  const [colourChosen, setColourChosen] = useState(false);
  const [before, setBefore] = useState(false);
  const [open, setOpen] = useState<RowKey | null>(null);
  const [textSteps, setTextSteps] = useState(0);
  const [justRight, setJustRight] = useState(false);
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => h.current?.focus({ preventScroll: true }), []);

  const forced = !!props.settings?.forcedColors;
  const fit = useMemo(
    () => applyOverrides(props.base, { ...ov, polarity: forced ? 'none' : colour }, colourChosen, props.settings),
    [props.base, ov, colour, colourChosen, props.settings],
  );
  const rows = fitRows(fit, props.settings);
  const look = before ? SITE_LOOK : lookOf(fit, ALL);
  const text = effectiveTextPx(fit);
  const changedRows = (Object.keys(ov) as Array<keyof Overrides>).filter((k) => k !== 'textPx').map(String);

  const step = (dir: -1 | 1) => {
    setOv((o) => ({ ...o, textPx: stepText(text, dir) }));
    setTextSteps((n) => n + 1);
    setJustRight(false);
    setBefore(false);
  };

  const choose = (key: RowKey, value: string) => {
    if (key === 'text') {
      setTextSteps((k) => k + 1);
      setJustRight(false);
    }
    setOv((o) => {
      const n = { ...o };
      if (key === 'text') n.textPx = Number(value);
      else if (key === 'contrast') n.band = value as 'N' | 'M' | 'S';
      else if (key === 'targets') n.targets = value === 'none' ? null : Number(value);
      else if (key === 'steady') n.steady = value === 'on';
      else if (key === 'motion') n.motion = value === 'on';
      else if (key === 'calm') n.level = Number(value) as StructureLevel;
      return n;
    });
    setBefore(false);
  };

  const save = () => {
    props.onSave(fit, { textSteps, colours: colourChosen && colour !== props.colourDefault, rows: changedRows });
  };

  const shown = rows.filter((r) => r.key !== 'text');
  const changed = shown.filter((r) => r.changed);
  const quiet = shown.filter((r) => !r.changed);

  const row = (r: FitRow, compact: boolean) => (
    <li class={`wu-row ${compact ? 'is-compact' : ''} ${open === r.key ? 'is-open' : ''}`} data-row={r.key}>
      <div class="wu-row-main">
        <p class="wu-row-title">
          {!compact ? <Check size={16} class="wu-row-check" /> : null}
          {r.title}
        </p>
        {!compact ? <p class="wu-row-line">{r.line}</p> : null}
        {!compact ? <SourceTag row={r} /> : null}
      </div>
      {r.choices.length ? (
        <button
          type="button"
          class="wu-change"
          aria-expanded={open === r.key}
          onClick={() => setOpen(open === r.key ? null : r.key)}
          data-answer={`change-${r.key}`}
        >
          {open === r.key ? 'Done' : 'Change'}
        </button>
      ) : null}
      {open === r.key ? (
        <div class="wu-seg wu-row-seg" role="radiogroup" aria-label={r.title}>
          {r.choices.map((c) => (
            <button
              type="button"
              role="radio"
              aria-checked={r.current === c.value}
              class={`wu-seg-btn ${r.current === c.value ? 'is-on' : ''}`}
              onClick={() => choose(r.key, c.value)}
              data-answer={`${r.key}-${c.value}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );

  const textRow = rows.find((r) => r.key === 'text');
  return (
    <div class="wu-confirm">
      <section class="wu-confirm-stage" aria-label="Your fit on a sample page">
        <div class="wu-confirm-bar">
          <div class="wu-seg" role="radiogroup" aria-label="See the page before and after">
            <button type="button" role="radio" aria-checked={before} class={`wu-seg-btn ${before ? 'is-on' : ''}`} onClick={() => setBefore(true)} data-answer="before">
              Before
            </button>
            <button type="button" role="radio" aria-checked={!before} class={`wu-seg-btn ${!before ? 'is-on' : ''}`} onClick={() => setBefore(false)} data-answer="after">
              After
            </button>
          </div>
          <p class="wu-confirm-hint">{before ? 'The page as the site made it.' : 'The same page, fitted to you.'}</p>
        </div>
        <div class="wu-frame">
          <FrameBar site="The Daily Ledger" note="a made-up news page" />
          <div class="wu-viewport is-scroll">
            <NewsPage look={look} showHits={!before && open === 'targets'} />
          </div>
        </div>
        <div class="wu-confirm-controls">
          <div class="wu-control">
            <p class="wu-control-label">
              Text size <span class="wu-control-value">{Math.round(text * 2) / 2} px</span>
            </p>
            <div class="wu-control-row">
              <Btn kind="tonal" onClick={() => step(-1)} disabled={text <= (TEXT_LADDER[0] as number) + 0.25} class="wu-btn-pill wu-btn-md" data="smaller">
                Smaller
              </Btn>
              <Btn
                kind={justRight ? 'primary' : 'tonal'}
                onClick={() => setJustRight(true)}
                pressed={justRight}
                class="wu-btn-pill wu-btn-md"
                data="just-right"
              >
                Just right
              </Btn>
              <Btn
                kind="tonal"
                onClick={() => step(1)}
                disabled={text >= (TEXT_LADDER[TEXT_LADDER.length - 1] as number) - 0.25}
                class="wu-btn-pill wu-btn-md"
                data="bigger"
              >
                Bigger
              </Btn>
            </div>
          </div>
          {!forced ? (
            <div class="wu-control">
              <p class="wu-control-label">Colours in Calm view</p>
              <div class="wu-seg is-lg" role="radiogroup" aria-label="Colours in Calm view">
                {COLOURS.map((c) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={colour === c.v}
                    class={`wu-seg-btn ${colour === c.v ? 'is-on' : ''}`}
                    onClick={() => {
                      setColour(c.v);
                      setColourChosen(true);
                      setBefore(false);
                    }}
                    data-answer={`colour-${c.v}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section class="wu-confirm-panel" aria-labelledby="wu-confirm-h">
        <h1 class="wu-title" id="wu-confirm-h" ref={h} tabIndex={-1}>
          This is your fit.
        </h1>
        <p class="wu-lede">
          {props.demoName ? `A sample fit (${props.demoName}) for demos. ` : ''}Here’s what helps you. Change anything.
        </p>
        <ul class="wu-rows" aria-label="What changes on pages">
          {textRow ? row(textRow, !textRow.changed) : null}
          {changed.map((r) => row(r, false))}
          {quiet.map((r) => row(r, true))}
        </ul>
        <div class="wu-confirm-actions">
          <Btn kind="primary" onClick={save} disabled={props.saving} class="wu-btn-pill wu-btn-wide" data="use">
            {props.saving ? 'Saving…' : 'Use this fit'}
          </Btn>
          <button type="button" class="wu-link" onClick={props.onRestart} data-answer="restart">
            Start over
          </button>
        </div>
      </section>
    </div>
  );
}

export function Done(props: { saved: boolean; seconds: number | null; onOpenDemo: () => void; onClose: () => void; onExport: (() => void) | null }): JSX.Element {
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => h.current?.focus({ preventScroll: true }), []);
  return (
    <div class="wu-center wu-done">
      <svg class="wu-done-mark" viewBox="0 0 96 96" aria-hidden="true">
        <circle class="wu-done-ring" cx="48" cy="48" r="44" pathLength={1} />
        <path class="wu-done-check" d="M30 49l12 12 25-27" pathLength={1} />
      </svg>
      <h1 class="wu-title" ref={h} tabIndex={-1}>
        {props.saved ? 'You’re set.' : 'Your fit was not saved.'}
      </h1>
      <p class="wu-lede">
        {props.saved
          ? 'WebAble now fits every page you open, and keeps learning from what you do. The WebAble button on each page shows what changed, and the original page is always one click away.'
          : 'Something stopped the save. Go back and try again, or close this tab and take the warm-up later.'}
      </p>
      {props.saved && props.seconds != null ? (
        <p class="wu-done-time">Done in {props.seconds} seconds.</p>
      ) : null}
      <div class="wu-start-actions is-center">
        <Btn kind="primary" onClick={props.onOpenDemo} class="wu-btn-pill wu-btn-wide" data="open-demo">
          Open a sample page
        </Btn>
        <Btn kind="tonal" onClick={props.onClose} class="wu-btn-pill" data="close">
          Close this tab
        </Btn>
      </div>
      {props.onExport ? (
        <button type="button" class="wu-link wu-link-quiet" onClick={props.onExport} data-answer="export">
          Save this session’s numbers (for testers)
        </button>
      ) : null}
    </div>
  );
}
