// Fictional mock pages for the "Find it" part. Every page has the same 24 links in both its calm and busy
// versions: 5 in the header, 12 tiles, 7 in the footer. Only the decoration around them changes.

export type TemplateId = 'store' | 'news' | 'list' | 'account';

export interface MockTemplate {
  id: TemplateId;
  brand: string;
  nav: [string, string, string, string, string];
  tiles: string[]; // exactly 12
  footer: [string, string, string, string, string, string, string];
  welcome: { title: string; line: string };
  note: { title: string; line: string };
  promo: { title: string; line: string };
  slides: Array<{ title: string; line: string }>;
  ticker: string;
  side: Array<{ title: string; line: string }>;
  badges: string[];
}

export const TEMPLATES: Record<TemplateId, MockTemplate> = {
  store: {
    id: 'store',
    brand: 'Northwind Market',
    nav: ['Shop', 'Deals', 'Stores', 'Orders', 'Help'],
    tiles: [
      'Fresh produce', 'Bakery', 'Dairy and eggs', 'Frozen food', 'Pantry', 'Snacks',
      'Drinks', 'Household', 'Baby care', 'Pet supplies', 'Gift cards', 'Flowers',
    ],
    footer: ['About us', 'Careers', 'Contact', 'Returns', 'Privacy', 'Terms', 'Site map'],
    welcome: { title: 'Good morning', line: 'Groceries delivered from your local store.' },
    note: { title: 'Open every day', line: '7 am to 10 pm' },
    promo: { title: 'MEGA SAVINGS WEEK', line: 'Up to 50% off. Ends Sunday!' },
    slides: [
      { title: 'Fresh picks', line: 'New fruit arrives every morning' },
      { title: 'Weekend brunch', line: 'Everything for a slow Sunday' },
      { title: 'Stock up', line: 'Pantry basics at lower prices' },
    ],
    ticker: 'Free delivery over $35  •  New store hours  •  Members save 10% today  •  Download our app  •  ',
    side: [
      { title: 'Join Plus', line: 'Save on every order' },
      { title: '2 for 1', line: 'On selected snacks' },
      { title: 'App only', line: 'Extra 15% off' },
    ],
    badges: ['New', 'Hot', '-20%', 'Top pick', 'Sale'],
  },
  news: {
    id: 'news',
    brand: 'The Daily Ledger',
    nav: ['News', 'Sport', 'Weather', 'Opinion', 'Video'],
    tiles: [
      'Local news', 'World', 'Business', 'Science', 'Health', 'Travel',
      'Food', 'Arts', 'Books', 'Puzzles', 'Podcasts', 'Newsletters',
    ],
    footer: ['About us', 'Contact', 'Advertise', 'Jobs', 'Privacy', 'Terms', 'Archive'],
    welcome: { title: 'Today', line: 'The stories that matter, in one place.' },
    note: { title: 'Morning edition', line: 'Out at 6 am' },
    promo: { title: 'BREAKING COVERAGE', line: 'Live updates all day. Watch now!' },
    slides: [
      { title: 'City council', line: 'What the new budget means' },
      { title: 'Weekend weather', line: 'Sun returns on Saturday' },
      { title: 'Arts season', line: 'Ten shows to see this fall' },
    ],
    ticker: 'Markets open higher  •  Road work on Main St  •  School board meets tonight  •  Storm watch lifted  •  ',
    side: [
      { title: 'Subscribe', line: '$1 for 3 months' },
      { title: 'Trending', line: 'Most read today' },
      { title: 'Sponsored', line: 'Plan your trip' },
    ],
    badges: ['Live', 'New', 'Hot', 'Must read', 'Video'],
  },
  list: {
    id: 'list',
    brand: 'Brightside Home',
    nav: ['Furniture', 'Lighting', 'Kitchen', 'Garden', 'Sale'],
    tiles: [
      'Desk lamps', 'Floor lamps', 'Bookshelves', 'Armchairs', 'Side tables', 'Rugs',
      'Curtains', 'Mirrors', 'Cushions', 'Plant pots', 'Storage boxes', 'Wall clocks',
    ],
    footer: ['About us', 'Delivery', 'Contact', 'Returns', 'Privacy', 'Terms', 'Stores'],
    welcome: { title: 'Living room', line: 'Simple pieces for a calm home.' },
    note: { title: 'Showroom', line: 'Open Tuesday to Sunday' },
    promo: { title: 'CLEARANCE BLOWOUT', line: 'Everything must go. Shop now!' },
    slides: [
      { title: 'Cozy corners', line: 'Soft light for long evenings' },
      { title: 'Small spaces', line: 'Clever storage ideas' },
      { title: 'New colors', line: 'Fresh fabrics for fall' },
    ],
    ticker: 'Free returns for 60 days  •  Order by 2 pm for next-day delivery  •  New arrivals every week  •  ',
    side: [
      { title: 'Design help', line: 'Book a free call' },
      { title: 'Bundle deal', line: 'Save 25% on sets' },
      { title: 'Card offer', line: '0% for 12 months' },
    ],
    badges: ['New', '-30%', 'Best seller', 'Hot', 'Low stock'],
  },
  account: {
    id: 'account',
    brand: 'Account center',
    nav: ['Overview', 'Billing', 'Security', 'Devices', 'Help'],
    tiles: [
      'Order history', 'Saved addresses', 'Email settings', 'Notifications', 'Linked accounts', 'Download data',
      'Privacy choices', 'Language', 'Gift cards', 'Subscriptions', 'Payment methods', 'Close account',
    ],
    footer: ['About us', 'Contact', 'Status', 'Developers', 'Privacy', 'Terms', 'Cookies'],
    welcome: { title: 'Your account', line: 'Manage your details and settings.' },
    note: { title: 'Signed in', line: 'Last visit yesterday' },
    promo: { title: 'UPGRADE TO PREMIUM', line: 'Unlock every feature today!' },
    slides: [
      { title: 'Stay in control', line: 'Review your privacy choices' },
      { title: 'New devices', line: 'See where you are signed in' },
      { title: 'Go paperless', line: 'Get statements by email' },
    ],
    ticker: 'Scheduled maintenance Sunday 2 am  •  New sign-in options  •  Updated terms  •  Refer a friend  •  ',
    side: [
      { title: 'Premium', line: 'Try free for 30 days' },
      { title: 'Rewards', line: 'You have 120 points' },
      { title: 'Refer a friend', line: 'Get $10 each' },
    ],
    badges: ['New', 'Beta', 'Popular', 'Hot', 'Updated'],
  },
};

/** Six or more hues for the busy version. */
export const BUSY_HUES = ['#E53935', '#FB8C00', '#F9A825', '#43A047', '#1E88E5', '#8E24AA', '#D81B60', '#00897B'];
