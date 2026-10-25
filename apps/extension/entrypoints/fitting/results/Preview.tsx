// "See it on a page like…": a kind of page, Before or With WebAble, in a quiet browser frame.
// Choosing a page shows Before for 700 ms, then cross-fades once to With WebAble (no switching with reduced motion).
// The first reveal waits until the frame is on screen, so the person actually sees the change.
import type { FitProfile } from '@webable/core';
import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Segmented } from './controls';
import { LockIcon } from './icons';
import { MiniPage } from './samples/MiniPage';
import { beforeLook, pageChanges, pageNote, withLook, type View } from './samples/look';
import { SAMPLE_SITES, sampleSite, type SampleKind } from './samples/sites';

const HOLD_MS = 700;

export function Preview({ fit, reduced }: { fit: FitProfile; reduced: boolean }): JSX.Element {
  const [kind, setKind] = useState<SampleKind>('news');
  const [view, setView] = useState<View>(reduced ? 'with' : 'before');
  const [fade, setFade] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const touched = useRef(false);
  const frame = useRef<HTMLDivElement>(null);

  const site = sampleSite(kind);
  const before = useMemo(() => beforeLook(site), [site]);
  const after = useMemo(() => withLook(site, fit), [site, fit]);
  const changes = useMemo(() => pageChanges(site, fit), [site, fit]);
  const note = pageNote(site);

  const reveal = (): void => {
    window.clearTimeout(timer.current);
    // With reduced motion nothing switches by itself: the frame keeps the view the person chose.
    if (reduced) return;
    setFade(false);
    setView('before');
    timer.current = window.setTimeout(() => {
      setFade(true);
      setView('with');
    }, HOLD_MS);
  };

  // First reveal when the frame scrolls into view.
  useEffect(() => {
    if (reduced) return;
    const el = frame.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      reveal();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          if (!touched.current) reveal();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // A setting changed below: show the page with WebAble, so the change is visible at once.
  const firstFit = useRef(true);
  useEffect(() => {
    if (firstFit.current) {
      firstFit.current = false;
      return;
    }
    touched.current = true;
    window.clearTimeout(timer.current);
    setFade(false);
    setView('with');
  }, [fit]);

  const onKind = (e: Event): void => {
    touched.current = true;
    setKind((e.currentTarget as HTMLSelectElement).value as SampleKind);
    reveal();
  };
  const onView = (v: View): void => {
    touched.current = true;
    window.clearTimeout(timer.current);
    setFade(!reduced);
    setView(v);
  };

  return (
    <section class="rs-section" aria-labelledby="rs-see">
      <div class="rs-section-head">
        <h2 class="rs-h2" id="rs-see">
          See it on a page like…
        </h2>
        <div class="rs-controls">
          <label class="visually-hidden" for="rs-kind">
            Kind of page
          </label>
          <select id="rs-kind" class="rs-select" value={kind} onChange={onKind}>
            {SAMPLE_SITES.map((s) => (
              <option key={s.kind} value={s.kind}>
                {s.option}
              </option>
            ))}
          </select>
          <Segmented<View>
            label="Show the page"
            options={[
              { value: 'before', label: 'Before' },
              { value: 'with', label: 'With WebAble' },
            ]}
            value={view}
            onChange={onView}
          />
        </div>
      </div>

      <div class="rs-frame" ref={frame}>
        <div class="rs-frame-bar" aria-hidden="true">
          <span class="rs-dots">
            <span />
            <span />
            <span />
          </span>
          <span class="rs-url">
            <LockIcon />
            <span>{site.url}</span>
          </span>
          <span />
        </div>
        <div class="rs-frame-view">
          <div class={`rs-layer${view === 'before' ? ' is-on' : ''}${fade ? ' is-fading' : ''}`} inert aria-hidden="true">
            <MiniPage site={site} look={before} />
          </div>
          <div class={`rs-layer${view === 'with' ? ' is-on' : ''}${fade ? ' is-fading' : ''}`} inert aria-hidden="true">
            <MiniPage site={site} look={after} />
          </div>
        </div>
      </div>

      <p class="rs-caption" aria-live="polite">
        {view === 'before' ? (
          <span>
            {site.brand} as it looks today, without WebAble.
          </span>
        ) : (
          <>
            {note && <span class="rs-note">{note}</span>}
            {changes.map((c) => (
              <span class="rs-chg" key={c.lead}>
                {c.lead}
                <strong>{c.strong}</strong>
              </span>
            ))}
          </>
        )}
      </p>
    </section>
  );
}
