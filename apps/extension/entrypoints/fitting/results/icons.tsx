// Line icons for the results page: 28 px, 1.75 px strokes, round ends, drawn in currentColor.
import type { JSX } from 'preact';
import type { NeedId } from './needs';

const line = {
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.75,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
} as const;

function Svg({ size = 28, children }: { size?: number; children: JSX.Element | JSX.Element[] }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" focusable="false" {...line}>
      {children}
    </svg>
  );
}

/** One icon per area WebAble helps with. */
export function NeedIcon({ id }: { id: NeedId }): JSX.Element {
  switch (id) {
    case 'text':
      // A large and a small letter A.
      return (
        <Svg>
          <path d="M3.5 22 9.75 6h.5L16.5 22" />
          <path d="M5.9 16.2h8.2" />
          <path d="M16.8 22l3.7-9.2h.5l3.7 9.2" />
          <path d="M18.2 18.8h4.6" />
        </Svg>
      );
    case 'faint':
      // Half light, half dark.
      return (
        <Svg>
          <circle cx="14" cy="14" r="9.25" />
          <path d="M14 4.75a9.25 9.25 0 0 1 0 18.5Z" fill="currentColor" />
        </Svg>
      );
    case 'buttons':
      // A button with a pointer on it.
      return (
        <Svg>
          <rect x="3.5" y="6" width="21" height="11" rx="5.5" />
          <path d="M14.5 13.5l6.2 2.4-2.7 1.1 2.6 3.4-1.5 1.1-2.6-3.4-1.6 2.5Z" fill="currentColor" stroke-width="1.25" />
        </Svg>
      );
    case 'steady':
      // A target with the dot in the middle.
      return (
        <Svg>
          <circle cx="14" cy="14" r="9.25" />
          <circle cx="14" cy="14" r="4.5" />
          <circle cx="14" cy="14" r="1.2" fill="currentColor" />
        </Svg>
      );
    case 'motion':
      // Pause.
      return (
        <Svg>
          <circle cx="14" cy="14" r="9.25" />
          <path d="M11.5 10.5v7M16.5 10.5v7" />
        </Svg>
      );
    case 'busy':
      // A page with a few calm lines.
      return (
        <Svg>
          <rect x="6" y="3.75" width="16" height="20.5" rx="3" />
          <path d="M10 9.5h8M10 13.5h8M10 17.5h5" />
        </Svg>
      );
  }
}

export function MinusIcon(): JSX.Element {
  return (
    <Svg size={24}>
      <path d="M7 14h14" stroke-width="2.25" />
    </Svg>
  );
}

export function PlusIcon(): JSX.Element {
  return (
    <Svg size={24}>
      <path d="M7 14h14M14 7v14" stroke-width="2.25" />
    </Svg>
  );
}

export function LockIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false" {...line} stroke-width={1.5}>
      <rect x="2.75" y="6.25" width="8.5" height="6" rx="1.5" />
      <path d="M4.75 6.25V4.5a2.25 2.25 0 0 1 4.5 0v1.75" />
    </svg>
  );
}
