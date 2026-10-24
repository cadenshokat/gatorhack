// Owner: C1. Typed messaging from the content script to the background worker.
import type { BgRequest } from '@webable/core';

export function ask<T>(_req: BgRequest, _timeoutMs = 15000): Promise<T> {
  throw new Error('not implemented');
}
