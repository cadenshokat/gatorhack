// Owner: D2. Explain card, the outline around the original passage, and the "Explain" pill.
import { DISPLAY_STACK, u } from '../panel/css-util';

export const explainCss = /* css */ `
.wa-ex-outline {
  position: fixed; top: 0; left: 0; z-index: 24; pointer-events: none;
  border-radius: ${u(10)}; border: ${u(2)} solid var(--c-accent);
  box-shadow: 0 0 0 ${u(4)} var(--c-accent-tint);
  animation: wa-lfade 240ms ease-out both;
}
.wa-ex {
  position: fixed; z-index: 25; display: flex; flex-direction: column; overflow: hidden;
  border-radius: ${u(22)}; background: var(--c-raised); color: var(--c-ink);
  box-shadow: var(--c-shadow-float), inset 0 0 0 ${u(0.5)} rgba(0,0,0,.08);
  border: ${u(1)} solid var(--c-edge);
  pointer-events: auto; animation: wa-rise 240ms cubic-bezier(.2,.8,.3,1);
}
.wa-ex-head { display: flex; align-items: center; gap: ${u(8)}; padding: ${u(14)} ${u(14)} ${u(6)} ${u(20)}; }
.wa-ex-eyebrow { flex: 1; font-weight: 500; font-size: ${u(14)}; color: var(--c-ink2); }
.wa-ex-body { overflow-y: auto; overscroll-behavior: contain; padding: ${u(4)} ${u(20)} ${u(10)}; display: grid; gap: ${u(12)}; }
.wa-ex-list { margin: 0; padding: 0 0 0 ${u(18)}; display: grid; gap: ${u(8)}; font-size: ${u(17)}; line-height: 1.55; }
.wa-ex-list li::marker { color: var(--c-accent); }
.wa-ex-msg { margin: 0; padding: ${u(4)} ${u(20)} ${u(10)}; font-size: ${u(15)}; color: var(--c-ink); }
.wa-ex-body .wa-ex-msg { padding: 0; }
.wa-ex-loading { display: grid; gap: ${u(10)}; padding: ${u(8)} ${u(20)} ${u(14)}; }
.wa-ex-loading p { margin: ${u(4)} 0 0; font-size: ${u(13.5)}; color: var(--c-ink2); }
.wa-ex-check { margin: 0; display: flex; align-items: center; gap: ${u(8)}; font-size: ${u(14)}; font-weight: 500; }
.wa-ex-check svg { flex: none; }
.wa-ex-check.is-ok { color: var(--c-accent); }
.wa-ex-check.is-warn { color: var(--c-warn); background: var(--c-warn-tint); padding: ${u(8)} ${u(12)}; border-radius: ${u(12)}; }
.wa-ex-orig { display: grid; gap: ${u(8)}; }
.wa-ex-orig-title { margin: 0; font-size: ${u(13.5)}; color: var(--c-ink2); }
.wa-ex-orig blockquote {
  margin: 0; padding: ${u(10)} ${u(14)}; border-radius: ${u(12)}; background: var(--c-canvas);
  border-left: ${u(3)} solid var(--c-line-strong); font-size: ${u(15)}; line-height: 1.5;
}
.wa-ex-cov { display: block; margin-top: ${u(4)}; font-size: ${u(12)}; color: var(--c-ink2); font-variant-numeric: tabular-nums; }
.wa-ex-details { display: grid; gap: ${u(10)}; padding: ${u(12)}; border-radius: ${u(14)}; background: var(--c-canvas); border: ${u(1)} solid var(--c-edge); }
.wa-ex-checks { list-style: none; margin: 0; padding: 0; display: grid; gap: ${u(6)}; font-size: ${u(13.5)}; }
.wa-ex-checks li { display: flex; align-items: center; gap: ${u(8)}; }
.wa-ex-checks li[data-ok="true"] svg { color: var(--c-accent); }
.wa-ex-checks li[data-ok="false"] { color: var(--c-warn); }
.wa-ex-cover { margin: 0; padding: 0; list-style: none; display: grid; gap: ${u(8)}; }
.wa-ex-cover li { display: grid; grid-template-columns: 1fr ${u(64)} auto; gap: ${u(8)}; align-items: center; font-size: ${u(12.5)}; }
.wa-ex-cover-text { color: var(--c-ink2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wa-ex-cover-bar { position: relative; height: ${u(5)}; border-radius: 999px; background: var(--c-tonal); overflow: hidden; }
.wa-ex-cover-bar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; background: var(--c-accent); }
.wa-ex-cover-bar i[data-low="true"] { background: #B66B00; }
.wa-ex-meta { margin: 0; font-size: ${u(12)}; color: var(--c-ink2); }
.wa-ex-foot {
  display: flex; align-items: center; gap: ${u(10)}; padding: ${u(10)} ${u(14)} ${u(12)} ${u(20)};
  border-top: ${u(1)} solid var(--c-line); font-size: ${u(12)}; color: var(--c-ink2);
}
.wa-ex-foot span { flex: 1; }
.wa-ex-pill {
  position: fixed; z-index: 26; appearance: none; display: inline-flex; align-items: center; gap: ${u(6)};
  min-height: ${'max(40px, calc(0.9 * var(--wa-target, 44px)))'}; padding: 0 ${u(16)} 0 ${u(13)};
  border-radius: 999px; border: 0; background: var(--c-accent); color: var(--c-on-accent);
  font-family: ${DISPLAY_STACK}; font-size: ${u(15)}; font-weight: 600;
  box-shadow: 0 8px 24px rgba(0,0,0,.22); cursor: pointer; pointer-events: auto;
  animation: wa-rise 180ms ease-out;
}
.wa-ex-pill:hover { background: var(--c-accent-hover); }
`;
