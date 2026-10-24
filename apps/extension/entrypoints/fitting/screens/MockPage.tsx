// A generated mock web page for "Find it". Calm and busy versions share the same 24 links in the same
// places; busy adds promos, badges, borders, many hues, image blocks and a loud sidebar. Moving versions
// add two of: a carousel (3 s), a ticker (40 px/s), a pulsing LIVE badge (1 Hz). Never more than 3
// flashes per second, and nothing scroll-linked.

import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { BUSY_HUES, TEMPLATES } from '../content/mock';
import type { FindTrial } from '../logic/finding';

export interface MockPageProps {
  trial: FindTrial;
  /** Motion is off (thumbnails, Stop motion pressed, or reduced motion). */
  still: boolean;
  /** Reduced motion: motion cells show one bright still promo instead. */
  salientInsteadOfMotion: boolean;
  fontPx: number;
  targetPx: number;
  reveal?: boolean;
  onLink?: (label: string) => void;
  interactive?: boolean;
}

function Carousel(props: { trial: FindTrial; busy: boolean; still: boolean }): JSX.Element {
  const slides = TEMPLATES[props.trial.template].slides;
  const [i, setI] = useState(0);
  useEffect(() => {
    if (props.still) return;
    let interval = 0;
    const first = window.setTimeout(() => {
      setI((v) => (v + 1) % slides.length);
      interval = window.setInterval(() => setI((v) => (v + 1) % slides.length), 3000);
    }, props.trial.firstAdvanceMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [props.still, props.trial.index]);
  return (
    <div class="mk-carousel" aria-hidden="true">
      <div class="mk-carousel-track" style={{ transform: `translateX(${-i * 100}%)` }}>
        {slides.map((s, k) => (
          <div
            class="mk-slide"
            style={props.busy ? { background: `linear-gradient(120deg, ${BUSY_HUES[(k * 2) % 8]}, ${BUSY_HUES[(k * 2 + 3) % 8]})` } : undefined}
          >
            <strong>{s.title}</strong>
            <span>{s.line}</span>
          </div>
        ))}
      </div>
      <div class="mk-dots">
        {slides.map((_, k) => (
          <span class={k === i ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}

function Ticker(props: { text: string; still: boolean; busy: boolean }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (props.still) return;
    const el = ref.current;
    if (!el) return;
    let x = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const half = el.scrollWidth / 2 || 1;
      x = (x + 40 * dt) % half;
      el.style.transform = `translateX(${-x}px)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [props.still]);
  return (
    <div class={`mk-ticker ${props.busy ? 'is-busy' : ''}`} aria-hidden="true">
      <div class="mk-ticker-track" ref={ref}>
        <span>{props.text}</span>
        <span>{props.text}</span>
      </div>
    </div>
  );
}

export function MockPage(props: MockPageProps): JSX.Element {
  const { trial } = props;
  const tpl = TEMPLATES[trial.template];
  const busy = trial.clutter;
  const moving = trial.motion && !props.salientInsteadOfMotion;
  const salient = trial.motion && props.salientInsteadOfMotion;
  const still = props.still || !moving;
  const hasCarousel = moving && trial.sources.includes('carousel');
  const hasTicker = moving && trial.sources.includes('ticker');
  const hasLive = moving && trial.sources.includes('live');
  const interactive = props.interactive ?? true;
  const hue = (k: number) => BUSY_HUES[k % BUSY_HUES.length] ?? '#1E88E5';

  const link = (label: string, cls: string, extra?: JSX.Element | null, style?: JSX.CSSProperties) => (
    <button
      type="button"
      class={`mk-link ${cls} ${props.reveal && label === trial.target ? 'is-reveal' : ''}`}
      tabIndex={interactive ? 0 : -1}
      style={style}
      onClick={interactive ? () => props.onLink?.(label) : undefined}
    >
      {extra}
      <span class="mk-label">{label}</span>
    </button>
  );

  let banner: JSX.Element;
  if (hasCarousel) banner = <Carousel trial={trial} busy={busy} still={still} />;
  else if (salient)
    banner = (
      <div class="mk-banner mk-banner-salient" aria-hidden="true">
        <strong>Today only</strong>
        <span>{tpl.promo.line}</span>
      </div>
    );
  else if (busy)
    banner = (
      <div class="mk-banner mk-banner-busy" aria-hidden="true" style={{ background: `linear-gradient(100deg, ${hue(0)}, ${hue(6)})` }}>
        <strong>{tpl.promo.title}</strong>
        <span>{tpl.promo.line}</span>
        <i class="mk-burst">%</i>
      </div>
    );
  else
    banner = (
      <div class="mk-banner" aria-hidden="true">
        <strong>{tpl.welcome.title}</strong>
        <span>{tpl.welcome.line}</span>
      </div>
    );

  const style = {
    '--mk-font': `${props.fontPx}px`,
    '--mk-target': `${props.targetPx}px`,
  } as JSX.CSSProperties;

  return (
    <div class={`mk ${busy ? 'is-busy' : 'is-calm'} ${trial.mirror ? 'is-mirror' : ''} ${still ? 'is-still' : ''}`} style={style}>
      <div class="mk-head" style={busy ? { background: `linear-gradient(90deg, ${hue(4)}, ${hue(5)})` } : undefined}>
        <span class="mk-brand" aria-hidden="true">
          {tpl.brand}
          {hasLive ? <i class={`mk-live ${still ? '' : 'is-pulsing'}`}>LIVE</i> : null}
        </span>
        <nav class="mk-nav">
          {tpl.nav.map((n, k) =>
            link(n, 'mk-nav-link', busy && k === 1 ? <i class="mk-badge mk-badge-nav">{tpl.badges[0]}</i> : null),
          )}
        </nav>
      </div>
      {hasTicker ? <Ticker text={tpl.ticker} still={still} busy={busy} /> : <div class="mk-ticker-space" aria-hidden="true" />}
      <div class="mk-body">
        <div class="mk-main">
          {banner}
          <div class="mk-tiles">
            {trial.tiles.map((t, k) =>
              link(
                t,
                'mk-tile',
                <span
                  class="mk-img"
                  aria-hidden="true"
                  style={busy ? { background: `linear-gradient(135deg, ${hue(k)}, ${hue(k + 3)})` } : undefined}
                >
                  {busy && k % 3 === 0 ? <i class="mk-badge">{tpl.badges[(k / 3) % tpl.badges.length]}</i> : null}
                </span>,
                busy ? { borderColor: hue(k + 1) } : undefined,
              ),
            )}
          </div>
        </div>
        <aside class="mk-side" aria-hidden="true">
          {busy ? (
            tpl.side.map((s, k) => (
              <div class="mk-promo" style={{ background: hue(k * 3 + 1), color: k === 1 ? '#111' : '#fff' }}>
                <strong>{s.title}</strong>
                <span>{s.line}</span>
                <i class="mk-star">★</i>
              </div>
            ))
          ) : (
            <div class="mk-side-calm">
              <strong>{tpl.note.title}</strong>
              <span>{tpl.note.line}</span>
            </div>
          )}
        </aside>
      </div>
      <div class="mk-foot">{tpl.footer.map((f) => link(f, 'mk-foot-link'))}</div>
    </div>
  );
}
