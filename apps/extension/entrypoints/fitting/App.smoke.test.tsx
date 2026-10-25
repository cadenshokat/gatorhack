// @vitest-environment happy-dom
// Smoke run of the flow: Welcome, an instruction card per step, and the steps themselves render and advance.
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./results/Results', () => ({
  Results: (p: { measured: boolean }) => <div id="results-stub">{p.measured ? 'measured' : 'saved'}</div>,
}));

const tick = (ms = 0) => act(() => new Promise<void>((r) => setTimeout(r, ms)));

describe('onboarding flow', () => {
  it('goes from Welcome through the instruction cards to Results when skipped', async () => {
    const { App } = await import('./App');
    const root = document.createElement('div');
    document.body.appendChild(root);
    await act(() => render(<App />, root));
    await tick(20);
    expect(root.textContent).toContain('Let’s set up the web for you.');

    const click = async (sel: string) => {
      const el = root.querySelector<HTMLButtonElement>(sel);
      expect(el, sel).toBeTruthy();
      await act(() => el!.click());
      await tick(5);
    };
    // Mouse user: a pointer press before Start.
    window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', isPrimary: true }));
    await click('[data-answer="start"]');
    expect(root.querySelector('.fl-modal')?.textContent).toContain('Reading · 1 of 4');

    await click('[data-answer="start-step"]');
    expect(root.querySelector('.fl-para')).toBeTruthy();
    await click('[data-answer="larger"]');
    await click('[data-answer="comfortable"]');
    expect(root.querySelector('.fl-modal')?.textContent).toContain('True or false?');
    expect(root.querySelector('.fl-rail')?.textContent).toContain('Text');

    // Skip the rest one card at a time.
    for (const label of ['Which word is it?', 'Light or dark?', 'Click the dots', 'Find it']) {
      await click('[data-answer="skip-step"]');
      expect(root.querySelector('.fl-modal')?.textContent).toContain(label);
    }
    await click('[data-answer="start-step"]');
    expect(root.querySelector('.fl-findchip')).toBeTruthy();
    await click('[data-answer="skip-all"]');
    await tick(20);
    expect(root.querySelector('#results-stub')?.textContent).toBe('measured');
  });
});
