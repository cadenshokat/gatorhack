// Owner: F. "What helps you": what WebAble has learned about the person's needs, in their own actions, with where
// each one came from, how sure WebAble is (dots, never a percentage) and "Not right" / "Forget this" on every row.
// It sits at the top of the panel, under the text size and page width controls.
import type { JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { FitDimension } from '@webable/core';
import type { EngineApi, EngineState } from '../../contracts';
import { isMac } from './hooks';
import { IconBook, IconChevron, IconContrast, IconDrop, IconHand, IconLayout, IconPause, IconTarget, IconTextSize } from './icons';
import { feedbackNote, helpRows, type FeedbackAction, type HelpRow } from './learned';

export { FEEDBACK_NOTE, feedbackNote, type FeedbackAction } from './learned';

const ICON: Record<FitDimension, (p: { size?: number }) => JSX.Element> = {
  text_size: IconTextSize,
  contrast: IconContrast,
  targets: IconTarget,
  steady_clicks: IconHand,
  motion: IconPause,
  clutter: IconLayout,
  reading_support: IconBook,
  colors: IconDrop,
};

export function DimIcon({ dim, size = 18 }: { dim: FitDimension; size?: number }) {
  const I = ICON[dim] ?? IconLayout;
  return <I size={size} />;
}

const VERB: Record<FeedbackAction, string> = { confirm: 'Use this', not_right: 'Not right', forget: 'Forget this' };

/** The two sentences behind "How WebAble learns". */
export const HOW_IT_LEARNS: readonly [string, string] = [
  'WebAble learns the need, never the cause: it notices what a page made hard, like a zoom you kept or a click that landed beside a button, and never guesses why.',
  'It keeps only those moments and your choices, never what you type, your age or your health, and what it learns stays on this laptop.',
];

export const EMPTY_HELPS = {
  title: 'Nothing to change yet.',
  body: 'WebAble starts from your Chrome settings and learns from what you do. Zoom in on a couple of sites and it will offer larger text everywhere.',
};

export function Dots({ row }: { row: Pick<HelpRow, 'dots' | 'sure'> }) {
  return (
    <span class="wa-dots" role="img" aria-label={`How sure: ${row.sure}`} title={row.sure}>
      {[1, 2, 3, 4].map((i) => (
        <i key={i} data-on={i <= row.dots ? '' : undefined} />
      ))}
    </span>
  );
}

interface Note {
  text: string;
  row: HelpRow;
  index: number;
  at: number;
}

const NOTE_MS = 3800;

/** Each note leaves NOTE_MS after it appeared. */
export function useNoteTimer<N extends { at: number }>(
  notes: Record<string, N>,
  setNotes: (f: (cur: Record<string, N>) => Record<string, N>) => void,
): void {
  useEffect(() => {
    const list = Object.values(notes);
    if (list.length === 0) return;
    const wait = Math.min(...list.map((n) => n.at)) + NOTE_MS - Date.now();
    const t = setTimeout(() => {
      const now = Date.now();
      setNotes((cur) => Object.fromEntries(Object.entries(cur).filter(([, n]) => now - n.at < NOTE_MS)));
    }, Math.max(50, wait));
    return () => clearTimeout(t);
  }, [notes, setNotes]);
}

/** Live rows, plus any row the person just corrected that has left the list, kept in place while its note shows. */
export function withNoted(rows: HelpRow[], notes: Record<string, Note>): HelpRow[] {
  const out = rows.slice();
  const missing = Object.values(notes)
    .filter((n) => !rows.some((r) => r.dim === n.row.dim))
    .sort((a, b) => a.index - b.index);
  for (const n of missing) out.splice(Math.min(n.index, out.length), 0, n.row);
  return out;
}

/**
 * The rows. Focus never gets lost: after "Not right" the note takes focus (its buttons step aside while it shows),
 * and when the note leaves, focus goes back to the row's first button, or to `onFocusLost` if the row left too.
 */
export function HelpList({
  rows,
  notes,
  onAct,
  onFocusLost,
  compact = false,
}: {
  rows: HelpRow[];
  notes: Record<string, { text: string }>;
  onAct: (row: HelpRow, index: number, action: FeedbackAction) => void;
  onFocusLost?: () => void;
  compact?: boolean;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const focusedNote = useRef<string | null>(null);
  const prevNotes = useRef<string[]>([]);
  useLayoutEffect(() => {
    const list = listRef.current;
    const keys = Object.keys(notes);
    if (list && pendingFocus.current) {
      const el = list.querySelector<HTMLElement>(`[data-note-for="${pendingFocus.current}"]`);
      if (el) {
        el.focus({ preventScroll: true });
        focusedNote.current = pendingFocus.current;
      }
      pendingFocus.current = null;
    }
    const left = prevNotes.current.filter((d) => !keys.includes(d));
    if (list && focusedNote.current && left.includes(focusedNote.current)) {
      const btn = list.querySelector<HTMLElement>(`.wa-help[data-dim="${focusedNote.current}"] .wa-mini`);
      focusedNote.current = null;
      if (btn) btn.focus({ preventScroll: true });
      else onFocusLost?.();
    }
    prevNotes.current = keys;
  });
  return (
    <ul class="wa-helps-list" ref={listRef} data-compact={compact ? '' : undefined}>
      {rows.map((row, i) => {
        const note = notes[row.dim];
        const actions: FeedbackAction[] = [
          ...(row.canConfirm ? (['confirm'] as const) : []),
          ...(row.canNotRight ? (['not_right'] as const) : []),
          ...(row.canForget ? (['forget'] as const) : []),
        ];
        const textId = `wa-help-${row.dim}`;
        return (
          <li key={row.dim} class="wa-help" data-status={row.status} data-dim={row.dim} data-noted={note ? '' : undefined}>
            <span class="wa-help-icon" aria-hidden="true">
              <DimIcon dim={row.dim} />
            </span>
            <div class="wa-help-main">
              {row.status !== 'on' && <span class="wa-help-status">{row.statusLabel}</span>}
              <p class="wa-help-text" id={textId}>
                <span class="wa-sr">{row.label}: </span>
                {row.sentence}
              </p>
              <div class="wa-help-meta">
                <span class="wa-chip" data-source={row.source}>
                  {row.chip}
                </span>
                <Dots row={row} />
                {row.value && !row.sentence.includes(row.value) && <span class="wa-help-val">{row.value}</span>}
              </div>
              {note ? (
                <p
                  class="wa-help-note"
                  role="status"
                  tabIndex={-1}
                  data-note-for={row.dim}
                  onFocusOut={(e) => {
                    if (e.relatedTarget) focusedNote.current = null;
                  }}
                >
                  {note.text}
                </p>
              ) : (
                actions.length > 0 && (
                  <div class="wa-help-acts" role="group" aria-label={row.label}>
                    {actions.map((a) => (
                      <button
                        key={a}
                        class="wa-mini"
                        data-kind={a}
                        aria-describedby={textId}
                        onClick={() => {
                          pendingFocus.current = row.dim;
                          onAct(row, i, a);
                        }}
                      >
                        {VERB[a]}
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function HowItLearns({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div class="wa-learns">
      <button class="wa-disclose" aria-expanded={open} onClick={onToggle}>
        <span class="wa-disclose-chev" aria-hidden="true">
          <IconChevron size={14} />
        </span>
        How WebAble learns
      </button>
      {open && (
        <div class="wa-learns-body">
          <p>{HOW_IT_LEARNS[0]}</p>
          <p>{HOW_IT_LEARNS[1]}</p>
        </div>
      )}
    </div>
  );
}

export function WhatHelps({ api, s }: { api: EngineApi; s: EngineState }) {
  const [notes, setNotes] = useState<Record<string, Note>>({});
  const [open, setOpen] = useState(false);
  const headRef = useRef<HTMLHeadingElement>(null);
  const passive = s.passive ?? null;
  useNoteTimer(notes, setNotes);

  if (!passive) return null;
  const rows = withNoted(helpRows(passive, new Date(), isMac()), notes);
  const on = rows.filter((r) => r.status === 'on').length;
  const maybe = rows.length - on;

  const act = (row: HelpRow, index: number, action: FeedbackAction) => {
    try {
      api.passiveFeedback(row.dim, action);
    } catch (e) {
      console.warn('[WebAble] feedback did not reach the engine', e);
    }
    setNotes((cur) => ({ ...cur, [row.dim]: { text: feedbackNote(row, action), row, index, at: Date.now() } }));
  };

  return (
    <section class="wa-card wa-helps" aria-labelledby="wa-helps-title">
      <div class="wa-helps-head">
        <h3 class="wa-helps-title" id="wa-helps-title" ref={headRef} tabIndex={-1}>
          What helps you
        </h3>
        {rows.length > 0 && (
          <span class="wa-helps-count">
            {on > 0 ? `${on} on` : ''}
            {on > 0 && maybe > 0 ? ' · ' : ''}
            {maybe > 0 ? `${maybe} suggested` : ''}
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <div class="wa-helps-empty">
          <p class="wa-helps-empty-title">{EMPTY_HELPS.title}</p>
          <p>{EMPTY_HELPS.body}</p>
        </div>
      ) : (
        <HelpList rows={rows} notes={notes} onAct={act} onFocusLost={() => headRef.current?.focus({ preventScroll: true })} />
      )}
      <HowItLearns open={open} onToggle={() => setOpen(!open)} />
    </section>
  );
}
