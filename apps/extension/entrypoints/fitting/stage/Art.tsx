// Drawn pictures for the stage page (no network images on an extension page). Flat, muted, news-photo proportions.

import type { JSX } from 'preact';
import type { ArtId } from '../content/news';

function Bridge(): JSX.Element {
  return (
    <svg viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="np-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#C9D9E6" />
          <stop offset="0.62" stop-color="#F3DCC0" />
          <stop offset="1" stop-color="#F6CFA6" />
        </linearGradient>
        <linearGradient id="np-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#9DB9C9" />
          <stop offset="1" stop-color="#6F93A8" />
        </linearGradient>
      </defs>
      <rect width="640" height="360" fill="url(#np-sky)" />
      <circle cx="468" cy="182" r="34" fill="#FBE7CD" />
      <path d="M0 214 C 90 170 170 196 250 178 S 420 150 500 176 S 600 168 640 180 L640 250 L0 250 Z" fill="#A9BCB1" />
      <path d="M0 236 C 120 204 210 230 320 214 S 520 200 640 220 L640 262 L0 262 Z" fill="#879F92" />
      <rect y="252" width="640" height="108" fill="url(#np-water)" />
      <g stroke="#C7DAE4" stroke-width="2" opacity="0.7">
        <line x1="40" y1="290" x2="120" y2="290" />
        <line x1="210" y1="312" x2="300" y2="312" />
        <line x1="420" y1="296" x2="520" y2="296" />
        <line x1="120" y1="334" x2="190" y2="334" />
        <line x1="540" y1="328" x2="610" y2="328" />
      </g>
      <path d="M-10 250 Q 320 196 650 250" fill="none" stroke="#3B4650" stroke-width="7" />
      <path d="M-10 250 Q 320 214 650 250" fill="none" stroke="#3B4650" stroke-width="3" />
      <g stroke="#3B4650" stroke-width="2">
        {Array.from({ length: 21 }, (_, i) => {
          const x = 10 + i * 30;
          const t = (x + 10) / 660;
          const y1 = 250 - 4 * (250 - 196) * t * (1 - t) * 0.5 - 2;
          const y2 = 250 - 4 * (250 - 214) * t * (1 - t) * 0.5 + 1;
          return <line x1={x} y1={y1} x2={x} y2={y2 + 6} />;
        })}
      </g>
      <path d="M150 237 L150 300 M490 237 L490 300" stroke="#3B4650" stroke-width="9" />
      <g fill="#5E7768">
        <ellipse cx="44" cy="226" rx="26" ry="34" />
        <ellipse cx="82" cy="234" rx="20" ry="26" />
        <ellipse cx="604" cy="226" rx="24" ry="32" />
      </g>
      <g fill="#2F3A42">
        <circle cx="300" cy="214" r="3.2" />
        <rect x="298" y="217" width="4.4" height="9" rx="2" />
        <circle cx="342" cy="213" r="3.2" />
        <rect x="340" y="216" width="4.4" height="9" rx="2" />
      </g>
    </svg>
  );
}

function Market(): JSX.Element {
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="320" height="180" fill="#EFE6DA" />
      <rect y="120" width="320" height="60" fill="#D9CBB8" />
      {[0, 1, 2].map((k) => (
        <g transform={`translate(${22 + k * 100} 46)`}>
          <path d="M0 18 L38 0 L76 18 Z" fill="#B5654A" />
          {[0, 1, 2, 3].map((i) => (
            <rect x={i * 19} y="18" width="19" height="14" fill={i % 2 ? '#F4EDE3' : '#C9755A'} />
          ))}
          <rect x="4" y="32" width="68" height="44" fill="#8A6A4F" />
          <circle cx="20" cy="58" r="7" fill="#D99A3D" />
          <circle cx="36" cy="60" r="7" fill="#9BB15E" />
          <circle cx="52" cy="58" r="7" fill="#C4513B" />
        </g>
      ))}
    </svg>
  );
}

function Library(): JSX.Element {
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="320" height="180" fill="#DCE5EA" />
      <rect y="138" width="320" height="42" fill="#BFC9C9" />
      <path d="M70 62 L160 26 L250 62 Z" fill="#B9AE9C" />
      <rect x="74" y="62" width="172" height="10" fill="#A79B88" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect x={86 + i * 34} y="74" width="12" height="58" fill="#E8E1D4" />
      ))}
      <rect x="70" y="132" width="180" height="8" fill="#A79B88" />
      <rect x="146" y="98" width="28" height="34" fill="#6E6152" />
    </svg>
  );
}

function Rain(): JSX.Element {
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="320" height="180" fill="#B8C4CE" />
      <g fill="#E9EEF2">
        <ellipse cx="120" cy="70" rx="56" ry="26" />
        <ellipse cx="160" cy="58" rx="44" ry="30" />
        <ellipse cx="200" cy="72" rx="50" ry="24" />
      </g>
      <g stroke="#5D7A93" stroke-width="3" stroke-linecap="round">
        {[100, 126, 152, 178, 204, 230].map((x, i) => (
          <line x1={x} y1={108 + (i % 2) * 10} x2={x - 8} y2={130 + (i % 2) * 10} />
        ))}
      </g>
    </svg>
  );
}

export function Art(props: { id: ArtId }): JSX.Element {
  switch (props.id) {
    case 'bridge':
      return <Bridge />;
    case 'market':
      return <Market />;
    case 'library':
      return <Library />;
    default:
      return <Rain />;
  }
}
