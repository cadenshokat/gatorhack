// Sample pages for "See it on a page like…". News and recipes can open simplified. The others only adjust in place.
// Nothing here is a real site, and nothing is invented beyond the words on the sample itself.

import type { JSX } from 'preact';
import type { PageLook } from '../logic/fitview';
import type { SamplePageId } from './copy';

export function MiniPage(props: { page: SamplePageId; look: PageLook; textPx: number; simple: boolean }): JSX.Element {
  const dark = props.look.dark;
  const hit = props.look.hitPx != null && props.look.hitPx > 24 ? Math.min(64, props.look.hitPx) : 40;
  const style = {
    fontSize: `${props.textPx}px`,
    color: dark ? '#f6f3ec' : props.look.body,
    background: dark ? '#161513' : '#fffcf8',
    lineHeight: String(props.look.lineHeight),
    fontWeight: props.look.weight > 500 ? 560 : 440,
    '--mini-ink': dark ? '#faf7f2' : props.look.ink,
    '--mini-meta': dark ? '#d4cfc4' : props.look.meta,
    '--mini-faint': dark ? '#c4beb2' : props.look.caption,
    '--mini-hit': `${hit}px`,
    '--mini-line': dark ? '#3a3834' : '#e6e1d8',
  } as JSX.CSSProperties;
  const pulse = !props.look.motionOff;
  return (
    <article class={`ob-mini ${props.look.motionOff ? 'is-still' : ''} ${dark ? 'is-dark' : ''}`} style={style}>
      {props.page === 'news' ? <News simple={props.simple} pulse={pulse} /> : null}
      {props.page === 'class' ? <ClassPage pulse={pulse} /> : null}
      {props.page === 'pharmacy' ? <Pharmacy /> : null}
      {props.page === 'bank' ? <Bank /> : null}
      {props.page === 'recipe' ? <Recipe simple={props.simple} /> : null}
    </article>
  );
}

function News(props: { simple: boolean; pulse: boolean }): JSX.Element {
  return (
    <div class="ob-page">
      <header class="ob-mast">The Harbor Post</header>
      {props.simple ? null : (
        <div class="ob-ticker">
          <Live pulse={props.pulse} />
          <span class="ob-marquee">Bridge lanes open both ways · Evening sail held at the dock</span>
        </div>
      )}
      <h3>The east bridge is open again</h3>
      <p class="ob-dek">Crews finished the last joints overnight. Cars can cross from first light.</p>
      {props.simple ? <p class="ob-readtime">6 min read</p> : null}
      <p>The city kept one lane closed for a week while the joints were set. This morning both directions are moving, and the walkway is open too.</p>
      {props.simple ? (
        <p>Buses return to the usual stop on the far side. The night crew will watch the span through the weekend.</p>
      ) : (
        <div class="ob-busy">
          <aside class="ob-adcard">
            <span class="ob-ad">Ad</span>
            <strong>Summer fares are here</strong>
            <span>Weekend seats from the harbor station.</span>
          </aside>
          <aside>
            <span class="ob-kicker">You might also like</span>
            <strong>Where to eat by the water</strong>
            <span class="ob-faint">A list from last summer</span>
          </aside>
        </div>
      )}
    </div>
  );
}

function ClassPage(props: { pulse: boolean }): JSX.Element {
  return (
    <div class="ob-page">
      <header class="ob-mast">Evening studio</header>
      <h3>Clay basics, week two</h3>
      <div class="ob-video">
        <Live pulse={props.pulse} />
        <strong>Video: trimming the foot</strong>
      </div>
      <h4>Reading</h4>
      <p>How clay dries, and when to cover it overnight.</p>
      <p class="ob-faint">Due Thursday, before class.</p>
      <span class="ob-fakebtn">Open the reading</span>
    </div>
  );
}

function Pharmacy(): JSX.Element {
  return (
    <div class="ob-page">
      <header class="ob-mast">Linden Pharmacy</header>
      <h3>Request a refill</h3>
      <p>Daily tablet · 30 count</p>
      <p class="ob-faint">Last filled 21 days ago. Pickup at the front counter.</p>
      <span class="ob-fakebtn">Request refill</span>
      <p class="ob-faint">We will send a note when it is ready. No payment on this page.</p>
    </div>
  );
}

function Bank(): JSX.Element {
  return (
    <div class="ob-page">
      <header class="ob-mast">Harbor Mutual</header>
      <h3>Checking</h3>
      <p class="ob-balance">$1,240.18</p>
      <table class="ob-statement">
        <caption class="ob-sr">Recent activity</caption>
        <thead>
          <tr><th>Date</th><th>What</th><th>Amount</th></tr>
        </thead>
        <tbody>
          <tr><td>Oct 21</td><td>Market</td><td>−$42.10</td></tr>
          <tr><td>Oct 20</td><td>Pay</td><td>+$860.00</td></tr>
          <tr><td>Oct 18</td><td>Transit</td><td>−$2.75</td></tr>
        </tbody>
      </table>
      <p class="ob-faint">A $12 hold is still pending.</p>
    </div>
  );
}

function Recipe(props: { simple: boolean }): JSX.Element {
  return (
    <div class="ob-page">
      <header class="ob-mast">Weeknight kitchen</header>
      {props.simple ? null : <p class="ob-kicker">From the home page</p>}
      <h3>Lemon rice</h3>
      {props.simple ? null : (
        <p>I learned this on a slow Sunday, after the market and a long walk home. The pan was already warm, and the lemon was the last one in the bowl. The story goes on for a while before the recipe starts.</p>
      )}
      <p class="ob-faint">25 min · serves 2</p>
      {props.simple ? null : (
        <aside class="ob-adcard">
          <span class="ob-ad">Ad</span>
          <strong>New pans, this week only</strong>
        </aside>
      )}
      <h4>Ingredients</h4>
      <ul>
        <li>1 cup rice</li>
        <li>1 lemon</li>
        <li>A handful of herbs</li>
      </ul>
      <h4>Steps</h4>
      <ol>
        <li>Simmer the rice until the water is gone.</li>
        <li>Stir in lemon and herbs. Rest for two minutes.</li>
      </ol>
      {props.simple ? null : <p class="ob-kicker">More to cook: tomato soup, oat cookies</p>}
    </div>
  );
}

function Live(props: { pulse: boolean }): JSX.Element {
  return (
    <span class="ob-live">
      <span class={`ob-dot ${props.pulse ? 'is-pulse' : ''}`} />
      Live
    </span>
  );
}
