// Owner: D2.
import type { EngineApi } from '../contracts';

export function mountUi(_api: EngineApi): () => void {
  return () => {};
}
export function isOurUi(_target: EventTarget | null): boolean {
  return false;
}
