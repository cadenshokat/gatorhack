// Capture config for floridagators.com "Football History vs Louisiana State University" (family 'sports', set 'B').
// Run: node scripts/capture/capture.mjs gators-lsu && node scripts/capture/validate.mjs gators-lsu
// The page template and its behaviours are shared with gators-ky: see ../gators-ky/gators.capture.mjs and
// site/page.js (a copy of gators-ky/site/page.js).

import { gatorsConfig } from '../gators-ky/gators.capture.mjs';

export default gatorsConfig({
  id: 'gators-lsu',
  url: 'https://floridagators.com/sports/football/opponent-history/louisiana-state-university/34',
  opponent: 'Louisiana State University',
  validationNotes: [
    "Ad: the 300x250 sits in the table's first ad row (between the 2019 and 2018 games). The captured load also had a 320x50 in the second ad row; it was emptied so each Gators page carries one ad.",
  ],
  linksFor: 'October 15, 2022',
});
