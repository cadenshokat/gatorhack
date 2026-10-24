// Owner: D2. Struggle gauges (pointing, reading, finding) with the 0.50–0.75 waiting band drawn.
import { useRef } from 'preact/hooks';
import type { StruggleKind } from '@webable/core';
import type { EngineState } from '../../contracts';
import { fmtCost, fmtMs, fmtP } from './format';
import { IconWarn } from './icons';

const OFFER_AT = 0.75;
const WAIT_AT = 0.5;

interface GaugeDef {
  key: 'pointing' | 'reading' | 'finding';
  name: string;
  kinds: StruggleKind[];
}

const GAUGES: GaugeDef[] = [
  { key: 'pointing', name: 'Pointing', kinds: ['pointing', 'slipping', 'accidental_repeat'] },
  { key: 'reading', name: 'Reading', kinds: ['reading', 'dense_text'] },
  { key: 'finding', name: 'Finding', kinds: ['finding', 'form'] },
];

type Band = 'low' | 'wait' | 'offer';
function band(v: number): Band {
  return v >= OFFER_AT ? 'offer' : v >= WAIT_AT ? 'wait' : 'low';
}

function n(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}

export function Gauges({ s }: { s: EngineState }) {
  const latest = s.struggle.latest;
  const kinds = latest?.kinds;
  const prev = useRef<Record<string, number>>({});
  const lastLatest = useRef<typeof latest>(null);
  const ghosts = useRef<Record<string, number | null>>({});

  const values: Record<string, number> = {};
  for (const g of GAUGES) values[g.key] = kinds ? Math.max(...g.kinds.map((k) => n(kinds[k]))) : 0;
  if (latest !== lastLatest.current) {
    // A new window landed: the previous values become the faint "was" markers.
    ghosts.current = lastLatest.current ? { ...prev.current } : {};
    prev.current = { ...values };
    lastLatest.current = latest;
  }

  const site = kinds ? n(kinds.site_fault) : 0;
  const deliberate = kinds ? n(kinds.deliberate) : 0;
  const offerKinds = new Set(s.struggle.offers.map((o) => o.kind));

  return (
    <section class="wa-card wa-card-pad" aria-label="Click and reading signals">
      <h3 class="wa-card-title">
        <span>Click and reading signals</span>
        <span>{s.struggle.history.length > 0 ? `${s.struggle.history.length} checked` : 'not checked yet'}</span>
      </h3>
      <div class="wa-gauges">
        {GAUGES.map((g) => {
          const v = values[g.key] ?? 0;
          const b = band(v);
          const waiting = g.kinds.some((k) => s.struggle.waiting.includes(k));
          const offered =
            (g.key === 'pointing' && (offerKinds.has('bigger_targets') || offerKinds.has('steady_clicks') || offerKinds.has('debounce'))) ||
            (g.key === 'reading' && (offerKinds.has('larger_text') || offerKinds.has('explain'))) ||
            (g.key === 'finding' && (offerKinds.has('calm_view') || offerKinds.has('main_actions') || offerKinds.has('explain_field')));
          const state = !latest
            ? 'waiting for signals'
            : offered
              ? 'offered'
              : waiting || b === 'wait'
                ? 'waiting for more'
                : b === 'offer'
                  ? 'above the bar'
                  : 'low';
          const ghost = ghosts.current[g.key];
          return (
            <div class="wa-gauge" key={g.key}>
              <div class="wa-gauge-head">
                <span class="wa-gauge-name">{g.name}</span>
                <span class="wa-gauge-state" data-band={offered || b === 'offer' ? 'offer' : waiting || b === 'wait' ? 'wait' : 'low'}>
                  {state}
                </span>
                <span class="wa-gauge-val">{latest ? fmtP(v) : '–'}</span>
              </div>
              <div
                class="wa-gtrack"
                role="meter"
                aria-label={`${g.name} signal`}
                aria-valuemin={0}
                aria-valuemax={1}
                aria-valuenow={Number(v.toFixed(2))}
                aria-valuetext={`${fmtP(v)}, ${state}`}
              >
                <span class="wa-gband wa-gband-wait" />
                <span class="wa-gband wa-gband-offer" />
                <span class="wa-gfill" data-band={b} style={{ width: `${Math.max(v * 100, latest ? 2 : 0)}%` }} />
                {ghost != null && Math.abs(ghost - v) > 0.02 && <span class="wa-gghost" style={{ left: `${ghost * 100}%` }} />}
                <span class="wa-gtick" style={{ left: `${OFFER_AT * 100}%` }} />
              </div>
            </div>
          );
        })}
        <div class="wa-gscale" aria-hidden="true">
          <span style={{ left: '25%' }}>leave</span>
          <span style={{ left: '62.5%' }}>wait 0.50–0.75</span>
          <span style={{ left: '87.5%' }}>offer</span>
        </div>
      </div>
      {site >= 0.7 && (
        <p class="wa-note">
          <IconWarn size={15} />
          <span>Clicks reached the page but it did not respond (site {fmtP(site)}). No change made: this looks like the page, not the clicks.</span>
        </p>
      )}
      {site < 0.7 && deliberate >= 0.4 && (
        <p class="wa-note">
          <span>Clicks look deliberate ({fmtP(deliberate)}), so nothing is offered for pointing.</span>
        </p>
      )}
      <p class="wa-note">
        <span>
          Counted on this device. Jev sees counts only, never page text or anything typed.
          {latest?.metrics ? ` Last check ${fmtMs(latest.metrics.wallMs)}, ${fmtCost(latest.metrics.costUsd)}.` : ''}
        </span>
      </p>
    </section>
  );
}
