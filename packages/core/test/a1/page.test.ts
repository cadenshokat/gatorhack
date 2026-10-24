import { describe, expect, it } from 'vitest';
import type { ElementEvidence, PageDigest } from '../../src/types';
import {
  JEV_CAUTION, HELP_CRITERIA, MAIN_CRITERIA, MAX_ELEMENTS_PER_CALL, NONE_OPTION, Q_MAIN, Q_ROLE, Q_TASK, ROLE_CRITERIA,
  TASK_CRITERIA, buildPageCalls, parsePageAnswers,
} from '../../src/jev/page';
import { JEV_MAX_CHOICE_OPTIONS, emptyJevMetrics, metricsFrom } from '../../src/jev/api';
import type { JevAnswer, JevQuestion } from '../../src/jev/api';
import { ALDERRA, choice, noul, response } from './fixtures';

function bigDigest(n: number): PageDigest {
  const base = ALDERRA.elements[8]!;
  const elements: ElementEvidence[] = Array.from({ length: n }, (_, i) => ({ ...base, id: `n${i + 1}`, label: `Item ${i + 1}` }));
  return { ...ALDERRA, elements, mainCandidates: elements.slice(0, 35).map((e) => e.id) };
}

const criteriaOf = (q: JevQuestion): string => JSON.stringify('criteria' in q ? q.criteria : null);

describe('buildPageCalls (design B)', () => {
  it('puts each element in its own questions, 4 per element, <= 25 elements per call', () => {
    const calls = buildPageCalls(ALDERRA);
    expect(calls).toHaveLength(2);
    for (const c of calls) {
      expect(c.elementIds.length).toBeLessThanOrEqual(MAX_ELEMENTS_PER_CALL);
      for (const id of c.elementIds) {
        for (const k of ['role', 'task', 'main', 'help']) {
          const q = c.questions[`${id}__${k}`]!;
          expect(q, `${id}__${k}`).toBeDefined();
          const ins = q.instructions as Record<string, unknown>;
          expect(Object.keys(ins).slice(0, 2)).toEqual(['question', 'element']);
          expect((ins.element as Record<string, unknown>).id).toBe(id);
        }
      }
      // the shared state holds page context only
      expect(Object.keys(c.state as object)).toEqual(['page']);
    }
    const ids = calls.flatMap((c) => c.elementIds);
    expect(new Set(ids).size).toBe(ALDERRA.elements.length);
  });

  it('splits 40 elements into balanced calls of 20', () => {
    const calls = buildPageCalls(bigDigest(40));
    expect(calls.map((c) => c.elementIds.length)).toEqual([20, 20]);
    expect(calls.map((c) => Object.keys(c.questions).length)).toEqual([81, 80]);
  });

  it('asks main_pick once, in the first call, over full evidence objects plus none, <= 255 options', () => {
    const calls = buildPageCalls(bigDigest(40));
    expect(calls[0]!.questions.main_pick).toBeDefined();
    expect(calls[1]!.questions.main_pick).toBeUndefined();
    const pick = calls[0]!.questions.main_pick!;
    expect(pick.type).toBe('choice');
    const crit = (pick as Extract<JevQuestion, { type: 'choice' }>).criteria;
    const keys = Object.keys(crit);
    expect(keys.length).toBeLessThanOrEqual(JEV_MAX_CHOICE_OPTIONS);
    expect(keys.length).toBe(31); // 30 candidates + none
    expect(keys[keys.length - 1]).toBe('none');
    expect(crit.none).toBe(NONE_OPTION);
    const n1 = crit.n1 as Record<string, unknown>;
    expect(Object.keys(n1).slice(0, 11)).toEqual([
      'id', 'tag', 'role_hint', 'label', 'zone', 'landmark', 'size', 'position', 'fixed', 'class_words', 'visual_weight',
    ]);
  });

  it('includes the escape option in every role Choice and keeps criteria byte-stable', () => {
    const a = buildPageCalls(ALDERRA);
    const b = buildPageCalls(bigDigest(12));
    const roleA = a[0]!.questions.n1__role!;
    const roleB = b[0]!.questions.n7__role!;
    expect(Object.keys((roleA as Extract<JevQuestion, { type: 'choice' }>).criteria)).toContain('other');
    expect(criteriaOf(roleA)).toBe(criteriaOf(roleB));
    expect(criteriaOf(roleA)).toBe(JSON.stringify(ROLE_CRITERIA));
    expect(criteriaOf(a[0]!.questions.n2__task!)).toBe(JSON.stringify(TASK_CRITERIA));
    expect(criteriaOf(a[1]!.questions.n20__main!)).toBe(JSON.stringify(MAIN_CRITERIA));
    expect(criteriaOf(b[0]!.questions.n3__help!)).toBe(JSON.stringify(HELP_CRITERIA));
    expect((roleA.instructions as Record<string, unknown>).question).toBe(Q_ROLE);
    expect((a[0]!.questions.n2__task!.instructions as Record<string, unknown>).question).toBe(Q_TASK);
    expect((a[0]!.questions.n2__main!.instructions as Record<string, unknown>).question).toBe(Q_MAIN);
  });

  it('uses the measured wording for the task Noul', () => {
    expect(Q_TASK).toBe(
      'Is the element described in `element` part of the main job of the page described in `page`: content the visitor reads for that job, or a field, button or step they use to do it?',
    );
  });

  it('adds the caution field on pages with ad iframes or off-site links, unless turned off', () => {
    const on = buildPageCalls(ALDERRA);
    expect((on[0]!.questions.n1__role!.instructions as Record<string, unknown>).caution).toBe(JEV_CAUTION);
    const off = buildPageCalls(ALDERRA, { caution: false });
    expect((off[0]!.questions.n1__role!.instructions as Record<string, unknown>).caution).toBeUndefined();
    const plain = buildPageCalls(bigDigest(5));
    expect((plain[0]!.questions.n1__role!.instructions as Record<string, unknown>).caution).toBeUndefined();
  });

  it('redacts labels and the page title again before they go to Jev', () => {
    const calls = buildPageCalls(ALDERRA);
    const all = JSON.stringify(calls);
    expect(all).not.toContain('555-0147');
    expect(all).not.toContain('Atorvastatin');
    expect(all).not.toContain('6214');
    expect(all).toContain('[phone number]');
    expect(all).toContain('[medication]');
  });
});

describe('parsePageAnswers', () => {
  it('builds typed judgments and leaves out elements with a missing answer', () => {
    const calls = buildPageCalls(ALDERRA);
    const responses = calls.map((c, ci) => {
      const answers: Record<string, JevAnswer> = {};
      for (const id of c.elementIds) {
        if (id === 'n2') continue; // simulate a missing element
        answers[`${id}__role`] = choice({ advertising: 0.97, main_content: 0.03 });
        answers[`${id}__task`] = noul(0.02);
        answers[`${id}__main`] = noul(0.01);
        answers[`${id}__help`] = noul(0.01);
      }
      if (ci === 0) answers.main_pick = choice({ n19: 0.98, n26: 0.01, none: 0.01 });
      return response(answers, 20_000);
    });
    const m = metricsFrom(responses.map((body) => ({ body, wallMs: 300, serverMs: 200, questions: 50 })));
    const u = parsePageAnswers(ALDERRA, calls, responses, m);
    expect(u.elements).toHaveLength(ALDERRA.elements.length - 1);
    expect(u.elements.find((e) => e.id === 'n2')).toBeUndefined();
    const n1 = u.elements.find((e) => e.id === 'n1')!;
    expect(n1).toMatchObject({ role: 'advertising', roleP: 0.97, task: 0.02, main: 0.01, help: 0.01 });
    expect(u.mainPick).toEqual({ id: 'n19', p: 0.98, probs: { n19: 0.98, n26: 0.01, none: 0.01 } });
    expect(u.cached).toBe(false);
    expect(u.metrics.inputTokens).toBe(40_000);
  });

  it('fails closed when a call has no response', () => {
    const calls = buildPageCalls(ALDERRA);
    const u = parsePageAnswers(ALDERRA, calls, [], emptyJevMetrics());
    expect(u.elements).toEqual([]);
    expect(u.mainPick.id).toBe('none');
  });
});

describe('metricsFrom', () => {
  it('adds tokens and questions, takes the slowest parallel call, prices input tokens', () => {
    const m = metricsFrom([
      { body: response({}, 30_000), wallMs: 250, serverMs: 180, questions: 61 },
      { body: response({}, 12_500), wallMs: 300.4, serverMs: null, questions: 40 },
    ]);
    expect(m).toMatchObject({ model: 'jev-1.14.0', calls: 2, questions: 101, inputTokens: 42_500, wallMs: 300, serverMs: 180 });
    expect(m.costUsd).toBeCloseTo(0.001785, 6);
  });
});
