// One renderer for every sample page, before WebAble and with it. Everything it draws comes from the site's data
// (sites.ts) and the look (look.ts): sizes and colours arrive as CSS custom properties, so "With WebAble" shows the
// person's real text size, contrast, weight, line height and click-area size. It is a picture: the frame marks it
// inert, so nothing inside can be focused or pressed.
import type { JSX } from 'preact';
import type { Look } from './look';
import type { SampleAd, SampleSite } from './sites';

export function MiniPage({ site, look }: { site: SampleSite; look: Look }): JSX.Element {
  const cls = ['mp', `mp-${site.kind}`, `mp-${look.layout}`, `mp-brand-${site.brandStyle}`, look.dark ? 'mp-dark' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div class={cls} style={look.vars}>
      {look.strip !== 'none' && <Strip text={site.strip} paused={look.strip === 'paused'} />}
      {look.layout === 'simple' ? <SimplePage site={site} /> : <SitePage site={site} look={look} />}
      {look.popup && <Popup site={site} />}
      <div class="mp-fade" />
    </div>
  );
}

function Strip({ text, paused }: { text: string; paused: boolean }): JSX.Element {
  return (
    <div class={`mp-strip${paused ? ' is-paused' : ''}`}>
      <div class="mp-strip-track">
        <span>{text}</span>
        <span>{text}</span>
      </div>
    </div>
  );
}

/* ---------------- The site's own layout ---------------- */

function SitePage({ site, look }: { site: SampleSite; look: Look }): JSX.Element {
  const ads = look.ads;
  return (
    <>
      <header class="mp-head">
        <span class="mp-brand">{site.brand}</span>
        <nav class="mp-nav">
          {site.nav.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </nav>
        <span class="mp-menu" />
        <span class="mp-btn">{site.headerButton}</span>
      </header>
      <div class={`mp-main${ads ? ' has-rail' : ''}`}>
        <div class="mp-content">
          <div class="mp-eyebrow">{site.eyebrow}</div>
          <div class="mp-h1">{site.title}</div>
          <div class="mp-deck">{site.deck}</div>
          {site.byline && <div class="mp-byline">{site.byline}</div>}
          {site.mode === 'simple' && <SiteArticle site={site} ads={ads} />}
          {site.form && (
            <>
              {ads && site.ads[1] && <Ad ad={site.ads[1]} variant="banner" />}
              <Form form={site.form} />
            </>
          )}
          {site.table && (
            <>
              {site.actions && <Actions actions={site.actions} />}
              <Statement table={site.table} />
            </>
          )}
        </div>
        {ads && (
          <aside class="mp-rail">
            {site.ads[0] && <Ad ad={site.ads[0]} />}
            <div class="mp-rail-box">
              <div class="mp-rail-title">{site.railTitle}</div>
              <ol>
                {site.rail.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}

function SiteArticle({ site, ads }: { site: SampleSite; ads: boolean }): JSX.Element {
  const inlineAd = ads ? site.ads[1] ?? site.ads[0] : undefined;
  const list = site.list ? <List list={site.list} /> : null;
  return (
    <div class="mp-article">
      {site.art && <Art art={site.art} />}
      {site.list?.first && list}
      {site.stepsTitle ? (
        <>
          <div class="mp-h2">{site.stepsTitle}</div>
          {inlineAd && <Ad ad={inlineAd} variant="inline" />}
          <Steps items={site.paragraphs} />
        </>
      ) : (
        site.paragraphs.map((p, i) => (
          <div key={p}>
            <p class="mp-p">{p}</p>
            {i === 0 && inlineAd && <Ad ad={inlineAd} variant="inline" />}
          </div>
        ))
      )}
      {!site.list?.first && list}
      {site.actions && <Actions actions={site.actions} />}
    </div>
  );
}

/* ---------------- WebAble's simple page ---------------- */

function SimplePage({ site }: { site: SampleSite }): JSX.Element {
  const [first, ...rest] = site.paragraphs;
  const list = site.list ? <List list={site.list} /> : null;
  const art = site.art ? <Art art={site.art} /> : null;
  return (
    <>
      <header class="mp-chead">
        <span class="mp-brand">{site.brand}</span>
      </header>
      <article class="mp-col">
        <div class="mp-eyebrow">{site.eyebrow}</div>
        <div class="mp-h1">{site.title}</div>
        <div class="mp-deck">{site.deck}</div>
        {site.byline && <div class="mp-byline">{site.byline}</div>}
        {site.list?.first ? (
          <>
            {list}
            {site.stepsTitle && <div class="mp-h2">{site.stepsTitle}</div>}
            <Steps items={site.paragraphs} />
            {art}
          </>
        ) : (
          <>
            {first && <p class="mp-p">{first}</p>}
            {art}
            {rest.map((p) => (
              <p class="mp-p" key={p}>
                {p}
              </p>
            ))}
            {list}
          </>
        )}
        {site.actions && <Actions actions={site.actions} />}
      </article>
    </>
  );
}

/* ---------------- Parts ---------------- */

function Art({ art }: { art: NonNullable<SampleSite['art']> }): JSX.Element {
  return (
    <div class={`mp-art art-${art}`}>
      {art === 'video' && (
        <>
          <span class="mp-play" />
          <span class="mp-progress" />
        </>
      )}
    </div>
  );
}

function Ad({ ad, variant }: { ad: SampleAd; variant?: 'inline' | 'banner' }): JSX.Element {
  return (
    <div class={`mp-ad${variant ? ` mp-ad-${variant}` : ''}`}>
      <div class={`mp-ad-art${ad.art ? ` art-${ad.art}` : ''}`} style={{ '--a': ad.colors[0], '--b': ad.colors[1] }} />
      <div class="mp-ad-text">
        <span class="mp-ad-label">Sponsored</span>
        <span class="mp-ad-title">{ad.title}</span>
      </div>
    </div>
  );
}

function List({ list }: { list: NonNullable<SampleSite['list']> }): JSX.Element {
  return (
    <>
      <div class="mp-h2">{list.title}</div>
      <ul class="mp-list">
        {list.items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </>
  );
}

function Steps({ items }: { items: string[] }): JSX.Element {
  return (
    <ol class="mp-steps">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ol>
  );
}

function Actions({ actions }: { actions: NonNullable<SampleSite['actions']> }): JSX.Element {
  return (
    <div class="mp-actions">
      <span class="mp-btn">{actions.primary}</span>
      {actions.secondary && <span class="mp-btn mp-btn-ghost">{actions.secondary}</span>}
    </div>
  );
}

function Form({ form }: { form: NonNullable<SampleSite['form']> }): JSX.Element {
  return (
    <div class="mp-form">
      <div class="mp-fields">
        {form.fields.map((f) => (
          <div class="mp-field" key={f.label}>
            <span class="mp-label">{f.label}</span>
            <span class={`mp-input${f.select ? ' is-select' : ''}`}>{f.value}</span>
          </div>
        ))}
      </div>
      <div class="mp-form-foot">
        <span class="mp-btn">{form.submit}</span>
        <span class="mp-note">{form.note}</span>
      </div>
    </div>
  );
}

function Statement({ table }: { table: NonNullable<SampleSite['table']> }): JSX.Element {
  return (
    <>
      <div class="mp-summary">
        {table.summary.map(([k, v]) => (
          <div class="mp-sum" key={k}>
            <span class="mp-sum-k">{k}</span>
            <span class="mp-sum-v">{v}</span>
          </div>
        ))}
      </div>
      <table class="mp-table">
        <thead>
          <tr>
            {table.columns.map((c, i) => (
              <th key={c} class={i >= 2 ? 'num' : undefined}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.join('|')}>
              {row.map((c, i) => (
                <td key={i} class={i >= 2 ? 'num' : undefined}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Popup({ site }: { site: SampleSite }): JSX.Element {
  const p = site.popup;
  return (
    <div class="mp-pop">
      <span class="mp-pop-x" />
      <div class="mp-pop-title">{p.title}</div>
      <div class="mp-pop-body">{p.body}</div>
      {p.field && <div class="mp-pop-field">{p.field}</div>}
      <span class="mp-btn">{p.button}</span>
    </div>
  );
}
