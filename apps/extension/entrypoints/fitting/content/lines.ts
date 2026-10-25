// Sentences for the reading game. Each is 60 characters and three short lines.
// Each one mentions a dog, or does not. Not taken from a published reading chart.

export interface ReadLine {
  text: string;
  dog: boolean;
}

export const READ_LINES: readonly ReadLine[] = [
  { text: 'The red bus stops beside the park where children play today.', dog: false },
  { text: 'A small dog waits by the door for one long walk outside now.', dog: true },
  { text: 'Rain on the window makes the street look soft and pale grey.', dog: false },
  { text: 'Our dog sleeps under that table after a very long breakfast.', dog: true },
  { text: 'The library keeps a quiet room for reading after the school.', dog: false },
  { text: 'She ties a blue scarf on before she steps out into the wind.', dog: false },
  { text: 'The dog carries a stick all the way back to the front porch.', dog: true },
  { text: 'Fresh bread cools on the counter beside an open side window.', dog: false },
  { text: 'A neighbour dog barks twice when the big mail truck arrives.', dog: true },
  { text: 'The evening train is late, so the platform stays quite full.', dog: false },
  { text: 'He fills a bowl of water and sets it down for the small dog.', dog: true },
  { text: 'Market stalls open early and sell apples, pears, plus bread.', dog: false },
];

/** Split a sentence into three lines on word boundaries. */
export function threeLines(text: string): [string, string, string] {
  const words = text.trim().split(/\s+/);
  const budget = Math.ceil(text.trim().length / 3);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (lines.length < 2 && current && next.length > budget) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  while (lines.length < 3) lines.push('');
  if (lines.length > 3) {
    const tail = lines.slice(2).join(' ');
    return [lines[0] ?? '', lines[1] ?? '', tail];
  }
  return [lines[0] ?? '', lines[1] ?? '', lines[2] ?? ''];
}
