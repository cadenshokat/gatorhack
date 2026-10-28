import { describe, expect, it } from 'vitest';
import type { DeliveryRecord, TrialRecord } from '../src/contracts';
import { debriefFor } from '../src/experiment/debrief';
import { eligible, screened } from '../src/experiment/eligibility';

describe('who the study is for', () => {
  it('takes people aged 50 or over with at least one kind of trouble', () => {
    expect(eligible('50-64', ['finding'])).toBe(true);
    expect(eligible('85+', ['getting_around', 'understanding'])).toBe(true);
  });

  it('stops people under 50, people with no trouble, and unanswered questions', () => {
    expect(eligible('under_50', ['finding'])).toBe(false);
    expect(eligible('65-74', [])).toBe(false);
    expect(eligible(null, ['finding'])).toBe(false);
    expect(eligible('65-74', null)).toBe(false);
  });

  it('keeps the answers with the rest of what we know about the person', () => {
    const about = screened({ ageBand: null, zoomToRead: 'often', tapWrong: null }, '75-84', ['understanding']);
    expect(about).toEqual({ ageBand: '75-84', zoomToRead: 'often', tapWrong: null, troubles: ['understanding'] });
  });
});

function trial(family: TrialRecord['family'], delivery: Partial<DeliveryRecord>): TrialRecord {
  return {
    family,
    condition: 'adapted',
    delivery: {
      textScale: 1,
      bodyPxBefore: 16,
      bodyPxAfter: 16,
      simplified: { open: false, auto: false },
      ops: [],
      ...delivery,
    },
  } as unknown as TrialRecord;
}

describe('the thank-you page', () => {
  it('puts each change under the warm-up or the AI, by the source the engine logged', () => {
    const d = debriefFor([
      trial('gov', {
        textScale: 1.5,
        ops: [
          { kind: 'targets', status: 'applied', source: 'fit' },
          { kind: 'unobstruct', status: 'applied', source: 'jev' },
          { kind: 'contrast', status: 'reversed', source: 'fit' },
        ],
      }),
      trial('news', { simplified: { open: true, auto: true } }),
    ]);
    expect(d.warmup).toEqual(['made the text bigger', 'made buttons and links bigger']);
    expect(d.ai).toEqual([
      'moved boxes that covered the website out of the way',
      'showed a simpler version of the news story',
    ]);
  });

  it('lists a change under whoever decided it, and leaves out what a safety check decided', () => {
    const d = debriefFor([
      trial('sports', {
        ops: [
          { kind: 'targets', status: 'applied', source: 'jev' },
          { kind: 'spacing', status: 'applied', source: 'check' },
        ],
      }),
    ]);
    expect(d.warmup).toEqual([]);
    expect(d.ai).toEqual(['made buttons and links bigger']);
  });

  it('leaves out changes to a website the simplified page covered', () => {
    const d = debriefFor([
      trial('news', { simplified: { open: true, auto: true }, ops: [{ kind: 'dim', status: 'applied', source: 'jev' }] }),
    ]);
    expect(d.ai).toEqual(['showed a simpler version of the news story']);
  });

  it('ignores the original round', () => {
    const t = { ...trial('gov', { textScale: 2 }), condition: 'original' } as TrialRecord;
    expect(debriefFor([t])).toEqual({ warmup: [], ai: [] });
  });
});
