import { DEMO_FITS, defaultFit } from '@webable/core';
import { describe, expect, it } from 'vitest';
import { PETAL_EXPLAIN, PETAL_LABEL, benefitLine, copy } from './copy';
import { threeLines, READ_LINES } from './lines';
import { NEED_IDS } from '../logic/needs';

describe('onboarding copy', () => {
  it('names the eight petals in plain words, in chart order', () => {
    expect(NEED_IDS.map((id) => PETAL_LABEL[id])).toEqual([
      'Small text',
      'Faint text',
      'Small buttons',
      'Steady clicking',
      'Moving things',
      'Busy pages',
      'Long reading',
      'Telling colours apart',
    ]);
    expect(PETAL_EXPLAIN.small_text).toBe('How much larger text makes reading easier for you.');
    expect(PETAL_EXPLAIN.telling_colours).toContain('label or pattern');
  });

  it('keeps the five section names and the results lines ready to swap', () => {
    expect(copy.sections.read.name).toBe('Reading size');
    expect(copy.sections.faint.name).toBe('Faint words');
    expect(copy.sections.bubbles.name).toBe('Pop the bubbles');
    expect(copy.sections.find.name).toBe('Find it');
    expect(copy.sections.colours.name).toBe('Sort the colours');
    expect(copy.sections.read.before).toBe('Sit as you usually do, and wear your usual glasses if you use them.');
    expect(copy.results.title).toBe("Here's how WebAble will fit the web to you");
    expect(copy.results.benefits).toBe('What WebAble will do for you');
    expect(copy.results.status).toBe("You're set. WebAble is on.");
    expect(copy.results.less).toBe('Less');
    expect(copy.results.more).toBe('More');
    expect(copy.results.off).toBe('Turn off');
    expect(Object.values(copy.pages)).toEqual(['News site', 'Online class', 'Pharmacy refill', 'Bank statement', 'Recipe']);
    expect(copy.captions.bank).toContain('keeps its layout');
  });

  it('fills benefit lines with the fit\'s real sizes', () => {
    const text = benefitLine('small_text', DEMO_FITS.rosa);
    expect(text).toBe('Text will be 22 px on every site, with headings kept in proportion.');
    const buttons = benefitLine('small_buttons', DEMO_FITS.rosa);
    expect(buttons).toContain('56 px');
    const reading = benefitLine('long_reading', DEMO_FITS.rosa);
    expect(reading).toBe("Long articles will get more space between lines (1.6× spacing) and lines that aren't too long to follow.");
    expect(benefitLine('moving_things', defaultFit())).toBeNull();
    expect(benefitLine('moving_things', DEMO_FITS.rosa)).toContain('paused');
    expect(benefitLine('busy_pages', DEMO_FITS.rosa)).toContain('simplified');
    expect(benefitLine('busy_pages', DEMO_FITS.reader)).toContain('main content first');
  });

  it('uses sixty-character sentences split into three lines', () => {
    for (const line of READ_LINES) {
      expect(line.text.length).toBe(60);
      const parts = threeLines(line.text);
      expect(parts.filter((part) => part.length > 0)).toHaveLength(3);
      expect(parts.join(' ')).toBe(line.text);
    }
    expect(copy.read.question(copy.read.thing)).toBe('Was there a dog in that sentence?');
  });
});