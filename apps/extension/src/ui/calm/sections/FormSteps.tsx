// Owner: D1. A form shown one step at a time (or all at once), with Back / Next, a recap of the choices made on the
// page, and the page's primary action as the last thing in the last step. Help stays visible on every step.
import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { renderLiveValue } from '../../proxy';
import { Blocks, ControlView, FlowView, PrimaryAction } from '../Blocks';
import { useCalm } from '../context';
import { useTick } from '../live';
import { Stepper } from '../Stepper';
import { type Block, type FlowBlock, flatten } from '../model';
import { type PlanSection, type PlanStep, allBlocks, splitActions } from '../plan';
import { HelpCard } from './layouts';

function isHelpBlock(b: Block): boolean {
  return (b.b === 'flow' && b.help) || (b.b === 'control' && b.help && !b.primary);
}

function summarize(blocks: Block[]): { text: string; inputs: number } {
  const parts: string[] = [];
  let inputs = 0;
  for (const b of flatten(blocks)) {
    if (b.b === 'choice') {
      inputs++;
      const v = renderLiveValue(b.el);
      if (v.kind === 'check' && v.checked) parts.push(b.title);
    } else if (b.b === 'field') {
      inputs++;
      const v = renderLiveValue(b.el);
      if (v.kind === 'text' && v.value.trim()) parts.push(`${b.label ? `${b.label}: ` : ''}${v.value.trim()}`.slice(0, 90));
    } else if (b.b === 'select') {
      inputs++;
      const v = renderLiveValue(b.el);
      if (v.kind === 'select' && v.index >= 0) parts.push(`${b.label ? `${b.label}: ` : ''}${v.options[v.index] ?? ''}`);
    }
  }
  return { text: parts.join(' · '), inputs };
}

function Recap({ steps, bodies }: { steps: PlanStep[]; bodies: Block[][] }): JSX.Element | null {
  useTick();
  const rows = steps
    .map((st, i) => ({ k: st.label, ...summarize(bodies[i] ?? []) }))
    .filter((r) => r.inputs > 0);
  if (!rows.length) return null;
  return (
    <div class="wa-recap">
      <span class="wa-eyebrow">Your choices on this page</span>
      {rows.map((r, i) => (
        <div key={i} class="wa-recap__row">
          <span class="wa-recap__k">{r.k}</span>
          <span class={r.text ? '' : 'wa-meta'}>{r.text || 'Nothing chosen yet'}</span>
        </div>
      ))}
    </div>
  );
}

function StepEnd({ blocks, recap }: { blocks: Block[]; recap: JSX.Element | null }): JSX.Element {
  const { rest, primary, secondary } = splitActions(blocks);
  return (
    <>
      {recap}
      <Blocks blocks={rest} />
      {primary && <PrimaryAction b={primary} />}
      {secondary.length > 0 && (
        <div class="wa-secondary">
          {secondary.map((s) => (
            <ControlView key={s.key} b={s} />
          ))}
        </div>
      )}
    </>
  );
}

function startsWithHeading(bs: Block[]): boolean {
  const f = bs[0];
  return !!f && (f.b === 'heading' || (f.b === 'group' && !!f.legend));
}

export function FormSteps({ p }: { p: PlanSection }): JSX.Element {
  const ctx = useCalm();
  const [cur, setCur] = useState(0);
  const [all, setAll] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const steps = p.steps;
  if (!steps) return <SingleForm p={p} />;

  const n = steps.length;
  const at = Math.min(cur, n - 1);
  const always: Block[] = [];
  const lead: FlowBlock[] = [];
  const bodies = steps.map((st, i) => {
    const bs = st.blocks.filter((b) => {
      if (isHelpBlock(b)) {
        always.push(b);
        return false;
      }
      return true;
    });
    if (i === 0) while (bs[0]?.b === 'flow' && bs.length > 1 && lead.length < 3) lead.push(bs.shift() as FlowBlock);
    return bs;
  });
  const go = (i: number): void => {
    setCur(Math.max(0, Math.min(n - 1, i)));
    requestAnimationFrame(() => {
      const el = panel.current;
      if (!el) return;
      el.scrollIntoView({ block: 'start', behavior: ctx.reduceMotion ? 'auto' : 'smooth' });
      el.focus({ preventScroll: true });
    });
  };
  const stepContent = (i: number): JSX.Element => {
    const st = steps[i]!;
    const bs = bodies[i]!;
    const title = !startsWithHeading(bs) && <h3 class="wa-h-section">{st.label}</h3>;
    if (i < n - 1) {
      return (
        <>
          {title}
          <Blocks blocks={bs} />
        </>
      );
    }
    const recap = st.synthetic ? <Recap steps={steps.slice(0, n - 1)} bodies={bodies.slice(0, n - 1)} /> : null;
    return (
      <>
        {title}
        <StepEnd blocks={bs} recap={recap} />
      </>
    );
  };

  return (
    <div class="wa-stack" style={{ gap: 'var(--wa-card-gap)' }}>
      {lead.length > 0 && (
        <div class="wa-stack">
          {lead.map((f) => (
            <FlowView key={f.key} b={f} pageline />
          ))}
        </div>
      )}
      <div class="wa-panel" ref={panel} tabIndex={-1} aria-label={all ? undefined : `Step ${at + 1} of ${n}`} role="group">
        {all ? (
          <div class="wa-stack" style={{ gap: 'var(--wa-band-gap)' }}>
            {steps.map((st, i) => (
              <section key={i} class="wa-stepbody" aria-label={st.label}>
                <p class="wa-stepof">
                  Step {i + 1} of {n}
                </p>
                {stepContent(i)}
              </section>
            ))}
          </div>
        ) : (
          <>
            <Stepper labels={steps.map((s) => s.label)} current={at} onPick={go} />
            <p class="wa-stepof" aria-live="polite">
              Step {at + 1} of {n}
            </p>
            <div class="wa-stepbody wa-fade" key={at}>
              {stepContent(at)}
            </div>
            {(at > 0 || at < n - 1) && (
              <div class="wa-stepnav">
                {at > 0 && (
                  <button type="button" class="wa-btn wa-btn--back" onClick={() => go(at - 1)}>
                    Back
                  </button>
                )}
                {at < n - 1 && (
                  <button type="button" class="wa-btn wa-btn--ink" onClick={() => go(at + 1)}>
                    Next: {steps[at + 1]!.label}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {always.length > 0 && <HelpCard blocks={always} />}
      <button type="button" class="wa-btn wa-btn--quiet wa-allsteps" onClick={() => setAll(!all)}>
        {all ? 'Show one step at a time' : 'Show every step at once'}
      </button>
    </div>
  );
}

/** A form (or the main part of the page) without steps: one panel, the primary action last. */
export function SingleForm({ p }: { p: PlanSection }): JSX.Element {
  const bs = allBlocks(p);
  const always = bs.filter(isHelpBlock);
  const main = bs.filter((b) => !isHelpBlock(b));
  return (
    <div class="wa-stack" style={{ gap: 'var(--wa-card-gap)' }}>
      <div class="wa-panel">
        <div class="wa-form">
          <StepEnd blocks={main} recap={null} />
        </div>
      </div>
      {always.length > 0 && <HelpCard blocks={always} />}
    </div>
  );
}

