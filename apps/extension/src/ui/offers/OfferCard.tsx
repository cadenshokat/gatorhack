// Owner: D2. One offer at a time: a question, a fact about the page, equal-size buttons, "Why this?" on request.
import { useEffect, useState } from 'preact/hooks';
import type { Offer, OfferKind } from '@webable/core';
import type { EngineApi } from '../../contracts';
import { fmtP } from '../panel/format';
import { useElapsed } from '../panel/hooks';
import { IconChevron } from '../panel/icons';

const PRIMARY: Record<OfferKind, string> = {
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
  if (o.kind === 'larger_text' && /other sites|everywhere/i.test(o.question)) return 'Use everywhere';
  return PRIMARY[o.kind] ?? 'Yes';
}

export function OfferCard({ api, offer }: { api: EngineApi; offer: Offer }) {
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

  return (
    <div
      class="wa-offer"
      role="region"
      aria-label="WebAble suggestion"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusIn={() => setFocusIn(true)}
      onFocusOut={() => setFocusIn(false)}
    >
      <p class="wa-offer-q">{offer.question}</p>
      <p class="wa-offer-fact">{offer.fact}</p>
      <div class="wa-offer-btns">
        <button class="wa-btn wa-btn-primary" onClick={() => api.acceptOffer(offer.kind)}>
          {primaryLabel(offer)}
        </button>
        <button class="wa-btn" onClick={() => api.dismissOffer(offer.kind, false)}>
          Not now
        </button>
      </div>
      <div class="wa-offer-links">
        <button class="wa-link" aria-expanded={why} onClick={() => setWhy(true)} disabled={why}>
          Why this?
        </button>
        <button class="wa-link wa-link-quiet" onClick={() => api.dismissOffer(offer.kind, true)}>
          Don't suggest this
        </button>
      </div>
      {why && (
        <div class="wa-offer-why">
          {offer.why && <p>{offer.why}</p>}
          <p>
            WebAble counted this on this device. To check the suggestion, it sent only counts like these to Jev: no
            page text and nothing you typed.
          </p>
          {Number.isFinite(offer.p) && (
            <p class="wa-offer-p">
              <span>Jev</span>
              <span class="wa-offer-pbar" aria-hidden="true">
                <i style={{ width: `${Math.round(Math.max(0, Math.min(1, offer.p)) * 100)}%` }} />
                <b style={{ left: '75%' }} />
              </span>
              <span class="wa-num">{fmtP(offer.p)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
