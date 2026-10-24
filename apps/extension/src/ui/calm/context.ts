// Owner: D1. What every part of the Calm view needs: the engine, the fit's structure limits and the proxy actions.
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { EngineApi } from '../../contracts';

export interface CalmCtx {
  api: EngineApi;
  /** Split paragraphs longer than this many sentences (Infinity: never). */
  splitN: number;
  /** Records per group in grouped lists. */
  groupSize: number;
  explainOn: boolean;
  reduceMotion: boolean;
  /** Press an original control (buttons, links, clickable divs). */
  click(el: Element): void;
  /** Press the page's primary action (watches for what the page shows next). */
  pressPrimary(el: Element): void;
  /** "Use it on the page": close the view, scroll to the original and focus it. */
  peek(el: Element): void;
}

export const Calm = createContext<CalmCtx | null>(null);

export function useCalm(): CalmCtx {
  const c = useContext(Calm);
  if (!c) throw new Error('Calm view context missing');
  return c;
}

const IRREVERSIBLE = /\b(buy|pay|purchase|place (?:your |my )?order|order now|confirm|send|delete|remove|submit|book now|transfer|donate|check ?out|sign up|subscribe)\b/i;

/** Actions that cannot be taken back ask for a second press (research-engineering §11.1). */
export function isIrreversible(label: string): boolean {
  return IRREVERSIBLE.test(label);
}
