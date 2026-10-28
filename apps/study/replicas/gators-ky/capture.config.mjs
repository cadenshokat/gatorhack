// Capture config for floridagators.com "Football History vs University of Kentucky" (family 'sports', set 'A').
// Run: node scripts/capture/capture.mjs gators-ky && node scripts/capture/validate.mjs gators-ky
// The page template and its behaviours are shared with gators-lsu: see ./gators.capture.mjs and site/page.js.

import { gatorsConfig } from './gators.capture.mjs';

export default gatorsConfig({
  id: 'gators-ky',
  url: 'https://floridagators.com/sports/football/opponent-history/university-of-kentucky/32',
  opponent: 'University of Kentucky',
  validationNotes: [
    "Ad: the 300x250 sits in the table's second ad row (between the 1994 and 1993 games). The captured load also had a 320x50 in the first ad row; it was emptied so each Gators page carries one ad.",
  ],
  linksFor: 'September 10, 2022',
});
