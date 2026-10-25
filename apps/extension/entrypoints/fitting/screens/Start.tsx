// Start: "Let's fit the web to you." What the browser settings already answered is shown before any tap.

import { textPriorPx, type BrowserSettings, type FitProfile } from '@webable/core';
import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { SITE_LOOK } from '../logic/fitview';
import { NewsPage } from '../stage/NewsPage';
import { FrameBar } from '../stage/Frame';
import { Btn, Check } from '../ui/common';

/** What the settings already decided, in plain words about the page. */
export function settingLines(s: BrowserSettings | null): string[] {
  if (!s) return [];
  const out: string[] = [];
  const prior = textPriorPx(s);
  if (prior) out.push(`Text starts near ${Math.round(prior)} px, from your Chrome font and zoom.`);
  if (s.minFontPx && s.minFontPx > 0) out.push(`Text never goes below your ${Math.round(s.minFontPx)} px minimum.`);
  if (s.reducedMotion) out.push('Moving parts stay paused, as your system asks.');
  if (s.forcedColors) out.push('Your system colours stay as they are.');
  else if (s.contrastMore) out.push('Grey text starts darker, as your system asks.');
  if (s.colorScheme === 'dark' && !s.forcedColors) out.push('Calm view starts in dark colours, like your system.');
  return out;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  } catch {
    return 'earlier';
  }
}

export function Start(props: {
  settings: BrowserSettings | null;
  existing: FitProfile | null;
  onStart: () => void;
  onSkip: () => void;
  onReader: () => void;
}): JSX.Element {
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => h.current?.focus({ preventScroll: true }), []);
  const lines = settingLines(props.settings);
  const before = props.existing && /^warmup|^fit-/.test(props.existing.calibration?.version ?? '') ? props.existing : null;
  return (
    <div class="wu-start">
      <div class="wu-start-hero">
        <p class="wu-kicker">The WebAble warm-up</p>
        <h1 class="wu-display" ref={h} tabIndex={-1}>
          Let’s fit the web to you.
        </h1>
        <p class="wu-lede">About a minute. Tap along. There are no wrong answers.</p>
        <div class="wu-start-actions">
          <Btn kind="primary" onClick={props.onStart} class="wu-btn-pill wu-btn-wide" data="start">
            Start
          </Btn>
          <Btn kind="tonal" onClick={props.onSkip} class="wu-btn-pill" data="skip">
            Skip for now
          </Btn>
        </div>
        <button type="button" class="wu-link" onClick={props.onReader} data-answer="reader">
          I use a screen reader
        </button>
        {lines.length ? (
          <div class="wu-known" aria-label="From your browser settings">
            <p class="wu-known-h">Already from your browser settings</p>
            <ul>
              {lines.map((l) => (
                <li>
                  <Check size={15} />
                  {l}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {before ? (
          <p class="wu-start-note">You took the warm-up on {fmtDate(before.createdAt)}. Taking it again replaces that fit.</p>
        ) : null}
      </div>
      <div class="wu-start-stage" aria-hidden="true">
        <div class="wu-frame">
          <FrameBar site="The Daily Ledger" note="a made-up news page" />
          <div class="wu-viewport">
            <NewsPage look={{ ...SITE_LOOK, motionOff: !!props.settings?.reducedMotion }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Skip for now: nothing is saved; WebAble already works from settings and learning. */
export function Skipped(props: { onClose: () => void; onBack: () => void }): JSX.Element {
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => h.current?.focus({ preventScroll: true }), []);
  return (
    <div class="wu-center">
      <h1 class="wu-title" ref={h} tabIndex={-1}>
        WebAble is already on.
      </h1>
      <p class="wu-lede">
        It starts from your browser settings and learns from what you do on pages, like zooming in. Take the warm-up any
        time from the WebAble button.
      </p>
      <div class="wu-start-actions is-center">
        <Btn kind="primary" onClick={props.onClose} class="wu-btn-pill wu-btn-wide" data="close">
          Close this tab
        </Btn>
        <Btn kind="tonal" onClick={props.onBack} class="wu-btn-pill" data="back">
          Take the warm-up
        </Btn>
      </div>
    </div>
  );
}

/** "I use a screen reader": nothing visual changes unless asked; reading order, labels and keys stay the site's own. */
export function ReaderPath(props: { onSave: () => void; onBack: () => void; saving: boolean }): JSX.Element {
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => h.current?.focus({ preventScroll: true }), []);
  return (
    <div class="wu-center">
      <h1 class="wu-title" ref={h} tabIndex={-1}>
        WebAble keeps pages as your screen reader expects.
      </h1>
      <p class="wu-lede">
        WebAble never changes reading order, labels or keyboard controls. They stay exactly as each site made them. The
        visual parts of the warm-up are skipped.
      </p>
      <div class="wu-start-actions is-center">
        <Btn kind="primary" onClick={props.onSave} disabled={props.saving} class="wu-btn-pill wu-btn-wide" data="save">
          {props.saving ? 'Saving…' : 'Use this and close'}
        </Btn>
        <Btn kind="tonal" onClick={props.onBack} class="wu-btn-pill" data="back">
          Back
        </Btn>
      </div>
    </div>
  );
}
