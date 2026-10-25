// Owner: P, F. One offer at a time: a question, a fact, two equal-size buttons, "Why this?" on request.
// Offers from this page's struggle check show Jev's numbers; offers from what WebAble learned across sites ("Make text
// larger on every site?") show what the person did, where, and how sure WebAble is, in dots.
import { useEffect, useState } from 'preact/hooks';
import { OFFER_COPY, type DimensionBelief, type Offer, type OfferKind, type PassiveFitState } from '@webable/core';
import type { EngineApi } from '../../contracts';
import { fmtP } from '../panel/format';
import { useElapsed } from '../panel/hooks';
import { IconChevron } from '../panel/icons';
import { confidenceOf, evidenceLines, isPassiveOffer, offerDim, offerFact, passivePrimary } from '../panel/learned';
import { Dots } from '../panel/WhatHelps';

const FALLBACK: Record<OfferKind, string> = {
  bigger_targets: 'Make bigger',
  steady_clicks: 'Turn on steady clicks',
  debounce: 'Ignore double clicks',
  larger_text: 'Make larger',
  explain: 'Explain',
  calm_view: 'Preview',
  main_actions: 'Show list',
  explain_field: 'Explain',
};

export function primaryLabel(o: Offer): string {
  if (isPassiveOffer(o)) return passivePrimary(o.kind);
  return OFFER_COPY?.[o.kind]?.primary ?? FALLBACK[o.kind] ?? 'Yes';
}

/** The privacy line under a learned offer's evidence. */
export const LEARNED_NOTE = 'Learned on this laptop from what you did. WebAble keeps what happened, never why.';

/** "Why this?" for an offer from what WebAble learned: the person's own actions, newest first, then how sure. */
function LearnedWhy({ offer, belief, fact }: { offer: Offer; belief: DimensionBelief | null; fact: string }) {
  const now = new Date();
  const { lines, more } = evidenceLines(belief, now, 4);
  const why = (offer.why ?? '').replace(/\s+/g, ' ').trim();
  const sure = belief ? confidenceOf(belief) : null;
  return (
    <div class="wa-offer-why" data-learned="">
      {why && why !== fact && why !== offer.question && <p>{why}</p>}
      {lines.length > 0 && (
        <ul class="wa-offer-ev" aria-label="What you did">
          {lines.map((l, i) => (
            <li key={i}>
              <span class="wa-offer-ev-what">{l.what}</span>
              {l.when && <span class="wa-offer-ev-when">{l.when}</span>}
            </li>
          ))}
          {more > 0 && <li class="wa-offer-ev-more">and {more} more</li>}
        </ul>
      )}
      {sure && (
        <div class="wa-offer-sure">
          <Dots row={sure} />
          <span>{sure.sure}</span>
        </div>
      )}
      <p class="wa-offer-why-sub">{LEARNED_NOTE}</p>
    </div>
  );
}

interface WhyParts {
  counts: string;
  privacy: string;
  jev: string;
  threshold: number;
}

/** Split the engine's "why" into the counts, the privacy note and Jev's answer, so nothing is said twice. */
export function splitWhy(why: string): WhyParts | null {
  const text = why.replace(/\s+/g, ' ').trim();
  const a = text.indexOf('WebAble counted');
  const b = text.indexOf('Jev:');
  if (a < 0 || b < a) return null;
  const t = /offers start at (\d(?:\.\d+)?)/i.exec(text);
  const threshold = t ? Number(t[1]) : 0.75;
  return {
    counts: text.slice(0, a).trim(),
    privacy: text.slice(a, b).trim(),
    jev: text
      .slice(b + 4)
      .replace(/^\s*\d(?:\.\d+)?\s*/, '')
      .replace(/\s*\(offers start at [^)]*\)\.?\s*$/i, '')
      .trim(),
    threshold: Number.isFinite(threshold) ? Math.max(0, Math.min(1, threshold)) : 0.75,
  };
}

function PBar({ p, at }: { p: number; at: number }) {
  return (
    <div class="wa-offer-p">
      <span>Jev</span>
      <span class="wa-offer-pbar" aria-hidden="true">
        <i style={{ width: `${Math.round(p * 100)}%` }} />
        <b style={{ left: `${Math.round(at * 100)}%` }} />
      </span>
      <span class="wa-num">{fmtP(p)}</span>
    </div>
  );
}

interface Props {
  api: EngineApi;
  offer: Offer;
  /** What WebAble has learned, for the "Why this?" of offers that come from it. */
  passive?: PassiveFitState | null;
  /** Called just before "Why this?" opens or closes, so the stack can keep its top edge and grow downward. */
  onWhy?: (open: boolean) => void;
}

export function OfferCard({ api, offer, passive = null, onWhy }: Props) {
  const key = `${offer.kind}|${offer.question}`;
  const [why, setWhy] = useState(false);
  const [hover, setHover] = useState(false);
  const [focusIn, setFocusIn] = useState(false);
  const [reopened, setReopened] = useState(false);
  useEffect(() => {
    setWhy(false);
    setReopened(false);
  }, [key]);
  // An ignored offer folds into a small chip after 12 s; the chip stays.
  const idle = useElapsed(key, 12_000, hover || focusIn || why || reopened);
  const collapsed = idle && !reopened;

  if (collapsed) {
    return (
      <button class="wa-offer-chip" onClick={() => setReopened(true)} aria-label={`Suggestion: ${offer.question}`}>
        <span class="wa-dot" data-state="changed" aria-hidden="true" />
        <span class="wa-offer-chip-text">{offer.question}</span>
        <IconChevron size={14} />
      </button>
    );
  }

  const learned = isPassiveOffer(offer);
  const belief = learned ? (passive?.beliefs?.[offerDim(offer.kind)] ?? null) : null;
  const fact = learned ? offerFact(offer, belief, new Date()) : offer.fact;
  const parts = !learned && offer.why ? splitWhy(offer.why) : null;
  const p = Number.isFinite(offer.p) ? Math.max(0, Math.min(1, offer.p)) : null;
  const toggleWhy = () => {
    onWhy?.(!why);
    setWhy(!why);
  };

  return (
    <div
      class="wa-offer"
      data-learned={learned ? '' : undefined}
      role="region"
      aria-label="WebAble suggestion"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusIn={() => setFocusIn(true)}
      onFocusOut={() => setFocusIn(false)}
    >
      {learned && <p class="wa-offer-kicker">From what you did</p>}
      <p class="wa-offer-q">{offer.question}</p>
      {fact && <p class="wa-offer-fact">{fact}</p>}
      <div class="wa-offer-btns">
        <button class="wa-btn wa-btn-primary" onClick={() => api.acceptOffer(offer.kind)}>
          {primaryLabel(offer)}
        </button>
        <button class="wa-btn" onClick={() => api.dismissOffer(offer.kind, false)}>
          Not now
        </button>
      </div>
      <div class="wa-offer-links">
        <button class="wa-link" aria-expanded={why} onClick={toggleWhy}>
          {why ? 'Hide why' : 'Why this?'}
        </button>
        <button class="wa-link wa-link-quiet" onClick={() => api.dismissOffer(offer.kind, true)}>
          Don't suggest this
        </button>
      </div>
      {why && learned && <LearnedWhy offer={offer} belief={belief} fact={fact} />}
      {why && !learned && (
        <div class="wa-offer-why">
          {parts ? (
            <>
              {parts.counts && <p>{parts.counts}</p>}
              {p !== null && <PBar p={p} at={parts.threshold} />}
              <p class="wa-offer-why-sub">
                {parts.jev ? `Jev's probability ${parts.jev}. ` : ''}
                Suggestions start at {fmtP(parts.threshold)}.
              </p>
              <p class="wa-offer-why-sub">{parts.privacy}</p>
            </>
          ) : (
            <>
              {offer.why && <p>{offer.why}</p>}
              {p !== null && <PBar p={p} at={0.75} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}
