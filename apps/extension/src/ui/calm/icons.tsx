// Owner: D1. Inline SVG icons (no url(), no network). All decorative: aria-hidden.
import type { JSX } from 'preact';

type P = { class?: string };
const base = (cls: string | undefined): JSX.SVGAttributes<SVGSVGElement> => ({
  class: cls,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': 'true',
  focusable: 'false',
});

export const ChevronDown = ({ class: c }: P): JSX.Element => (
  <svg {...base(c)}><path d="M6 9l6 6 6-6" /></svg>
);
export const ChevronRight = ({ class: c }: P): JSX.Element => (
  <svg {...base(c)}><path d="M9 6l6 6-6 6" /></svg>
);
export const Check = ({ class: c }: P): JSX.Element => (
  <svg {...base(c)} stroke-width={3}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const Search = ({ class: c }: P): JSX.Element => (
  <svg {...base(c)}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
);
export const Close = ({ class: c }: P): JSX.Element => (
  <svg {...base(c)}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const Phone = ({ class: c }: P): JSX.Element => (
  <svg {...base(c)}>
    <path d="M5 4h3.5l1.7 4.3-2.2 1.4a11 11 0 0 0 6.3 6.3l1.4-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z" />
  </svg>
);
export const Mail = ({ class: c }: P): JSX.Element => (
  <svg {...base(c)}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M4 7l8 6 8-6" /></svg>
);
export const Help = ({ class: c }: P): JSX.Element => (
  <svg {...base(c)}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.3-2.5 3.8M12 17.2h.01" /></svg>
);
export const Alert = ({ class: c }: P): JSX.Element => (
  <svg {...base(c)}><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5M12 17.5h.01" /></svg>
);
export const Shield = ({ class: c }: P): JSX.Element => (
  <svg {...base(c)}><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" /></svg>
);
export const Play = ({ class: c }: P): JSX.Element => (
  <svg {...base(c)}><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5.5 3.5-5.5 3.5z" /></svg>
);
export const Lock = ({ class: c }: P): JSX.Element => (
  <svg {...base(c)}><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg>
);
