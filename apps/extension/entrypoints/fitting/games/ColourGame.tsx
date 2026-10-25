// Put seven colour chips in order, to the right of a fixed starting chip.
// Tap a chip, then a spot. A pointer can also drag. Keyboard uses the same buttons.

import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { copy } from '../content/copy';
import { chipColor, MOVABLE, PILOT } from '../logic/colour';
import { shuffle, type Rng } from '../logic/rand';
import { Button } from '../ui/bits';

export function ColourGame(props: { rng: Rng; onDone: (result: { placed: string[] }) => void }): JSX.Element {
  const deck = useMemo(() => shuffle(MOVABLE, props.rng).map((c) => c.id), [props.rng]);
  const [slots, setSlots] = useState<Array<string | null>>(() => Array(MOVABLE.length).fill(null));
  const [held, setHeld] = useState<string | null>(null);

  const placed = new Set(slots.filter((id): id is string => id != null));
  const pool = deck.filter((id) => !placed.has(id) && id !== held);

  const hue = (id: string) => MOVABLE.find((c) => c.id === id)?.hue ?? PILOT.hue;

  const place = (index: number) => {
    if (!held) {
      const there = slots[index];
      if (there) {
        const next = slots.slice();
        next[index] = null;
        setSlots(next);
        setHeld(there);
      }
      return;
    }
    const next = slots.slice();
    const occupant = next[index] ?? null;
    next[index] = held;
    setSlots(next);
    setHeld(occupant);
  };

  const full = slots.every((id) => id != null);

  const onKeys = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const root = e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
    const chips = [...(root?.querySelectorAll<HTMLButtonElement>('[data-answer="chip"], [data-answer="slot"], [data-answer="placed"], [data-answer="held"]') ?? [])];
    if (!chips.length) return;
    e.preventDefault();
    const i = chips.indexOf(document.activeElement as HTMLButtonElement);
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    const next = chips[(Math.max(0, i) + dir + chips.length) % chips.length];
    next?.focus();
  };

  return (
    <section class="ob-game" aria-labelledby="ob-game-title" onKeyDown={onKeys}>
      <h1 id="ob-game-title" class="ob-sr">{copy.sections.colours.name}</h1>
      <div class="ob-order" role="list" aria-label={copy.sections.colours.name}>
        <div class="ob-chip is-fixed" role="listitem" style={{ background: chipColor(PILOT.hue) }} aria-label={copy.sections.colours.name} />
        {slots.map((id, index) => (
          <button
            key={index}
            type="button"
            role="listitem"
            class={`ob-slot ${id ? 'is-filled' : ''}`}
            style={id ? { background: chipColor(hue(id)) } : undefined}
            aria-label={id ? copy.colours.chip : copy.colours.place}
            data-answer={id ? 'placed' : 'slot'}
            onClick={() => place(index)}
          />
        ))}
      </div>
      <div class="ob-pool" role="group" aria-label={copy.sections.colours.name}>
        {held ? (
          <button
            type="button"
            class="ob-chip is-held"
            style={{ background: chipColor(hue(held)) }}
            aria-pressed="true"
            aria-label={copy.colours.chip}
            data-answer="held"
            onClick={() => setHeld(null)}
          />
        ) : null}
        {pool.map((id) => (
          <button
            key={id}
            type="button"
            class="ob-chip"
            style={{ background: chipColor(hue(id)) }}
            aria-label={copy.colours.chip}
            data-answer="chip"
            onClick={() => setHeld(id)}
          />
        ))}
      </div>
      <Button kind="primary" onClick={() => props.onDone({ placed: slots.filter((id): id is string => id != null) })} data="colours-done" disabled={!full}>
        {copy.colours.done}
      </Button>
    </section>
  );
}
