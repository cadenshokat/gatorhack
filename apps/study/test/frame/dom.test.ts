// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { findTextRange, linesShown, normalizeText } from '../../src/frame/answer';
import { boxDistance, inWebAble, interactiveIn, linkKind, nearestDistance } from '../../src/frame/hit';

describe('links', () => {
  const here = { href: 'https://study.example/article/park?x=1' };
  const a = (href: string, attrs: Record<string, string> = {}) => {
    const el = document.createElement('a');
    el.setAttribute('href', href);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };
  it('a jump within the page is not a navigation', () => {
    expect(linkKind(a('#answer'), here)).toBe('fragment');
    expect(linkKind(a('/article/park?x=1#answer'), here)).toBe('fragment');
  });
  it('anything else leaves the page', () => {
    expect(linkKind(a('/news'), here)).toBe('leave');
    expect(linkKind(a('https://other.example/'), here)).toBe('leave');
    expect(linkKind(a('/article/park?x=1'), here)).toBe('leave');
    expect(linkKind(a('#top', { target: '_blank' }), here)).toBe('leave');
    expect(linkKind(a('/file.pdf', { download: '' }), here)).toBe('leave');
  });
  it('javascript: and empty links do not navigate', () => {
    expect(linkKind(a('javascript:void(0)'), here)).toBeNull();
    expect(linkKind(a(''), here)).toBeNull();
  });
});

describe('hit testing on the event path', () => {
  it('finds the control a tap pressed, including summary and ARIA buttons', () => {
    document.body.innerHTML = '<div><details><summary><span id="s">Open</span></summary></details><div role="button"><b id="r">Go</b></div><p id="p">text</p></div>';
    const path = (el: Element): EventTarget[] => {
      const out: EventTarget[] = [];
      for (let n: Element | null = el; n; n = n.parentElement) out.push(n);
      return [...out, document, window];
    };
    expect(interactiveIn(path(document.getElementById('s')!))?.tagName).toBe('SUMMARY');
    expect(interactiveIn(path(document.getElementById('r')!))?.getAttribute('role')).toBe('button');
    expect(interactiveIn(path(document.getElementById('p')!))).toBeNull();
  });
  it('knows WebAble\'s layer by its host element', () => {
    const host = document.createElement('webable-ui');
    expect(inWebAble([document.createElement('button'), host, document])).toBe(true);
    expect(inWebAble([document.body, document])).toBe(false);
  });
});

describe('miss distance', () => {
  it('is 0 inside a box and Euclidean to its border outside', () => {
    const b = { left: 10, top: 10, right: 60, bottom: 40 };
    expect(boxDistance(20, 20, b)).toBe(0);
    expect(boxDistance(0, 20, b)).toBe(10);
    expect(boxDistance(63, 44, b)).toBe(5);
    expect(nearestDistance(100, 100, [b, { left: 90, top: 110, right: 120, bottom: 130 }])).toBe(10);
    expect(nearestDistance(0, 0, [])).toBeNull();
  });
});

describe('answer text', () => {
  it('normalizes quotes, dashes, spaces and case', () => {
    expect(normalizeText('The  Park’s dog — Area')).toBe("the park's dog - area");
  });
  it('finds the answer across inline elements and line breaks', () => {
    document.body.innerHTML = '<p id="p">The park’s dog area <a href="#">will\n  open</a> on <b>December 5</b>, after the grass.</p>';
    const r = findTextRange(document.body, "will open on December 5");
    expect(r).not.toBeNull();
    expect(r!.toString().replace(/\s+/g, ' ')).toBe('will open on December 5');
    expect(findTextRange(document.body, 'not on the page')).toBeNull();
  });
  it('counts a sentence as seen when most of its lines are in view', () => {
    const line = (top: number) => ({ left: 0, right: 300, top, bottom: top + 20, width: 300, height: 20 });
    const area = { left: 0, top: 0, right: 390, bottom: 600 };
    expect(linesShown([line(100), line(120)], area)).toBe(true);
    expect(linesShown([line(570), line(590), line(610)], area)).toBe(false);
    expect(linesShown([line(560), line(580)], area)).toBe(true);
    expect(linesShown([], area)).toBe(false);
  });
});
