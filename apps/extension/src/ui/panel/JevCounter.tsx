// Owner: P. The live Jev counter. Its headline is the page read ("187 decisions · 0.69 s · $0.0034") from the same
// jevTotals() the Lens header uses, so the two always agree; every other Jev answer since load is counted under it.
import type { EngineState } from '../../contracts';
import { fmtCacheNote, fmtCost, fmtCount, fmtMs, fmtSinceLoad, fmtTokens, jevTotals } from './format';
import { useTweened } from './hooks';
import type { TodayMeter } from './today';

export function JevCounter({ s, today }: { s: EngineState; reduce?: boolean; today?: TodayMeter | null }) {
  const t = jevTotals(s);
  const has = Boolean(s.understanding) && t.decisions > 0;
  // Numbers tick up as answers land (a changing number is not motion, so this runs with reduced motion too).
  const decisions = useTweened(t.decisions, 900, false);
  const secs = useTweened((t.headlineMs ?? 0) / 1000, 900, false);
  const cost = useTweened(t.cached ? t.viewUsd : t.costUsd, 900, false);
  const waiting = !has && (s.phase === 'reading' || s.phase === 'tailored');
  const cacheNote = has ? fmtCacheNote(t) : null;
  const since = has ? fmtSinceLoad(t) : null;
  const shownCost = t.cached ? t.viewUsd : t.costUsd;

  return (
    <section class="wa-card wa-card-pad" aria-label="Jev on this page">
      <h3 class="wa-card-title">
        <span>Page read by Jev</span>
        <span class="wa-badge wa-badge-blue">{t.model}</span>
      </h3>
      {waiting ? (
        <div class="wa-counter" aria-live="polite">
          {['decisions', 'page read', 'cost'].map((k) => (
            <div class="wa-counter-cell" key={k}>
              <span class="wa-shimmer" style={{ height: '1.6em', width: '70%' }} />
              <span class="wa-counter-lab">{k === 'decisions' ? 'asking Jev…' : k}</span>
            </div>
          ))}
        </div>
      ) : !has ? (
        <p class="wa-empty" style={{ padding: 0 }}>
          {s.fit ? 'Jev has not read this page yet.' : 'Jev reads the page once a fit is saved.'}
        </p>
      ) : (
        <div
          class="wa-counter"
          aria-label={`Page read: ${fmtCount(t.decisions)} decisions, ${fmtMs(t.headlineMs)}, ${t.cached ? 'from cache, $0 for this view' : fmtCost(t.costUsd)}`}
        >
          <div class="wa-counter-cell">
            <span class="wa-counter-val">{fmtCount(decisions)}</span>
            <span class="wa-counter-lab">decisions</span>
          </div>
          <div class="wa-counter-cell">
            <span class="wa-counter-val">{secs.toFixed(2)} s</span>
            <span class="wa-counter-lab">{t.cached ? 'first read' : 'page read'}</span>
          </div>
          <div class="wa-counter-cell">
            <span class="wa-counter-val">{shownCost > 0 ? fmtCost(cost > 0 ? cost : shownCost) : '$0'}</span>
            <span class="wa-counter-lab">{t.cached ? 'this view' : 'cost'}</span>
          </div>
        </div>
      )}
      {has && (
        <div class="wa-counter-sub">
          {cacheNote ? (
            <span class="wa-counter-cache">{cacheNote}</span>
          ) : (
            <>
              <span>
                {fmtCount(t.calls)} {t.calls === 1 ? 'call' : 'calls'} in parallel
              </span>
              {t.serverMs != null && <span>server {fmtMs(t.serverMs)}</span>}
              {t.inputTokens > 0 && <span>{fmtTokens(t.inputTokens)}</span>}
            </>
          )}
        </div>
      )}
      {(since || (today && today.decisions > 0)) && (
        <div class="wa-counter-foot">
          {since && <span>{since}</span>}
          {today && today.decisions > 0 && (
            <span>
              Today, new answers only: <b class="wa-num">{fmtCount(today.decisions)}</b> · {fmtCost(today.usd)}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
