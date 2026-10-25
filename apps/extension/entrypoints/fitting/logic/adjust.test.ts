import { defaultFit } from '@webable/core';
import { describe, expect, it } from 'vitest';
import { adjustNeed } from './adjust';
import type { OnboardingExtras } from './needs';

describe('one-tap adjust', () => {
  it('steps text, faint words, and buttons, and turns each off', () => {
    const start = defaultFit() as ReturnType<typeof defaultFit> & OnboardingExtras;
    start.text.bodyPx = 22;
    const more = adjustNeed(start, 'small_text', 'more');
    expect(more.text.bodyPx).toBeGreaterThan(22);
    expect(more.layout?.column).toBe('off');
    const high = adjustNeed(more, 'small_text', 'more');
    const again = adjustNeed(high, 'small_text', 'more');
    expect(again.text.bodyPx).toBeGreaterThanOrEqual(32);
    expect(again.layout?.column).toBe('auto');
    expect(adjustNeed(again, 'small_text', 'off').text.bodyPx).toBe(16);

    const darker = adjustNeed(start, 'faint_text', 'more');
    expect(darker.contrast.band).toBe('M');
    expect(adjustNeed(darker, 'faint_text', 'more').contrast.band).toBe('S');
    expect(adjustNeed(darker, 'faint_text', 'off').contrast.band).toBe('N');

    const taps = adjustNeed(start, 'small_buttons', 'more');
    expect(taps.targets.minPx).toBe(44);
    expect(adjustNeed(taps, 'small_buttons', 'more').targets.minPx).toBe(72);
    expect(adjustNeed(taps, 'small_buttons', 'off').targets.minPx).toBeNull();
  });

  it('turns moving things, busy pages, and colour help on and off', () => {
    const start = defaultFit() as ReturnType<typeof defaultFit> & OnboardingExtras;
    const moving = adjustNeed(start, 'moving_things', 'more');
    expect(moving.attention.motion.on).toBe(true);
    expect(adjustNeed(moving, 'moving_things', 'off').attention.motion.on).toBe(false);

    const busy = adjustNeed(start, 'busy_pages', 'more');
    expect(busy.attention.structureLevel).toBe(1);
    expect(adjustNeed(busy, 'busy_pages', 'more').attention.structureLevel).toBe(2);
    expect(adjustNeed(busy, 'busy_pages', 'off').attention.structureLevel).toBe(0);

    const colour = adjustNeed(start, 'telling_colours', 'more');
    expect(colour.colourAssist).toBe(true);
    expect(colour.colourNeed?.score).toBeGreaterThanOrEqual(48);
    expect(adjustNeed(colour, 'telling_colours', 'off').colourAssist).toBe(false);
  });
});