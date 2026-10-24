// Owner: P. Offer card, collapsed offer chip, toasts, the docked cookie-notice bar and the "Show" chips.
import { DISPLAY_STACK, target, u } from '../panel/css-util';

export const offersCss = /* css */ `
.wa-stack {
  position: fixed; z-index: 41;
  width: min(${u(360)}, calc(100vw - ${u(32)}));
  max-height: calc(100dvh - ${u(32)});
  display: flex; flex-direction: column; align-items: flex-end; gap: ${u(10)};
  pointer-events: none;
  transition: right 220ms cubic-bezier(.2,.8,.3,1), left 220ms cubic-bezier(.2,.8,.3,1);
}
.wa-stack[data-side="left"] { align-items: flex-start; }
.wa-stack[data-scroll="true"] { overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; border-radius: ${u(24)}; }
.wa-stack > * { pointer-events: auto; flex: none; }

.wa-offer {
  width: 100%; padding: ${u(18)} ${u(18)} ${u(12)};
  border-radius: ${u(24)}; background: var(--c-raised); color: var(--c-ink);
  box-shadow: var(--c-shadow-float), inset 0 0 0 ${u(0.5)} rgba(0,0,0,.08);
  border: ${u(1)} solid var(--c-edge);
  animation: wa-rise 260ms cubic-bezier(.2,.8,.3,1);
}
.wa-offer-q {
  margin: 0; font-family: ${DISPLAY_STACK}; font-size: ${u(18)}; line-height: 1.25;
  font-weight: 600; letter-spacing: -0.012em;
}
.wa-offer-fact { margin: ${u(6)} 0 0; font-size: ${u(14.5)}; color: var(--c-ink2); }
.wa-offer-btns { display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: 1fr; gap: ${u(8)}; margin-top: ${u(14)}; }
.wa-offer-btns .wa-btn { width: 100%; height: 100%; white-space: normal; text-align: center; padding: ${u(6)} ${u(12)}; line-height: 1.2; }
.wa-offer-links { display: flex; justify-content: space-between; gap: ${u(8)}; margin-top: ${u(6)}; }
.wa-link-quiet { color: var(--c-ink2); }
.wa-link[disabled] { color: var(--c-ink); cursor: default; text-decoration: none; }
.wa-offer-why {
  margin-top: ${u(8)}; padding: ${u(12)} ${u(14)}; border-radius: ${u(16)};
  background: var(--c-canvas); font-size: ${u(13.5)}; color: var(--c-ink); display: grid; gap: ${u(8)};
  border: ${u(1)} solid var(--c-edge);
}
.wa-offer-why p { margin: 0; }
.wa-offer-why-sub { color: var(--c-ink2); font-size: ${u(12.5)}; }
.wa-offer-p { display: flex; align-items: center; gap: ${u(10)}; font-weight: 600; }
.wa-offer-pbar { position: relative; flex: 1; height: ${u(6)}; border-radius: 999px; background: var(--c-tonal); }
.wa-offer-pbar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; background: var(--c-accent); }
.wa-offer-pbar b { position: absolute; top: ${u(-3)}; bottom: ${u(-3)}; width: ${u(1.5)}; background: var(--c-ink); opacity: .55; }

.wa-offer-chip {
  appearance: none; display: inline-flex; align-items: center; gap: ${u(8)}; max-width: 100%;
  min-height: ${'var(--wa-target, 44px)'}; padding: 0 ${u(12)} 0 ${u(14)};
  border-radius: 999px; border: ${u(1)} solid var(--c-edge); background: var(--c-raised); color: var(--c-ink);
  box-shadow: var(--c-shadow-float); font-size: ${u(14)}; font-weight: 500; cursor: pointer;
  animation: wa-rise 200ms ease-out;
}
.wa-offer-chip-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.wa-toasts { display: flex; flex-direction: column; align-items: flex-end; gap: ${u(8)}; width: 100%; }
.wa-toast {
  display: flex; align-items: center; gap: ${u(10)}; max-width: 100%;
  padding: ${u(8)} ${u(8)} ${u(8)} ${u(14)}; border-radius: 999px;
  background: #1D1D1F; color: #F5F5F7; box-shadow: 0 10px 30px rgba(0,0,0,.25);
  font-size: ${u(14.5)}; font-weight: 500;
  animation: wa-rise 240ms cubic-bezier(.2,.8,.3,1);
}
.wa-root[data-mode="dark"] .wa-toast { background: #F5F5F7; color: #1D1D1F; }
.wa-root[data-mode="max"] .wa-toast { background: #000000; color: #FFFFFF; }
.wa-toast-icon {
  width: ${u(22)}; height: ${u(22)}; border-radius: 999px; display: grid; place-items: center; flex: none;
  background: #8FCB9B; color: #0F1A12;
}
.wa-toast-text { flex: 1; min-width: 0; line-height: 1.3; }
.wa-toast-undo { background: rgba(255,255,255,.16); color: inherit; }
.wa-toast-undo:hover { background: rgba(255,255,255,.26); }
.wa-root[data-mode="dark"] .wa-toast-undo { background: rgba(0,0,0,.08); }
.wa-toast-x { background: transparent; color: inherit; opacity: .7; }
.wa-toast-x:hover { background: rgba(255,255,255,.12); color: inherit; opacity: 1; }

/* ---------- docked cookie notice: a short bar that never answers for the person ---------- */
.wa-cbar {
  position: fixed; z-index: 37; margin: 0 auto; max-width: ${u(1080)}; min-height: max(${u(72)}, calc(${target()} + ${u(20)}));
  display: flex; align-items: center; padding: ${u(10)} ${u(12)} ${u(10)} ${u(18)};
  border-radius: ${u(22)}; border: ${u(1)} solid var(--c-edge);
  background: var(--c-glass); color: var(--c-ink);
  -webkit-backdrop-filter: saturate(180%) blur(24px); backdrop-filter: saturate(180%) blur(24px);
  box-shadow: var(--c-shadow-float), inset 0 0 0 ${u(0.5)} rgba(0,0,0,.08);
  pointer-events: auto; animation: wa-rise 260ms cubic-bezier(.2,.8,.3,1);
}
.wa-cbar-row { display: flex; align-items: center; gap: ${u(12)}; width: 100%; min-width: 0; overflow: hidden; }
.wa-cbar-icon {
  flex: none; width: ${u(34)}; height: ${u(34)}; border-radius: 999px; display: grid; place-items: center;
  background: var(--c-tonal); color: var(--c-ink2);
}
.wa-cbar-text {
  margin: 0; flex: 1 1 auto; min-width: ${u(150)};
  font-family: ${DISPLAY_STACK}; font-size: ${u(16)}; font-weight: 600; letter-spacing: -0.01em; white-space: nowrap;
}
.wa-cbar-choices { display: flex; align-items: center; gap: ${u(8)}; flex: none; }
.wa-cbar-btn { flex: none; background: var(--c-tonal); color: var(--c-ink); font-weight: 500; }
.wa-cbar-read { flex: none; display: inline-flex; align-items: center; gap: ${u(4)}; white-space: nowrap; min-height: ${target()}; padding: 0 ${u(8)}; }
.wa-root[data-mode="max"] .wa-cbar-btn { border: ${u(2)} solid #000000; }

/* ---------- "Survey · Show" chips for overlays moved aside ---------- */
.wa-ochips { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: ${u(8)}; max-width: 100%; }
.wa-stack[data-side="left"] .wa-ochips { justify-content: flex-start; }
.wa-ochip {
  appearance: none; display: inline-flex; align-items: center; gap: ${u(6)};
  min-height: max(${u(36)}, calc(0.8 * ${target()})); padding: 0 ${u(16)};
  border-radius: 999px; border: ${u(1)} solid var(--c-edge);
  background: var(--c-glass); color: var(--c-ink);
  -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px);
  box-shadow: 0 4px 16px rgba(0,0,0,.12), inset 0 0 0 ${u(0.5)} rgba(0,0,0,.08);
  font-size: ${u(14)}; font-weight: 500; cursor: pointer; pointer-events: auto;
  animation: wa-rise 220ms cubic-bezier(.2,.8,.3,1);
  transition: background-color 160ms ease, transform 160ms ease;
}
.wa-ochip:hover { background: var(--c-raised); transform: translateY(${u(-1)}); }
.wa-ochip-sep { color: var(--c-ink2); }
.wa-ochip-verb { color: var(--c-link); font-weight: 600; }
`;
