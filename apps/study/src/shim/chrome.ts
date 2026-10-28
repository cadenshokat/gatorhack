// A stand-in for the two chrome.* seams the engine and UI use (engine-seams §6.2): runtime.{id, sendMessage} and
// storage.{local, session, onChanged}. bus.ts runs unchanged on top of it. Storage lives in memory: one store per
// realm, so per trial (each trial is a fresh iframe). Values are copied with structuredClone on the way in and out,
// the way Chrome serialises them, so the engine can never change a stored value by reference.

import type { BusEnvelope, BusReply, ExtRequest } from '../../../extension/src/engine/bus';
import { toReply } from './errors';

type Change = { oldValue?: unknown; newValue?: unknown };
type Listener = (changes: Record<string, Change>, area: string) => void;
type Keys = string | string[] | Record<string, unknown> | null | undefined;

export interface MemoryArea {
  get(keys?: Keys): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  clear(): Promise<void>;
  setAccessLevel(): Promise<void>;
  /** Study only: a copy of everything stored (for tests and the dev host). */
  dump(): Record<string, unknown>;
}

export interface ChromeShim {
  runtime: { id: string; sendMessage(msg: unknown): Promise<BusReply> };
  storage: {
    local: MemoryArea;
    session: MemoryArea;
    onChanged: { addListener(l: Listener): void; removeListener(l: Listener): void; hasListener(l: Listener): boolean };
  };
}

const copy = <T>(v: T): T => (v === undefined ? v : structuredClone(v));

function isEnvelope(msg: unknown): msg is BusEnvelope {
  return !!msg && typeof msg === 'object' && (msg as { __wa?: unknown }).__wa === 1
    && typeof (msg as { req?: { type?: unknown } }).req?.type === 'string';
}

export function createChromeShim(handle: (req: ExtRequest) => Promise<unknown>): ChromeShim {
  const listeners = new Set<Listener>();

  const area = (name: 'local' | 'session'): MemoryArea => {
    const m = new Map<string, unknown>();
    const pick = (k: Keys): string[] =>
      k == null ? [...m.keys()] : typeof k === 'string' ? [k] : Array.isArray(k) ? k : Object.keys(k);
    const announce = (changes: Record<string, Change>) => {
      if (!Object.keys(changes).length) return;
      queueMicrotask(() => {
        for (const l of [...listeners]) {
          try {
            l(changes, name);
          } catch {
            /* a listener's own failure is its own */
          }
        }
      });
    };
    return {
      async get(keys) {
        const out: Record<string, unknown> = {};
        // An object argument gives defaults for keys that are not stored, as Chrome does.
        const defaults = keys && typeof keys === 'object' && !Array.isArray(keys) ? keys : null;
        for (const key of pick(keys)) {
          if (m.has(key)) out[key] = copy(m.get(key));
          else if (defaults && key in defaults) out[key] = copy(defaults[key]);
        }
        return out;
      },
      async set(items) {
        const changes: Record<string, Change> = {};
        for (const [k, v] of Object.entries(items ?? {})) {
          if (v === undefined) continue;
          const next = copy(v);
          changes[k] = { oldValue: copy(m.get(k)), newValue: copy(next) };
          m.set(k, next);
        }
        announce(changes);
      },
      async remove(keys) {
        const changes: Record<string, Change> = {};
        for (const k of typeof keys === 'string' ? [keys] : keys) {
          if (!m.has(k)) continue;
          changes[k] = { oldValue: copy(m.get(k)) };
          m.delete(k);
        }
        announce(changes);
      },
      async clear() {
        const changes: Record<string, Change> = {};
        for (const [k, v] of m) changes[k] = { oldValue: copy(v) };
        m.clear();
        announce(changes);
      },
      async setAccessLevel() {},
      dump() {
        return Object.fromEntries([...m].map(([k, v]) => [k, copy(v)]));
      },
    };
  };

  return {
    runtime: {
      // bus.ts only checks that the id is truthy.
      id: 'webable-study',
      async sendMessage(msg: unknown): Promise<BusReply> {
        if (!isEnvelope(msg)) return { ok: false, code: 'bad_response', error: 'Not a WebAble request' };
        try {
          return { ok: true, data: (await handle(msg.req)) ?? null };
        } catch (err) {
          return toReply(err);
        }
      },
    },
    storage: {
      local: area('local'),
      session: area('session'),
      onChanged: {
        addListener: (l) => void listeners.add(l),
        removeListener: (l) => void listeners.delete(l),
        hasListener: (l) => listeners.has(l),
      },
    },
  };
}

/** Puts the stand-in on globalThis.chrome (before the engine is imported) and returns it. */
export function installChromeShim(handle: (req: ExtRequest) => Promise<unknown>): ChromeShim {
  const shim = createChromeShim(handle);
  try {
    (globalThis as { chrome?: unknown }).chrome = shim;
  } catch {
    Object.defineProperty(globalThis, 'chrome', { value: shim, configurable: true, writable: true });
  }
  return shim;
}
