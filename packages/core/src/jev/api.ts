// Jev System One API types (POST https://api.typesafe.ai/v1/systemone). Owner: A1.
import type { JevMetrics } from '../types';

export type JevEntry = string | Record<string, unknown> | unknown[] | null;

export type JevQuestion =
  | { type: 'noul'; instructions: JevEntry; criteria?: { true: JevEntry; false: JevEntry } }
  | { type: 'choice'; instructions: JevEntry; criteria: Record<string, JevEntry> }
  | { type: 'score'; instructions: JevEntry; criteria: JevEntry[] }
  | { type: 'box'; instructions: JevEntry };

export interface JevRequestBody {
  model: string;
  state: unknown;
  questions: Record<string, JevQuestion>;
  assets?: Record<string, unknown>;
}

export type JevAnswer =
  | { type: 'noul'; noul: number }
  | { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: 'score'; score: number; legend: Record<string, unknown>; probabilities: Record<string, number>; confidence: number }
  | { type: 'box'; box: { top: number; bottom: number; left: number; right: number }; confidence: number };

export interface JevResponse {
  model: string;
  answers: Record<string, JevAnswer>;
  usage: { input_tokens: number; output_tokens: number };
}

export function metricsFrom(
  _responses: Array<{ body: JevResponse; wallMs: number; serverMs: number | null; questions: number }>,
): JevMetrics {
  throw new Error('not implemented');
}
