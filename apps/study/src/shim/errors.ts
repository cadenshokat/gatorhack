// Errors the study background throws, and the reply envelope they become: the same shapes as
// apps/extension/entrypoints/background.ts (BgError, toReply), so bus.ts raises the same BusError codes.

import type { BusErrorCode, BusReply } from '../../../extension/src/engine/bus';

export class StudyBgError extends Error {
  readonly code: BusErrorCode;
  readonly status: number | null;
  constructor(code: BusErrorCode, message: string, status: number | null = null) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function toReply(err: unknown): BusReply {
  if (err instanceof StudyBgError) return { ok: false, code: err.code, error: err.message, status: err.status };
  const msg = err instanceof Error ? err.message : String(err);
  return { ok: false, code: 'network', error: msg };
}
