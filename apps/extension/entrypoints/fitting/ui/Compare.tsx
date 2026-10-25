// Original page and the page with WebAble, with a slider between them.
// News and recipes show the simplified page on the WebAble side. A bank statement keeps its layout.

import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { FitProfile } from '@webable/core';
import { copy, SAMPLE_PAGES, type SamplePageId } from '../content/copy';
import { effectiveTextPx, fullLook, SITE_LOOK } from '../logic/fitview';
import { MiniPage } from '../content/pages';

export function Compare(props: { fit: FitProfile }): JSX.Element {
  const [page, setPage] = useState<SamplePageId>('news');
  const [value, setValue] = useState(38);
  const [hint, setHint] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const apply = () => setWidth(el.clientWidth);
    apply();
    const watch = new ResizeObserver(apply);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  const afterSimple = page === 'news' || page === 'recipe';
  const after = fullLook(props.fit);
  const textPx = Math.max(16, effectiveTextPx(props.fit));
  const side = value >= 70 ? copy.results.original : value <= 30 ? copy.results.yours : `${copy.results.original}. ${copy.results.yours}`;

  return (
    <section class="ob-see-block" aria-labelledby="ob-see-heading">
      <div class="ob-see-row">
        <label class="ob-see" id="ob-see-heading">
          <span>{copy.results.see}</span>
          <select
            value={page}
            data-answer="sample-page"
            onChange={(e) => setPage((e.currentTarget as HTMLSelectElement).value as SamplePageId)}
          >
            {SAMPLE_PAGES.map((id) => (
              <option key={id} value={id}>{copy.pages[id]}</option>
            ))}
          </select>
        </label>
      </div>
      <div class="ob-compare" ref={box}>
        <div class="ob-compare-pane" inert>
          <MiniPage page={page} look={after} textPx={textPx} simple={afterSimple} />
        </div>
        <div class="ob-compare-pane ob-compare-clip" style={{ width: `${value}%` }} inert>
          <div class="ob-compare-full" style={{ width: `${width}px` }}>
            <MiniPage page={page} look={SITE_LOOK} textPx={16} simple={false} />
          </div>
        </div>
        <div class="ob-compare-line" style={{ left: `${value}%` }} aria-hidden="true" />
        <input
          class="ob-range"
          type="range"
          min={0}
          max={100}
          step={5}
          value={value}
          aria-label={copy.results.drag}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
          aria-valuetext={side}
          data-answer="compare"
          onInput={(e) => {
            setHint(false);
            setValue(Number((e.currentTarget as HTMLInputElement).value));
          }}
        />
      </div>
      {hint ? <p class="ob-drag">{copy.results.drag}</p> : null}
      <p class="ob-caption">{copy.captions[page]}</p>
      <div class="ob-compare-key" aria-hidden="true">
        <span>{copy.results.original}</span>
        <span>{copy.results.yours}</span>
      </div>
    </section>
  );
}
