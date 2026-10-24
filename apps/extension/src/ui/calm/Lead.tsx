// Owner: C. The first band of the Calm view: an optional eyebrow (the page's caption), the page's title, one
// orientation line in the page's own words, one pinned sentence when it carries a time, money or a rule, and the rest
// of the page's intro behind "About this page". Nothing here is written by us or by a model.
import type { JSX } from 'preact';
import { Blocks, InlineLink } from './Blocks';
import { InlineDisclosure } from './Disclosure';
import type { Inline } from './model';
import type { Lead } from './plan';

function Parts({ parts }: { parts: Inline[] }): JSX.Element {
  return (
    <>
      {parts.map((p, i) => {
        if (p.t === 'text') return <span key={i}>{p.text}</span>;
        if (p.t === 'br') return <br key={i} />;
        return <InlineLink key={i} p={p} />;
      })}
    </>
  );
}

export function LeadBand({ lead }: { lead: Lead }): JSX.Element {
  const Title = lead.titleSize === 'page' ? 'h1' : 'h2';
  const hasLine = !!(lead.orient || lead.pinned);
  return (
    <header class="wa-lead">
      {lead.eyebrow && <p class="wa-eyebrow wa-lead__eyebrow">{lead.eyebrow}</p>}
      {lead.title && <Title class={lead.titleSize === 'page' ? 'wa-h-page' : 'wa-h-section'}>{lead.title}</Title>}
      {(hasLine || lead.about.length > 0) && (
        <div class="wa-orient">
          {lead.orient && (
            <span class="wa-orient__line">
              <Parts parts={lead.orient} />{' '}
            </span>
          )}
          {lead.pinned && (
            <span class="wa-orient__pin">
              <Parts parts={lead.pinned} />{' '}
            </span>
          )}
          {lead.about.length > 0 && (
            <InlineDisclosure label="About this page">
              <Blocks blocks={lead.about} />
            </InlineDisclosure>
          )}
        </div>
      )}
    </header>
  );
}
