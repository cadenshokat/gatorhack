// The warm-up's words for the phone study: the onboarding's steps, unchanged in what they measure, said the way the
// study's writing guide asks (everyday words, one idea per sentence, numbered steps, buttons named exactly and in
// bold, "cannot" in full, nothing that tells people to hurry). Every claim is true to the step's code: sizes are capped
// to the screen, a word's shade follows the last answer, a missed dot moves on. The onboarding keeps its own words
// (fitting/ui/words.ts defaults, fitting/logic/steps.ts).

import type { StepId, StepWords } from '../../../extension/entrypoints/fitting/logic/steps';
import type { StepLabels } from '../../../extension/entrypoints/fitting/ui/words';

/**
 * The onboarding's labels in the study's words. The activities show no line under their heading (the owner's decision,
 * 28 Oct 2026): the instruction page before each one says what to do, so the "…Line" labels are empty.
 */
export const WARMUP_LABELS: StepLabels = {
  sizeTitle: 'Make the text a comfortable size',
  smaller: 'Make text smaller',
  larger: 'Make text bigger',
  comfortable: 'This size is comfortable',
  sizeLine: '',
  sizeMax: '',
  sizeMin: '',
  sizeText:
    'This is some sample text for you to read. Tap the buttons to make it bigger or smaller. Stop when you can read every word without leaning in or squinting. Choose the size that is comfortable for you today.',
  tfTitle: 'Is this sentence true or false?',
  yes: 'True',
  no: 'False',
  cantRead: 'I cannot read it',
  tfLine: '',
  faintTitle: 'Which word can you see?',
  cantSee: 'I cannot see a word',
  faintLine: '',
  ldAskTitle: 'Which page was easier to read?',
  light: 'The light page',
  dark: 'The dark page',
  same: 'No difference',
  ldLine: '',
  dotsTitle: () => 'Tap the dots',
  dotsLine: '',
  skipStep: 'Skip this activity',
  startStep: 'Start',
};

/** The card before each activity. A line break starts a new line; **bold** names a button. */
export function warmupWords(step: StepId): StepWords {
  switch (step) {
    case 'size':
      return {
        title: 'Make the text a comfortable size',
        todo: 'You will see some text.\n1. Tap **Make text bigger** or **Make text smaller**.\n2. Stop when you can read the text easily.\n3. Tap **This size is comfortable**.',
        success: 'There is no right size. Choose the one that is comfortable for you.',
      };
    case 'truefalse':
      return {
        title: 'Read short sentences',
        todo: '1. Read the sentence.\n2. Tap **True** or **False**.\nThe sentences get smaller as you go. If you cannot read one, tap **I cannot read it**.\nThere are up to 9 sentences.',
        success: 'For example, “Fish live in water” is true. You would tap **True**.\nThis takes about one minute.',
      };
    case 'faint':
      return {
        title: 'Find the word',
        todo: 'You will see a gray word. Some words are very light.\n1. Look at the word.\n2. Tap the same word in the list under it.\nThere are up to 7 words.',
        success: 'If you cannot see a word, tap **I cannot see a word**.\nThis takes about one minute.',
      };
    case 'lightdark':
      return {
        title: 'Compare a light page and a dark page',
        todo: 'You will read 2 sentences on a light page and 2 on a dark page.\n1. Read the sentence.\n2. Tap **True** or **False**.',
        success:
          'After the 4 sentences, choose the page that was easier to read. There is no right answer.\nThis takes about one minute.',
      };
    case 'dots':
      return {
        title: 'Tap the dots',
        todo: 'You will see 9 dots in a circle. One dot is filled in.\n1. Tap the filled-in dot.\n2. Another dot fills in. Tap that one.\n3. Keep going until the page changes.\nTap at your usual speed.',
        success:
          'If you miss a dot, keep going. The next dot fills in anyway. The dots may change size.\nThis takes about one minute.',
      };
    default:
      return { title: '', todo: '', success: '' };
  }
}

/** "Warm-up, activity 2 of 5", like "Round 1, website 2 of 3". */
export function warmupEyebrow(step: StepId, steps: readonly StepId[]): string {
  return `Warm-up, activity ${steps.indexOf(step) + 1} of ${steps.length}`;
}

/** A plain line when the reading activities are finished and the tapping one comes next. */
export function warmupSetLine(prev: StepId | null, next: StepId): string | null {
  if (prev && prev !== 'dots' && next === 'dots') return 'The reading activities are finished.';
  return null;
}
