// Capture config for the Allrecipes recipe "Simple Banana Bread" on a phone (recipe family, set A). Shared Allrecipes
// setup in ./ar-capture.mjs (also used by ../ar-cookies), so the pair is captured the same way.
// Run: node scripts/capture/capture.mjs ar-banana-bread && node scripts/capture/validate.mjs ar-banana-bread

import { arConfig } from './ar-capture.mjs';

export default arConfig({
  id: 'ar-banana-bread',
  url: 'https://www.allrecipes.com/recipe/6757/simple-banana-bread/',
});
