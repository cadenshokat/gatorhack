// Capture config for the AP News article "New study traces van Gogh's famed 'Starry Night' to an actual night sky
// from 1889" on a phone (news family, set A). Shared AP setup in ./ap-capture.mjs (also used by ap-mars).
// Run: node scripts/capture/capture.mjs ap-vangogh && node scripts/capture/validate.mjs ap-vangogh

import { fileURLToPath } from 'node:url';
import { apConfig } from './ap-capture.mjs';

export default apConfig({
  id: 'ap-vangogh',
  url: 'https://apnews.com/article/van-gogh-starry-night-space-6385c8e37f748bddc4137cdda5c76887',
  localDir: fileURLToPath(new URL('./site/local/', import.meta.url)),
  // site/local/float.mp4 is a commercial (Metro by T-Mobile) recorded from this page's floating player at an earlier
  // capture; ap-mars uses the same clip. Keep it: the player also shows political campaign ads, which the study
  // should not show.
  keepFloatClip: true,
  stateNotes: [
    'Floating player clip: a 12 s commercial (Metro by T-Mobile) recorded from this page\'s player; the same clip as ap-mars. The player state (its ad layout with "Skip Ad") is as captured.',
  ],
});
