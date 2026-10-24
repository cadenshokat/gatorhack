// Owner: D1. A labelled drawer with a count. Content renders only when open; nothing inside is ever deleted.
import type { ComponentChildren, JSX } from 'preact';
import { useId, useState } from 'preact/hooks';
import { ChevronDown } from './icons';

export function Disclosure(props: {
  title: string;
  count?: number | null;
  sub?: string | null;
  defaultOpen?: boolean;
  headingLevel?: 2 | 3;
  children: ComponentChildren;
}): JSX.Element {
  const [open, setOpen] = useState(!!props.defaultOpen);
  const body = useId();
  const H = props.headingLevel === 3 ? 'h3' : 'h2';
  return (
    <div class="wa-disc" data-open={open || undefined}>
      <H>
        <button type="button" class="wa-disc__sum" aria-expanded={open} aria-controls={body} onClick={() => setOpen(!open)}>
          <span class="wa-disc__text">
            <span class="wa-disc__title">{props.title}</span>
            {props.sub && <span class="wa-disc__sub">{props.sub}</span>}
          </span>
          {props.count != null && props.count > 0 && <span class="wa-chipcount">{props.count}</span>}
          <span class="wa-chev" aria-hidden="true">
            <ChevronDown />
          </span>
        </button>
      </H>
      {open && (
        <div class="wa-disc__body wa-fade" id={body}>
          {props.children}
        </div>
      )}
    </div>
  );
}
