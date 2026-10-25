// Owner: C, D. What every part of the Calm view needs: the engine, the fit's structure limits and the proxy actions.
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { EngineApi } from '../../contracts';
import type { PageKind } from './plan';

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
  /** The stepped form's current step (0-based) and how to move between steps. */
  step: number;
  goStep(i: number): void;
  /** Open "More on this page" and bring it into view. */
  showDrawer(): void;
  /** Bumps each time showDrawer() is called (the drawer opens itself on change). */
  drawerCall: number;
  /** The page's error summary, drawn at the top of the form (not again inside it). */
  errorEl: Element | null;
  /** What kind of page this is (article, news index, form, product, portal, page). */
  kind: PageKind;
  /** The text column in the view's px (a figure at least 1.4 × as wide goes to the picture column). */
  textCol: number;
  /** A search results page (Google, Bing, a site's own search): results are a plain list, not cards. */
  results?: boolean;
}

/** A results page by its address (the layout may not say so): a search engine's, or a site's own /search?q=… page. */
export function isResultsUrl(u: URL | Location = location): boolean {
  const host = u.hostname.replace(/^www\./, '');
  const engine = /^(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com|search\.brave\.com|ecosia\.org)$/i.test(host);
  if (engine) return /^\/(search|html|web)?\/?$/i.test(u.pathname) && /[?&](q|p)=/.test(u.search);
  return /(^|\/)search(\/|$)/i.test(u.pathname) && /[?&](q|query|search|term|keywords?)=[^&]/i.test(u.search);
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
