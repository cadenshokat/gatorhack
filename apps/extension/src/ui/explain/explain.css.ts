// Owner: S (round 3), P. The plain-words card, the outline around the original passage, and the "Explain" pill, in
// the sheet's --k-* look (white card, near-black ink, one deep green accent). They sit in the page layer, so lengths
// size with --u. Nothing under 15 px.
import { DISPLAY_STACK, u } from '../panel/css-util';

export const explainCss = /* css */ `
.wa-ex-outline {
  position: fixed; z-index: 24; pointer-events: none; box-sizing: border-box;
  border-radius: ${u(12)}; border: ${u(2)} solid var(--k-accent);
  box-shadow: 0 0 0 ${u(4)} var(--k-accent-tint);
  animation: wa-lfade 200ms ease-out both;
}
.wa-ex {
  position: fixed; z-index: 25; display: flex; flex-direction: column; overflow: hidden;
  border-radius: ${u(24)}; background: var(--k-card); color: var(--k-ink);
  border: ${u(1)} solid var(--k-edge); box-shadow: var(--k-shadow);
  font-size: ${u(16)}; line-height: ${u(24)};
  pointer-events: auto; animation: wa-k-in 200ms var(--k-ease) both;
}
.wa-ex :focus-visible { outline: ${u(3)} solid var(--k-accent); outline-offset: ${u(3)}; }
.wa-ex-head { display: flex; align-items: center; gap: ${u(12)}; padding: ${u(16)} ${u(16)} ${u(8)} ${u(24)}; }
.wa-ex-eyebrow { flex: 1; font-family: ${DISPLAY_STACK}; font-size: ${u(17)}; font-weight: 600; letter-spacing: -0.01em; color: var(--k-ink); }
.wa-ex-x {
  appearance: none; flex: none; margin: 0; padding: 0; display: grid; place-items: center;
  width: ${u(36)}; height: ${u(36)}; border-radius: 50%; border: 0;
  background: var(--k-canvas); color: var(--k-ink2); cursor: pointer; pointer-events: auto;
}
.wa-ex-x:hover { color: var(--k-ink); }
.wa-ex-body { overflow-y: auto; overscroll-behavior: contain; padding: ${u(4)} ${u(24)} ${u(16)}; display: grid; gap: ${u(16)}; }
.wa-ex-list { margin: 0; padding: 0 0 0 ${u(20)}; display: grid; gap: ${u(10)}; font-size: ${u(18)}; line-height: ${u(28)}; }
.wa-ex-list li::marker { color: var(--k-accent); }
.wa-ex-msg { margin: 0; padding: ${u(4)} ${u(24)} ${u(16)}; font-size: ${u(16)}; color: var(--k-ink); }
.wa-ex-body .wa-ex-msg { padding: 0; font-weight: 500; }
.wa-ex-note { margin: ${u(-6)} 0 0; font-size: ${u(15)}; color: var(--k-ink2); }
.wa-ex-quote, .wa-ex-orig blockquote {
  margin: 0; padding: ${u(14)} ${u(18)}; border-radius: ${u(16)}; background: var(--k-canvas);
  font-size: ${u(16)}; line-height: ${u(24)}; color: var(--k-ink);
}
.wa-ex-quote { max-height: ${u(320)}; overflow-y: auto; overscroll-behavior: contain; }
.wa-ex-loading { display: grid; gap: ${u(10)}; padding: ${u(8)} ${u(24)} ${u(16)}; }
.wa-ex-loading .wa-shimmer { background: linear-gradient(90deg, var(--k-canvas) 0%, var(--k-line) 50%, var(--k-canvas) 100%); background-size: 200% 100%; }
.wa-ex-loading p { margin: ${u(6)} 0 0; font-size: ${u(15)}; color: var(--k-ink2); }
.wa-ex-status {
  margin: 0 ${u(24)} ${u(10)}; display: flex; align-items: center; gap: ${u(8)};
  font-size: ${u(15)}; font-weight: 600; line-height: ${u(21)}; flex: none;
}
.wa-ex-status svg { flex: none; }
.wa-ex-status.is-ok { color: var(--k-accent); }
.wa-ex-status.is-warn { color: var(--k-ink); }
.wa-ex-orig { display: grid; gap: ${u(8)}; }
.wa-ex-orig-title { margin: 0; font-size: ${u(15)}; font-weight: 600; color: var(--k-ink2); }
.wa-ex-foot {
  display: flex; align-items: center; gap: ${u(12)}; padding: ${u(12)} ${u(16)} ${u(16)} ${u(24)};
  border-top: ${u(1)} solid var(--k-line); font-size: ${u(15)}; line-height: ${u(21)}; color: var(--k-ink2);
}
.wa-ex-foot span { flex: 1; }
.wa-ex-close { flex: none; }
.wa-ex-pill {
  position: fixed; z-index: 26; appearance: none; display: inline-flex; align-items: center; gap: ${u(8)};
  min-height: max(${u(44)}, var(--wa-target, 44px)); padding: 0 ${u(20)} 0 ${u(16)};
  border-radius: 999px; border: 0; background: var(--k-ink); color: var(--k-on-ink);
  font-family: ${DISPLAY_STACK}; font-size: ${u(16)}; font-weight: 600;
  box-shadow: var(--k-shadow-btn); cursor: pointer; pointer-events: auto;
  animation: wa-k-in 160ms var(--k-ease) both;
}
.wa-ex-pill:hover { opacity: .9; }
.wa-ex-pill:focus-visible { outline: ${u(3)} solid var(--k-accent); outline-offset: ${u(3)}; }
`;
