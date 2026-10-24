// Screen 0: welcome, and the ways in (full fitting, a 30-second fit, listening, a demo fit, skip).

import type { FitProfile } from '@webable/core';
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { Btn, Deck, Heading } from '../ui/common';

export type DemoName = 'rosa' | 'typical' | 'reader';

const DEMOS: Array<{ name: DemoName; title: string; line: string }> = [
  { name: 'rosa', title: 'Rosa', line: 'Larger text, bigger click areas, steady clicks, calmer pages.' },
  { name: 'typical', title: 'Typical', line: 'WebAble’s starting point. Changes very little.' },
  { name: 'reader', title: 'Reader', line: 'Very large text and the strongest contrast.' },
];

function Hero(): JSX.Element {
  return (
    <svg class="fx-hero" viewBox="0 0 280 150" role="img" aria-label="Letters growing above a tailor's ruler">
      <text x="22" y="92" class="fx-hero-a1">Aa</text>
      <text x="80" y="92" class="fx-hero-a2">Aa</text>
      <text x="158" y="92" class="fx-hero-a3">Aa</text>
      <line x1="18" x2="262" y1="118" y2="118" class="fx-hero-rule" />
      {Array.from({ length: 21 }, (_, i) => (
        <line x1={18 + i * 12.2} x2={18 + i * 12.2} y1={i % 5 === 0 ? 108 : 112} y2="118" class="fx-hero-tick" />
      ))}
      <circle cx="204" cy="118" r="7" class="fx-hero-dot" />
    </svg>
  );
}

function PartIcon(props: { kind: 'reading' | 'pointing' | 'finding' }): JSX.Element {
  if (props.kind === 'reading') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true" class="fx-part-icon">
        <text x="3" y="24" class="fx-icon-text">Aa</text>
      </svg>
    );
  }
  if (props.kind === 'pointing') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true" class="fx-part-icon">
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
          return <circle cx={16 + 10 * Math.cos(a)} cy={16 + 10 * Math.sin(a)} r={i === 0 ? 3.6 : 2.6} class={i === 0 ? 'fill' : 'ring'} />;
        })}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" class="fx-part-icon">
      <rect x="4" y="6" width="10" height="7" rx="2" class="ring" />
      <rect x="18" y="6" width="10" height="7" rx="2" class="ring" />
      <rect x="4" y="17" width="10" height="7" rx="2" class="fill" />
      <rect x="18" y="17" width="10" height="7" rx="2" class="ring" />
    </svg>
  );
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'earlier';
  }
}

export function Welcome(props: {
  existing: FitProfile | null;
  onStart: (mode: 'full' | 'quick' | 'listen') => void;
  onSkipAll: () => void;
  onDemo: (name: DemoName) => void;
}): JSX.Element {
  const [showDemos, setShowDemos] = useState(false);
  return (
    <div class="fx-welcome">
      <Hero />
      <Heading class="fx-h1-hero">Let’s fit the web to you.</Heading>
      <Deck>3 short parts, about 2 minutes. There’s no right or wrong. Skip anything.</Deck>

      <ol class="fx-parts fade-in" aria-label="The three parts">
        <li>
          <PartIcon kind="reading" />
          <div>
            <strong>Reading</strong>
            <span>Find a text size that’s easy to read.</span>
          </div>
        </li>
        <li>
          <PartIcon kind="pointing" />
          <div>
            <strong>Pointing</strong>
            <span>Click a few dots at your usual pace.</span>
          </div>
        </li>
        <li>
          <PartIcon kind="finding" />
          <div>
            <strong>Finding</strong>
            <span>Spot a link on a few made-up pages.</span>
          </div>
        </li>
      </ol>

      <div class="fx-row fx-row-center fade-in">
        <Btn kind="primary" onClick={() => props.onStart('full')} class="fx-btn-wide">
          Start
        </Btn>
        <Btn kind="tonal" onClick={props.onSkipAll} class="fx-btn-wide">
          Skip for now
        </Btn>
      </div>

      <p class="fx-privacy fade-in">
        Your answers stay on this computer. WebAble keeps only your fit.
        {props.existing ? ` You already have a fit from ${fmtDate(props.existing.createdAt)}; it changes only if you save a new one.` : ''}
      </p>

      <div class="fx-more fade-in" role="group" aria-label="Other ways to start">
        <Btn kind="plain" onClick={() => props.onStart('quick')}>
          30-second fit
        </Btn>
        <Btn kind="plain" onClick={() => props.onStart('listen')}>
          Skip the visual parts
        </Btn>
        <Btn kind="plain" onClick={() => setShowDemos((v) => !v)} pressed={showDemos}>
          Use a demo fit
        </Btn>
      </div>

      {showDemos ? (
        <div class="fx-demos fade-in" role="group" aria-label="Demo fits">
          {DEMOS.map((d) => (
            <button type="button" class="fx-demo" onClick={() => props.onDemo(d.name)}>
              <strong>{d.title}</strong>
              <span>{d.line}</span>
            </button>
          ))}
          <p class="fx-demo-note">Rosa is a sample person made up for demos.</p>
        </div>
      ) : null}
    </div>
  );
}

const POINTERS: Array<{ id: 'mouse' | 'trackpad' | 'touch' | 'other' | 'keyboard'; label: string; line: string }> = [
  { id: 'mouse', label: 'Mouse', line: 'A mouse or trackball' },
  { id: 'trackpad', label: 'Trackpad', line: 'A laptop touchpad' },
  { id: 'touch', label: 'Touch screen', line: 'Fingers on the screen' },
  { id: 'other', label: 'Another pointer', line: 'Pen, head or eye pointer' },
  { id: 'keyboard', label: 'Keyboard, switch or voice', line: 'No pointing needed' },
];

function PointerIcon(props: { id: string }): JSX.Element {
  const p = { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;
  switch (props.id) {
    case 'mouse':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <rect x="9" y="4" width="14" height="24" rx="7" {...p} />
          <line x1="16" y1="8" x2="16" y2="13" {...p} />
        </svg>
      );
    case 'trackpad':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <rect x="4" y="7" width="24" height="18" rx="3" {...p} />
          <line x1="4" y1="20" x2="28" y2="20" {...p} />
          <line x1="16" y1="20" x2="16" y2="25" {...p} />
        </svg>
      );
    case 'touch':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <rect x="9" y="3" width="14" height="26" rx="3" {...p} />
          <circle cx="16" cy="16" r="3.2" {...p} />
        </svg>
      );
    case 'other':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M8 24 L20 12 L23 15 L11 27 L7 28 Z" {...p} />
          <line x1="18" y1="14" x2="21" y2="17" {...p} />
          <path d="M22 6 l4 4" {...p} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <rect x="3" y="9" width="26" height="15" rx="3" {...p} />
          <line x1="8" y1="14" x2="9" y2="14" {...p} />
          <line x1="13" y1="14" x2="14" y2="14" {...p} />
          <line x1="18" y1="14" x2="19" y2="14" {...p} />
          <line x1="23" y1="14" x2="24" y2="14" {...p} />
          <line x1="10" y1="19" x2="22" y2="19" {...p} />
        </svg>
      );
  }
}

export function PointerChoice(props: {
  suggested: 'mouse' | 'touch';
  onPick: (id: 'mouse' | 'trackpad' | 'touch' | 'other' | 'keyboard') => void;
}): JSX.Element {
  return (
    <div>
      <Heading>How do you usually point?</Heading>
      <Deck>This sets the size of the dots in the pointing part.</Deck>
      <div class="fx-choices fade-in" role="group" aria-label="How you point">
        {POINTERS.map((p) => (
          <button
            type="button"
            class={`fx-choice ${p.id === props.suggested ? 'is-suggested' : ''}`}
            onClick={() => props.onPick(p.id)}
          >
            <span class="fx-choice-icon">
              <PointerIcon id={p.id} />
            </span>
            <span class="fx-choice-text">
              <strong>{p.label}</strong>
              <span>{p.line}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
