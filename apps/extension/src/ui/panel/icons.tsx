// Owner: D2. Inline SVG icons (no url(), no external assets). All use currentColor.
import type { JSX } from 'preact';

type IconProps = { size?: number; class?: string };

function Svg(props: IconProps & { children: JSX.Element | JSX.Element[] }) {
  const s = props.size ?? 16;
  return (
    <svg
      class={props.class}
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {props.children}
    </svg>
  );
}

export const IconShield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.3 7.5 9.5 4.4-1.2 7.5-4.9 7.5-9.5V6L12 3z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Svg>
);
export const IconStar = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 14.6 9l6 .6-4.5 4 1.3 5.9L12 16.6l-5.4 2.9 1.3-5.9-4.5-4 6-.6L12 3.5z" />
  </Svg>
);
export const IconFold = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h10M4 17h6" />
    <path d="m16 15 3 3 3-3" />
  </Svg>
);
export const IconPin = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="5" width="16" height="12" rx="2" />
    <path d="M9 21h6M12 17v4" />
  </Svg>
);
export const IconDot = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.5" />
  </Svg>
);
export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const IconLens = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
    <path d="M8.5 11h5M11 8.5v5" />
  </Svg>
);
export const IconLayout = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4" width="17" height="16" rx="3" />
    <path d="M3.5 9h17M10 9v11" />
  </Svg>
);
export const IconUndo = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Svg>
);
export const IconSliders = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
export const IconPulse = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
  </Svg>
);
export const IconText = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 6h14M5 11h14M5 16h9" />
  </Svg>
);
export const IconHand = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6.5 7S5 17.5 4 15l-.8-2.2a1.4 1.4 0 0 1 2.5-1.2L8 15" />
  </Svg>
);
export const IconDiamond = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 21 12l-9 9-9-9 9-9z" />
    <path d="M12 8v8M8 12h8" />
  </Svg>
);
export const IconWarn = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4 2.8 19.5h18.4L12 4z" />
    <path d="M12 10v4.5M12 17.3v.2" />
  </Svg>
);
export const IconChevron = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);
export const IconSpark = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  </Svg>
);
