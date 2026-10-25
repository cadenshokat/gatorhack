// Five kinds of page people use every day, as data for one renderer (MiniPage). Every brand, name and number here is
// made up. Pictures are CSS gradient compositions named by `art` (see results.css, `.art-*`).

export type SampleKind = 'news' | 'class' | 'pharmacy' | 'bank' | 'recipe';

/** How WebAble treats the page: the simple single-column page, the site's own form, or the site's own table. */
export type SampleMode = 'simple' | 'form' | 'table';

export interface SampleAd {
  title: string;
  /** Two colours for the product picture: background, object. */
  colors: [string, string];
  art?: 'sea';
}

export interface SampleSite {
  kind: SampleKind;
  option: string; // the choice in "See it on a page like…"
  mode: SampleMode;
  brand: string;
  brandStyle: 'serif' | 'sans' | 'round';
  accent: string; // the site's own colour
  stripBg: string;
  stripInk: string;
  url: string;
  strip: string;
  nav: string[];
  headerButton: string;
  eyebrow: string;
  title: string;
  deck: string;
  byline?: string;
  art?: 'dawn' | 'video' | 'soup';
  paragraphs: string[];
  /** Numbered steps (a recipe's method) instead of plain paragraphs. */
  stepsTitle?: string;
  list?: { title: string; items: string[]; first?: boolean };
  actions?: { primary: string; secondary?: string };
  form?: { fields: Array<{ label: string; value: string; select?: boolean }>; submit: string; note: string };
  table?: { summary: Array<[string, string]>; columns: string[]; rows: string[][] };
  ads: SampleAd[];
  railTitle: string;
  rail: string[];
  popup: { title: string; body: string; button: string; field?: string };
}

export const SAMPLE_SITES: SampleSite[] = [
  {
    kind: 'news',
    option: 'News site',
    mode: 'simple',
    brand: 'The Daily Ledger',
    brandStyle: 'serif',
    accent: '#9b2335',
    stripBg: '#9b2335',
    stripInk: '#f6dfe2',
    url: 'thedailyledger.news/city',
    strip: 'Live: Bridge closures this weekend   ·   Markets open higher   ·   Weekend weather: sun and wind   ·   Subscribe for 99¢ a week   ·   Live: Bridge closures this weekend   ·   Markets open higher   ·',
    nav: ['World', 'City', 'Business', 'Health', 'Sport', 'Food', 'Opinion', 'Puzzles'],
    headerButton: 'Subscribe',
    eyebrow: 'City',
    title: 'The old tram line reopens on Saturday after three years of repairs',
    deck: 'Riders get new stops, level boarding and a train every eight minutes.',
    byline: 'By Maya Ortiz · 6 min read',
    art: 'dawn',
    paragraphs: [
      'The Harbor Line, closed since the spring of 2023, carries its first passengers again at 6 a.m. on Saturday. The trip from Old Market to the river will take eleven minutes, four fewer than before.',
      'Every stop now has a raised platform, so riders can roll or step straight onto the train. Screens at each stop show the next three arrivals, and every train calls out its stops.',
      'Fares stay the same. Riders with a city pass travel free for the first week.',
    ],
    actions: { primary: 'Next story', secondary: 'Listen' },
    ads: [
      { title: 'Seven islands you can reach without a passport', colors: ['#7cc3d6', '#2f8db0'], art: 'sea' },
      { title: 'Readers say this chair fixed their back in a week', colors: ['#e9dccb', '#b0764a'] },
    ],
    railTitle: 'Most read',
    rail: ['Council votes on new park hours', 'Ten bakeries worth the queue', 'Why the river smells in autumn', 'School lunch menus get a shake-up'],
    popup: { title: 'Get the Morning Ledger', body: 'The day’s news in your inbox by 7 a.m.', button: 'Sign up', field: 'Email address' },
  },
  {
    kind: 'class',
    option: 'Online class',
    mode: 'simple',
    brand: 'Northbridge Online',
    brandStyle: 'sans',
    accent: '#2f4fb5',
    stripBg: '#fde9a6',
    stripInk: '#6d5a1c',
    url: 'northbridge.online/writing-101/week-3',
    strip: 'New: earn a certificate in 6 weeks   ·   Spring enrollment closes Friday   ·   30% off all course bundles   ·   New: earn a certificate in 6 weeks   ·   Spring enrollment closes Friday   ·',
    nav: ['Home', 'My courses', 'Calendar', 'Grades', 'Messages', 'Library', 'Help'],
    headerButton: 'Upgrade',
    eyebrow: 'Week 3 · Lesson 2',
    title: 'Writing a clear opening paragraph',
    deck: 'Three simple ways to tell the reader what your piece is about.',
    byline: 'Prof. Daniel Reyes · 12 minutes',
    art: 'video',
    paragraphs: [
      'Your first paragraph has one job: tell the reader what they get if they keep going. Say it plainly, in two or three sentences.',
      'Start with the point, not the background. Then give one detail that makes it real. Save the history for later.',
      'Before Thursday, rewrite the opening of your last essay using one of the three ways below.',
    ],
    list: { title: 'In this lesson', items: ['Start with the point', 'Add one real detail', 'Say what comes next'] },
    actions: { primary: 'Mark as done', secondary: 'Next lesson' },
    ads: [
      { title: 'Boost your grades with instant study notes', colors: ['#dfe6ff', '#4b63c9'] },
      { title: 'Student laptops from $299 this week only', colors: ['#e8e8ea', '#3a3d46'] },
    ],
    railTitle: 'Up next',
    rail: ['Lesson 3: Linking your ideas', 'Quiz: Openings', 'Discussion: Share your draft'],
    popup: { title: 'Get the Northbridge app', body: 'Study on the go with lessons you can save.', button: 'Download' },
  },
  {
    kind: 'pharmacy',
    option: 'Pharmacy refill',
    mode: 'form',
    brand: 'Alderra Pharmacy',
    brandStyle: 'round',
    accent: '#0d6f7c',
    stripBg: '#0d6f7c',
    stripInk: '#d9f1f3',
    url: 'alderra.health/refill',
    strip: 'Flu shots now available   ·   Free delivery over $35   ·   Save 20% on vitamins this week   ·   Flu shots now available   ·   Free delivery over $35   ·   Save 20% on vitamins this week   ·',
    nav: ['Prescriptions', 'Shop', 'Vaccines', 'Find a store', 'Offers', 'Account'],
    headerButton: 'Sign in',
    eyebrow: 'Prescriptions',
    title: 'Refill a prescription',
    deck: 'Most refills are ready to pick up in about two hours.',
    paragraphs: [],
    form: {
      fields: [
        { label: 'Prescription number', value: '4410 2287 19' },
        { label: 'Date of birth', value: '04 / 12 / 1951' },
        { label: 'Pick up at', value: 'Alderra, 18 Mill Street', select: true },
        { label: 'Pick up time', value: 'Today, after 3 p.m.', select: true },
      ],
      submit: 'Request refill',
      note: 'We’ll send a text when it’s ready.',
    },
    ads: [
      { title: 'Vitamin D, buy one get one free', colors: ['#fff1cf', '#e3a21a'] },
      { title: 'Members save on every visit', colors: ['#d7eff1', '#0d6f7c'] },
    ],
    railTitle: 'You might also need',
    rail: ['Pill organizer, 7 days', 'Blood pressure monitor', 'Reading glasses'],
    popup: { title: 'Save 15% today', body: 'Join Alderra Rewards in one minute.', button: 'Join now', field: 'Email address' },
  },
  {
    kind: 'bank',
    option: 'Bank statement',
    mode: 'table',
    brand: 'Harbor Bank',
    brandStyle: 'sans',
    accent: '#1e3a5f',
    stripBg: '#e7edf5',
    stripInk: '#4c6283',
    url: 'harborbank.money/statements/october',
    strip: 'Savings rates from 4.10%   ·   New card designs are here   ·   Refer a friend and get $50   ·   Savings rates from 4.10%   ·   New card designs are here   ·   Refer a friend and get $50   ·',
    nav: ['Accounts', 'Payments', 'Transfers', 'Cards', 'Statements', 'Help'],
    headerButton: 'Log out',
    eyebrow: 'Everyday Checking ···4821',
    title: 'October statement',
    deck: 'October 1 to October 31, 2026',
    paragraphs: [],
    table: {
      summary: [
        ['Starting balance', '$2,418.60'],
        ['Money in', '$3,150.00'],
        ['Money out', '$1,723.77'],
        ['Ending balance', '$3,844.83'],
      ],
      columns: ['Date', 'Description', 'Amount', 'Balance'],
      rows: [
        ['Oct 1', 'Pension payment', '+$1,575.00', '$3,993.60'],
        ['Oct 3', 'Green Grocer', '−$64.12', '$3,929.48'],
        ['Oct 6', 'City water bill', '−$48.90', '$3,880.58'],
        ['Oct 9', 'Rent', '−$1,450.00', '$2,430.58'],
        ['Oct 14', 'Alderra Pharmacy', '−$22.40', '$2,408.18'],
        ['Oct 15', 'Pension payment', '+$1,575.00', '$3,983.18'],
        ['Oct 21', 'Electric company', '−$96.35', '$3,886.83'],
        ['Oct 28', 'Phone bill', '−$42.00', '$3,844.83'],
      ],
    },
    actions: { primary: 'Download', secondary: 'Print' },
    ads: [{ title: 'You’re pre-approved for a card with 0% for 18 months', colors: ['#dfe7f2', '#1e3a5f'] }],
    railTitle: 'Quick links',
    rail: ['Set up alerts', 'Dispute a charge', 'Order checks'],
    popup: { title: 'Go paperless', body: 'Get your statements by email instead.', button: 'Turn on' },
  },
  {
    kind: 'recipe',
    option: 'Recipe',
    mode: 'simple',
    brand: 'Home Table',
    brandStyle: 'serif',
    accent: '#b4522a',
    stripBg: '#2c2a26',
    stripInk: '#efe6d8',
    url: 'hometable.kitchen/red-lentil-soup',
    strip: 'Win a stand mixer   ·   New: 20-minute dinners   ·   Shop the cookware sale   ·   Win a stand mixer   ·   New: 20-minute dinners   ·   Shop the cookware sale   ·',
    nav: ['Recipes', 'Dinner', 'Baking', 'Quick', 'Healthy', 'Videos', 'Shop'],
    headerButton: 'Join free',
    eyebrow: 'Soups · Serves 4',
    title: 'Easy red lentil soup',
    deck: 'A warm, filling soup from pantry staples, ready in 35 minutes.',
    byline: 'By Ana Lima · Prep 10 min · Cook 25 min',
    art: 'soup',
    stepsTitle: 'Method',
    paragraphs: [
      'Soften the onion and carrots in a little oil for 5 minutes.',
      'Add the lentils, stock and cumin. Simmer for 20 minutes, until the lentils fall apart.',
      'Blend until smooth, stir in the lemon juice and season to taste.',
    ],
    list: {
      title: 'Ingredients',
      first: true,
      items: ['1 cup red lentils, rinsed', '1 onion, chopped', '2 carrots, diced', '4 cups vegetable stock', '1 tsp ground cumin', 'Juice of half a lemon'],
    },
    actions: { primary: 'Save recipe', secondary: 'Print' },
    ads: [
      { title: 'The knife chefs swear by is 40% off', colors: ['#ece7df', '#4a4f57'] },
      { title: 'Meal kits from $4 a plate', colors: ['#f4e3cf', '#c0632f'] },
    ],
    railTitle: 'Trending',
    rail: ['Crispy baked potatoes', 'One-pan lemon chicken', 'Banana bread, no mixer'],
    popup: { title: 'Free recipe book', body: 'Join 2 million home cooks.', button: 'Get it free', field: 'Email address' },
  },
];

export function sampleSite(kind: SampleKind): SampleSite {
  return SAMPLE_SITES.find((s) => s.kind === kind) ?? (SAMPLE_SITES[0] as SampleSite);
}
