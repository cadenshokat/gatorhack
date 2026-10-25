import { DEMO_FITS, defaultFit } from '@webable/core';
import type { FitProfile } from '@webable/core';
import { describe, expect, it } from 'vitest';
import { BUSY_FLOOR, NEED_ORDER, amountWords, bodyPxOf, buttonsValue, needValues, textValue, topHelps, topNeeds } from './needs';
import { buttonChoice, faintLevel, nextTextSize, stepText, withButtons, withFaint, withMotion, withPolarity, withSteady } from './adjust';

const value = (fit: FitProfile, id: string): number => needValues(fit).find((n) => n.id === id)?.value ?? -1;

describe('how much WebAble helps', () => {
  it('gives six values in chart order, each 0-100', () => {
    for (const fit of [DEMO_FITS.rosa, DEMO_FITS.typical, DEMO_FITS.reader]) {
      const v = needValues(fit);
      expect(v.map((n) => n.id)).toEqual([...NEED_ORDER]);
      for (const n of v) {
        expect(n.value).toBeGreaterThanOrEqual(0);
        expect(n.value).toBeLessThanOrEqual(100);
      }
    }
  });

  it('never puts busy pages below 35, and grows it with the simplified page', () => {
    expect(value(defaultFit(), 'busy')).toBe(BUSY_FLOOR);
    expect(value(DEMO_FITS.reader, 'busy')).toBeGreaterThan(BUSY_FLOOR);
    expect(value(DEMO_FITS.rosa, 'busy')).toBeGreaterThan(value(DEMO_FITS.reader, 'busy'));
  });

  it('scales text and click areas on a log scale, with nothing at the usual sizes', () => {
    expect(textValue(16)).toBe(0);
    expect(textValue(22)).toBeGreaterThan(textValue(18));
    expect(textValue(32)).toBe(100);
    expect(textValue(36)).toBe(100);
    expect(buttonsValue(null)).toBe(0);
    expect(buttonsValue(24)).toBe(0);
    expect(buttonsValue(56)).toBeGreaterThan(buttonsValue(44));
    expect(buttonsValue(96)).toBe(100);
  });

  it('reads a size the person set over the measured one', () => {
    const fit: FitProfile = { ...DEMO_FITS.rosa, text: { ...DEMO_FITS.rosa.text, bodyPx: 22, override: 27.6 } };
    expect(bodyPxOf(fit)).toBe(28);
    expect(value(fit, 'text')).toBe(textValue(28));
  });

  it('leaves steady clicks and moving things at zero when they are off', () => {
    const typical = defaultFit();
    expect(value(typical, 'steady')).toBe(0);
    expect(value(typical, 'motion')).toBe(0);
    expect(value(DEMO_FITS.rosa, 'steady')).toBeGreaterThan(70);
    expect(value(DEMO_FITS.rosa, 'motion')).toBeGreaterThan(70);
  });
});

describe('the top three help lines', () => {
  it('always include busy pages, strongest first, with the real values', () => {
    const rosa = DEMO_FITS.rosa;
    const top = topNeeds(rosa);
    expect(top).toHaveLength(3);
    expect(top.map((n) => n.id)).toEqual(['busy', 'text', 'buttons']);
    expect(top.map((n) => n.id)).toContain('busy');
    for (let i = 1; i < top.length; i++) expect(top[i]!.value).toBeLessThanOrEqual(top[i - 1]!.value);

    const reader = topHelps(DEMO_FITS.reader);
    const text = reader.find((l) => l.id === 'text');
    expect(text?.strong).toBe('24 px');
    expect(`${text?.lead}${text?.strong}${text?.tail}`).toBe('Show text at 24 px, with headings kept in proportion.');
  });

  it('puts the click-area size in the buttons line', () => {
    const fit: FitProfile = {
      ...defaultFit(),
      targets: { minPx: 72, conf: 0.6 },
    };
    const line = topHelps(fit).find((l) => l.id === 'buttons');
    expect(line?.strong).toBe('72 px');
    expect(`${line?.lead}${line?.strong}${line?.tail}`).toBe('Make buttons and links easier to hit, 72 px or larger.');
  });

  it('shows fewer, truer lines to someone who needs little', () => {
    const lines = topHelps(defaultFit());
    expect(lines.map((l) => l.id)).toEqual(['busy', 'faint']);
    expect(lines.some((l) => /\d/.test(`${l.lead}${l.strong ?? ''}`))).toBe(false);
  });

  it('describes amounts in words, never numbers', () => {
    expect(amountWords(90)).toBe('A lot');
    expect(amountWords(50)).toBe('Some');
    expect(amountWords(15)).toBe('A little');
    expect(amountWords(0)).toBe('Not needed');
  });
});

describe('adjusting settings', () => {
  it('steps text along the ladder into text.override', () => {
    const fit: FitProfile = { ...defaultFit(), text: { ...defaultFit().text, bodyPx: 21 } };
    expect(nextTextSize(fit, 1)).toBe(22);
    expect(nextTextSize(fit, -1)).toBe(20);
    const up = stepText(fit, 1);
    expect(up.text.override).toBe(22);
    expect(up.text.bodyPx).toBe(21);
    const top: FitProfile = { ...fit, text: { ...fit.text, override: 36 } };
    expect(stepText(top, 1)).toBe(top);
    // Back to the measured size clears the override.
    const at22: FitProfile = { ...defaultFit(), text: { ...defaultFit().text, bodyPx: 22, override: 24 } };
    expect(stepText(at22, -1).text.override).toBeNull();
  });

  it('moves faint text with its floor, weight and line height', () => {
    const darkest = withFaint(defaultFit(), 'darkest');
    expect(darkest.contrast).toEqual({ band: 'S', floor: 15 });
    expect(darkest.weight.floor).toBe(600);
    expect(darkest.spacing.lineHeight).toBe(1.8);
    expect(faintLevel(darkest)).toBe('darkest');
    const off = withFaint(darkest, 'off');
    expect(off.contrast).toEqual({ band: 'N', floor: 4.5 });
    expect(off.weight.floor).toBe(400);
    expect(faintLevel(withFaint(off, 'darker'))).toBe('darker');
  });

  it('sets click areas, light or dark, steady clicks and moving things', () => {
    const big = withButtons(defaultFit(), 56);
    expect(big.targets.minPx).toBe(56);
    expect(big.clicks.steady.radiusPx).toBe(11);
    expect(buttonChoice(big)).toBe(56);
    expect(withButtons(big, 'off').targets.minPx).toBeNull();
    expect(buttonChoice(withButtons(big, 'off'))).toBe('off');
    expect(withPolarity(defaultFit(), 'dark').polarity).toEqual({ value: 'dark', stated: 'dark' });
    expect(withSteady(defaultFit(), true).clicks.steady.on).toBe(true);
    expect(withMotion(defaultFit(), true).attention.motion.on).toBe(true);
    // The original is never changed.
    const base = defaultFit();
    withMotion(base, true);
    expect(base.attention.motion.on).toBe(false);
  });
});
