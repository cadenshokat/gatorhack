// Owner: A1.
import type { JevQuestion, JevResponse } from './api';

export function buildExplainCheckCall(_originalSentences: string[], _explanation: string): { state: unknown; questions: Record<string, JevQuestion> } {
  throw new Error('not implemented');
}
export function parseExplainCheck(_originalSentences: string[], _resp: JevResponse): { covered: number[]; addedFact: number; droppedFact: number } {
  throw new Error('not implemented');
}
export function numbersKept(_original: string, _explanation: string): boolean { throw new Error('not implemented'); }
export function conditionWordsKept(_original: string, _explanation: string): boolean { throw new Error('not implemented'); }
