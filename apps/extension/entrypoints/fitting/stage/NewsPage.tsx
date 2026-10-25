// The stage page: a made-up news site at web defaults that takes each result as a block ends — text grows by zoom with
// headings in proportion, captions darken, click areas grow, the sidebar dims, the ticker stops.

import type { JSX } from 'preact';
import { NEWS } from '../content/news';
import type { PageLook } from '../logic/fitview';
import { Art } from './Art';

export interface NewsPageProps {
  look: PageLook;
  /** Show the grown click areas strongly (the moment Clicks lands). */
  showHits?: boolean;
  /** Buttons and links do nothing on the stage. */
  inert?: boolean;
}

export function NewsPage(props: NewsPageProps): JSX.Element {
  const { look } = props;
  const hitCss = look.hitPx ? look.hitPx / look.zoom : null;
  const style = {
    '--np-ink': look.dark ? '#EDEDEF' : look.ink,
    '--np-body': look.dark ? '#D7D8DC' : look.body,
    '--np-meta': look.dark ? '#B4B6BC' : look.meta,
    '--np-caption': look.dark ? '#B4B6BC' : look.caption,
    '--np-nav': look.dark ? '#C4C6CC' : look.nav,
    '--np-bg': look.dark ? '#121317' : '#FFFFFF',
    '--np-line': look.dark ? '#2A2C31' : '#E6E6E6',
    '--np-weight': String(look.weight),
    '--np-lh': String(look.lineHeight),
    '--np-hit': hitCss ? `${hitCss}px` : '0px',
    zoom: String(look.zoom),
  } as JSX.CSSProperties;
  const cls = [
    'np-zoom',
    hitCss ? 'has-hits' : '',
    props.showHits ? 'show-hits' : '',
    look.motionOff ? 'is-still' : '',
    look.calm >= 1 ? 'is-calm1' : '',
    look.calm >= 2 ? 'is-calm2' : '',
    look.dark ? 'is-dark' : '',
  ].join(' ');
  const btn = (label: string, kind = '') => (
    <button type="button" class={`np-btn np-hit ${kind}`} tabIndex={-1} aria-hidden="true">
      {label}
    </button>
  );
  return (
    <div class={cls} style={style} inert={props.inert ?? true}>
      <div class="np">
        <div class="np-util">
          <span class="np-date">{NEWS.date}</span>
          <span class="np-util-actions">
            {btn('Subscribe', 'is-solid')}
            {btn('Sign in')}
          </span>
        </div>
        <div class="np-mast">{NEWS.brand}</div>
        <nav class="np-nav">
          {NEWS.nav.map((n) => (
            <a class="np-hit" tabIndex={-1}>
              {n}
            </a>
          ))}
        </nav>
        <div class="np-ticker">
          <span class="np-live">
            <i />
            Live
          </span>
          <div class="np-ticker-win">
            <div class="np-ticker-track">
              <span>{NEWS.ticker}</span>
              <span>{NEWS.ticker}</span>
            </div>
          </div>
        </div>

        <div class="np-grid">
          <article class="np-main">
            <p class="np-kicker">{NEWS.lead.kicker}</p>
            <h2 class="np-h1">{NEWS.lead.headline}</h2>
            <p class="np-dek">{NEWS.lead.dek}</p>
            <p class="np-byline">{NEWS.lead.byline}</p>
            <figure class="np-figure">
              <div class="np-pic">
                <Art id="bridge" />
              </div>
              <figcaption class="np-caption">{NEWS.lead.caption}</figcaption>
            </figure>
            {NEWS.lead.body.map((p) => (
              <p class="np-p">{p}</p>
            ))}
            <div class="np-actions">
              {btn('Share')}
              {btn('Save')}
              {btn('Comments (48)')}
            </div>
            <div class="np-more">
              {NEWS.more.map((m) => (
                <a class="np-card np-hit" tabIndex={-1}>
                  <span class="np-thumb">
                    <Art id={m.art} />
                  </span>
                  <span class="np-card-kicker">{m.kicker}</span>
                  <span class="np-card-title">{m.title}</span>
                  <span class="np-card-time">{m.time}</span>
                </a>
              ))}
            </div>
          </article>

          <aside class="np-side">
            <h3 class="np-side-h">Most read</h3>
            <ol class="np-list">
              {NEWS.mostRead.map((t, i) => (
                <li>
                  <span class="np-num">{i + 1}</span>
                  <a class="np-hit" tabIndex={-1}>
                    {t}
                  </a>
                </li>
              ))}
            </ol>
            <div class="np-ad">
              <span class="np-ad-label">{NEWS.ad.label}</span>
              <div class="np-ad-box">
                <strong>{NEWS.ad.title}</strong>
                <span>{NEWS.ad.line}</span>
                {btn(NEWS.ad.cta, 'is-ad')}
              </div>
            </div>
            <p class="np-folded">1 promotion moved to the end of the page</p>
            <div class="np-news">
              <strong>{NEWS.newsletter.title}</strong>
              <span>{NEWS.newsletter.line}</span>
              {btn(NEWS.newsletter.cta)}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
