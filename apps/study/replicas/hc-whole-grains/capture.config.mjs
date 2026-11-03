// Capture config for the Health.com news article "Eating This Many Servings of Whole Grains Each Day May Improve Heart
// Health, Research Shows" on a phone (health family, set B). Shared Health.com setup in
// ../hc-fiber-sleep/hc-capture.mjs (the pair's other replica, hc-fiber-sleep, uses it too), so the pair is captured
// the same way.
// Run: node scripts/capture/capture.mjs hc-whole-grains && node scripts/capture/validate.mjs hc-whole-grains

import { hcConfig } from '../hc-fiber-sleep/hc-capture.mjs';

export default hcConfig({
  id: 'hc-whole-grains',
  url: 'https://www.health.com/whole-grains-more-servings-heart-health-12126278',
  validationNotes: [
    'First-screen pixels 0% (target 0.5%).',
    'Full-page pixels 12.86% (target 2%): every band is an in-content ad slot (2304-2553, 3198-3366, 4098-4697, 5336-5585, 6557-6806, 7560-7809; 3198-3366 is a video ad frozen as a still). The live full-page screenshot shows those cross-origin ad frames blank; the copy shows the creatives captured in each slot. Text, layout and everything else match (heights 9599/9599, links, headings, tap targets, fonts, fixed-layer cover, all widths, both behaviour checks pass).',
  ],
});
