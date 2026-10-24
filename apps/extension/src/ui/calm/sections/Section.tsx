// Owner: D1. One band per FitSpec section: open, collapsed behind a disclosure, or in "More on this page".
import type { JSX } from 'preact';
import { Blocks } from '../Blocks';
import { Disclosure } from '../Disclosure';
import { type CalmPlan, type PlanSection, allBlocks } from '../plan';
import { FormSteps, SingleForm } from './FormSteps';
import {
  AsIs, BuyBox, CardGrid, ChipBar, Facts, Gallery, Generic, HelpCard, Hero, LinkGrid, Notice, Reading, RowList, leaves,
} from './layouts';

const PANEL_LAYOUTS = new Set(['as_is', 'buy_box', 'facts', 'chip_bar', 'link_grid', 'gallery']);

export function SectionBody({ p, inDrawer = false }: { p: PlanSection; inDrawer?: boolean }): JSX.Element {
  switch (p.layout) {
    case 'hero': return <Hero p={p} />;
    case 'buy_box': return <BuyBox p={p} />;
    case 'card_grid': return <CardGrid p={p} />;
    case 'row_list': return <RowList p={p} />;
    case 'reading': return <Reading p={p} />;
    case 'facts': return <Facts p={p} />;
    case 'form_steps': return inDrawer ? <Generic p={p} /> : <FormSteps p={p} />;
    case 'chip_bar': return <ChipBar p={p} />;
    case 'link_grid': return <LinkGrid p={p} />;
    case 'gallery': return <Gallery p={p} />;
    default: return inDrawer ? <Generic p={p} /> : p.isPrimary ? <SingleForm p={p} /> : <AsIs p={p} />;
  }
}

export function SectionView({ p }: { p: PlanSection }): JSX.Element {
  const name = p.title ?? p.label;
  if (p.hoist) {
    return (
      <section class="wa-band wa-band--tight" aria-label={name}>
        <Notice p={p} />
      </section>
    );
  }
  if (p.sec.role === 'help') {
    return (
      <section class="wa-band wa-band--tight" aria-label={name}>
        <HelpCard title={p.title} blocks={leaves(allBlocks(p))} />
      </section>
    );
  }
  if (p.state === 'collapsed') {
    return (
      <div class="wa-band wa-band--tight">
        <Disclosure title={name} count={p.count || null}>
          <SectionBody p={p} />
        </Disclosure>
      </div>
    );
  }
  const H = p.titleSize === 'page' ? 'h1' : 'h2';
  const showHead = p.layout !== 'hero' && !!p.title;
  const panel = p.lead && PANEL_LAYOUTS.has(p.layout) && !(p.layout === 'as_is' && p.isPrimary);
  return (
    <section class={`wa-band${p.lead ? ' wa-band--lead' : ''}`} aria-label={name}>
      {showHead && (
        <div class="wa-head">
          <H class={p.titleSize === 'page' ? 'wa-h-page' : 'wa-h-section'}>{p.title}</H>
          {!!p.records && p.count >= 3 && <span class={`wa-count ${p.titleSize === 'page' ? 'wa-h-page' : 'wa-h-section'}`}>{p.count}</span>}
        </div>
      )}
      {panel ? (
        <div class="wa-panel">
          <SectionBody p={p} />
        </div>
      ) : (
        <SectionBody p={p} />
      )}
    </section>
  );
}

/** "More on this page": every end-drawer part, Jev-folded distraction and unplaced part, behind one disclosure. */
export function Drawer({ plan }: { plan: CalmPlan }): JSX.Element | null {
  if (!plan.drawer.length) return null;
  return (
    <section class="wa-band" aria-label="More on this page">
      <Disclosure title="More on this page" count={plan.drawer.length} sub={plan.drawerLabels.join(' · ') || null}>
        {plan.drawer.map((d) => (
          <div key={d.key} class="wa-sub">
            <div class="wa-sub__head">
              <h3 class="wa-h-title">{d.label}</h3>
              {d.section?.records && d.section.records.length >= 2 && <span class="wa-count wa-h-title">{d.section.records.length}</span>}
            </div>
            {d.section ? (
              <SectionBody p={d.section} inDrawer />
            ) : (
              <div class="wa-stack">
                <Blocks blocks={d.blocks} />
              </div>
            )}
          </div>
        ))}
      </Disclosure>
    </section>
  );
}
