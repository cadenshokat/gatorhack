// The stage: a made-up news page at web defaults (16 px body, #999 captions, 24 px buttons, a sidebar, a moving
// ticker). Written for WebAble at Gator Hack V. Everything here is fiction.

export const NEWS = {
  brand: 'The Daily Ledger',
  date: 'Saturday, October 24, 2026',
  nav: ['News', 'Local', 'Business', 'Weather', 'Sport', 'Opinion', 'Arts'],
  ticker: 'Markets open higher  •  Road work on Main St until Friday  •  School board meets tonight  •  Storm watch lifted for the coast  •  Late trains on the Blue Line  •  ',
  lead: {
    kicker: 'City',
    headline: 'New footbridge opens over the Alder River',
    dek: 'After two years of work, walkers and cyclists can now cross from Mill Street to Riverside Park in four minutes.',
    byline: 'By Ana Ruiz · October 24, 2026 · 6 min read',
    caption: 'The footbridge links Mill Street to Riverside Park. Photo: Ledger staff',
    body: [
      'The 180-metre bridge opened at dawn on Friday, and by noon more than two thousand people had walked across. The city expects it to cut the walk from the station to the park from twenty minutes to four.',
      'Lights along the deck stay on until midnight. Bikes share the middle lane, and there are benches at each end.',
    ],
  },
  more: [
    { kicker: 'Local', title: 'Farmers market moves indoors for the winter', time: '2 hours ago', art: 'market' as const },
    { kicker: 'Community', title: 'Library adds Sunday hours from November', time: '4 hours ago', art: 'library' as const },
    { kicker: 'Weather', title: 'Rain expected through Monday morning', time: '5 hours ago', art: 'rain' as const },
  ],
  mostRead: [
    'What the new bus routes mean for you',
    'Ten soups for a cold week',
    'School board approves later start times',
    'The quiet return of the corner shop',
    'Your questions about the bridge, answered',
  ],
  ad: { label: 'Advertisement', title: 'Autumn sale', line: '40% off coats this weekend only', cta: 'Shop now' },
  newsletter: { title: 'The Morning Ledger', line: 'The day’s news in five minutes, every weekday.', cta: 'Sign up' },
};

export type ArtId = 'bridge' | 'market' | 'library' | 'rain';
