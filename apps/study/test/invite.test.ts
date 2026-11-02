import { describe, expect, it } from 'vitest';
import { openInvite, parseInvite, wantsOpenSession } from '../src/store/invite';

describe('the plain study link', () => {
  it('starts a real session only on the deployed site, and never when a preview is asked for', () => {
    expect(wantsOpenSession('', true)).toBe(true);
    expect(wantsOpenSession('', false)).toBe(false);
    expect(wantsOpenSession('?preview', true)).toBe(false);
    expect(wantsOpenSession('?preview=1', true)).toBe(false);
    expect(wantsOpenSession('?seq=2', true)).toBe(false);
    expect(wantsOpenSession('?fit=rosa&seq=1', true)).toBe(false);
    expect(wantsOpenSession('?sequence=2', true)).toBe(true);
  });

  it('gives a code the database accepts, an order from 0 to 3, and the main cohort', () => {
    for (const r of [0, 0.25, 0.5, 0.999]) {
      const inv = openInvite(() => r);
      expect(inv.code).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
      expect(inv.sequence).toBe(Math.floor(r * 4));
      expect(inv.cohort).toBe('main');
      // The same shape as an invitation link's code.
      expect(parseInvite(`#i=${inv.code}.${inv.sequence}.m`)).toEqual(inv);
    }
  });
});
