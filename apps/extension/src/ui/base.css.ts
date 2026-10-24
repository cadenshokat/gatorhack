// Owner: D1. CSS for constructed stylesheets inside our shadow root. Never use url() or @import (page CSP blocks them).
//
// - `baseCss`: host reset, default light tokens and shared primitives (pills, cards, the fern dot) for all WebAble UI.
// - `calmCss`: the Calm view, every selector scoped under `.wa-calm`. CalmView adopts it into its own root node itself,
//   so it renders correctly whether or not the host also adopted `baseCss`.
// Tokens are CSS custom properties `--wa-*` from tokens.ts; the Calm view sets fit-sized values inline on its root.
import { tokensFor, tokensToCss } from './tokens';

/** Pills, cards and small shared pieces. `s` is a scope prefix ('' for the whole shadow root, '.wa-calm ' for the view). */
function primitives(s: string): string {
  return `
${s}.wa-btn{appearance:none;-webkit-appearance:none;border:0;margin:0;display:inline-flex;align-items:center;justify-content:center;gap:.45em;
  min-height:var(--wa-ctl);min-width:var(--wa-ctl);padding:0 var(--wa-pill-pad);border-radius:var(--wa-r-pill);
  font-family:var(--wa-font);font-size:var(--wa-f);font-weight:var(--wa-w-ctl);line-height:1.2;letter-spacing:var(--wa-letter-sp);
  text-align:center;text-decoration:none;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;
  background:var(--wa-tonal);color:var(--wa-ink);box-shadow:inset 0 0 0 var(--wa-edge) var(--wa-edge-color);
  transition:background-color .18s ease,color .18s ease,box-shadow .18s ease,opacity .18s ease}
${s}.wa-btn:hover{background:var(--wa-hover)}
${s}.wa-btn:active{background:var(--wa-press)}
${s}.wa-btn svg{flex:none;width:1em;height:1em}
${s}.wa-btn[disabled],${s}.wa-btn[aria-disabled=true]{cursor:not-allowed;color:var(--wa-ink-2);background:var(--wa-tonal)}
${s}.wa-btn--quiet{background:transparent;box-shadow:none}
${s}.wa-btn--quiet:hover{background:var(--wa-tonal)}
${s}.wa-btn--accent{background:var(--wa-accent);color:var(--wa-on-accent);box-shadow:none}
${s}.wa-btn--accent:hover{background:var(--wa-accent-hover)}
${s}.wa-btn--soft{background:var(--wa-accent-tint);color:var(--wa-accent);box-shadow:inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}
${s}.wa-btn--soft:hover{background:color-mix(in srgb,var(--wa-accent-tint) 70%,var(--wa-accent) 12%)}
${s}.wa-btn--ink{background:var(--wa-ink);color:var(--wa-canvas);box-shadow:none}
${s}.wa-btn--ink:hover{background:color-mix(in srgb,var(--wa-ink) 86%,var(--wa-canvas))}
${s}.wa-btn--action{background:var(--wa-action);color:var(--wa-on-action);box-shadow:none}
${s}.wa-btn--action:hover{background:var(--wa-action-hover)}
${s}.wa-btn--link{background:transparent;box-shadow:none;color:var(--wa-link);padding-inline:2px;min-width:0;justify-content:flex-start;text-align:left}
${s}.wa-btn--link:hover{background:transparent;text-decoration:underline;text-underline-offset:.18em}
${s}.wa-btn--block{width:100%}
${s}.wa-card{background:var(--wa-raised);border-radius:var(--wa-r-card);padding:var(--wa-card-pad);
  box-shadow:var(--wa-shadow-card),inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}
${s}.wa-dot{flex:none;display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--wa-accent)}
${s}.wa-meta{color:var(--wa-ink-2)}
${s}.wa-sr{position:absolute!important;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
${s}:focus-visible{outline:var(--wa-ring) solid var(--wa-focus);outline-offset:var(--wa-ring)}
`;
}

const RESET = `
:host{all:initial;color-scheme:light}
:host *,:host *::before,:host *::after{box-sizing:border-box}
[popover]{margin:0;padding:0;border:0;max-width:none;max-height:none;background:transparent;color:inherit;overflow:visible}
`;

export const baseCss: string = `${RESET}${tokensToCss(tokensFor(null, 'light'), ':host')}${primitives('')}`;

const C = '.wa-calm';

export const calmCss: string = `
${C}{position:fixed;inset:0;z-index:2;display:block;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable;
  background:var(--wa-canvas);color:var(--wa-ink);pointer-events:auto;text-align:left;
  font-family:var(--wa-font);font-size:var(--wa-f);line-height:var(--wa-lh-body);font-weight:var(--wa-w-body);
  word-spacing:var(--wa-word-sp);letter-spacing:var(--wa-letter-sp);font-size-adjust:ex-height .536;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;
  color-scheme:light;container-type:inline-size;container-name:wa}
${C}[data-scheme=dark]{color-scheme:dark}
${C} *,${C} *::before,${C} *::after{box-sizing:border-box}
${C} :where(h1,h2,h3,h4,h5,h6,p,ul,ol,li,figure,figcaption,blockquote,dl,dt,dd,table,fieldset,legend){margin:0;padding:0;border:0;font:inherit;color:inherit}
${C} :where(ul,ol){list-style:none}
${C} :where(button,input,select,textarea){font:inherit;color:inherit;letter-spacing:inherit;word-spacing:inherit;margin:0}
${C} :where(img,svg,video){display:block;max-width:100%}
${C} :where(a){color:var(--wa-link);text-decoration:none}
${C} ::selection{background:var(--wa-selection)}
${primitives(`${C} `)}

/* ---------- frosted strip ---------- */
${C} .wa-strip{position:sticky;top:0;z-index:4;background:var(--wa-glass);
  -webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);
  box-shadow:0 var(--wa-hair) 0 color-mix(in srgb,var(--wa-line) 75%,transparent)}
${C} .wa-strip__in{max-width:var(--wa-page-max);margin:0 auto;min-height:var(--wa-strip-h);padding:8px var(--wa-side-pad);
  display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}
${C} .wa-brand{display:flex;align-items:center;gap:10px;min-width:0;max-width:min(22em,48%);font-weight:var(--wa-w-ctl)}
${C} .wa-brand__name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${C} .wa-brand__tag{flex:none;color:var(--wa-ink-2);font-weight:var(--wa-w-body);padding-left:12px;box-shadow:inset var(--wa-hair) 0 0 var(--wa-line)}
${C} .wa-substrip{display:flex;flex-wrap:wrap;align-items:center;gap:6px 4px;margin-bottom:var(--wa-gap)}
${C} .wa-substrip .wa-search{flex:1 1 14em;max-width:19em;margin-right:8px}
${C} .wa-substrip .wa-strip__item .wa-btn{min-height:max(44px,var(--wa-t));padding-inline:12px;background:transparent;box-shadow:none;color:var(--wa-link)}
${C} .wa-substrip .wa-strip__item .wa-btn:hover{background:var(--wa-tonal)}
${C} .wa-substrip .wa-search .wa-btn{min-height:max(44px,var(--wa-t));padding-inline:16px}
${C} .wa-strip__tools{order:2;margin-left:auto;display:flex;align-items:center;flex-wrap:wrap;justify-content:flex-end;gap:8px}
${C} .wa-strip__items{order:3;flex:1 1 100%;display:flex;flex-wrap:wrap;align-items:center;gap:8px;min-width:0}
${C} .wa-strip__items:empty{display:none}
${C} .wa-strip .wa-btn{min-height:max(44px,var(--wa-t));padding-inline:max(16px,calc(var(--wa-pill-pad)*.8))}
${C} .wa-strip__item{max-width:16em}
${C} .wa-strip__item .wa-btn{max-width:100%}
${C} .wa-strip__item .wa-btn span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${C} .wa-seg{display:inline-flex;align-items:center;padding:3px;gap:2px;border-radius:var(--wa-r-pill);background:var(--wa-tonal);
  box-shadow:inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}
${C} .wa-seg .wa-btn{background:transparent;box-shadow:none;min-width:max(44px,var(--wa-t));padding-inline:12px}
${C} .wa-seg .wa-btn:hover{background:var(--wa-hover)}
${C} .wa-search{display:flex;align-items:center;gap:8px;flex:1 1 18em;min-width:12em;max-width:32em}
${C} .wa-search__field{position:relative;flex:1;min-width:0;display:flex;align-items:center}
${C} .wa-search__field svg{position:absolute;left:16px;width:1em;height:1em;color:var(--wa-ink-2);pointer-events:none}
${C} .wa-search input{width:100%;min-height:max(44px,var(--wa-t));padding:0 16px 0 calc(16px + 1.6em);border:0;border-radius:var(--wa-r-pill);
  background:var(--wa-tonal);color:var(--wa-ink);box-shadow:inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}
${C} .wa-search input:focus{outline:none;box-shadow:0 0 0 var(--wa-ring) var(--wa-focus)}
${C} .wa-aichip{animation:wa-in .3s ease-out both}
@container wa (min-width: 1000px){
  ${C} .wa-strip__items{order:1;flex:1 1 auto;justify-content:center}
}
@container wa (max-width: 620px){
  ${C} .wa-seg{display:none}
  ${C} .wa-brand{max-width:52%}
  ${C} .wa-brand__tag{display:none}
  ${C} .wa-strip .wa-btn--quiet span{display:none}
  ${C} .wa-strip .wa-btn--quiet{padding-inline:12px}
}

/* ---------- page column ---------- */
${C} .wa-page{display:block;padding:calc(var(--wa-band-gap)*.45) var(--wa-side-pad) calc(var(--wa-band-gap)*1.4)}
${C} .wa-page:focus{outline:none}
${C} .wa-col{max-width:var(--wa-col-max);margin:0 auto}
${C} .wa-stack{display:flex;flex-direction:column;gap:var(--wa-gap)}
${C} .wa-stack>*{min-width:0}
${C} :is(.wa-stack,.wa-frame,.wa-form,.wa-stepbody,.wa-group,.wa-sub,.wa-disc__body,.wa-buy__info,.wa-prose,.wa-help__body,.wa-popup,.wa-result,.wa-tile,.wa-para)>.wa-btn:not(.wa-btn--block){align-self:flex-start}
${C} .wa-note{display:flex;align-items:flex-start;gap:12px;color:var(--wa-ink-2)}
${C} .wa-note .wa-dot{margin-top:calc((1em * var(--wa-lh-body) - 10px) / 2)}
${C} .wa-note__body{display:flex;flex-direction:column;gap:2px;min-width:0}
${C} .wa-note b{color:var(--wa-ink);font-weight:var(--wa-w-ctl)}
${C} .wa-band{margin-top:var(--wa-band-gap)}
${C} .wa-band--tight{margin-top:var(--wa-card-gap)}
${C} .wa-note+.wa-band,${C} .wa-note+.wa-band--tight{margin-top:calc(var(--wa-band-gap)*.55)}
${C} .wa-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 .4em;margin-bottom:var(--wa-head-gap)}
${C} .wa-h-page{font-family:var(--wa-font-display);font-size:var(--wa-f-page);line-height:var(--wa-lh-page);font-weight:var(--wa-w-head);
  letter-spacing:var(--wa-tr-page);text-wrap:balance;overflow-wrap:break-word}
${C} .wa-h-section{font-family:var(--wa-font-display);font-size:var(--wa-f-section);line-height:var(--wa-lh-section);font-weight:var(--wa-w-head);
  letter-spacing:var(--wa-tr-section);text-wrap:balance;overflow-wrap:break-word}
${C} .wa-h-title{font-family:var(--wa-font-display);font-size:var(--wa-f-title);line-height:var(--wa-lh-title);font-weight:var(--wa-w-head);
  letter-spacing:var(--wa-tr-title);overflow-wrap:break-word}
${C} .wa-count{color:var(--wa-ink-2)}
${C} .wa-pageline{color:var(--wa-ink-2);max-width:var(--wa-measure);margin-top:calc(var(--wa-head-gap)*-.35)}
${C} .wa-panel{background:var(--wa-raised);border-radius:var(--wa-r-panel);padding:var(--wa-panel-pad);
  box-shadow:var(--wa-shadow-card),inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}
${C} .wa-band--lead .wa-head{margin-bottom:calc(var(--wa-head-gap)*.8)}
${C} :is(.wa-panel,.wa-band,.wa-result,.wa-disc){scroll-margin-top:calc(var(--wa-strip-h) + 20px);scroll-margin-bottom:24px}

/* ---------- text ---------- */
${C} .wa-p{max-width:var(--wa-measure);overflow-wrap:break-word}
${C} .wa-p--quiet{color:var(--wa-ink-2)}
${C} .wa-p--price{font-weight:var(--wa-w-ctl)}
${C} .wa-para{display:flex;flex-direction:column;gap:.7em}
${C} .wa-inline-link{color:var(--wa-link);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:.16em;cursor:pointer}
${C} .wa-inline-link:hover{text-decoration-thickness:2px}
${C} .wa-crumbs{color:var(--wa-ink-2)}
${C} .wa-crumbs .wa-inline-link{color:inherit;text-decoration:none}
${C} .wa-crumbs .wa-inline-link:hover{text-decoration:underline}
${C} button.wa-inline-link{appearance:none;background:none;border:0;padding:0;font:inherit;display:inline;text-align:inherit;color:var(--wa-link)}
${C} .wa-explain{align-self:flex-start;min-height:max(44px,calc(var(--wa-t)*.8));padding-inline:max(16px,var(--wa-f))}
${C} .wa-list{display:flex;flex-direction:column;gap:var(--wa-gap-s);padding-left:1.25em;list-style:disc outside}
${C} .wa-list--ol{list-style:decimal outside}
${C} .wa-list>li{padding-left:.2em}
${C} .wa-list>li::marker{color:var(--wa-ink-2)}
${C} .wa-list--plain{list-style:none;padding-left:0}
${C} .wa-actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px}
${C} .wa-equal{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,10em),1fr));gap:12px}
${C} .wa-equal .wa-btn{width:100%}

/* ---------- grouped rows ---------- */
${C} .wa-rows,${C} .wa-choices,${C} .wa-facts{background:var(--wa-raised);border-radius:var(--wa-r-card);overflow:hidden;
  box-shadow:var(--wa-shadow-card),inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}
${C} .wa-row,${C} .wa-choice,${C} .wa-fact{position:relative;display:flex;align-items:center;gap:calc(var(--wa-gap)*1.2);min-height:var(--wa-row);
  padding:12px var(--wa-card-pad);color:var(--wa-ink)}
${C} :is(.wa-row,.wa-choice,.wa-fact)+:is(.wa-row,.wa-choice,.wa-fact)::before{content:"";position:absolute;top:0;left:var(--wa-card-pad);right:0;
  height:var(--wa-hair);background:var(--wa-line)}
${C} a.wa-row,${C} button.wa-row{width:100%;text-align:left;border:0;background:transparent;cursor:pointer;font:inherit;transition:background-color .18s ease}
${C} a.wa-row:hover,${C} button.wa-row:hover{background:color-mix(in srgb,var(--wa-tonal) 55%,var(--wa-raised))}
${C} :is(.wa-rows,.wa-facts,.wa-table-wrap) :focus-visible{outline-offset:calc(var(--wa-ring) * -1)}
${C} .wa-row__main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
${C} .wa-row__title{font-weight:var(--wa-w-ctl);overflow-wrap:break-word}
${C} a.wa-row .wa-row__title{color:var(--wa-link)}
${C} .wa-row__chev{flex:none;width:1em;height:1em;color:var(--wa-ink-2)}
${C} .wa-row__thumb{flex:none;width:calc(var(--wa-row)*1.3);height:calc(var(--wa-row)*.95);padding:6px;border-radius:12px}
${C} .wa-row__thumb[data-fit=cover]{width:calc(var(--wa-row)*2.1);height:calc(var(--wa-row)*1.3);padding:0}
${C} .wa-row__aside{flex:none;display:flex;gap:8px;align-items:center}
${C} .wa-groupgap{display:flex;flex-direction:column;gap:var(--wa-card-gap)}

/* ---------- choices (checkbox and radio) ---------- */
${C} .wa-choice{cursor:pointer;transition:background-color .18s ease}
${C} .wa-choice:hover{background:color-mix(in srgb,var(--wa-tonal) 45%,var(--wa-raised))}
${C} .wa-choice[data-checked]{background:color-mix(in srgb,var(--wa-action) 7%,var(--wa-raised))}
${C} .wa-choice[data-disabled]{cursor:not-allowed}
${C} .wa-choice[data-disabled]:hover{background:transparent}
${C} .wa-choice[data-disabled] .wa-choice__title{color:var(--wa-ink-2)}
${C} .wa-choice:has(input:focus-visible){outline:var(--wa-ring) solid var(--wa-focus);outline-offset:calc(var(--wa-ring) * -1);z-index:1}
${C} .wa-box{flex:none;width:var(--wa-check);height:var(--wa-check);border-radius:calc(var(--wa-check)*.28);display:grid;place-items:center;
  background:var(--wa-raised);box-shadow:inset 0 0 0 2px var(--wa-line-strong);color:var(--wa-on-action);
  transition:background-color .18s ease,box-shadow .18s ease}
${C} .wa-box--radio{border-radius:50%}
${C} .wa-box svg{width:64%;height:64%;opacity:0;transition:opacity .12s ease}
${C} .wa-box__dot{width:42%;height:42%;border-radius:50%;background:var(--wa-on-action);opacity:0}
${C} .wa-choice[data-checked] .wa-box{background:var(--wa-action);box-shadow:none}
${C} .wa-choice[data-checked] .wa-box svg,${C} .wa-choice[data-checked] .wa-box__dot{opacity:1}
${C} .wa-choice[data-disabled] .wa-box{background:var(--wa-tonal);box-shadow:inset 0 0 0 2px var(--wa-line)}
${C} .wa-choice__text{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
${C} .wa-choice__title{font-weight:var(--wa-w-ctl);overflow-wrap:break-word}
${C} .wa-choice__meta{color:var(--wa-ink-2);overflow-wrap:break-word}
${C} .wa-choice__extra{display:flex;flex-wrap:wrap;gap:4px 16px;padding:0 var(--wa-card-pad) 12px calc(var(--wa-card-pad) + var(--wa-check) + var(--wa-gap)*1.2)}

/* ---------- fields ---------- */
${C} .wa-field{display:flex;flex-direction:column;gap:8px}
${C} .wa-label{font-weight:var(--wa-w-ctl)}
${C} .wa-req{color:var(--wa-ink-2);font-weight:var(--wa-w-body)}
${C} .wa-hint{color:var(--wa-ink-2)}
${C} .wa-input{width:100%;min-height:var(--wa-ctl);padding:0 var(--wa-field-pad);border-radius:var(--wa-r-field);
  background:var(--wa-raised);color:var(--wa-ink);border:var(--wa-ctl-edge) solid var(--wa-line-strong);
  transition:border-color .18s ease,box-shadow .18s ease}
${C} textarea.wa-input{padding-block:calc(var(--wa-field-pad)*.7);min-height:calc(var(--wa-ctl)*2.4);resize:vertical;line-height:var(--wa-lh-body)}
${C} .wa-input:focus{outline:none;border-color:var(--wa-focus);box-shadow:0 0 0 var(--wa-ring) var(--wa-selection)}
${C} .wa-input[disabled],${C} .wa-input[readonly]{background:var(--wa-tonal);color:var(--wa-ink-2)}
${C} .wa-selectwrap{position:relative;display:flex;align-items:center}
${C} .wa-selectwrap select{appearance:none;-webkit-appearance:none;padding-right:calc(var(--wa-field-pad)*2 + 1em);cursor:pointer}
${C} .wa-selectwrap svg{position:absolute;right:var(--wa-field-pad);width:1em;height:1em;color:var(--wa-ink-2);pointer-events:none}
${C} .wa-group{display:flex;flex-direction:column;gap:var(--wa-gap)}
${C} .wa-form{display:flex;flex-direction:column;gap:var(--wa-card-gap)}

/* ---------- media ---------- */
${C} .wa-well{background:var(--wa-well);border-radius:var(--wa-r-media);display:flex;align-items:center;justify-content:center;overflow:hidden;padding:7%}
${C} .wa-well img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain}
${C} .wa-well[data-fit=cover]{padding:0}
${C} .wa-well[data-fit=cover] img{width:100%;height:100%;max-width:none;max-height:none;object-fit:cover}
${C} .wa-figure{display:flex;flex-direction:column;gap:8px}
${C} .wa-figure img{border-radius:var(--wa-r-media);max-height:min(62vh,560px);width:auto;object-fit:contain;background:var(--wa-well)}
${C} .wa-figure--icon img{max-height:96px}
${C} .wa-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,calc(var(--wa-tile-min)*.8)),1fr));gap:var(--wa-card-gap)}
${C} .wa-gallery .wa-well{aspect-ratio:1/1}

/* ---------- tiles ---------- */
${C} .wa-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,var(--wa-tile-min)),1fr));gap:var(--wa-card-gap)}
${C} .wa-tile{display:flex;flex-direction:column;gap:6px;background:var(--wa-raised);border-radius:var(--wa-r-card);padding:var(--wa-card-pad);
  box-shadow:var(--wa-shadow-card),inset 0 0 0 var(--wa-edge) var(--wa-edge-color);min-width:0}
${C} .wa-tile .wa-well{aspect-ratio:4/3;margin:calc(var(--wa-card-pad)*-.4) calc(var(--wa-card-pad)*-.4) 10px}
${C} .wa-tile__eyebrow{color:var(--wa-badge);font-weight:var(--wa-w-ctl)}
${C} .wa-tile__title{font-family:var(--wa-font-display);font-size:var(--wa-f-title);line-height:var(--wa-lh-title);font-weight:var(--wa-w-head);
  letter-spacing:var(--wa-tr-title);overflow-wrap:break-word}
${C} .wa-tile__title a{color:inherit}
${C} .wa-tile__actions{margin-top:auto;padding-top:12px;display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}
${C} .wa-more{margin-top:var(--wa-card-gap)}

/* ---------- disclosures and the end drawer ---------- */
${C} .wa-disc{background:var(--wa-raised);border-radius:var(--wa-r-card);box-shadow:var(--wa-shadow-card),inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}
${C} .wa-disc__sum{appearance:none;border:0;background:transparent;width:100%;display:flex;align-items:center;gap:14px;min-height:var(--wa-row);
  padding:12px var(--wa-card-pad);text-align:left;cursor:pointer;border-radius:var(--wa-r-card);color:inherit;font:inherit}
${C} .wa-disc__sum:hover .wa-chev{background:var(--wa-hover)}
${C} .wa-disc__text{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
${C} .wa-disc__title{font-family:var(--wa-font-display);font-size:var(--wa-f-title);line-height:var(--wa-lh-title);font-weight:var(--wa-w-head);letter-spacing:var(--wa-tr-title)}
${C} .wa-disc__sub{color:var(--wa-ink-2)}
${C} .wa-chipcount{flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:2.1em;min-height:1.9em;padding:0 .65em;
  border-radius:var(--wa-r-pill);background:var(--wa-tonal);font-weight:var(--wa-w-ctl);font-variant-numeric:tabular-nums}
${C} .wa-chev{flex:none;display:grid;place-items:center;width:max(36px,calc(var(--wa-f)*1.9));height:max(36px,calc(var(--wa-f)*1.9));border-radius:50%;
  background:var(--wa-tonal);color:var(--wa-ink);transition:transform .25s ease,background-color .18s ease}
${C} .wa-chev svg{width:48%;height:48%}
${C} .wa-disc[data-open] .wa-chev{transform:rotate(180deg)}
${C} .wa-disc__body{padding:4px var(--wa-card-pad) var(--wa-card-pad);display:flex;flex-direction:column;gap:var(--wa-card-gap)}
${C} .wa-disc .wa-disc,${C} .wa-disc :is(.wa-rows,.wa-choices,.wa-facts,.wa-tile,.wa-notice,.wa-table-wrap,.wa-frame,.wa-help,.wa-panel,.wa-sheet){background:var(--wa-well);box-shadow:inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}
${C} .wa-disc :is(.wa-tile,.wa-rows) .wa-well{background:var(--wa-raised)}
${C} .wa-sub{display:flex;flex-direction:column;gap:var(--wa-gap)}
${C} .wa-sub+.wa-sub{padding-top:var(--wa-card-gap);box-shadow:0 calc(var(--wa-hair) * -1) 0 var(--wa-line)}
${C} .wa-sub__head{display:flex;align-items:baseline;gap:.4em;flex-wrap:wrap}

/* ---------- stepper ---------- */
${C} .wa-steps{display:grid;grid-template-columns:repeat(var(--wa-steps,3),minmax(0,1fr));gap:10px;margin-bottom:calc(var(--wa-head-gap)*1.1)}
${C} .wa-steps>li{display:flex;min-width:0}
${C} .wa-step{width:100%;appearance:none;border:0;background:transparent;padding:6px 0;margin:0;display:flex;flex-direction:column;gap:10px;text-align:left;
  cursor:pointer;color:var(--wa-ink-2);min-height:var(--wa-t);border-radius:12px;font:inherit}
${C} .wa-step__bar{display:block;height:6px;border-radius:3px;background:var(--wa-tonal);transition:background-color .25s ease}
${C} .wa-step[data-state=done] .wa-step__bar,${C} .wa-step[data-state=current] .wa-step__bar{background:var(--wa-ink)}
${C} .wa-step[data-state=current]{color:var(--wa-ink);font-weight:var(--wa-w-ctl)}
${C} .wa-step__label{display:flex;gap:.45em;align-items:baseline;overflow-wrap:break-word}
${C} .wa-step__num{font-variant-numeric:tabular-nums}
${C} .wa-stepof{color:var(--wa-ink-2);margin-bottom:4px}
${C} .wa-stepbody{display:flex;flex-direction:column;gap:var(--wa-card-gap)}
${C} .wa-stepnav{display:flex;flex-wrap:wrap;gap:12px;margin-top:var(--wa-card-gap)}
${C} .wa-stepnav .wa-btn--ink{flex:1 1 14em;min-height:var(--wa-primary-h)}
${C} .wa-stepnav .wa-btn--back{flex:0 0 auto;min-height:var(--wa-primary-h)}
${C} .wa-recap{display:flex;flex-direction:column;gap:6px;padding:var(--wa-card-pad);border-radius:var(--wa-r-card);background:var(--wa-well)}
${C} .wa-recap__row{display:flex;flex-wrap:wrap;gap:4px 12px}
${C} .wa-recap__k{color:var(--wa-ink-2);min-width:9em}
${C} .wa-stack>.wa-allsteps{align-self:center}
@container wa (max-width: 640px){
  ${C} .wa-step__label{display:none}
}

/* ---------- primary action ---------- */
${C} .wa-primary{display:flex;flex-direction:column;gap:10px;margin-top:var(--wa-gap)}
${C} .wa-btn--primary{width:100%;min-height:var(--wa-primary-h);background:var(--wa-action);color:var(--wa-on-action);
  font-family:var(--wa-font-display);font-size:var(--wa-f-title);font-weight:var(--wa-w-head);letter-spacing:var(--wa-tr-title);
  box-shadow:0 1px 2px rgba(0,0,0,.08),0 8px 24px color-mix(in srgb,var(--wa-action) 30%,transparent)}
${C} .wa-btn--primary:hover{background:var(--wa-action-hover)}
${C} .wa-btn--primary:active{background:var(--wa-action);filter:brightness(.94)}
${C} .wa-btn--primary[data-armed]{box-shadow:0 0 0 var(--wa-ring) var(--wa-raised),0 0 0 calc(var(--wa-ring)*2.2) var(--wa-action)}
${C} .wa-btn--primary[disabled]{background:var(--wa-tonal);color:var(--wa-ink-2);box-shadow:none}
${C}[data-mode=max] .wa-btn--primary{box-shadow:none}
${C} .wa-primary__hint{color:var(--wa-ink-2);text-align:center}
${C} .wa-dock{position:sticky;bottom:0;z-index:4;padding:12px var(--wa-side-pad) 14px;background:var(--wa-glass);
  -webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);
  box-shadow:0 calc(var(--wa-hair) * -1) 0 color-mix(in srgb,var(--wa-line) 75%,transparent)}
${C} .wa-dock__in{max-width:var(--wa-col-max);margin:0 auto}
${C} .wa-dock .wa-primary{margin-top:0;gap:6px}
${C} .wa-dock .wa-primary__hint:empty{display:none}
${C} .wa-secondary{display:flex;flex-wrap:wrap;justify-content:center;gap:10px 12px}

/* ---------- notices, help, peek ---------- */
${C} .wa-notice{display:flex;flex-direction:column;gap:var(--wa-gap);background:var(--wa-raised);border-radius:var(--wa-r-card);padding:var(--wa-card-pad);
  box-shadow:var(--wa-shadow-card),inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}
${C} .wa-notice--alert{background:var(--wa-warning-tint);box-shadow:inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}
${C} .wa-notice__title{display:flex;align-items:center;gap:10px;font-weight:var(--wa-w-ctl)}
${C} .wa-notice--alert .wa-notice__title svg{color:var(--wa-warning)}
${C} .wa-notice__title svg{flex:none;width:1.1em;height:1.1em}
${C} .wa-help{display:flex;flex-wrap:wrap;align-items:center;gap:6px 18px;background:var(--wa-raised);border-radius:var(--wa-r-card);
  padding:calc(var(--wa-card-pad)*.75) var(--wa-card-pad);box-shadow:var(--wa-shadow-card),inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}
${C} .wa-help__icon{flex:none;display:grid;place-items:center;width:2em;height:2em;border-radius:50%;background:var(--wa-accent-tint);color:var(--wa-accent)}
${C} .wa-help__icon svg{width:55%;height:55%}
${C} .wa-help__body{flex:1 1 16em;display:flex;flex-direction:column;gap:2px;min-width:0}
${C} .wa-peek{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;padding:14px var(--wa-card-pad);border-radius:var(--wa-r-card);
  background:var(--wa-well);box-shadow:inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}
${C} .wa-peek__text{flex:1 1 14em;display:flex;flex-direction:column;gap:2px;min-width:0}
${C} .wa-table-wrap{overflow-x:auto;background:var(--wa-raised);border-radius:var(--wa-r-card);
  box-shadow:var(--wa-shadow-card),inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}
${C} .wa-table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
${C} .wa-table :is(th,td){padding:12px 16px;text-align:left;vertical-align:top;box-shadow:inset 0 calc(var(--wa-hair) * -1) 0 var(--wa-line)}
${C} .wa-table th{font-weight:var(--wa-w-ctl)}
${C} .wa-table tr:last-child td{box-shadow:none}
${C} .wa-fact{display:grid;grid-template-columns:minmax(7em,2fr) 3fr;gap:4px 24px;align-items:baseline}
${C} .wa-fact__k{color:var(--wa-ink-2)}
${C} .wa-fact--one{display:block}
${C} .wa-fact--head{font-weight:var(--wa-w-ctl)}
${C} .wa-fact .wa-actions{gap:2px 14px}
${C} .wa-fact .wa-btn--link{min-height:max(36px,calc(var(--wa-t)*.7))}
@container wa (max-width: 640px){
  ${C} .wa-fact{grid-template-columns:1fr}
}
${C} .wa-chips{display:flex;flex-wrap:wrap;gap:10px}
${C} .wa-chip[data-selected]{background:var(--wa-ink);color:var(--wa-canvas)}
${C} .wa-linkgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,max(11em,190px)),1fr));gap:0 24px}
${C} .wa-linkgrid .wa-btn--link{color:var(--wa-ink-2);font-weight:var(--wa-w-body);min-height:max(44px,var(--wa-t))}
${C} .wa-linkgrid .wa-btn--link:hover{color:var(--wa-ink)}
${C} .wa-buy{display:grid;gap:var(--wa-card-gap);align-items:start}
${C} .wa-buy__media .wa-well{aspect-ratio:1/1;border-radius:var(--wa-r-panel);max-height:62vh}
${C} .wa-buy__info{display:flex;flex-direction:column;gap:var(--wa-gap)}
@container wa (min-width: 900px){
  ${C} .wa-buy{grid-template-columns:7fr 5fr}
}
${C} .wa-sheet{background:var(--wa-raised);border-radius:var(--wa-r-panel);padding:var(--wa-panel-pad);
  box-shadow:var(--wa-shadow-card),inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}
${C} .wa-prose{display:flex;flex-direction:column;gap:.85em;max-width:var(--wa-measure)}
${C} .wa-prose>.wa-h-title{margin-top:.5em}
${C} .wa-frame{display:flex;flex-direction:column;gap:var(--wa-gap);background:var(--wa-raised);border-radius:var(--wa-r-media);padding:var(--wa-card-pad);
  box-shadow:var(--wa-shadow-card),inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}

/* ---------- page results and page popups ---------- */
${C} .wa-result{display:flex;flex-direction:column;gap:var(--wa-gap);background:var(--wa-raised);border-radius:var(--wa-r-panel);padding:var(--wa-panel-pad);
  box-shadow:var(--wa-shadow-card),inset 0 0 0 max(2px,var(--wa-edge)) var(--wa-action)}
${C} .wa-eyebrow{color:var(--wa-ink-2);font-weight:var(--wa-w-ctl)}
${C} .wa-popup{position:fixed;z-index:6;left:50%;top:calc(var(--wa-strip-h) + 20px);transform:translateX(-50%);
  width:min(calc(100% - 2 * var(--wa-side-pad)),calc(var(--wa-col-max) * .82));max-height:calc(100% - var(--wa-strip-h) - 40px);overflow:auto;
  background:var(--wa-raised);border-radius:var(--wa-r-card);padding:var(--wa-card-pad);display:flex;flex-direction:column;gap:var(--wa-gap);
  box-shadow:var(--wa-shadow-float),inset 0 0 0 var(--wa-edge) var(--wa-edge-color);animation:wa-in .2s ease-out both}
${C} .wa-popup__head{display:flex;align-items:center;justify-content:space-between;gap:12px}
${C} .wa-foot{margin-top:var(--wa-band-gap);padding-top:var(--wa-card-gap);box-shadow:0 calc(var(--wa-hair) * -1) 0 var(--wa-line);color:var(--wa-ink-2);
  display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 24px}
${C} .wa-empty{color:var(--wa-ink-2);text-align:center;padding:var(--wa-band-gap) 0}

/* ---------- motion ---------- */
@keyframes wa-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
${C} .wa-fade{animation:wa-in .25s ease-out both}
${C} .wa-popup.wa-fade{animation:none}
@media (prefers-reduced-motion: reduce){
  ${C},${C} *{animation:none!important;transition:none!important;scroll-behavior:auto!important}
}
${C}[data-motion=reduce],${C}[data-motion=reduce] *{animation:none!important;transition:none!important;scroll-behavior:auto!important}
`;
