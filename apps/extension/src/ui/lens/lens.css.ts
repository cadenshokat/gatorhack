// Owner: D2. The Jev Lens overlay: boxes and chips over the page, header strip, decision drawer.
import { DISPLAY_STACK, MONO_STACK, VERDICT, u } from '../panel/css-util';

export const lensCss = /* css */ `
.wa-lens { position: fixed; inset: 0; z-index: 20; pointer-events: none; overflow: hidden; }
.wa-lbox, .wa-lchip { position: absolute; top: 0; left: 0; will-change: transform; visibility: hidden; }
.wa-lbox {
  border-radius: ${u(7)}; border: ${u(1.5)} solid rgba(94,94,99,.55);
  animation: wa-lfade 420ms ease-out both; animation-delay: calc(var(--i, 0) * 14ms);
  transition: box-shadow 160ms ease, border-width 160ms ease;
}
.wa-lbox[data-v="promote"] {
  border: ${u(2.5)} solid ${VERDICT.promote}; background: rgba(0,113,227,.06);
  box-shadow: 0 0 0 ${u(4)} rgba(0,113,227,.18), 0 0 ${u(28)} rgba(0,113,227,.35);
}
.wa-lbox[data-v="promote"]::after {
  content: ""; position: absolute; inset: ${u(-4)}; border-radius: ${u(10)};
  border: ${u(2)} solid rgba(0,113,227,.55); animation: wa-lring 2.2s ease-out infinite; animation-delay: 900ms;
}
.wa-lbox[data-v="protect"] { border: ${u(2)} solid ${VERDICT.protect}; background: rgba(45,106,62,.05); }
.wa-lbox[data-v="fold"] { border: ${u(2)} dotted ${VERDICT.fold}; background: rgba(182,68,0,.07); }
.wa-lbox[data-v="keep_popup"] { border: ${u(2)} solid ${VERDICT.keep_popup}; background: rgba(107,63,196,.05); }
.wa-lbox[data-v="keep"][data-dashed="true"] { border-style: dashed; border-color: rgba(94,94,99,.5); }
.wa-lbox[data-v="pending"] { border: ${u(1.5)} dashed rgba(134,134,139,.65); animation: wa-lpend 1.4s ease-in-out infinite; }
.wa-lbox[data-hot="true"] { border-width: ${u(3)}; box-shadow: 0 0 0 ${u(5)} rgba(0,0,0,.12); }

.wa-lchip {
  display: inline-flex; align-items: center; gap: ${u(5)}; white-space: nowrap;
  padding: ${u(3)} ${u(8)} ${u(6)} ${u(6)}; border-radius: ${u(8)};
  font-family: ${DISPLAY_STACK}; font-size: ${u(11.5)}; line-height: 1.2; font-weight: 600; letter-spacing: 0;
  color: #FFFFFF; background: ${VERDICT.keep};
  box-shadow: 0 ${u(2)} ${u(8)} rgba(0,0,0,.18), 0 0 0 ${u(1)} rgba(255,255,255,.6);
  animation: wa-lpop 380ms cubic-bezier(.2,.9,.3,1.25) both; animation-delay: calc(var(--i, 0) * 14ms);
  transform-origin: left bottom;
}
.wa-lchip svg { flex: none; }
.wa-lchip-p { font-variant-numeric: tabular-nums; opacity: .95; }
.wa-lchip-word { font-weight: 500; opacity: .9; }
.wa-lbar {
  position: absolute; left: ${u(6)}; right: ${u(6)}; bottom: ${u(2.5)}; height: ${u(2.5)};
  border-radius: 999px; background: rgba(255,255,255,.32); overflow: hidden;
}
.wa-lbar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; background: #FFFFFF; }
.wa-lchip[data-v="promote"] { background: ${VERDICT.promote}; font-size: ${u(12.5)}; padding: ${u(4)} ${u(10)} ${u(7)} ${u(7)}; }
.wa-lchip[data-v="protect"] { background: ${VERDICT.protect}; }
.wa-lchip[data-v="fold"] { background: ${VERDICT.fold}; }
.wa-lchip[data-v="keep_popup"] { background: ${VERDICT.keep_popup}; }
.wa-lchip[data-v="keep"] {
  background: rgba(255,255,255,.95); color: #3A3A3C;
  box-shadow: 0 ${u(1)} ${u(4)} rgba(0,0,0,.12), inset 0 0 0 ${u(1)} rgba(94,94,99,.55);
}
.wa-lchip[data-v="keep"][data-dashed="true"] { color: #5E5E63; box-shadow: 0 ${u(1)} ${u(4)} rgba(0,0,0,.1); outline: ${u(1)} dashed rgba(94,94,99,.7); outline-offset: ${u(-1)}; }
.wa-lchip[data-v="keep"] .wa-lbar { background: rgba(94,94,99,.18); }
.wa-lchip[data-v="keep"] .wa-lbar i { background: #6E6E73; }
.wa-lchip[data-v="pending"] { background: rgba(255,255,255,.92); color: #6E6E73; font-weight: 500; animation: wa-lpend 1.4s ease-in-out infinite; }
.wa-lchip[data-v="pending"] .wa-lbar { display: none; }
.wa-lchip[data-hot="true"] { transform-origin: left bottom; box-shadow: 0 ${u(4)} ${u(14)} rgba(0,0,0,.28), 0 0 0 ${u(2)} #FFFFFF; z-index: 2; }
.wa-lchip[data-band="offer"] .wa-lbar i { background-image: repeating-linear-gradient(90deg, #FFFFFF 0 ${u(3)}, rgba(255,255,255,.55) ${u(3)} ${u(5)}); }

.wa-lscan {
  position: absolute; left: 0; right: 0; top: 0; height: ${u(140)};
  background: linear-gradient(180deg, rgba(0,113,227,0) 0%, rgba(0,113,227,.10) 70%, rgba(0,113,227,.28) 100%);
  border-bottom: ${u(1.5)} solid rgba(0,113,227,.45);
  animation: wa-lscan 1100ms cubic-bezier(.4,.1,.3,1) both;
}

@keyframes wa-lfade { from { opacity: 0; } to { opacity: 1; } }
@keyframes wa-lpop { from { opacity: 0; translate: 0 ${u(6)}; scale: .7; } to { opacity: 1; translate: 0 0; scale: 1; } }
@keyframes wa-lpend { 0%, 100% { opacity: .9; } 50% { opacity: .45; } }
@keyframes wa-lring { 0% { opacity: .9; transform: scale(1); } 70%, 100% { opacity: 0; transform: scale(1.06); } }
@keyframes wa-lscan { from { transform: translateY(${u(-150)}); opacity: 1; } 85% { opacity: 1; } to { transform: translateY(100vh); opacity: 0; } }

/* ---------- header strip ---------- */
.wa-lhead {
  position: absolute; top: ${u(12)}; left: 50%; transform: translateX(-50%);
  width: max-content; max-width: calc(100vw - ${u(24)});
  display: grid; gap: ${u(5)}; padding: ${u(8)} ${u(8)} ${u(9)} ${u(16)};
  border-radius: ${u(20)}; background: var(--c-glass); color: var(--c-ink);
  -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px);
  box-shadow: var(--c-shadow-float), inset 0 0 0 ${u(0.5)} rgba(0,0,0,.08);
  border: ${u(1)} solid var(--c-edge);
  pointer-events: auto; animation: wa-rise 260ms cubic-bezier(.2,.8,.3,1);
  transition: left 220ms cubic-bezier(.2,.8,.3,1), transform 220ms cubic-bezier(.2,.8,.3,1);
}
.wa-lhead[data-drawer="open"] {
  left: ${u(12)}; transform: none;
  max-width: calc(100vw - min(${u(440)}, calc(100vw - ${u(24)})) - ${u(36)});
}
.wa-lhead-row { display: flex; align-items: center; gap: ${u(6)} ${u(12)}; flex-wrap: wrap; }
.wa-lhead .wa-btn-sm { min-height: ${u(32)}; padding: 0 ${u(12)}; font-size: ${u(13)}; }
.wa-lhead .wa-iconbtn { width: ${u(32)}; height: ${u(32)}; }
.wa-lbrand { display: inline-flex; align-items: center; gap: ${u(6)}; font-family: ${DISPLAY_STACK}; font-weight: 600; font-size: ${u(15)}; letter-spacing: -0.01em; }
.wa-lbrand svg { color: ${VERDICT.promote}; }
.wa-lstats { display: inline-flex; align-items: baseline; flex-wrap: wrap; gap: ${u(3)} ${u(7)}; font-size: ${u(13)}; color: var(--c-ink2); }
.wa-lstats b { color: var(--c-ink); font-weight: 600; font-variant-numeric: tabular-nums; font-size: ${u(14)}; }
.wa-lstats .wa-sep { opacity: .45; }
.wa-lhead-btns { margin-left: auto; display: inline-flex; gap: ${u(6)}; align-items: center; }
.wa-legend { display: inline-flex; flex-wrap: wrap; gap: ${u(4)} ${u(10)}; font-size: ${u(11.5)}; color: var(--c-ink2); align-items: center; }
.wa-legend-item { display: inline-flex; align-items: center; gap: ${u(6)}; white-space: nowrap; }
.wa-sw { width: ${u(18)}; height: ${u(5)}; border-radius: 999px; background: var(--c-ink); }
.wa-sw-offer { background: repeating-linear-gradient(90deg, var(--c-ink) 0 ${u(3)}, transparent ${u(3)} ${u(5)}); box-shadow: inset 0 0 0 ${u(1)} var(--c-ink); }
.wa-sw-leave { background: transparent; box-shadow: inset 0 0 0 ${u(1)} var(--c-line-strong); }
.wa-vkey { display: inline-flex; align-items: center; gap: ${u(5)}; white-space: nowrap; }
.wa-vkey i { width: ${u(9)}; height: ${u(9)}; border-radius: ${u(3)}; display: inline-block; }
.wa-lhead-sep { width: ${u(1)}; height: ${u(12)}; background: var(--c-line); }
.wa-lsummary { display: inline-flex; flex-wrap: wrap; gap: ${u(3)} ${u(10)}; font-size: ${u(11.5)}; color: var(--c-ink2); }
.wa-lsummary b { color: var(--c-ink); font-weight: 600; }

/* ---------- drawer ---------- */
.wa-ldrawer {
  position: absolute; right: ${u(12)}; top: ${u(12)}; bottom: ${u(12)};
  width: min(${u(440)}, calc(100vw - ${u(24)}));
  display: flex; flex-direction: column; overflow: hidden;
  border-radius: ${u(24)}; background: var(--c-sheet); color: var(--c-ink);
  -webkit-backdrop-filter: saturate(180%) blur(24px); backdrop-filter: saturate(180%) blur(24px);
  box-shadow: var(--c-shadow-float), inset 0 0 0 ${u(0.5)} rgba(0,0,0,.08);
  border: ${u(1)} solid var(--c-edge);
  pointer-events: auto; animation: wa-slide 240ms cubic-bezier(.2,.8,.3,1);
}
@keyframes wa-slide { from { opacity: 0; transform: translateX(${u(16)}); } to { opacity: 1; transform: none; } }
.wa-ldrawer-head { display: flex; align-items: center; gap: ${u(8)}; padding: ${u(14)} ${u(14)} ${u(10)} ${u(18)}; }
.wa-ldrawer-head h3 { margin: 0; flex: 1; font-family: ${DISPLAY_STACK}; font-size: ${u(18)}; font-weight: 600; letter-spacing: -0.012em; }
.wa-tabs { display: inline-flex; padding: ${u(3)}; gap: ${u(2)}; background: var(--c-tonal); border-radius: 999px; margin: 0 ${u(14)} ${u(10)}; align-self: flex-start; }
.wa-tab {
  appearance: none; border: 0; background: transparent; color: var(--c-ink2); cursor: pointer;
  min-height: max(${u(32)}, calc(0.75 * var(--wa-target, 44px))); padding: 0 ${u(14)}; border-radius: 999px;
  font-size: ${u(13.5)}; font-weight: 600;
}
.wa-tab[aria-selected="true"] { background: var(--c-raised); color: var(--c-ink); box-shadow: 0 1px 3px rgba(0,0,0,.12); }
.wa-ldrawer-body { flex: 1; overflow: auto; overscroll-behavior: contain; padding: 0 ${u(10)} ${u(12)}; }
.wa-lrows { list-style: none; margin: 0; padding: 0; display: grid; gap: ${u(2)}; }
.wa-lrow {
  appearance: none; width: 100%; border: 0; background: transparent; text-align: left; cursor: pointer;
  display: grid; grid-template-columns: ${u(10)} 1fr auto; gap: ${u(2)} ${u(10)}; align-items: center;
  padding: ${u(9)} ${u(10)}; border-radius: ${u(12)}; color: var(--c-ink);
  animation: wa-lrow 300ms ease-out both; animation-delay: calc(var(--i, 0) * 18ms);
}
.wa-lrow:hover, .wa-lrow:focus-visible { background: var(--c-raised); }
@keyframes wa-lrow { from { opacity: 0; transform: translateY(${u(4)}); } to { opacity: 1; transform: none; } }
.wa-lrow-dot { width: ${u(10)}; height: ${u(10)}; border-radius: ${u(3)}; background: ${VERDICT.keep}; grid-row: span 2; align-self: start; margin-top: ${u(5)}; }
.wa-lrow-label { font-size: ${u(14)}; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wa-lrow-p { font-variant-numeric: tabular-nums; font-weight: 600; font-size: ${u(14)}; text-align: right; }
.wa-lrow-sub { grid-column: 2 / 4; font-size: ${u(12)}; color: var(--c-ink2); display: flex; gap: ${u(6)}; flex-wrap: wrap; }
.wa-lrow-bar { grid-column: 2 / 4; height: ${u(3)}; border-radius: 999px; background: var(--c-tonal); position: relative; overflow: hidden; margin-top: ${u(2)}; }
.wa-lrow-bar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; background: ${VERDICT.keep}; }
.wa-lgroup { font-size: ${u(12)}; font-weight: 600; color: var(--c-ink2); padding: ${u(12)} ${u(10)} ${u(4)}; }
.wa-json {
  margin: 0; padding: ${u(14)}; border-radius: ${u(16)}; background: var(--c-raised);
  font-family: ${MONO_STACK}; font-size: ${u(11.5)}; line-height: 1.55; color: var(--c-ink2);
  white-space: pre; overflow: visible; tab-size: 2; user-select: text; -webkit-user-select: text;
  border: ${u(1)} solid var(--c-edge);
}
.wa-j-key { color: var(--c-ink); font-weight: 600; }
.wa-j-str { color: #1E7B34; }
.wa-j-num { color: #0058B9; }
.wa-j-lit { color: #8A2BB0; }
.wa-root[data-mode="dark"] .wa-j-str { color: #8FCB9B; }
.wa-root[data-mode="dark"] .wa-j-num { color: #6CB4FF; }
.wa-root[data-mode="dark"] .wa-j-lit { color: #D7A6F5; }
.wa-raw-note { font-size: ${u(12.5)}; color: var(--c-ink2); margin: 0 ${u(4)} ${u(10)}; }

/* ---------- today meter ---------- */
.wa-ltoday {
  position: absolute; left: ${u(16)}; bottom: ${u(16)};
  display: inline-flex; align-items: center; gap: ${u(8)}; padding: ${u(8)} ${u(14)};
  border-radius: 999px; background: var(--c-glass); color: var(--c-ink2); font-size: ${u(13)};
  -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px);
  box-shadow: var(--c-shadow-float); border: ${u(1)} solid var(--c-edge);
  font-variant-numeric: tabular-nums; pointer-events: none;
}
.wa-ltoday b { color: var(--c-ink); font-weight: 600; }
`;
