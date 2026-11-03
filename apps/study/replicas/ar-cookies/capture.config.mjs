// Capture config for the Allrecipes recipe "The Perfect Chocolate Chip Cookie" on a phone (recipe family, set B).
// Shared Allrecipes setup in ../ar-banana-bread/ar-capture.mjs, so the pair is captured the same way; site/page.js
// is a copy of ../ar-banana-bread/site/page.js.
// Run: node scripts/capture/capture.mjs ar-cookies && node scripts/capture/validate.mjs ar-cookies

import { arConfig } from '../ar-banana-bread/ar-capture.mjs';

export default arConfig({
  id: 'ar-cookies',
  url: 'https://www.allrecipes.com/recipe/25110/the-perfect-chocolate-chip-cookie/',
});
