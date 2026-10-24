// Owner: D2. The live Jev counter: "101 decisions · 0.31 s · $0.0018".
import type { EngineState } from '../../contracts';
import { fmtCost, fmtCount, fmtMs, fmtTokens, jevTotals } from './format';
import { useTweened } from './hooks';

export function JevCounter({ s }: { s: EngineState; reduce?: boolean }) {
  const t = jevTotals(s);
  // Numbers tick up as answers land (a changing number is not motion, so this runs with reduced motion too).
  const decisions = useTweened(t.decisions, 900, false);
  const secs = useTweened((t.headlineMs ?? 0) / 1000, 900, false);
  const cost = useTweened(t.costUsd, 900, false);
  const waiting = t.decisions === 0 && (s.phase === 'reading' || s.phase === 'tailored');
  const none = t.decisions === 0 && !waiting;

  return (
    <section class="wa-card wa-card-pad" aria-label="Jev counter">
      <h3 class="wa-card-title">
        <span>Jev on this page</span>
        <span class="wa-badge wa-badge-blue">{t.model}</span>
      </h3>
      {waiting ? (
        <div class="wa-counter" aria-live="polite">
          {['decisions', 'seconds', 'cost'].map((k) => (
            <div class="wa-counter-cell" key={k}>
              <span class="wa-shimmer" style={{ height: '1.6em', width: '70%' }} />
              <span class="wa-counter-lab">{k === 'decisions' ? 'asking Jev…' : k}</span>
            </div>
          ))}
        </div>
      ) : none ? (
        <p class="wa-empty" style={{ padding: 0 }}>
          {s.fit ? 'No Jev decisions on this page yet.' : 'Jev reads the page once a fit is saved.'}
        </p>
      ) : (
        <div class="wa-counter" aria-label={`${fmtCount(t.decisions)} decisions, ${fmtMs(t.headlineMs)}, ${fmtCost(t.costUsd)}`}>
          <div class="wa-counter-cell">
            <span class="wa-counter-val">{fmtCount(decisions)}</span>
            <span class="wa-counter-lab">decisions</span>
          </div>
          <div class="wa-counter-cell">
            <span class="wa-counter-val">{secs.toFixed(2)} s</span>
            <span class="wa-counter-lab">{t.calls > 1 ? 'page read' : 'wall time'}</span>
          </div>
          <div class="wa-counter-cell">
            <span class="wa-counter-val">{fmtCost(cost > 0 ? cost : t.costUsd)}</span>
            <span class="wa-counter-lab">cost</span>
          </div>
        </div>
      )}
      {!waiting && !none && (
        <div class="wa-counter-sub">
          <span>{fmtCount(t.calls)} {t.calls === 1 ? 'call' : 'calls'}, all questions in parallel</span>
          {t.serverMs != null && <span>server {fmtMs(t.serverMs)}</span>}
          {t.inputTokens > 0 && <span>{fmtTokens(t.inputTokens)}</span>}
          {t.cached && <span class="wa-badge">cached answers</span>}
        </div>
      )}
    </section>
  );
}
