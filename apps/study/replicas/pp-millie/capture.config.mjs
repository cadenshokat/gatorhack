// Capture config for the PEOPLE article "Millie Bobby Brown Runs an Animal Rescue on Her Farm. She's Already Helped
// Hundreds of Dogs Find Homes" on a phone (entertainment family, set A). Shared PEOPLE setup in ./pp-capture.mjs (also
// used by ../pp-karin), so the pair is captured the same way.
// Run: node scripts/capture/capture.mjs pp-millie && node scripts/capture/validate.mjs pp-millie

import { ppConfig } from './pp-capture.mjs';

export default ppConfig({
  id: 'pp-millie',
  url: 'https://people.com/millie-bobby-brown-helps-hundreds-of-dogs-find-homes-at-animal-rescue-on-georgia-farm-12207442',
});
