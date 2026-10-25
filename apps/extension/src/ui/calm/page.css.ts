// Owner: round 8b (SIMPLIFIED.md rules 4–8). Loaded after calmCss, so these rules win:
// - about 80 % of the screen is content: the column is min(80 cqw, 1400 px) from 1280 px, 88 cqw from 900, 92 cqw
//   below (cqw: the simplified page's own width, so the rules hold at any page zoom); the top bar and the dock line up
//   with it; one left edge for everything; body paragraphs up to about 85 characters (37 em); pictures, tables, grids
//   and the scoreboard use the full column; nothing ever scrolls sideways;
// - one spacing scale (8 / 16 / 24 / 40 / 64): sections 64 px apart, list rows padded 16 px with a hairline;
// - "More from {site}" as uniform cards (or rows at large text) and the closed "Site links (N)" at the very end;
// - calm links: titles in lists are not underlined until hover or focus, and only a disclosure has a chevron.
const C = '.wa-calm';

export const pageCss: string = `
${C} :is(.wa-page,.wa-strip,.wa-dock){--wa-colw:92cqw}
@container wa (min-width: 900px){
  ${C} :is(.wa-page,.wa-strip,.wa-dock){--wa-colw:88cqw}
}
@container wa (min-width: 1280px){
  ${C} :is(.wa-page,.wa-strip,.wa-dock){--wa-colw:min(80cqw,1400px)}
}
${C} .wa-page{padding-inline:0;overflow-x:clip}
${C} .wa-col{width:var(--wa-colw);max-width:none;margin-inline:auto}
${C} .wa-col>*{max-width:100%;margin-inline:0}
${C} .wa-col[data-kind=form]>*{max-width:min(var(--wa-form-col),100%);margin-inline:auto}
${C} .wa-strip__in,${C} .wa-strip__notein{width:var(--wa-colw);max-width:none;padding-inline:0;margin-inline:auto}
${C} .wa-dock{padding-inline:0}
${C} .wa-dock__in{width:var(--wa-colw);max-width:none}
${C} :where(img,video,canvas,iframe,table){max-width:100%}

/* Running text: up to about 85 characters a line; everything else the full column, from one left edge. */
${C} :is(.wa-p,.wa-orient,.wa-art__dek,.wa-leadstory__dek,.wa-pic__cap){max-width:min(100ch,100%)}
${C} .wa-prose{max-width:100%}
${C} .wa-pic--wide{width:100%;margin-left:0;max-width:max(min(100%,24em),calc((var(--wa-vh,100vh) - var(--wa-strip-h)) * .92 * var(--wa-ratio,1.5)))}
${C} .wa-pic--wide .wa-pic__cap{width:auto;max-width:min(100ch,100%);margin-inline:0;padding-inline-end:0}
${C} :is(.wa-picbox--wide,.wa-recipe__figure){max-width:100%}
/* A recipe's photo at its own shape from the left edge, at most about three quarters of the screen tall. */
${C} .wa-recipe{gap:24px}
${C} .wa-recipe__figure .wa-picbox--wide{width:fit-content;aspect-ratio:auto;height:auto}
${C} .wa-recipe__figure .wa-picbox--wide img{width:auto;height:auto;max-width:100%;max-height:calc((var(--wa-vh,100vh) - var(--wa-strip-h)) * .75)}

/* One spacing scale: 8 / 16 / 24 / 40 / 64. */
${C} .wa-band{margin-top:64px}
${C} :is(.wa-band--tight,.wa-band--task){margin-top:24px}
${C} .wa-band--first{margin-top:0;margin-bottom:24px}
${C} .wa-isec{margin-top:64px}
${C} :is(.wa-row,.wa-story){padding-block:16px}
${C} .wa-grid{gap:24px}
${C} .wa-head{margin-bottom:24px}
${C} .wa-art__lead{margin-top:40px}

/* Calm links: no chevrons on items (a disclosure keeps its one); titles in lists underline on hover or focus only. */
${C} .wa-row__chev{display:none}
${C} :is(a.wa-row,button.wa-row):focus-visible .wa-row__title,${C} a.wa-story:focus-visible .wa-story__title{text-decoration:underline;text-decoration-thickness:max(1px,.06em);text-underline-offset:.2em}

/* "Listen to this article": one quiet button under the byline that presses the page's own control. */
${C} .wa-listen{align-self:flex-start;margin-top:16px;gap:.5em}
${C} .wa-listen svg{width:1.1em;height:1.1em}

/* The end of a reading page: "More from {site}", then the closed "Site links (N)". */
${C} .wa-end{margin-top:64px;padding-top:40px;box-shadow:inset 0 var(--wa-hair) 0 var(--wa-line)}
${C} .wa-band:has(>.wa-disc:last-child)+.wa-end{box-shadow:none;padding-top:0}
${C} .wa-end__title{margin:0 0 24px}
${C} .wa-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:24px;align-items:start}
${C} .wa-card2{display:flex;flex-direction:column;gap:8px;min-width:0;color:var(--wa-ink);text-decoration:none}
${C} .wa-card2 .wa-pic{margin-bottom:8px}
${C} .wa-card2 .wa-pic__box{aspect-ratio:16/9}
${C} .wa-card2__title{font-family:var(--wa-font-display);font-size:var(--wa-f-title);line-height:var(--wa-lh-title);font-weight:600;
  letter-spacing:var(--wa-tr-title);color:var(--wa-ink);overflow-wrap:break-word;text-wrap:pretty}
${C} a.wa-card2:is(:hover,:focus-visible) .wa-card2__title{text-decoration:underline;text-decoration-thickness:max(1px,.06em);text-underline-offset:.18em}
${C} a.wa-card2:focus-visible{outline-offset:6px;border-radius:var(--wa-r-pic)}
${C} .wa-end .wa-story__title{font-weight:600}
${C} .wa-end .wa-more{margin-top:24px}
${C} .wa-band.wa-links{margin-top:64px}
${C} .wa-sitelinks{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,13em),1fr));gap:0 24px;margin:0;padding:0 0 16px;list-style:none}
${C} .wa-sitelinks>li{min-width:0}
${C} .wa-sitelink{display:flex;align-items:center;min-height:max(44px,var(--wa-t));padding-block:8px;color:var(--wa-ink);text-decoration:none;overflow-wrap:break-word}
${C} .wa-sitelink:is(:hover,:focus-visible){text-decoration:underline;text-decoration-thickness:max(1px,.06em);text-underline-offset:.2em}
${C} .wa-sitelink:focus-visible{outline-offset:2px}
/* The closing "Original page" sits on the column's right edge, like the top bar's. */
${C} .wa-foot .wa-btn--quiet{margin-inline-end:calc(-1 * var(--wa-pill-pad))}
`;
