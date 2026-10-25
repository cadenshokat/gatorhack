import { defaultFit, type BrowserSettings } from '@webable/core';
import { describe, expect, it } from 'vitest';
import { applySession, emptyMeasures } from './session';

const settings = { forcedColors: false } as BrowserSettings;

describe('session fit', () => {
  it('writes the measured sizes onto the shared fit and keeps the optional extras', () => {
    const measures = emptyMeasures(false);
    measures.reading = { cpsPx: 20, bodyPx: 28, topWpm: 80, readingSupport: true, dropped: true };
    measures.band = 'M';
    measures.polarity = 'dark';
    measures.minPx = 44;
    measures.steady = true;
    measures.debounce = false;
    measures.clutterP = 0.72;
    measures.structureLevel = 1;
    measures.motionOn = true;
    measures.motionP = 0.8;
    measures.colour = { crossings: 2, score: 67, axes: ['blue-yellow'] };

    const fit = applySession(defaultFit(), measures, settings);
    expect(fit.v).toBe('fit.1');
    expect(fit.text.bodyPx).toBe(28);
    expect(fit.text.cpsPx).toBe(20);
    expect(fit.text.source).toBe('measured');
    expect(fit.contrast.band).toBe('M');
    expect(fit.contrast.floor).toBe(7);
    expect(fit.polarity.value).toBe('dark');
    expect(fit.targets.minPx).toBe(44);
    expect(fit.clicks.steady.on).toBe(true);
    expect(fit.clicks.debounce).toBe(false);
    expect(fit.attention.clutter.p).toBe(0.72);
    expect(fit.attention.structureLevel).toBe(1);
    expect(fit.attention.motion.on).toBe(true);
    expect(fit.attention.motion.p).toBe(0.8);
    expect(fit.readingSupport).toBe(true);
    expect(fit.topWpm).toBe(80);
    expect(fit.colourNeed?.score).toBe(67);
    expect(fit.spacing.lineHeight).toBe(1.6);
  });

  it('leaves click size alone for a keyboard and leaves colours alone when the system locks them', () => {
    const keys = emptyMeasures(true);
    keys.minPx = 72;
    keys.steady = true;
    const keyed = applySession(defaultFit(), keys, settings);
    expect(keyed.targets.minPx).toBeNull();
    expect(keyed.clicks.steady.on).toBe(false);

    const locked = emptyMeasures(false);
    locked.band = 'S';
    locked.polarity = 'dark';
    const out = applySession(defaultFit(), locked, { forcedColors: true } as BrowserSettings);
    expect(out.contrast.band).toBe('N');
    expect(out.polarity.value).toBe('none');
  });

  it('writes a soft motion probability without turning motion on, and keeps a reduce-motion setting', () => {
    const soft = emptyMeasures(false);
    soft.clutterP = 0.22;
    soft.structureLevel = 0;
    soft.motionOn = false;
    soft.motionP = 0.3;
    const quiet = applySession(defaultFit(), soft, settings);
    expect(quiet.attention.motion.on).toBe(false);
    expect(quiet.attention.motion.p).toBe(0.3);
    expect(quiet.attention.structureLevel).toBe(0);

    const held = emptyMeasures(false);
    held.clutterP = 0.58;
    held.structureLevel = 1;
    held.motionOn = false;
    held.motionP = 0.35;
    const reduced = applySession(defaultFit(), held, { forcedColors: false, reducedMotion: true } as BrowserSettings);
    expect(reduced.attention.motion.on).toBe(true);
    expect(reduced.attention.motion.p).toBeGreaterThanOrEqual(0.35);
  });
});
