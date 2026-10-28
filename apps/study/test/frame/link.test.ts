// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { linkKey, linkWords } from '../../src/frame/hit';

const here = { href: 'https://study.example/article/van-gogh-starry-night-space-6385' };
const a = (html: string): Element => {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.firstElementChild as Element;
};

describe('where a tapped link goes, as task targets are written', () => {
  it('keeps path and query for the copy’s own site', () => {
    expect(linkKey(a('<a href="/author/marcia-dunn">x</a>'), here)).toBe('/author/marcia-dunn');
    expect(linkKey(a('<a href="/MapClick.php?lat=29.6742&amp;FcstType=graphical">x</a>'), here)).toBe(
      '/MapClick.php?lat=29.6742&FcstType=graphical',
    );
  });

  it('drops the fragment and resolves relative links', () => {
    expect(linkKey(a('<a href="conditions.htm#alerts">x</a>'), { href: 'https://study.example/ever/planyourvisit/basicinfo.htm' })).toBe(
      '/ever/planyourvisit/conditions.htm',
    );
  });

  it('keeps the whole address for another site', () => {
    expect(linkKey(a('<a href="https://www.ap.org/about/?x=1#y">x</a>'), here)).toBe('https://www.ap.org/about/?x=1');
  });
});

describe('a link’s words', () => {
  it('uses its text, then its label, then its picture', () => {
    expect(linkWords(a('<a href="/x">  See 3\n park alerts </a>'))).toBe('See 3 park alerts');
    expect(linkWords(a('<a href="/x" aria-label="Close"></a>'))).toBe('Close');
    expect(linkWords(a('<a href="/x"><img alt="Hourly forecast"></a>'))).toBe('Hourly forecast');
  });
});
