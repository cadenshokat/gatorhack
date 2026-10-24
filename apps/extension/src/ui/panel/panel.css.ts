// Owner: D2. Root theme bridge, shared controls, pill and panel styles.
// Colours read D1's tokens (var(--wa-ink) …, set on :host by mount.ts) and fall back to the Showroom values.
import { DISPLAY_STACK, FONT_STACK, target, u } from './css-util';

export const rootCss = /* css */ `
:host { all: initial !important; }
.wa-layer {
  margin: 0; padding: 0; border: 0; inset: 0; width: 100vw; height: 100dvh;
  max-width: none; max-height: none; background: transparent; overflow: visible;
  pointer-events: none; color: inherit; position: fixed; display: block;
}
.wa-layer.wa-nopopover { z-index: 2147483646; }
.wa-root {
  --c-canvas: var(--wa-canvas, #F5F5F7);
  --c-raised: var(--wa-raised, #FFFFFF);
  --c-tonal: var(--wa-tonal, #E8E8ED);
  --c-hover: var(--wa-hover, #DCDCE1);
  --c-press: var(--wa-press, #D2D2D7);
  --c-ink: var(--wa-ink, #1D1D1F);
  --c-ink2: var(--wa-ink-2, #5E5E63);
  --c-line: var(--wa-line, #D2D2D7);
  --c-line-strong: var(--wa-line-strong, #86868B);
  --c-action: var(--wa-action, #0071E3);
  --c-on-action: var(--wa-on-action, #FFFFFF);
  --c-action-hover: var(--wa-action-hover, #0077ED);
  --c-link: var(--wa-link, #0066CC);
  --c-accent: var(--wa-accent, #2D6A3E);
  --c-on-accent: var(--wa-on-accent, #FFFFFF);
  --c-accent-hover: var(--wa-accent-hover, #22552F);
  --c-accent-tint: var(--wa-accent-tint, #E4EFE6);
  --c-warn: var(--wa-warning, #7A4800);
  --c-warn-tint: var(--wa-warning-tint, #FAEFD9);
  --c-focus: var(--wa-focus, #0071E3);
  --c-glass: var(--wa-glass, rgba(255, 255, 255, 0.78));
  --c-sheet: rgba(245, 245, 247, 0.9);
  --c-shadow-card: var(--wa-shadow-card, 0 1px 2px rgba(0,0,0,.04), 0 6px 20px rgba(0,0,0,.06));
  --c-shadow-float: var(--wa-shadow-float, 0 12px 40px rgba(0,0,0,.16));
  --c-edge: var(--wa-edge-color, transparent);
  font-family: ${FONT_STACK};
  font-size: ${u(15)};
  line-height: 1.45;
  color: var(--c-ink);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  font-kerning: normal;
  letter-spacing: 0;
  text-align: left;
  pointer-events: none;
}
.wa-root[data-mode="dark"] {
  --c-canvas: var(--wa-canvas, #000000);
  --c-raised: var(--wa-raised, #1C1C1E);
  --c-tonal: var(--wa-tonal, #2C2C2E);
  --c-hover: var(--wa-hover, #3A3A3C);
  --c-press: var(--wa-press, #48484A);
  --c-ink: var(--wa-ink, #F5F5F7);
  --c-ink2: var(--wa-ink-2, #A1A1A6);
  --c-line: var(--wa-line, #38383A);
  --c-line-strong: var(--wa-line-strong, #8E8E93);
  --c-link: var(--wa-link, #2997FF);
  --c-accent: var(--wa-accent, #8FCB9B);
  --c-on-accent: var(--wa-on-accent, #0F1A12);
  --c-accent-hover: var(--wa-accent-hover, #A9D9B2);
  --c-accent-tint: var(--wa-accent-tint, #1B2B1F);
  --c-warn: var(--wa-warning, #F2B75E);
  --c-warn-tint: var(--wa-warning-tint, #2E2412);
  --c-focus: var(--wa-focus, #2997FF);
  --c-glass: var(--wa-glass, rgba(22, 22, 23, 0.82));
  --c-sheet: rgba(28, 28, 30, 0.92);
  --c-shadow-card: none;
  --c-shadow-float: var(--wa-shadow-float, 0 12px 40px rgba(0,0,0,.6));
}
.wa-root[data-mode="max"] {
  --c-canvas: var(--wa-canvas, #FFFFFF); --c-raised: var(--wa-raised, #FFFFFF); --c-tonal: var(--wa-tonal, #F0F0F0);
  --c-hover: var(--wa-hover, #E2E2E2); --c-press: var(--wa-press, #D4D4D4);
  --c-ink: var(--wa-ink, #000000); --c-ink2: var(--wa-ink-2, #000000);
  --c-line: var(--wa-line, #000000); --c-line-strong: var(--wa-line-strong, #000000);
  --c-action: var(--wa-action, #0040DD); --c-action-hover: var(--wa-action-hover, #0033B8); --c-link: var(--wa-link, #0040DD);
  --c-focus: var(--wa-focus, #000000);
  --c-accent: var(--wa-accent, #1F4D2B); --c-accent-hover: var(--wa-accent-hover, #163A20); --c-accent-tint: var(--wa-accent-tint, #E4EFE6);
  --c-warn: var(--wa-warning, #5C3600); --c-warn-tint: var(--wa-warning-tint, #FAEFD9);
  --c-glass: var(--wa-glass, rgba(255,255,255,.97)); --c-sheet: var(--wa-raised, #FFFFFF);
  --c-shadow-card: none; --c-shadow-float: var(--wa-shadow-float, none);
  --c-edge: var(--wa-edge-color, #000000);
}
.wa-root *, .wa-root *::before, .wa-root *::after { box-sizing: border-box; }
:where(.wa-root) button { font: inherit; color: inherit; letter-spacing: inherit; }
.wa-root :focus { outline: none; }
.wa-root :focus-visible {
  outline: ${u(3)} solid var(--c-focus);
  outline-offset: ${u(2)};
}
.wa-sr {
  position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
.wa-num { font-variant-numeric: tabular-nums; }

/* ---------- buttons ---------- */
.wa-btn {
  appearance: none; -webkit-appearance: none;
  display: inline-flex; align-items: center; justify-content: center; gap: ${u(8)};
  min-height: ${target()}; min-width: ${target()};
  padding: 0 ${u(18)};
  border: ${u(1)} solid var(--c-edge); border-radius: 999px;
  background: var(--c-tonal); color: var(--c-ink);
  font-size: ${u(15)}; font-weight: 500; line-height: 1.2; white-space: nowrap;
  cursor: pointer; user-select: none; -webkit-user-select: none;
  transition: background-color 160ms ease, color 160ms ease, box-shadow 160ms ease;
  pointer-events: auto;
}
.wa-btn:hover { background: var(--c-hover); }
.wa-btn:active { background: var(--c-press); }
.wa-btn[disabled] { opacity: 0.55; cursor: default; }
.wa-btn[aria-pressed="true"]:not(.wa-btn-primary):not(.wa-btn-accent) { background: var(--c-ink); color: var(--c-raised); }
.wa-btn-primary { background: var(--c-action); color: var(--c-on-action); }
.wa-btn-primary:hover { background: var(--c-action-hover); }
.wa-btn-primary:active { background: var(--c-action); }
.wa-btn-accent { background: var(--c-accent); color: var(--c-on-accent); }
.wa-btn-accent:hover { background: var(--c-accent-hover); }
.wa-btn-quiet { background: transparent; color: var(--c-link); padding: 0 ${u(10)}; }
.wa-btn-quiet:hover { background: var(--c-tonal); }
.wa-btn-block { width: 100%; }
.wa-btn-sm { min-height: max(${u(34)}, calc(0.8 * var(--wa-target, 44px))); min-width: 0; padding: 0 ${u(14)}; font-size: ${u(14)}; }
.wa-iconbtn {
  appearance: none; display: inline-grid; place-items: center;
  width: max(${u(36)}, calc(0.8 * var(--wa-target, 44px))); height: max(${u(36)}, calc(0.8 * var(--wa-target, 44px)));
  border: ${u(1)} solid var(--c-edge); border-radius: 999px; background: var(--c-tonal); color: var(--c-ink2);
  cursor: pointer; pointer-events: auto; transition: background-color 160ms ease, color 160ms ease;
  flex: none;
}
.wa-iconbtn:hover { background: var(--c-hover); color: var(--c-ink); }
.wa-link {
  appearance: none; background: none; border: 0; padding: ${u(4)} ${u(2)}; margin: 0;
  color: var(--c-link); font-size: ${u(14)}; font-weight: 500; cursor: pointer; pointer-events: auto;
  text-decoration: none; border-radius: ${u(6)};
}
.wa-link:hover { text-decoration: underline; text-underline-offset: ${u(3)}; }

/* ---------- switch rows ---------- */
.wa-switch {
  appearance: none; display: flex; align-items: center; gap: ${u(12)}; width: 100%;
  min-height: ${target()}; padding: ${u(10)} ${u(16)}; margin: 0;
  background: transparent; border: 0; text-align: left; cursor: pointer; pointer-events: auto;
  color: var(--c-ink); border-radius: ${u(14)};
  transition: background-color 160ms ease;
}
.wa-switch:hover { background: rgba(0,0,0,0.035); }
.wa-root[data-mode="dark"] .wa-switch:hover { background: rgba(255,255,255,0.06); }
.wa-switch-text { flex: 1; min-width: 0; display: grid; gap: ${u(2)}; }
.wa-switch-title { font-size: ${u(15)}; font-weight: 500; }
.wa-switch-sub { font-size: ${u(13)}; color: var(--c-ink2); }
.wa-track {
  flex: none; position: relative; width: ${u(46)}; height: ${u(28)}; border-radius: 999px;
  background: var(--c-press); transition: background-color 180ms ease;
  border: ${u(1)} solid var(--c-edge);
}
.wa-track::after {
  content: ""; position: absolute; top: ${u(2)}; left: ${u(2)}; width: ${u(24)}; height: ${u(24)};
  border-radius: 999px; background: #FFFFFF; box-shadow: 0 1px 3px rgba(0,0,0,.25);
  transition: transform 180ms cubic-bezier(.3,.7,.4,1);
}
.wa-switch[aria-checked="true"] .wa-track { background: var(--c-accent); }
.wa-switch[aria-checked="true"] .wa-track::after { transform: translateX(${u(18)}); }
.wa-kbd {
  display: inline-block; font-size: ${u(11.5)}; font-weight: 600; color: var(--c-ink2);
  border: ${u(1)} solid var(--c-line); border-bottom-width: ${u(2)}; border-radius: ${u(6)};
  padding: 0 ${u(5)}; margin-left: ${u(6)}; line-height: 1.5; vertical-align: 1px;
}

/* ---------- pill ---------- */
.wa-pill {
  position: fixed; right: ${u(16)}; z-index: 40;
  appearance: none; display: inline-flex; align-items: center; gap: ${u(9)};
  height: ${target()}; min-width: ${target()}; padding: 0 ${u(16)} 0 ${u(14)};
  border-radius: 999px; border: ${u(1)} solid var(--c-edge);
  background: var(--c-glass); color: var(--c-ink);
  -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px);
  box-shadow: var(--c-shadow-float), inset 0 0 0 ${u(0.5)} rgba(0,0,0,0.06);
  font-family: ${DISPLAY_STACK}; font-size: ${u(15)}; font-weight: 600; letter-spacing: -0.01em;
  cursor: pointer; pointer-events: auto;
  transition: bottom 260ms cubic-bezier(.3,.7,.4,1), transform 160ms ease, box-shadow 160ms ease;
}
.wa-pill:hover { transform: translateY(${u(-1)}); }
.wa-pill[aria-expanded="true"] { background: var(--c-raised); }
.wa-pill-count {
  min-width: ${u(22)}; height: ${u(22)}; padding: 0 ${u(6)}; border-radius: 999px;
  display: inline-grid; place-items: center; background: var(--c-accent-tint); color: var(--c-accent);
  font-size: ${u(12.5)}; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: 0;
}
.wa-dot { position: relative; width: ${u(10)}; height: ${u(10)}; border-radius: 999px; background: var(--c-line-strong); flex: none; }
.wa-dot[data-state="changed"] { background: var(--c-accent); box-shadow: 0 0 0 ${u(3)} var(--c-accent-tint); }
.wa-dot[data-state="original"] { background: transparent; box-shadow: inset 0 0 0 ${u(2)} var(--c-accent); }
.wa-dot[data-state="error"] { background: var(--c-warn); }
.wa-dot[data-state="working"] { background: var(--c-accent); animation: wa-breathe 1.4s ease-in-out infinite; }
@keyframes wa-breathe { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .35; transform: scale(.8); } }

/* ---------- panel ---------- */
.wa-panel {
  position: fixed; right: ${u(16)}; z-index: 39;
  width: min(${u(392)}, calc(100vw - ${u(32)}));
  display: flex; flex-direction: column;
  border-radius: ${u(28)}; border: ${u(1)} solid var(--c-edge);
  background: var(--c-sheet); color: var(--c-ink);
  -webkit-backdrop-filter: saturate(180%) blur(24px); backdrop-filter: saturate(180%) blur(24px);
  box-shadow: var(--c-shadow-float), inset 0 0 0 ${u(0.5)} rgba(0,0,0,0.08);
  pointer-events: auto; overflow: hidden;
  animation: wa-rise 220ms cubic-bezier(.2,.8,.3,1);
  transform-origin: bottom right;
}
@keyframes wa-rise { from { opacity: 0; transform: translateY(${u(10)}) scale(.98); } to { opacity: 1; transform: none; } }
.wa-panel-head { display: flex; align-items: flex-start; gap: ${u(12)}; padding: ${u(16)} ${u(16)} ${u(10)} ${u(20)}; }
.wa-panel-title { flex: 1; min-width: 0; }
.wa-panel-title h2 {
  margin: 0; font-family: ${DISPLAY_STACK}; font-size: ${u(21)}; line-height: 1.15; font-weight: 600;
  letter-spacing: -0.016em; display: flex; align-items: center; gap: ${u(8)};
}
.wa-panel-title p { margin: ${u(4)} 0 0; font-size: ${u(13.5)}; color: var(--c-ink2); }
.wa-panel-body { overflow-y: auto; overscroll-behavior: contain; padding: 0 ${u(12)} ${u(12)}; display: grid; gap: ${u(8)}; }
.wa-card {
  background: var(--c-raised); border-radius: ${u(20)}; box-shadow: var(--c-shadow-card);
  border: ${u(1)} solid var(--c-edge); padding: ${u(6)};
}
.wa-card-pad { padding: ${u(14)} ${u(16)}; }
.wa-card-title {
  display: flex; align-items: baseline; justify-content: space-between; gap: ${u(8)};
  margin: 0 0 ${u(10)}; font-size: ${u(13)}; font-weight: 600; color: var(--c-ink2);
  text-transform: none; letter-spacing: 0;
}
.wa-card-title-inset { padding: ${u(10)} ${u(10)} 0; margin: 0; }
.wa-card-title b { color: var(--c-ink); font-weight: 600; font-size: ${u(15)}; }
.wa-actions { display: grid; grid-template-columns: 1fr 1fr; gap: ${u(8)}; padding: ${u(6)}; }
.wa-actions .wa-btn { width: 100%; }
.wa-hr { height: ${u(1)}; background: var(--c-line); margin: ${u(2)} ${u(16)}; opacity: .7; }
.wa-panel-foot {
  display: flex; align-items: center; justify-content: space-between; gap: ${u(8)};
  padding: ${u(10)} ${u(20)} ${u(16)}; font-size: ${u(12.5)}; color: var(--c-ink2);
  border-top: ${u(1)} solid var(--c-line);
}

/* ---------- Jev counter ---------- */
.wa-counter { display: grid; grid-template-columns: repeat(3, 1fr); gap: ${u(4)}; }
.wa-counter-cell { display: grid; gap: ${u(2)}; }
.wa-counter-val {
  font-family: ${DISPLAY_STACK}; font-size: ${u(24)}; line-height: 1.05; font-weight: 600;
  letter-spacing: -0.022em; font-variant-numeric: tabular-nums; color: var(--c-ink);
  white-space: nowrap;
}
.wa-counter-lab { font-size: ${u(12.5)}; color: var(--c-ink2); }
.wa-counter-sub { margin-top: ${u(10)}; font-size: ${u(12.5)}; color: var(--c-ink2); display: flex; flex-wrap: wrap; gap: ${u(4)} ${u(10)}; }
.wa-counter-sub span { white-space: nowrap; }
.wa-badge {
  display: inline-flex; align-items: center; gap: ${u(4)}; padding: ${u(1)} ${u(8)}; border-radius: 999px;
  font-size: ${u(11.5)}; font-weight: 600; background: var(--c-tonal); color: var(--c-ink2); white-space: nowrap;
}
.wa-badge-accent { background: var(--c-accent-tint); color: var(--c-accent); }
.wa-badge-warn { background: var(--c-warn-tint); color: var(--c-warn); }
.wa-badge-blue { background: rgba(0,113,227,.1); color: var(--c-action); }
.wa-shimmer {
  display: inline-block; height: ${u(12)}; border-radius: ${u(6)}; width: 60%;
  background: linear-gradient(90deg, var(--c-tonal) 0%, var(--c-hover) 50%, var(--c-tonal) 100%);
  background-size: 200% 100%; animation: wa-shimmer 1.3s linear infinite;
}
@keyframes wa-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }

/* ---------- gauges ---------- */
.wa-gauges { display: grid; gap: ${u(14)}; }
.wa-gauge { display: grid; gap: ${u(6)}; }
.wa-gauge-head { display: flex; align-items: baseline; gap: ${u(8)}; }
.wa-gauge-name { font-weight: 500; font-size: ${u(14.5)}; }
.wa-gauge-val { margin-left: auto; font-variant-numeric: tabular-nums; font-weight: 600; font-size: ${u(14.5)}; }
.wa-gauge-state { font-size: ${u(12.5)}; color: var(--c-ink2); }
.wa-gauge-state[data-band="offer"] { color: var(--c-accent); font-weight: 600; }
.wa-gauge-state[data-band="wait"] { color: var(--c-warn); font-weight: 600; }
.wa-gtrack { position: relative; height: ${u(12)}; border-radius: 999px; background: var(--c-tonal); overflow: visible; }
.wa-gband { position: absolute; top: 0; bottom: 0; }
.wa-gband-wait {
  left: 50%; width: 25%;
  background: repeating-linear-gradient(135deg, rgba(182,107,0,.22) 0 ${u(3)}, rgba(182,107,0,.08) ${u(3)} ${u(6)});
}
.wa-gband-offer { left: 75%; right: 0; border-radius: 0 999px 999px 0; background: rgba(45,106,62,.16); }
.wa-gfill {
  position: absolute; left: 0; top: ${u(3)}; bottom: ${u(3)}; margin-left: ${u(3)};
  max-width: calc(100% - ${u(6)}); border-radius: 999px; background: var(--c-line-strong);
  transition: width 600ms cubic-bezier(.2,.8,.3,1), background-color 300ms ease;
}
.wa-gfill[data-band="wait"] { background: #B66B00; }
.wa-gfill[data-band="offer"] { background: var(--c-accent); }
.wa-gghost {
  position: absolute; top: ${u(-2)}; bottom: ${u(-2)}; width: ${u(2)}; border-radius: 2px;
  background: var(--c-ink2); opacity: .35; transition: left 600ms cubic-bezier(.2,.8,.3,1);
}
.wa-gtick { position: absolute; top: ${u(-3)}; bottom: ${u(-3)}; width: ${u(1.5)}; background: var(--c-ink); opacity: .5; }
.wa-gscale { position: relative; height: ${u(14)}; font-size: ${u(11)}; color: var(--c-ink2); }
.wa-gscale span { position: absolute; transform: translateX(-50%); white-space: nowrap; }
.wa-note { font-size: ${u(13)}; color: var(--c-ink2); margin: ${u(10)} 0 0; display: flex; gap: ${u(6)}; align-items: flex-start; }
.wa-note svg { flex: none; margin-top: ${u(2)}; }

/* ---------- ledger ---------- */
.wa-ledger { list-style: none; margin: 0; padding: 0; display: grid; }
.wa-entry {
  display: grid; grid-template-columns: ${u(28)} 1fr auto; gap: ${u(4)} ${u(10)}; align-items: start;
  padding: ${u(10)} ${u(10)}; border-radius: ${u(14)};
}
.wa-entry + .wa-entry { border-top: ${u(1)} solid var(--c-line); border-radius: 0; }
.wa-entry-icon {
  width: ${u(28)}; height: ${u(28)}; border-radius: 999px; display: grid; place-items: center;
  background: var(--c-tonal); color: var(--c-ink2);
}
.wa-entry[data-source="jev"] .wa-entry-icon { background: rgba(0,113,227,.1); color: var(--c-action); }
.wa-entry[data-source="fit"] .wa-entry-icon, .wa-entry[data-source="layout"] .wa-entry-icon { background: var(--c-accent-tint); color: var(--c-accent); }
.wa-entry[data-action="reversed"] .wa-entry-icon { background: var(--c-warn-tint); color: var(--c-warn); }
.wa-entry-main { min-width: 0; }
.wa-entry-title { font-size: ${u(14.5)}; line-height: 1.35; overflow-wrap: anywhere; }
.wa-entry-meta { display: flex; flex-wrap: wrap; align-items: center; gap: ${u(6)}; margin-top: ${u(4)}; font-size: ${u(12)}; color: var(--c-ink2); }
.wa-entry-detail { margin-top: ${u(2)}; font-size: ${u(12.5)}; color: var(--c-ink2); overflow-wrap: anywhere; }
.wa-entry-side { display: flex; align-items: center; }
.wa-empty { padding: ${u(14)} ${u(12)}; font-size: ${u(14)}; color: var(--c-ink2); }
.wa-more { display: flex; justify-content: center; padding: ${u(4)} 0 ${u(2)}; }

/* ---------- calm host chips ---------- */
.wa-floatchip {
  position: fixed; left: 50%; transform: translateX(-50%); bottom: ${u(108)}; z-index: 38;
  display: flex; align-items: center; gap: ${u(12)}; padding: ${u(8)} ${u(8)} ${u(8)} ${u(18)};
  border-radius: 999px; background: var(--c-raised); color: var(--c-ink);
  box-shadow: var(--c-shadow-float); border: ${u(1)} solid var(--c-edge);
  pointer-events: auto; font-size: ${u(15)}; font-weight: 500;
  animation: wa-rise 240ms cubic-bezier(.2,.8,.3,1);
}
.wa-floatchip-quiet { padding: ${u(10)} ${u(18)}; font-size: ${u(13.5)}; color: var(--c-ink2); left: auto; right: auto; transform: none; left: ${u(20)}; }
.wa-calm-loading {
  position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; pointer-events: auto;
  background: var(--c-canvas); color: var(--c-ink);
}
.wa-calm-loading-card { display: grid; gap: ${u(14)}; justify-items: center; text-align: center; padding: ${u(32)}; max-width: ${u(460)}; }
.wa-calm-loading-card h2 { margin: 0; font-family: ${DISPLAY_STACK}; font-size: ${u(28)}; font-weight: 600; letter-spacing: -0.02em; }
.wa-calm-loading-card p { margin: 0; color: var(--c-ink2); }
.wa-spinner {
  width: ${u(34)}; height: ${u(34)}; border-radius: 999px; border: ${u(3)} solid var(--c-tonal);
  border-top-color: var(--c-accent); animation: wa-spin 900ms linear infinite;
}
@keyframes wa-spin { to { transform: rotate(360deg); } }

/* ---------- motion off ----------
   Reduced motion: no movement anywhere. The Lens keeps its staggered cross-fade (opacity only), which is not motion. */
.wa-root[data-motion="reduce"] :not(.wa-lchip):not(.wa-lbox):not(.wa-lrow),
.wa-root[data-motion="reduce"] ::before, .wa-root[data-motion="reduce"] ::after {
  animation-duration: 1ms !important; animation-iteration-count: 1 !important;
  transition-duration: 1ms !important; scroll-behavior: auto !important;
}
.wa-root[data-motion="reduce"] .wa-lchip, .wa-root[data-motion="reduce"] .wa-lrow { animation-name: wa-lfade; }
.wa-root[data-motion="reduce"] .wa-lbox[data-v="pending"], .wa-root[data-motion="reduce"] .wa-lchip[data-v="pending"] { animation: none; }
@media (prefers-reduced-motion: reduce) {
  .wa-root :not(.wa-lchip):not(.wa-lbox):not(.wa-lrow), .wa-root ::before, .wa-root ::after {
    animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important;
  }
  .wa-root .wa-lchip, .wa-root .wa-lrow { animation-name: wa-lfade; }
}
`;
