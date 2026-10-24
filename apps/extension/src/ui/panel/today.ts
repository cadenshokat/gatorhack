// Owner: P. "Today, new answers only": the day's Jev answers across pages, kept in chrome.storage.local under
// `todayMeter` (the popup reads the same key). Answers replayed from the server's cache are not counted again.
import { useEffect, useState } from 'preact/hooks';
import type { JevMetrics } from '@webable/core';
import type { EngineState } from '../../contracts';

export const TODAY_KEY = 'todayMeter';
export interface TodayMeter {
  day: string;
  decisions: number;
  usd: number;
  pages: number;
}

function dayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function store(): chrome.storage.StorageArea | null {
  try {
    return typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null;
  } catch {
    return null;
  }
}

async function read(): Promise<TodayMeter> {
  const fresh: TodayMeter = { day: dayKey(), decisions: 0, usd: 0, pages: 0 };
  const a = store();
  if (!a) return fresh;
  try {
    const got = await a.get(TODAY_KEY);
    const v = got[TODAY_KEY] as Partial<TodayMeter> | undefined;
    if (!v || v.day !== fresh.day) return fresh;
    return { day: fresh.day, decisions: Number(v.decisions) || 0, usd: Number(v.usd) || 0, pages: Number(v.pages) || 0 };
  } catch {
    return fresh;
  }
}

let queue: Promise<void> = Promise.resolve();
function add(decisions: number, usd: number, page: boolean): Promise<void> {
  queue = queue
    .then(async () => {
      const a = store();
      if (!a) return;
      const cur = await read();
      try {
        await a.set({
          [TODAY_KEY]: { day: cur.day, decisions: cur.decisions + decisions, usd: cur.usd + usd, pages: cur.pages + (page ? 1 : 0) },
        });
      } catch {
        /* storage unavailable: the meter stays as it was */
      }
    })
    .catch(() => {});
  return queue;
}

/** Every Jev metrics object for this page that came from a live answer (not replayed from cache). */
function liveMetrics(s: EngineState): Array<{ m: JevMetrics; page: boolean }> {
  const out: Array<{ m: JevMetrics; page: boolean }> = [];
  const seen = new Set<JevMetrics>();
  const push = (m: JevMetrics | null | undefined, page = false) => {
    if (!m || typeof m !== 'object' || seen.has(m)) return;
    seen.add(m);
    out.push({ m, page });
  };
  if (s.understanding && !s.understanding.cached) push(s.understanding.metrics, true);
  for (const j of s.struggle.history) push(j?.metrics);
  push(s.struggle.latest?.metrics);
  push(s.calm.redesign?.judge);
  push(s.calm.visual?.metrics);
  push(s.explain.result?.jev);
  return out;
}

const counted = new WeakSet<JevMetrics>();

/** Adds each new live Jev answer once, and returns the running total for today (all pages). */
export function useTodayMeter(s: EngineState): TodayMeter | null {
  const [meter, setMeter] = useState<TodayMeter | null>(null);
  const fresh = liveMetrics(s).filter((x) => !counted.has(x.m));
  const key = fresh.length;
  useEffect(() => {
    let alive = true;
    void (async () => {
      let d = 0;
      let usd = 0;
      let page = false;
      for (const { m, page: p } of fresh) {
        counted.add(m);
        d += Number(m.questions) || 0;
        usd += Number(m.costUsd) || 0;
        page = page || p;
      }
      if (d > 0 || usd > 0) await add(d, usd, page);
      const v = await read();
      if (alive) setMeter(v);
    })();
    return () => {
      alive = false;
    };
    // `fresh` is recomputed from the state on every render; its length says when to add.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, s.understanding]);
  return meter;
}
