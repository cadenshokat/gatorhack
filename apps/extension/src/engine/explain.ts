// Owner: C2. "Explain this": plain language beside the original (research-redesign.md §10, research-engineering.md §14).
//
// Only on an explicit request. The passage is redacted here with core `redactText` (the server redacts again and
// refuses anything `stillSensitive`). Personal details the redactor replaced are put back locally, for display
// only, so the person reads their own numbers and names while the model never saw them.

import { redactText, stillSensitive, type ExplainResult } from '@webable/core';
import { ask, BusError } from './bus';
import { wordCount } from './signals';

/** research-redesign.md §10.3: the passage limit is 2,000 characters. */
export const EXPLAIN_MAX_CHARS = 2000;
export const EXPLAIN_MIN_WORDS = 3;
const EXPLAIN_TIMEOUT_MS = 25_000;

export type ExplainRefusal = 'sensitive_page' | 'excluded_site' | 'empty' | 'too_long' | 'personal_details' | 'no_answer';

/** Plain copy for each refusal: about the page and the text, never about the person. */
export const EXPLAIN_MESSAGES: Record<ExplainRefusal, string> = {
  sensitive_page: 'Explain is off on pages with password or payment fields.',
  excluded_site: 'Explain is off on mail, chat and banking sites.',
  empty: 'Select a sentence or a paragraph to explain.',
  too_long: 'This passage is too long to explain at once. Select up to about 300 words.',
  personal_details: 'This passage has personal details that could not be removed, so it was not sent.',
  no_answer: 'The explanation could not be made right now. The original text is unchanged.',
};

export class ExplainError extends Error {
  readonly code: ExplainRefusal;
  constructor(code: ExplainRefusal, message: string = EXPLAIN_MESSAGES[code]) {
    super(message);
    this.name = 'ExplainError';
    this.code = code;
  }
}

/** Webmail, chat, banking and patient-portal hosts (research-engineering.md §14 policy gates). */
const EXCLUDED_HOSTS: RegExp[] = [
  /^mail\.google\.com$/, /(^|\.)outlook\.(live|office|office365)\.com$/, /^mail\.yahoo\.com$/, /^mail\.proton\.me$/,
  /^(www\.)?icloud\.com$/, /^mail\.aol\.com$/, /^web\.whatsapp\.com$/, /(^|\.)messenger\.com$/, /^app\.slack\.com$/,
  /^(www\.)?discord\.com$/, /^web\.telegram\.org$/, /^teams\.(microsoft|live)\.com$/, /^messages\.google\.com$/,
  /(^|\.)chase\.com$/, /(^|\.)bankofamerica\.com$/, /(^|\.)wellsfargo\.com$/, /(^|\.)citi\.com$/,
  /(^|\.)capitalone\.com$/, /(^|\.)usbank\.com$/, /(^|\.)pnc\.com$/, /(^|\.)tdbank\.com$/, /(^|\.)ally\.com$/,
  /(^|\.)americanexpress\.com$/, /(^|\.)discover\.com$/, /(^|\.)schwab\.com$/, /(^|\.)fidelity\.com$/,
  /(^|\.)vanguard\.com$/, /(^|\.)paypal\.com$/, /(^|\.)venmo\.com$/, /(^|\.)bank$/, /(^|\.)mychart\./,
];

export function isExcludedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return EXCLUDED_HOSTS.some((re) => re.test(h));
}

/** Collapse whitespace and drop zero-width characters. */
export function normalizePassage(text: string): string {
  return String(text ?? '').replace(/[​-‍⁠﻿]/g, '').replace(/\s+/g, ' ').trim();
}

/** Why this passage must not be sent, or null when it may be. Pure. */
export function explainBlockReason(passage: string, sensitive: boolean, hostname: string): ExplainRefusal | null {
  if (sensitive) return 'sensitive_page';
  if (isExcludedHost(hostname)) return 'excluded_site';
  if (wordCount(passage) < EXPLAIN_MIN_WORDS) return 'empty';
  if (passage.length > EXPLAIN_MAX_CHARS) return 'too_long';
  return null;
}

function cleanKind(kind: string): string {
  const k = String(kind ?? '').toLowerCase().replace(/[^a-z _-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  return k || 'web page';
}

function isExplainResult(x: unknown): x is ExplainResult {
  if (!x || typeof x !== 'object') return false;
  const r = x as Partial<ExplainResult>;
  return typeof r.ok === 'boolean' && (typeof r.explanation === 'string' || r.explanation === null) &&
    Array.isArray(r.sentences) && Array.isArray(r.showOriginalInstead) && !!r.checks && typeof r.checks === 'object';
}

/**
 * Explain a passage the person selected. Throws ExplainError (with a plain `message` for the card) when the
 * passage may not be sent, and the bus's BusError when the server cannot be reached.
 */
export async function requestExplain(text: string, pageKind: string, sensitive: boolean): Promise<ExplainResult> {
  const passage = normalizePassage(text);
  let host = '';
  try { host = location.hostname; } catch { /* not in a page */ }
  const block = explainBlockReason(passage, sensitive, host);
  if (block) throw new ExplainError(block);
  const redacted = redactText(passage);
  if (stillSensitive(redacted)) throw new ExplainError('personal_details');
  let res: unknown;
  try {
    res = await ask<ExplainResult>({ type: 'explain', req: { passage: redacted, pageKind: cleanKind(pageKind) } }, EXPLAIN_TIMEOUT_MS);
  } catch (err) {
    if (err instanceof BusError && (err.code === 'refused' || err.status === 422)) throw new ExplainError('personal_details');
    throw err;
  }
  if (!isExplainResult(res)) throw new ExplainError('no_answer');
  return restoreFromAnswer(res, passage, redacted);
}

/**
 * Put personal details back, aligning the original with the text the model actually saw. The server redacts once
 * more and says what it sent (`passage`); a second pass can replace words the first one kept ("Florida's" became
 * "[name]'s"), so aligning with our own redaction alone would leave those placeholders on screen. Falls back to our
 * own redaction when the server's text cannot be aligned. Pure.
 */
export function restoreFromAnswer(res: ExplainResult, original: string, redacted: string): ExplainResult {
  const sent = (res as ExplainResult & { passage?: unknown }).passage;
  if (typeof sent === 'string' && sent && sent !== redacted) {
    const spans = alignRedaction(original, sent);
    if (spans && spans.length) return restoreExplainResult(res, original, sent);
  }
  return restoreExplainResult(res, original, redacted);
}

/* ------------------------------------------------------------------ */
/* Local restoration of redacted details (display only)               */
/* ------------------------------------------------------------------ */

const PLACEHOLDER = /\[[a-z]+(?: [a-z]+)*\]/g;
const WORD = /[\p{L}\p{N}]+/gu;

export interface RedactionSpan {
  token: string; // '[phone number]'
  value: string; // the original text it replaced
  at: number; // index of the token in the redacted passage
  left: string; // the word before it (lower case), for matching in the explanation
  right: string; // the word after it
}

function lastWord(s: string): string {
  const m = s.match(WORD);
  return m ? (m[m.length - 1] ?? '').toLowerCase() : '';
}

function firstWord(s: string): string {
  WORD.lastIndex = 0;
  const m = WORD.exec(s);
  WORD.lastIndex = 0;
  return m ? m[0].toLowerCase() : '';
}

function plausible(token: string, value: string): boolean {
  if (value === token) return true;
  if (value.length > 160 || value.trim().length === 0) return false;
  const t = token.slice(1, -1);
  if (/number|amount|dose|phone|card|account|rx|\bid\b/.test(t)) return /\d/.test(value);
  if (t === 'email' || t === 'handle') return value.includes('@');
  if (t === 'link') return /[./]/.test(value);
  if (t === 'date') return /\d|[A-Za-z]{3}/.test(value);
  if (t === 'address') return /\d|box/i.test(value);
  if (t === 'name' || t === 'medication') return /[A-Za-z]/.test(value);
  return true;
}

/** Curly quotes and apostrophes to straight ones (one character for one). */
function foldQuotes(s: string): string {
  return s.replace(/[‘’‚‛ʼ′]/g, "'").replace(/[“”„‟″]/g, '"');
}

/**
 * Map each placeholder in `redacted` back to the text it replaced in `original`, or null when the two cannot be
 * aligned with certainty (then nothing is restored). Pure.
 */
export function alignRedaction(originalText: string, redactedText: string): RedactionSpan[] | null {
  if (originalText === redactedText) return [];
  // Curly and straight quotes compare equal (redaction may write "[name]'s" for "Florida’s"). The fold maps one
  // character to one, so positions in the folded original are positions in the real one.
  const original = foldQuotes(originalText);
  const redacted = foldQuotes(redactedText);
  const toks: Array<{ token: string; at: number }> = [];
  const lits: string[] = [];
  let last = 0;
  for (const m of redacted.matchAll(PLACEHOLDER)) {
    const at = m.index ?? 0;
    lits.push(redacted.slice(last, at));
    toks.push({ token: m[0], at });
    last = at + m[0].length;
  }
  lits.push(redacted.slice(last));
  if (toks.length === 0) return null;
  const first = lits[0] ?? '';
  if (!original.startsWith(first)) return null;
  let pos = first.length;
  const spans: RedactionSpan[] = [];
  for (let i = 0; i < toks.length; i++) {
    const tk = toks[i];
    const lit = lits[i + 1] ?? '';
    if (!tk) return null;
    let end: number;
    if (i === toks.length - 1) {
      if (!original.endsWith(lit)) return null;
      end = original.length - lit.length;
    } else {
      if (lit.length === 0) return null; // two placeholders side by side cannot be split safely
      end = original.indexOf(lit, pos + 1);
    }
    if (end <= pos) return null;
    const value = originalText.slice(pos, end);
    if (!plausible(tk.token, value)) return null;
    spans.push({
      token: tk.token,
      value,
      at: tk.at,
      left: lastWord(redacted.slice(0, tk.at)),
      right: firstWord(redacted.slice(tk.at + tk.token.length)),
    });
    pos = end + lit.length;
  }
  return pos === original.length ? spans : null;
}

/**
 * Put details back into text the model wrote. A placeholder is restored only when that is unambiguous: every
 * replaced value of its kind is the same, or exactly one of them shares its neighbouring words. Otherwise the
 * placeholder stays. Pure.
 */
export function restoreByContext(text: string, spans: readonly RedactionSpan[]): string {
  if (!spans.length) return text;
  const byToken = new Map<string, RedactionSpan[]>();
  for (const s of spans) byToken.set(s.token, [...(byToken.get(s.token) ?? []), s]);
  return text.replace(PLACEHOLDER, (tok: string, offset: number) => {
    const cands = byToken.get(tok);
    if (!cands?.length) return tok;
    const values = new Set(cands.map((c) => c.value));
    if (values.size === 1) return cands[0]?.value ?? tok;
    const left = lastWord(text.slice(0, offset));
    const right = firstWord(text.slice(offset + tok.length));
    let best: RedactionSpan | null = null;
    let bestScore = 0;
    let tie = false;
    for (const c of cands) {
      const score = (left && c.left === left ? 1 : 0) + (right && c.right === right ? 1 : 0);
      if (score > bestScore) {
        best = c;
        bestScore = score;
        tie = false;
      } else if (score === bestScore && score > 0 && best && c.value !== best.value) {
        tie = true;
      }
    }
    return best && bestScore > 0 && !tie ? best.value : tok;
  });
}

/** Put details back into a sentence that was cut from the redacted passage (exact, by position). Pure. */
export function restoreSpan(text: string, redacted: string, spans: readonly RedactionSpan[]): string {
  if (!spans.length) return text;
  const idx = redacted.indexOf(text);
  if (idx < 0) return restoreByContext(text, spans);
  let out = '';
  let pos = 0;
  for (const s of spans) {
    const rel = s.at - idx;
    if (rel < pos || rel + s.token.length > text.length) continue;
    if (text.slice(rel, rel + s.token.length) !== s.token) continue;
    out += text.slice(pos, rel) + s.value;
    pos = rel + s.token.length;
  }
  return out + text.slice(pos);
}

/** The result with personal details restored for display. The flags and scores are untouched. Pure. */
export function restoreExplainResult(res: ExplainResult, original: string, redacted: string): ExplainResult {
  const spans = alignRedaction(original, redacted);
  if (!spans || spans.length === 0) return res;
  return {
    ...res,
    explanation: res.explanation === null ? null : restoreByContext(res.explanation, spans),
    sentences: res.sentences.map((s) => ({ ...s, original: restoreSpan(s.original, redacted, spans) })),
    showOriginalInstead: res.showOriginalInstead.map((s) => restoreSpan(s, redacted, spans)),
  };
}
