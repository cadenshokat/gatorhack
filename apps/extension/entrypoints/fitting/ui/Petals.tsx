// Eight petals, one per need. Length is the only signal.
// The same words are in a table, for anyone who does not see the drawing.

import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { copy, helpWord, PETAL_EXPLAIN, PETAL_LABEL } from '../content/copy';
import type { NeedScore } from '../logic/needs';

const SIZE = 460;
const C = 230;
const MAX = 128;
const MIN = 26;

function petalPath(len: number): string {
  const w = 16;
  return `M 0 0 C ${-w} ${-len * 0.42}, ${-w * 0.55} ${-len * 0.78}, 0 ${-len} C ${w * 0.55} ${-len * 0.78}, ${w} ${-len * 0.42}, 0 0 Z`;
}

function linesOf(label: string): [string, string] {
  const parts = label.split(' ');
  if (parts.length <= 1) return [label, ''];
  if (parts.length === 2) return [parts[0] as string, parts[1] as string];
  return [`${parts[0]} ${parts[1]}`, parts.slice(2).join(' ')];
}

export function PetalChart(props: { scores: NeedScore[] }): JSX.Element {
  const [open, setOpen] = useState<string | null>(null);
  const openScore = props.scores.find((s) => s.id === open);
  const summary = props.scores.map((s) => `${PETAL_LABEL[s.id]}, ${helpWord(s.score)}`).join('. ');
  return (
    <figure class="ob-chart" aria-label={`${copy.results.chart}. ${copy.results.chartHint} ${summary}`}>
      <figcaption>
        <h2 id="ob-chart-title">{copy.results.chart}</h2>
        <p>{copy.results.chartHint}</p>
      </figcaption>
      <svg class="ob-petals" viewBox={`0 0 ${SIZE} ${SIZE}`} role="presentation">
        {props.scores.map((s, i) => {
          const len = MIN + (s.score / 100) * (MAX - MIN);
          const rot = i * 45;
          return (
            <g key={s.id} transform={`translate(${C} ${C}) rotate(${rot})`} data-petal={s.id}>
              <path class="ob-petal-track" d={petalPath(MAX)} />
              <path class="ob-petal" d={petalPath(len)} style={{ animationDelay: `${i * 60}ms` }} />
              <title>{`${PETAL_LABEL[s.id]}. ${PETAL_EXPLAIN[s.id]}`}</title>
            </g>
          );
        })}
        {props.scores.map((s, i) => {
          const angle = ((-90 + i * 45) * Math.PI) / 180;
          const x = C + Math.cos(angle) * 178;
          const y = C + Math.sin(angle) * 178;
          const anchor = Math.cos(angle) > 0.35 ? 'start' : Math.cos(angle) < -0.35 ? 'end' : 'middle';
          const [a, b] = linesOf(PETAL_LABEL[s.id]);
          return (
            <text
              key={`${s.id}-label`}
              class="ob-petal-label"
              x={x}
              y={y}
              text-anchor={anchor}
              tabIndex={0}
              role="button"
              onClick={() => setOpen(s.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOpen(s.id);
                }
              }}
            >
              <title>{PETAL_EXPLAIN[s.id]}</title>
              <tspan x={x} dy="-0.35em">{a}</tspan>
              {b ? <tspan x={x} dy="1.25em">{b}</tspan> : null}
            </text>
          );
        })}
      </svg>
      {openScore ? <p class="ob-petal-note" aria-live="polite">{PETAL_EXPLAIN[openScore.id]}</p> : null}
      <table class="ob-scores">
        <caption class="ob-sr">{copy.results.chart}. {copy.results.chartHint}</caption>
        <thead>
          <tr>
            <th scope="col">{copy.results.what}</th>
            <th scope="col">{copy.results.howMuch}</th>
          </tr>
        </thead>
        <tbody>
          {props.scores.map((s) => (
            <tr key={s.id}>
              <th scope="row">
                {PETAL_LABEL[s.id]}
                <span class="ob-explain">{PETAL_EXPLAIN[s.id]}</span>
              </th>
              <td>{helpWord(s.score)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
