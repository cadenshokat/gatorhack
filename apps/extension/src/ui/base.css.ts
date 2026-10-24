// Owner: C. CSS for constructed stylesheets inside our shadow roots. Never use url() or @import (page CSP blocks them).
//
// - `baseCss`: host reset, default light tokens and shared primitives (pills, cards, the fern dot) for all WebAble UI.
// - `calmCss`: the Calm view, every selector scoped under `.wa-calm`. CalmView adopts it into its own root node itself,
//   so it renders correctly whether or not the host also adopted `baseCss`.
// - `calmChromeCss`: rules for the in-page chrome's shadow root while the Calm view is open (the WebAble pill and the
//   floating chips hide). Keyed on `[data-calm-open]` on `.wa-root` (or the host), and on the open Calm host itself.
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
${s}.wa-btn--tonal{background:var(--wa-tonal);color:var(--wa-ink)}
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

/**
 * For the chrome's own shadow root: while the Calm view is open, the WebAble pill and the floating chips step aside
 * (the view has its own Close and Original page). The App sets `data-calm-open` on `.wa-root`; the rule on the open
 * Calm host works even before it does.
 */
export const calmChromeCss: string = `
.wa-root[data-calm-open] .wa-pill,.wa-root[data-calm-open] .wa-floatchip,
:host([data-calm-open]) .wa-pill,:host([data-calm-open]) .wa-floatchip,
.wa-calm-host.is-open.has-content ~ .wa-app .wa-pill,.wa-calm-host.is-open.has-content ~ .wa-app .wa-floatchip{display:none!important}
`;

const C = '.wa-calm';

export const calmCss: string = `
${C}{position:fixed;inset:0;z-index:2;display:block;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable;
  scroll-padding-top:calc(var(--wa-strip-h) + 16px);scroll-padding-bottom:calc(var(--wa-dock-h) + 24px);
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
${C} .wa-strip{position:sticky;top:0;z-index:5;background:var(--wa-glass);
  -webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);
  box-shadow:0 var(--wa-hair) 0 color-mix(in srgb,var(--wa-line) 75%,transparent)}
${C} .wa-strip__in{max-width:var(--wa-page-max);margin:0 auto;min-height:var(--wa-strip-h);padding:6px var(--wa-side-pad);
  display:flex;flex-wrap:nowrap;align-items:center;gap:10px 12px}
${C} .wa-brand{flex:0 1 auto;display:flex;align-items:center;gap:10px;min-width:3em;max-width:14em;font-weight:var(--wa-w-head)}
${C} .wa-brand__name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${C} .wa-strip__tools{flex:0 1 auto;min-width:0;margin-left:auto;display:flex;align-items:center;flex-wrap:nowrap;justify-content:flex-end;gap:8px}
${C} .wa-strip .wa-btn{flex:none;min-height:max(44px,var(--wa-chip-h));padding-inline:max(14px,calc(var(--wa-pill-pad)*.7))}
${C} .wa-strip .wa-close{min-width:max(44px,var(--wa-chip-h));padding-inline:0;border-radius:50%}
${C} .wa-strip .wa-btn--helplink{color:var(--wa-link);padding-inline:10px;flex:0 1 auto;min-width:44px;max-width:100%}
${C} .wa-strip__help{display:inline-flex;flex:0 1 auto;min-width:44px;max-width:14em;overflow:hidden}
${C} .wa-strip__help .wa-btn span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${C} .wa-seg{display:inline-flex;align-items:center;padding:3px;gap:2px;border-radius:var(--wa-r-pill);background:var(--wa-tonal);
  box-shadow:inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}
${C} .wa-seg .wa-btn{background:transparent;box-shadow:none;min-width:max(44px,var(--wa-chip-h));min-height:calc(max(44px,var(--wa-chip-h)) - 6px);padding-inline:12px}
${C} .wa-seg .wa-btn:hover{background:var(--wa-hover)}
@container wa (max-width: 1060px){
  ${C} .wa-strip__help{display:none}
}
@container wa (max-width: 860px){
  ${C} .wa-seg{display:none}
  ${C} .wa-brand{display:none}
}

/* ---------- provenance chip and popover ---------- */
${C} .wa-prov{flex:none;position:relative;display:flex;align-items:center;gap:10px;min-width:0}
${C} .wa-provchip{appearance:none;border:0;margin:0;position:relative;display:inline-flex;align-items:center;gap:10px;cursor:pointer;
  min-height:var(--wa-chip-h);padding:0 max(14px,calc(var(--wa-f)*.7));border-radius:var(--wa-r-pill);
  background:var(--wa-accent-tint);color:var(--wa-accent);font:inherit;font-weight:var(--wa-w-ctl);white-space:nowrap;
  box-shadow:inset 0 0 0 var(--wa-edge) var(--wa-edge-color);transition:background-color .18s ease}
${C} .wa-provchip::before{content:"";position:absolute;inset:calc((var(--wa-chip-h) - max(var(--wa-t),var(--wa-chip-h))) / 2) -4px}
${C} .wa-provchip:hover{background:color-mix(in srgb,var(--wa-accent-tint) 75%,var(--wa-accent) 12%)}
${C} .wa-provchip__dot{flex:none;width:9px;height:9px;border-radius:50%;background:var(--wa-accent)}
${C} .wa-provchip[data-loading] .wa-provchip__dot{animation:wa-pulse 1.4s ease-in-out infinite}
${C} .wa-provchip__src{display:inline-block;animation:wa-swap .2s ease-out both}
${C} .wa-aiready{min-height:var(--wa-chip-h)!important;white-space:nowrap;animation:wa-in .25s ease-out both}
${C} .wa-popover{position:absolute;z-index:8;top:calc(100% + 10px);left:0;width:min(440px,calc(100vw - 32px));
  display:flex;flex-direction:column;gap:16px;padding:22px 24px;border-radius:22px;background:var(--wa-raised);color:var(--wa-ink);
  font-weight:var(--wa-w-body);white-space:normal;box-shadow:var(--wa-shadow-float),inset 0 0 0 var(--wa-edge) var(--wa-edge-color);
  animation:wa-in .18s ease-out both}
${C} .wa-popover:focus{outline:none}
${C} .wa-popover__title{font-weight:var(--wa-w-head)}
${C} .wa-popover__row{display:flex;align-items:center;justify-content:space-between;gap:12px 16px;flex-wrap:wrap}
${C} .wa-popover__row p{flex:1 1 14em}
${C} .wa-pbar{display:flex;flex-direction:column;gap:6px}
${C} .wa-pbar__row{display:flex;justify-content:space-between;gap:12px}
${C} .wa-pbar__row b{font-weight:var(--wa-w-head);font-variant-numeric:tabular-nums;white-space:nowrap}
${C} .wa-pbar__track{display:block;height:8px;border-radius:4px;background:var(--wa-tonal);overflow:hidden}
${C} .wa-pbar__fill{display:block;height:100%;border-radius:4px;background:var(--wa-accent)}
${C} .wa-pbar[data-tone=risk] .wa-pbar__fill{background:var(--wa-warning)}

/* ---------- page column and the first band ---------- */
${C} .wa-page{display:block;padding:var(--wa-top-pad) var(--wa-side-pad) calc(var(--wa-band-gap)*1.2)}
${C}[data-docked] .wa-page{min-height:calc(100vh - var(--wa-strip-h) - var(--wa-dock-h))}
${C} .wa-page:focus{outline:none}
${C} .wa-col{max-width:var(--wa-col-max);margin:0 auto}
${C} .wa-stack{display:flex;flex-direction:column;gap:var(--wa-gap)}
${C} .wa-stack>*{min-width:0}
${C} :is(.wa-stack,.wa-frame,.wa-form,.wa-stepbody,.wa-group,.wa-sub,.wa-disc__body,.wa-buy__info,.wa-prose,.wa-help__body,.wa-popup,.wa-result,.wa-tile,.wa-para)>.wa-btn:not(.wa-btn--block){align-self:flex-start}
${C} .wa-lead{display:flex;flex-direction:column;max-width:min(var(--wa-measure),100%);margin-bottom:var(--wa-task-gap)}
${C} .wa-lead .wa-h-page,${C} .wa-lead .wa-h-section{max-width:100%}
${C} .wa-lead__eyebrow{margin-bottom:calc(var(--wa-lead-gap)*.6)}
${C} .wa-orient{margin-top:var(--wa-lead-gap);max-width:min(var(--wa-measure),100%)}
${C} .wa-orient__line{color:var(--wa-ink-2)}
${C} .wa-orient__pin{color:var(--wa-ink);font-weight:var(--wa-w-ctl)}
${C} .wa-about{appearance:none;border:0;background:transparent;font:inherit;color:var(--wa-link);cursor:pointer;white-space:nowrap;
  display:inline-flex;align-items:center;gap:.3em;padding:.35em .2em;margin:-.35em 0;border-radius:10px;font-weight:var(--wa-w-ctl)}
${C} .wa-about:hover{text-decoration:underline;text-underline-offset:.18em}
${C} .wa-about__chev{width:.9em;height:.9em;transition:transform .2s ease}
${C} .wa-about[aria-expanded=true] .wa-about__chev{transform:rotate(180deg)}
${C} .wa-aboutwell{display:flex;flex-direction:column;gap:.7em;margin-top:12px;padding:var(--wa-card-pad);border-radius:var(--wa-r-card);
  background:var(--wa-raised);box-shadow:inset 0 0 0 max(1px,var(--wa-edge)) var(--wa-line)}
${C} .wa-band{margin-top:var(--wa-band-gap)}
${C} .wa-band--tight{margin-top:var(--wa-card-gap)}
${C} .wa-band--first{margin-top:0;margin-bottom:var(--wa-task-gap)}
${C} .wa-lead+.wa-band,${C} .wa-lead+.wa-band--tight{margin-top:0}
${C} .wa-band--task{margin-top:var(--wa-card-gap)}
${C} .wa-lead+.wa-band--task{margin-top:0}
${C} .wa-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 .4em;margin-bottom:var(--wa-head-gap)}
${C} .wa-h-page{font-family:var(--wa-font-display);font-size:var(--wa-f-page);line-height:var(--wa-lh-page);font-weight:var(--wa-w-head);
  letter-spacing:var(--wa-tr-page);text-wrap:balance;overflow-wrap:break-word}
${C} .wa-h-section{font-family:var(--wa-font-display);font-size:var(--wa-f-section);line-height:var(--wa-lh-section);font-weight:var(--wa-w-head);
  letter-spacing:var(--wa-tr-section);text-wrap:balance;overflow-wrap:break-word}
${C} .wa-h-title{font-family:var(--wa-font-display);font-size:var(--wa-f-title);line-height:var(--wa-lh-title);font-weight:var(--wa-w-head);
  letter-spacing:var(--wa-tr-title);overflow-wrap:break-word}
${C} .wa-count{color:var(--wa-ink-2)}
${C} .wa-eyebrow{color:var(--wa-ink-2);font-weight:var(--wa-w-head);font-size:var(--wa-f);text-transform:none;letter-spacing:var(--wa-letter-sp)}
${C} .wa-panel{background:var(--wa-raised);border-radius:var(--wa-r-panel);padding:var(--wa-panel-pad);
  box-shadow:var(--wa-shadow-card),inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}
${C} .wa-band--lead .wa-head{margin-bottom:calc(var(--wa-head-gap)*.8)}
${C} :is(.wa-panel,.wa-band,.wa-result,.wa-disc,.wa-notice){scroll-margin-top:calc(var(--wa-strip-h) + 20px);scroll-margin-bottom:calc(var(--wa-dock-h) + 24px)}

/* ---------- text ---------- */
${C} .wa-p{max-width:min(var(--wa-measure),100%);overflow-wrap:break-word}
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
${C} .wa-list>li{padding-left:.2em;display:list-item}
${C} .wa-list>li::marker{color:var(--wa-ink-2)}
${C} .wa-list--plain{list-style:none;padding-left:0}
${C} .wa-actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px}
${C} .wa-equal{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,11.5em),1fr));gap:12px}
${C} .wa-equal .wa-btn{width:100%}

/* ---------- grouped rows ---------- */
${C} .wa-rows,${C} .wa-choices,${C} .wa-facts{background:var(--wa-raised);border-radius:var(--wa-r-card);overflow:hidden;
  box-shadow:var(--wa-shadow-card),inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}
${C} .wa-row,${C} .wa-choice,${C} .wa-fact{position:relative;display:flex;align-items:center;gap:calc(var(--wa-gap)*1.2);min-height:var(--wa-row);
  padding:12px var(--wa-card-pad);color:var(--wa-ink)}
${C} :is(.wa-row,.wa-choice,.wa-fact,.wa-sumrow)+:is(.wa-row,.wa-choice,.wa-fact,.wa-sumrow)::before{content:"";position:absolute;top:0;left:var(--wa-card-pad);right:0;
  height:var(--wa-hair);background:var(--wa-line)}
${C} a.wa-row,${C} button.wa-row{width:100%;text-align:left;border:0;background:transparent;cursor:pointer;font:inherit;transition:background-color .18s ease}
${C} a.wa-row:hover,${C} button.wa-row:hover{background:color-mix(in srgb,var(--wa-tonal) 55%,var(--wa-raised))}
${C} :is(.wa-rows,.wa-facts,.wa-table-wrap) :focus-visible{outline-offset:calc(var(--wa-ring) * -1)}
${C} .wa-row__main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
${C} .wa-row__title{font-weight:var(--wa-w-ctl);overflow-wrap:break-word}
${C} a.wa-row .wa-row__title{color:var(--wa-link)}
${C} .wa-row__chev{flex:none;width:1em;height:1em;color:var(--wa-ink-2)}
${C} .wa-row__icon{flex:none;display:grid;place-items:center;width:2em;height:2em;border-radius:50%;background:var(--wa-accent-tint);color:var(--wa-accent)}
${C} .wa-row__icon svg{width:55%;height:55%}
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

/* ---------- fields and forms ---------- */
${C} .wa-field{display:flex;flex-direction:column;gap:8px}
${C} .wa-label{font-weight:var(--wa-w-ctl)}
${C} .wa-req{color:var(--wa-ink-2);font-weight:var(--wa-w-body)}
${C} .wa-hint{color:var(--wa-ink-2)}
${C} .wa-input{width:100%;min-height:var(--wa-ctl);padding:0 var(--wa-field-pad);border-radius:var(--wa-r-field);
  background:var(--wa-raised);color:var(--wa-ink);border:var(--wa-ctl-edge) solid var(--wa-line-strong);
  transition:border-color .18s ease,box-shadow .18s ease}
${C} .wa-input--10{max-width:calc(10ch + 2 * var(--wa-field-pad) + 4px)}
${C} .wa-input--20{max-width:calc(20ch + 2 * var(--wa-field-pad) + 4px)}
${C} .wa-input--30{max-width:calc(30ch + 2 * var(--wa-field-pad) + 4px)}
${C} textarea.wa-input{padding-block:calc(var(--wa-field-pad)*.7);min-height:calc(var(--wa-ctl)*2.4);resize:vertical;line-height:var(--wa-lh-body)}
${C} .wa-input:focus{outline:none;border-color:var(--wa-focus);box-shadow:0 0 0 var(--wa-ring) var(--wa-selection)}
${C} .wa-input[disabled],${C} .wa-input[readonly]{background:var(--wa-tonal);color:var(--wa-ink-2)}
${C} .wa-input[aria-invalid=true]{border-color:var(--wa-warning)}
${C} .wa-selectwrap{position:relative;display:flex;align-items:center}
${C} .wa-selectwrap select{appearance:none;-webkit-appearance:none;padding-right:calc(var(--wa-field-pad)*2 + 1em);cursor:pointer}
${C} .wa-selectwrap svg{position:absolute;right:var(--wa-field-pad);width:1em;height:1em;color:var(--wa-ink-2);pointer-events:none}
${C} .wa-group{display:flex;flex-direction:column;gap:var(--wa-gap)}
${C} .wa-form{display:flex;flex-direction:column;gap:var(--wa-field-gap)}
${C} :is(.wa-panel,.wa-frame,.wa-sheet) :is(.wa-rows,.wa-facts){background:transparent;box-shadow:none;border-radius:0;overflow:visible;margin-inline:calc(var(--wa-card-pad) * -1)}
${C} :is(.wa-panel,.wa-frame,.wa-sheet) :is(.wa-rows,.wa-facts)>:is(.wa-row,.wa-fact){padding-inline:var(--wa-card-pad)}
${C} .wa-panel :is(.wa-rows,.wa-facts){margin-inline:calc(var(--wa-panel-pad) * -1)}
${C} .wa-panel :is(.wa-rows,.wa-facts)>:is(.wa-row,.wa-fact){padding-inline:var(--wa-panel-pad)}
${C} .wa-panel .wa-choices{background:transparent;box-shadow:none;border-radius:0;overflow:visible;margin-inline:calc(var(--wa-panel-pad) * -1)}
${C} .wa-panel .wa-choice{padding-inline:var(--wa-panel-pad)}
${C} .wa-panel .wa-choice+.wa-choice::before{left:var(--wa-panel-pad);right:var(--wa-panel-pad)}
${C} .wa-panel .wa-choice__extra{padding-left:calc(var(--wa-panel-pad) + var(--wa-check) + var(--wa-gap)*1.2)}
${C}[data-mode=max] .wa-panel .wa-choices{box-shadow:none!important;background:transparent!important}
${C} .wa-form__title{margin-bottom:calc(var(--wa-field-gap) * -.45)}
${C} .wa-formstack{gap:var(--wa-card-gap)}
${C} .wa-formnote{gap:calc(var(--wa-gap)*.8)}
${C} .wa-formnote .wa-p{color:var(--wa-ink-2)}

/* ---------- stepped form ---------- */
${C} .wa-steppanel{display:flex;flex-direction:column;gap:6px}
${C} .wa-steppanel:focus{outline:none}
${C} .wa-stepof{margin:0}
${C} .wa-step__title{margin-bottom:calc(var(--wa-field-gap)*.6)}
${C} .wa-stepbody{display:flex;flex-direction:column;gap:var(--wa-field-gap)}
${C} .wa-summary{display:flex;flex-direction:column;gap:12px}
${C} .wa-summary .wa-rows{margin:0}
${C} .wa-sumrow{position:relative;display:grid;grid-template-columns:minmax(8em,2fr) 3fr auto;align-items:center;gap:4px 20px;min-height:var(--wa-row);
  padding:10px var(--wa-card-pad)}
${C} .wa-sumrow__k{color:var(--wa-ink-2)}
${C} .wa-sumrow__v{font-weight:var(--wa-w-ctl);overflow-wrap:anywhere}
${C} .wa-sumrow__a .wa-btn{min-height:max(44px,calc(var(--wa-t)*.8))}
@container wa (max-width: 640px){
  ${C} .wa-sumrow{grid-template-columns:1fr auto}
  ${C} .wa-sumrow__k{grid-column:1 / -1}
}

/* ---------- media ---------- */
${C} .wa-well{background:var(--wa-well);border-radius:var(--wa-r-media);display:flex;align-items:center;justify-content:center;overflow:hidden;padding:7%}
${C} .wa-well img{display:block;width:100%;height:100%;min-width:0;min-height:0;object-fit:contain}
${C} .wa-well[data-fit=cover]{padding:0}
${C} .wa-well[data-fit=cover] img{width:100%;height:100%;max-width:none;max-height:none;object-fit:cover}
${C} .wa-figure{display:flex;flex-direction:column;gap:8px}
${C} .wa-figure img{border-radius:var(--wa-r-media);max-height:min(62vh,560px);width:auto;object-fit:contain;background:var(--wa-well)}
${C} .wa-figure--icon img{max-height:96px;background:transparent}
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
${C} .wa-disc--quiet{box-shadow:inset 0 0 0 max(1px,var(--wa-edge)) var(--wa-line)}
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

/* ---------- the dock ---------- */
${C} .wa-dock{position:sticky;bottom:0;z-index:5;padding:12px var(--wa-side-pad) 14px;background:var(--wa-glass);
  -webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);
  box-shadow:0 calc(var(--wa-hair) * -1) 0 color-mix(in srgb,var(--wa-line) 75%,transparent);animation:wa-dock .16s ease-out both}
${C} .wa-dock__in{max-width:var(--wa-col-max);margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px 20px}
${C} .wa-dock__ctx{flex:1 1 auto;min-width:0;color:var(--wa-ink-2);font-weight:var(--wa-w-ctl);overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
${C} .wa-dock__btns{flex:none;display:flex;align-items:center;gap:12px}
${C} .wa-dock .wa-primary{margin:0;position:relative;gap:0}
${C} .wa-dock .wa-primary__hint{position:absolute;right:0;bottom:calc(100% + 12px);width:max-content;max-width:min(420px,70vw);text-align:right;
  padding:8px 14px;border-radius:12px;background:var(--wa-raised);color:var(--wa-ink);box-shadow:var(--wa-shadow-float),inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}
${C} .wa-dock .wa-primary__hint:empty{display:none}
${C} .wa-dock .wa-btn--primary,${C} .wa-dock .wa-btn--done{width:auto;min-width:280px;padding-inline:max(28px,calc(var(--wa-pill-pad)*1.4))}
${C} .wa-dock .wa-btn--back{min-height:var(--wa-primary-h)}
${C} .wa-btn--done{min-height:var(--wa-primary-h);background:var(--wa-success-tint)!important;color:var(--wa-success)!important;
  font-family:var(--wa-font-display);font-size:var(--wa-f-title);font-weight:var(--wa-w-head);cursor:default;
  box-shadow:inset 0 0 0 max(1px,var(--wa-edge)) color-mix(in srgb,var(--wa-success) 35%,transparent)}
@container wa (max-width: 640px){
  ${C} .wa-dock__ctx{display:none}
  ${C} .wa-dock__btns{flex:1}
  ${C} .wa-dock .wa-btn--primary,${C} .wa-dock .wa-btn--done{min-width:0;flex:1}
}
${C} .wa-secondary{display:flex;flex-wrap:wrap;gap:10px 12px}

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

/* ---------- notices, success, help, peek ---------- */
${C} .wa-notice{position:relative;display:flex;gap:14px;align-items:flex-start;background:var(--wa-warning-tint);border-radius:16px;
  padding:var(--wa-card-pad) var(--wa-card-pad) var(--wa-card-pad) calc(var(--wa-card-pad) + 4px);
  box-shadow:inset 4px 0 0 var(--wa-warning),inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}
${C} .wa-notice:focus{outline:none}
${C} .wa-notice--consent{background:var(--wa-raised);box-shadow:var(--wa-shadow-card),inset 4px 0 0 var(--wa-line-strong),inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}
${C} .wa-notice--error{box-shadow:inset 4px 0 0 var(--wa-warning),inset 0 0 0 max(1px,var(--wa-edge)) color-mix(in srgb,var(--wa-warning) 40%,transparent)}
${C} .wa-notice__icon{flex:none;display:grid;place-items:center;width:1.4em;height:calc(1em * var(--wa-lh-body));color:var(--wa-warning)}
${C} .wa-notice--consent .wa-notice__icon{color:var(--wa-ink-2)}
${C} .wa-notice__icon svg{width:1.15em;height:1.15em}
${C} .wa-notice__body{flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--wa-gap)}
${C} .wa-notice__title{font-family:var(--wa-font-display);font-size:var(--wa-f-title);line-height:var(--wa-lh-title);font-weight:var(--wa-w-head)}
${C} .wa-notice__link{appearance:none;border:0;background:transparent;padding:6px 0;margin:-6px 0;font:inherit;cursor:pointer;align-self:flex-start;
  display:inline-flex;align-items:center;gap:.35em;color:var(--wa-link);font-weight:var(--wa-w-ctl);text-decoration:underline;text-underline-offset:.18em;
  min-height:max(44px,calc(var(--wa-t)*.8))}
${C} .wa-notice__link svg{width:.9em;height:.9em;flex:none}
${C} .wa-errlist{display:flex;flex-direction:column;gap:6px}
${C} .wa-success{display:flex;flex-direction:column;gap:var(--wa-gap);padding:var(--wa-panel-pad);border-radius:28px;background:var(--wa-success-tint);
  color:var(--wa-ink);box-shadow:inset 0 0 0 var(--wa-edge) var(--wa-edge-color);animation:wa-in .25s ease-out both}
${C} .wa-success__icon{display:grid;place-items:center;width:calc(var(--wa-f)*2.4);height:calc(var(--wa-f)*2.4);border-radius:50%;background:var(--wa-success);color:var(--wa-success-tint)}
${C} .wa-success__icon svg{width:62%;height:62%;stroke-width:2.4}
${C} .wa-success h2:focus{outline:none}
${C} .wa-success__ref{display:flex;align-items:center;flex-wrap:wrap;gap:12px 16px}
${C} .wa-success__refno{font-size:var(--wa-f-big);font-weight:var(--wa-w-head);font-variant-numeric:tabular-nums;letter-spacing:.02em}
${C} .wa-help{display:flex;flex-wrap:wrap;align-items:center;gap:6px 18px;background:var(--wa-raised);border-radius:var(--wa-r-card);
  padding:calc(var(--wa-card-pad)*.75) var(--wa-card-pad);box-shadow:var(--wa-shadow-card),inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}
${C} .wa-help__icon{flex:none;display:grid;place-items:center;width:2em;height:2em;border-radius:50%;background:var(--wa-accent-tint);color:var(--wa-accent)}
${C} .wa-help__icon svg{width:55%;height:55%}
${C} .wa-help__body{flex:1 1 16em;display:flex;flex-direction:column;gap:2px;min-width:0}
${C} .wa-portal__title{margin-bottom:12px}
${C} .wa-portal .wa-row{min-height:64px}
${C} .wa-helpgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,18em),1fr));gap:var(--wa-card-gap)}
${C} .wa-helptile{display:flex;flex-direction:column;gap:var(--wa-gap-s);padding:var(--wa-card-pad);border-radius:var(--wa-r-card);background:var(--wa-raised);
  box-shadow:var(--wa-shadow-card),inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}
${C} .wa-helptile .wa-h-title{display:flex;align-items:center;gap:12px;margin-bottom:4px}
${C} .wa-helptile .wa-help__icon{width:1.6em;height:1.6em}
${C} .wa-helptile .wa-list{gap:4px}
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

/* ---------- product ---------- */
${C} .wa-buy{display:grid;gap:var(--wa-card-gap);align-items:start}
${C} .wa-buy__media .wa-well{aspect-ratio:1/1;border-radius:var(--wa-r-panel);max-height:32vh;margin-inline:auto}
${C} .wa-buy__info{display:flex;flex-direction:column;gap:var(--wa-gap)}
${C} .wa-buy__price{font-size:var(--wa-f-big);font-weight:600;font-variant-numeric:tabular-nums}
${C} .wa-buy__opts{display:flex;flex-direction:column;gap:var(--wa-gap)}
${C} .wa-buy__opts .wa-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;background:transparent;box-shadow:none;overflow:visible}
${C} .wa-buy__opts .wa-choice{min-height:calc(var(--wa-t)*1.25);border-radius:14px;background:var(--wa-raised);box-shadow:inset 0 0 0 max(1px,var(--wa-edge)) var(--wa-line)}
${C} .wa-buy__opts .wa-choice::before{display:none}
${C} .wa-buy__opts .wa-choice[data-checked]{box-shadow:inset 0 0 0 2px var(--wa-action)}
@container wa (min-width: 1100px){
  ${C} .wa-buy:not(.wa-buy--nomedia){grid-template-columns:5fr 7fr;gap:calc(var(--wa-card-gap)*2)}
  ${C} .wa-buy__media{position:sticky;top:calc(var(--wa-strip-h) + 20px)}
  ${C} .wa-buy__media .wa-well{max-height:none}
}

/* ---------- reading ---------- */
${C} .wa-sheet{background:var(--wa-raised);border-radius:28px;padding:var(--wa-panel-pad);
  box-shadow:var(--wa-shadow-card),inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}
${C} .wa-prose{display:flex;flex-direction:column;gap:.85em;max-width:min(var(--wa-measure),100%)}
${C} .wa-prose>.wa-h-title{margin-top:.5em}
${C} .wa-byline{color:var(--wa-ink-2)}
${C} .wa-tools{display:flex;flex-wrap:wrap;gap:4px 10px}
${C} .wa-btn--tool{background:transparent;box-shadow:none;color:var(--wa-link);padding-inline:10px;min-width:0}
${C} .wa-btn--tool:hover{background:var(--wa-tonal)}
${C} .wa-frame{display:flex;flex-direction:column;gap:var(--wa-gap);background:var(--wa-raised);border-radius:var(--wa-r-media);padding:var(--wa-card-pad);
  box-shadow:var(--wa-shadow-card),inset 0 0 0 var(--wa-edge) var(--wa-edge-color)}

/* ---------- the page's own top-bar controls, under the task ---------- */
${C} .wa-substrip{display:flex;flex-wrap:wrap;align-items:center;gap:8px 6px}
${C} .wa-substrip .wa-search{flex:1 1 14em;max-width:22em;margin-right:8px}
${C} .wa-substrip .wa-strip__item{max-width:16em}
${C} .wa-substrip .wa-strip__item .wa-btn{min-height:max(44px,var(--wa-t));padding-inline:12px;background:transparent;box-shadow:none;color:var(--wa-link);max-width:100%}
${C} .wa-substrip .wa-strip__item .wa-btn span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${C} .wa-substrip .wa-strip__item .wa-btn:hover{background:var(--wa-tonal)}
${C} .wa-substrip .wa-search .wa-btn{min-height:max(44px,var(--wa-t));padding-inline:16px}
${C} .wa-search{display:flex;align-items:center;gap:8px;min-width:12em}
${C} .wa-search__field{position:relative;flex:1;min-width:0;display:flex;align-items:center}
${C} .wa-search__field svg{position:absolute;left:16px;width:1em;height:1em;color:var(--wa-ink-2);pointer-events:none}
${C} .wa-search input{width:100%;min-height:max(44px,var(--wa-t));padding:0 16px 0 calc(16px + 1.6em);border:0;border-radius:var(--wa-r-pill);
  background:var(--wa-raised);color:var(--wa-ink);box-shadow:inset 0 0 0 max(1px,var(--wa-edge)) var(--wa-line)}
${C} .wa-search input:focus{outline:none;box-shadow:0 0 0 var(--wa-ring) var(--wa-focus)}

/* ---------- page results and page popups ---------- */
${C} .wa-result{display:flex;flex-direction:column;gap:var(--wa-gap);background:var(--wa-raised);border-radius:var(--wa-r-panel);padding:var(--wa-panel-pad);
  box-shadow:var(--wa-shadow-card),inset 0 0 0 max(2px,var(--wa-edge)) var(--wa-action)}
${C} .wa-popup{position:fixed;z-index:6;left:50%;top:calc(var(--wa-strip-h) + 20px);transform:translateX(-50%);
  width:min(calc(100% - 2 * var(--wa-side-pad)),calc(var(--wa-col-max) * .82));max-height:calc(100% - var(--wa-strip-h) - 40px);overflow:auto;
  background:var(--wa-raised);border-radius:var(--wa-r-card);padding:var(--wa-card-pad);display:flex;flex-direction:column;gap:var(--wa-gap);
  box-shadow:var(--wa-shadow-float),inset 0 0 0 var(--wa-edge) var(--wa-edge-color);animation:wa-in .2s ease-out both}
${C} .wa-popup__head{display:flex;align-items:center;justify-content:space-between;gap:12px}
${C} .wa-foot{margin-top:var(--wa-band-gap);padding-top:var(--wa-card-gap);box-shadow:0 calc(var(--wa-hair) * -1) 0 var(--wa-line);color:var(--wa-ink-2);
  display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 24px}
${C} .wa-empty{color:var(--wa-ink-2);text-align:center;padding:var(--wa-band-gap) 0}

/* ---------- dark: product shots stay in a light well ---------- */
${C}[data-scheme=dark] :is(.wa-buy__media,.wa-tile,.wa-gallery) .wa-well{background:#F5F5F7}

/* ---------- maximum contrast: no tints, glass or shadows; 2px borders; underlined links ---------- */
${C}[data-mode=max] :is(.wa-panel,.wa-rows,.wa-choices,.wa-facts,.wa-tile,.wa-disc,.wa-help,.wa-sheet,.wa-frame,.wa-table-wrap,.wa-notice,.wa-success,.wa-aboutwell,.wa-popover,.wa-result,.wa-popup){
  box-shadow:inset 0 0 0 2px var(--wa-ink)!important;background:var(--wa-raised)!important}
${C}[data-mode=max] .wa-notice{box-shadow:inset 6px 0 0 var(--wa-ink),inset 0 0 0 2px var(--wa-ink)!important}
${C}[data-mode=max] :is(.wa-strip,.wa-dock){background:var(--wa-canvas);-webkit-backdrop-filter:none;backdrop-filter:none}
${C}[data-mode=max] .wa-strip{box-shadow:0 2px 0 var(--wa-ink)}
${C}[data-mode=max] .wa-dock{box-shadow:0 -2px 0 var(--wa-ink)}
${C}[data-mode=max] :is(a,.wa-btn--link,.wa-inline-link,.wa-about,.wa-notice__link,.wa-row__title){text-decoration:underline;text-underline-offset:.18em}
${C}[data-mode=max] :is(.wa-provchip,.wa-btn--soft,.wa-btn--tonal,.wa-btn--done){background:var(--wa-canvas)!important;color:var(--wa-ink)!important;box-shadow:inset 0 0 0 2px var(--wa-ink)!important}
${C}[data-mode=max] :focus-visible{outline:3px solid var(--wa-focus);outline-offset:3px}
${C}[data-mode=max] .wa-input{border-width:2px;border-color:var(--wa-ink)}

/* ---------- motion ---------- */
@keyframes wa-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes wa-dock{from{transform:translateY(100%)}to{transform:none}}
@keyframes wa-swap{from{opacity:0}to{opacity:1}}
@keyframes wa-pulse{0%,100%{opacity:1}50%{opacity:.3}}
${C} .wa-fade{animation:wa-in .25s ease-out both}
${C} .wa-popup.wa-fade{animation:none}
@media (prefers-reduced-motion: reduce){
  ${C},${C} *{animation:none!important;transition:none!important;scroll-behavior:auto!important}
}
${C}[data-motion=reduce],${C}[data-motion=reduce] *{animation:none!important;transition:none!important;scroll-behavior:auto!important}
`;
