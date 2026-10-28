// Capture config for the AP News article "Japan launches spacecraft to mysterious moons of Mars in a bold mission to
// bring home soil samples" on a phone (news family, set B). Shared AP setup in ../ap-vangogh/ap-capture.mjs, so the
// pair is captured the same way.
// Run: node scripts/capture/capture.mjs ap-mars && node scripts/capture/validate.mjs ap-mars

import { fileURLToPath } from 'node:url';
import { apConfig } from '../ap-vangogh/ap-capture.mjs';

export default apConfig({
  id: 'ap-mars',
  url: 'https://apnews.com/article/japan-mars-moon-mission-fb51fbbf90374631e8ae658f9ca46154',
  localDir: fileURLToPath(new URL('./site/local/', import.meta.url)),
  // On the capture load the floating player was showing a political campaign ad. site/local/float.mp4 is instead the
  // commercial the same player showed on ap-vangogh's capture (copied from ../ap-vangogh/site/local/float.mp4), so
  // the pair also carries the same floating video.
  keepFloatClip: true,
  stateNotes: [
    'Floating player clip: the same 12 s commercial (Metro by T-Mobile) as ap-vangogh. On this capture load the player showed a political campaign ad, which the study should not show; the player state (its ad layout with "Skip Ad") is as captured.',
  ],
});
