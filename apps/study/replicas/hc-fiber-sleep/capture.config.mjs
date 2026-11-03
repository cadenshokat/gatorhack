// Capture config for the Health.com news article "Eating More Fiber During the Day May Help You Sleep Better at Night,
// According to Research" on a phone (health family, set A). Shared Health.com setup in ./hc-capture.mjs
// (also used by ../hc-yoga), so the pair is captured the same way.
// Run: node scripts/capture/capture.mjs hc-fiber-sleep && node scripts/capture/validate.mjs hc-fiber-sleep

import { hcConfig } from './hc-capture.mjs';

export default hcConfig({
  id: 'hc-fiber-sleep',
  url: 'https://www.health.com/higher-fiber-intake-deep-sleep-12120564',
  validationNotes: [
    'First-screen pixels 0.28% (target 0.5%): the only band is 801-843 CSS px, the 320x50 adhesive ad at the bottom of the screen (its frozen creative paints slightly differently from the live frame).',
    'Full-page pixels 8.37% (target 2%): every band is an in-content ad slot (250 or 600 px tall: 3290-3539, 4329-4928, 5691-5940, 6832-7081). The live full-page screenshot shows those cross-origin ad frames blank; the copy shows the creatives captured in each slot. Text, layout and everything else match (heights 9665/9665, links, headings, tap targets, fonts, fixed-layer cover, all widths, both behaviour checks pass).',
  ],
});
