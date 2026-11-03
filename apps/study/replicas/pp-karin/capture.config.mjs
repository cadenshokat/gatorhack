// Capture config for the PEOPLE article "Karin Slaughter Wanted To Be 'Very Mindful' of Sensitive Storylines in The
// Good Daughter" on a phone (entertainment family, set B). Shared PEOPLE setup in ../pp-millie/pp-capture.mjs, so the
// pair is captured the same way.
// Run: node scripts/capture/capture.mjs pp-karin && node scripts/capture/validate.mjs pp-karin

import { ppConfig } from '../pp-millie/pp-capture.mjs';

export default ppConfig({
  id: 'pp-karin',
  url: 'https://people.com/karin-slaughter-mindful-of-violence-storyline-in-the-good-daughter-12202639',
});
