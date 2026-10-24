// Owner: P. One offer at a time: a question, a fact about the page, two equal-size buttons, "Why this?" on request.
import { useEffect, useState } from 'preact/hooks';
import { OFFER_COPY, type Offer, type OfferKind } from '@webable/core';
import type { EngineApi } from '../../contracts';
import { fmtP } from '../panel/format';
import { useElapsed } from '../panel/hooks';
import { IconChevron } from '../panel/icons';

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
  if (o.kind === 'larger_text' && /other sites|everywhere/i.test(o.question)) return 'Use everywhere';
  return OFFER_COPY?.[o.kind]?.primary ?? FALLBACK[o.kind] ?? 'Yes';
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
  /** Called just before "Why this?" opens or closes, so the stack can keep its top edge and grow downward. */
  onWhy?: (open: boolean) => void;
}

export function OfferCard({ api, offer, onWhy }: Props) {
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

  const parts = offer.why ? splitWhy(offer.why) : null;
  const p = Number.isFinite(offer.p) ? Math.max(0, Math.min(1, offer.p)) : null;
  const toggleWhy = () => {
    onWhy?.(!why);
    setWhy(!why);
  };

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
        <button class="wa-link" aria-expanded={why} onClick={toggleWhy}>
          {why ? 'Hide why' : 'Why this?'}
        </button>
        <button class="wa-link wa-link-quiet" onClick={() => api.dismissOffer(offer.kind, true)}>
          Don't suggest this
        </button>
      </div>
      {why && (
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
