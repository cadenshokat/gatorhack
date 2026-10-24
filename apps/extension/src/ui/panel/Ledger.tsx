// Owner: D2. "What changed": the engine's ledger in plain sentences, newest first, with per-change Undo.
import { useState } from 'preact/hooks';
import type { LedgerEntry, OpRecord } from '@webable/core';
import type { EngineApi, EngineState } from '../../contracts';
import { fmtP, fmtSince } from './format';
import { IconCheck, IconDiamond, IconHand, IconLayout, IconPulse, IconShield, IconSliders, IconText, IconUndo, IconWarn } from './icons';

const SOURCE_LABEL: Record<LedgerEntry['source'], string> = {
  fit: 'from your fit',
  jev: 'Jev',
  check: 'self-check',
  signals: 'signals',
  layout: 'layout',
  explain: 'explain',
  person: 'you',
};

function EntryIcon({ e }: { e: LedgerEntry }) {
  const s = 15;
  if (e.action === 'reversed') return <IconWarn size={s} />;
  if (e.action === 'protected') return <IconShield size={s} />;
  switch (e.source) {
    case 'fit':
      return <IconSliders size={s} />;
    case 'jev':
      return <IconDiamond size={s} />;
    case 'check':
      return <IconCheck size={s} />;
    case 'signals':
      return <IconPulse size={s} />;
    case 'layout':
      return <IconLayout size={s} />;
    case 'explain':
      return <IconText size={s} />;
    case 'person':
    default:
      return <IconHand size={s} />;
  }
}

function actionBadge(e: LedgerEntry, op: OpRecord | undefined) {
  if (op?.status === 'reversed' && e.action !== 'reversed') return <span class="wa-badge">reversed</span>;
  switch (e.action) {
    case 'reversed':
      return <span class="wa-badge wa-badge-warn">reversed</span>;
    case 'protected':
      return <span class="wa-badge wa-badge-accent">protected</span>;
    case 'offered':
      return <span class="wa-badge">offered</span>;
    case 'waiting':
      return <span class="wa-badge">waiting</span>;
    case 'skipped':
      return <span class="wa-badge">skipped</span>;
    case 'kept':
      return <span class="wa-badge">kept</span>;
    default:
      return null;
  }
}

const PAGE = 14;

export function Ledger({ api, s }: { api: EngineApi; s: EngineState }) {
  const [limit, setLimit] = useState(PAGE);
  const ops = new Map(s.ops.map((o) => [o.id, o]));
  const entries = [...s.ledger].reverse();
  const shown = entries.slice(0, limit);
  const applied = s.ops.filter((o) => o.status === 'applied').length;
  const reversed = s.ops.filter((o) => o.status === 'reversed').length;

  return (
    <section class="wa-card" aria-label="What changed">
      <h3 class="wa-card-title wa-card-title-inset">
        <span>What changed</span>
        <span>
          {applied} on{reversed > 0 ? ` · ${reversed} reversed` : ''}
        </span>
      </h3>
      {shown.length === 0 ? (
        <p class="wa-empty">Nothing changed yet.</p>
      ) : (
        <ul class="wa-ledger">
          {shown.map((e, i) => {
            const op = e.opId ? ops.get(e.opId) : undefined;
            const canUndo = Boolean(op && op.status === 'applied' && e.action !== 'reversed');
            return (
              <li class="wa-entry" key={`${e.at}-${i}`} data-source={e.source} data-action={e.action ?? ''}>
                <span class="wa-entry-icon" aria-hidden="true">
                  <EntryIcon e={e} />
                </span>
                <div class="wa-entry-main">
                  <div class="wa-entry-title">{e.title}</div>
                  {e.detail && <div class="wa-entry-detail">{e.detail}</div>}
                  <div class="wa-entry-meta">
                    <span>{SOURCE_LABEL[e.source] ?? e.source}</span>
                    {typeof e.p === 'number' && <span class="wa-badge wa-badge-blue wa-num">p {fmtP(e.p)}</span>}
                    {actionBadge(e, op)}
                    <span class="wa-num">{fmtSince(e.at)}</span>
                  </div>
                </div>
                <div class="wa-entry-side">
                  {canUndo && op && (
                    <button class="wa-btn wa-btn-sm" onClick={() => api.undoOp(op.id)} aria-label={`Undo: ${e.title}`}>
                      <IconUndo size={14} />
                      Undo
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {entries.length > limit && (
        <div class="wa-more">
          <button class="wa-link" onClick={() => setLimit(limit + PAGE * 2)}>
            Show {Math.min(PAGE * 2, entries.length - limit)} more
          </button>
        </div>
      )}
    </section>
  );
}
