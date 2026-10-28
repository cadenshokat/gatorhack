// One participant's session: created from the invitation, kept on the phone after every change so a reload resumes
// where it left off, and sent to the study database (remote.ts) when collection is on. A preview never leaves the phone.

import { PROTOCOL, type DeviceInfo, type SessionRecord, type TrialRecord } from '../contracts';
import { CONFIG, collectionReady } from './config';
import type { Invite } from './invite';
import { seedFromCode } from './invite';
import { enqueue, flush, remoteEnabled, setSecret, withdrawRemote } from './remote';

const KEY = (code: string) => `webable.study.session.${code}`;
const SECRET = (code: string) => `webable.study.secret.${code}`;

function uuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return crypto.randomUUID();
  const h = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function randomHex(bytes: number): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function newSession(invite: Invite): SessionRecord {
  const now = new Date().toISOString();
  return {
    v: 'study-session.1',
    protocol: PROTOCOL,
    sessionId: uuid(),
    code: invite.code,
    cohort: invite.cohort,
    sequence: invite.sequence,
    seed: seedFromCode(invite.code),
    engineCommit: CONFIG.engineCommit,
    startedAt: now,
    updatedAt: now,
    finishedAt: null,
    stage: 'welcome',
    consent: null,
    about: { ageBand: null, zoomToRead: null, tapWrong: null },
    device: null,
    calibration: null,
    trials: [],
    sus: { 1: null, 2: null },
    final: null,
    notes: [],
    withdrawn: false,
  };
}

export function loadSession(code: string): SessionRecord | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY(code)) ?? 'null') as SessionRecord | null;
    return s && s.v === 'study-session.1' && s.protocol === PROTOCOL ? s : null;
  } catch {
    return null;
  }
}

function secretFor(code: string): string {
  try {
    const have = localStorage.getItem(SECRET(code));
    if (have) return have;
    const s = randomHex(32);
    localStorage.setItem(SECRET(code), s);
    return s;
  } catch {
    return randomHex(32);
  }
}

/** Collected answers go to the database only for real invitations with every agreement detail configured. */
export function collecting(s: SessionRecord): boolean {
  return s.cohort !== 'preview' && collectionReady() && remoteEnabled();
}

/** The session row: everything except the tap logs, which travel once with their own trial row. */
function snapshot(s: SessionRecord): SessionRecord {
  return { ...s, trials: s.trials.map((t) => (t.metrics ? { ...t, metrics: { ...t.metrics, tapLog: [] } } : t)) };
}

export class SessionStore {
  readonly secret: string;
  constructor(public record: SessionRecord) {
    this.secret = secretFor(record.code);
    setSecret(this.secret);
  }

  private persist(): void {
    try {
      localStorage.setItem(KEY(this.record.code), JSON.stringify(this.record));
    } catch {
      /* storage blocked: the session still runs, it just can't resume after a reload */
    }
  }

  private send(kind: 'session' | 'trial', payload: unknown): void {
    // Nothing leaves the phone before the person agrees, or after they ask for their answers to be deleted.
    if (!this.record.consent || !collecting(this.record) || this.record.withdrawn) return;
    enqueue({
      rowId: uuid(),
      session_id: this.record.sessionId,
      code: this.record.code,
      cohort: this.record.cohort as 'pilot' | 'main',
      protocol: this.record.protocol,
      kind,
      stage: this.record.stage,
      payload,
    });
  }

  update(patch: Partial<SessionRecord>, opts: { send?: boolean } = {}): SessionRecord {
    this.record = { ...this.record, ...patch, updatedAt: new Date().toISOString() };
    this.persist();
    if (opts.send !== false) this.send('session', snapshot(this.record));
    return this.record;
  }

  addTrial(t: TrialRecord): SessionRecord {
    const trials = [...this.record.trials.filter((x) => !(x.taskId === t.taskId && x.round === t.round)), t];
    this.record = { ...this.record, trials, updatedAt: new Date().toISOString() };
    this.persist();
    this.send('trial', { sessionId: this.record.sessionId, ...t });
    this.send('session', snapshot(this.record));
    return this.record;
  }

  note(kind: string, detail?: string): void {
    this.record = { ...this.record, notes: [...this.record.notes, { at: new Date().toISOString(), kind, detail }] };
    this.persist();
  }

  setDevice(d: DeviceInfo): void {
    const prev = this.record.device;
    if (prev && (prev.userAgent !== d.userAgent || prev.screen.w !== d.screen.w || prev.screen.h !== d.screen.h)) {
      this.note('device_changed', `${prev.screen.w}x${prev.screen.h} -> ${d.screen.w}x${d.screen.h}`);
    }
    this.update({ device: prev ?? d }, { send: false });
  }

  /** Resolves true once everything is acknowledged (or nothing needs sending). */
  async flushed(): Promise<boolean> {
    if (!collecting(this.record)) return true;
    return flush();
  }

  /** Leave and delete: removes the answers here and asks the database to delete its copy. */
  async withdraw(): Promise<boolean> {
    this.record = { ...this.record, withdrawn: true, stage: 'withdrawn' };
    const ok = collecting(this.record) ? await withdrawRemote(this.record.sessionId, this.secret) : true;
    try {
      localStorage.setItem(KEY(this.record.code), JSON.stringify({ ...newSessionTombstone(this.record) }));
    } catch {
      /* fine */
    }
    return ok;
  }
}

function newSessionTombstone(s: SessionRecord): Pick<SessionRecord, 'v' | 'protocol' | 'code' | 'withdrawn' | 'stage'> {
  return { v: s.v, protocol: s.protocol, code: s.code, withdrawn: true, stage: 'withdrawn' };
}
