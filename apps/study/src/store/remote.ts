// Sends answers to the study database (Supabase, apps/study/supabase/). The table takes inserts only: the public key
// can add rows but never read, change or delete them. Each save is one row: a 'session' snapshot (everything but the
// per-task tap logs) or one 'trial'. Rows wait in an outbox kept on the phone and are retried until the database
// acknowledges them, so a dropped connection loses nothing and "saved" is only said after it is true.

import { CONFIG } from './config';

export interface OutRow {
  /** Unique per row, so a retry after a lost reply is recognisable in the data. */
  rowId: string;
  session_id: string;
  code: string;
  cohort: 'pilot' | 'main';
  protocol: string;
  kind: 'session' | 'trial';
  stage: string;
  payload: unknown;
}

const OUTBOX = 'webable.study.outbox';
const TABLE = 'gatorhack_study_rows';

let busy = false;
let timer = 0;
const listeners = new Set<(pending: number) => void>();

function readOutbox(): OutRow[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX) ?? '[]') as OutRow[];
  } catch {
    return [];
  }
}

function writeOutbox(rows: OutRow[]): void {
  try {
    localStorage.setItem(OUTBOX, JSON.stringify(rows));
  } catch {
    /* storage full or blocked: the rows stay in memory for this page */
    memory = rows;
  }
}

let memory: OutRow[] | null = null;
const outbox = (): OutRow[] => memory ?? readOutbox();

export function remoteEnabled(): boolean {
  return !!(CONFIG.supabaseUrl && CONFIG.supabaseKey && globalThis.crypto?.subtle);
}

export function pending(): number {
  return outbox().length;
}

export function onPending(fn: (n: number) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(): void {
  const n = pending();
  listeners.forEach((l) => l(n));
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Queue a row and try to send everything waiting. A newer 'session' snapshot replaces an unsent older one. */
export function enqueue(row: OutRow): void {
  if (!remoteEnabled()) return;
  const rows = outbox().filter((r) => !(row.kind === 'session' && r.kind === 'session' && r.session_id === row.session_id));
  rows.push(row);
  writeOutbox(rows);
  emit();
  void flush();
}

/** Send waiting rows in order. Resolves true when nothing is left. */
export async function flush(): Promise<boolean> {
  if (!remoteEnabled()) return true;
  if (busy) return pending() === 0;
  busy = true;
  window.clearTimeout(timer);
  try {
    let rows = outbox();
    while (rows.length) {
      const row = rows[0]!;
      const ok = await post(row);
      if (!ok) {
        // Retry with a gentle backoff; nothing is dropped.
        timer = window.setTimeout(() => void flush(), 4000);
        return false;
      }
      rows = outbox().filter((r) => r.rowId !== row.rowId);
      writeOutbox(rows);
      emit();
    }
    return true;
  } finally {
    busy = false;
  }
}

let sessionSecret = '';

export function setSecret(secret: string): void {
  sessionSecret = secret;
}

async function post(row: OutRow): Promise<boolean> {
  if (!sessionSecret) return false;
  try {
    const res = await fetch(`${CONFIG.supabaseUrl}/rest/v1/${TABLE}`, {
      method: 'POST',
      keepalive: JSON.stringify(row.payload).length < 60_000,
      headers: {
        apikey: CONFIG.supabaseKey!,
        Authorization: `Bearer ${CONFIG.supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        row_id: row.rowId,
        session_id: row.session_id,
        code: row.code,
        cohort: row.cohort,
        protocol: row.protocol,
        kind: row.kind,
        stage: row.stage,
        secret_hash: await sha256Hex(sessionSecret),
        payload: row.payload,
      }),
    });
    // 409: this row id is already stored (an earlier reply was lost). That counts as saved.
    return res.ok || res.status === 409;
  } catch {
    return false;
  }
}

/** Deletes every stored row of this session and leaves a tombstone. Resolves true when the database confirmed it. */
export async function withdrawRemote(sessionId: string, secret: string): Promise<boolean> {
  if (!remoteEnabled()) return true;
  writeOutbox(outbox().filter((r) => r.session_id !== sessionId));
  emit();
  try {
    const res = await fetch(`${CONFIG.supabaseUrl}/rest/v1/rpc/gatorhack_study_withdraw`, {
      method: 'POST',
      headers: {
        apikey: CONFIG.supabaseKey!,
        Authorization: `Bearer ${CONFIG.supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_session: sessionId, p_secret: secret }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
