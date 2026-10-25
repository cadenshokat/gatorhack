import { DEMO_FITS, contrastRatio, parseColor, type FitProfile } from '@webable/core';
import { describe, expect, it } from 'vitest';
import { withPolarity } from '../adjust';
import { SITE, beforeLook, withLook } from './look';
import { SAMPLE_SITES, sampleSite } from './sites';

const ratio = (fg: string | undefined, bg: string | undefined): number =>
  contrastRatio(parseColor(fg ?? '') ?? { r: 0, g: 0, b: 0, a: 1 }, parseColor(bg ?? '') ?? { r: 255, g: 255, b: 255, a: 1 });

describe('sample pages', () => {
  it('has five fictional pages, each with a believable before', () => {
    expect(SAMPLE_SITES.map((s) => s.kind)).toEqual(['news', 'class', 'pharmacy', 'bank', 'recipe']);
    const before = beforeLook(sampleSite('news'));
    expect(before.vars['--mp-body']).toBe(`${SITE.body}px`);
    expect(before.vars['--mp-ctl']).toBe('28px');
    expect(before.popup && before.ads && before.strip === 'moving').toBe(true);
  });

  it('uses the person’s own text size, contrast floor and click size', () => {
    const rosa = DEMO_FITS.rosa;
    const look = withLook(sampleSite('pharmacy'), rosa);
    expect(look.vars['--mp-body']).toBe('22px');
    expect(parseFloat(look.vars['--mp-ctl'] ?? '0')).toBeGreaterThanOrEqual(56);
    expect(ratio(look.vars['--mp-text'], look.vars['--mp-bg'])).toBeGreaterThanOrEqual(rosa.contrast.floor - 0.05);
    expect(ratio(look.vars['--mp-muted'], look.vars['--mp-bg'])).toBeGreaterThanOrEqual(rosa.contrast.floor - 0.05);
    expect(look.popup).toBe(false);
  });

  it('keeps headings the strongest text on a dark page', () => {
    const fit: FitProfile = withPolarity(DEMO_FITS.reader, 'dark');
    const look = withLook(sampleSite('news'), fit);
    const bg = look.vars['--mp-bg'];
    expect(look.dark).toBe(true);
    expect(ratio(look.vars['--mp-head'], bg)).toBeGreaterThanOrEqual(ratio(look.vars['--mp-text'], bg));
    expect(ratio(look.vars['--mp-text'], bg)).toBeGreaterThanOrEqual(fit.contrast.floor - 0.05);
  });

  it('keeps a statement’s layout and pauses its strip only when moving things are paused', () => {
    const bank = sampleSite('bank');
    expect(withLook(bank, DEMO_FITS.rosa).layout).toBe('site');
    expect(withLook(bank, DEMO_FITS.rosa).strip).toBe('paused');
    expect(withLook(bank, DEMO_FITS.typical).strip).toBe('moving');
    expect(withLook(sampleSite('recipe'), DEMO_FITS.typical).layout).toBe('simple');
  });
});
