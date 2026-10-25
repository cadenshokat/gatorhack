// Every word a person sees in onboarding and on the results page.
// Swap this module to change the copy. Plain language only.

import type { FitProfile } from '@webable/core';
import { effectiveTextPx } from '../logic/fitview';
import type { OnboardingExtras } from '../logic/needs';

export type SectionId = 'read' | 'faint' | 'bubbles' | 'find' | 'colours';

export interface SectionCopy {
  name: string;
  title: string;
  task: string;
  success: string;
  /** Shown on the card before Start, when this step has one. */
  before?: string;
  /** Keyboard path, shown on the card. */
  keyboard?: string;
  encourage: string;
}

export const copy = {
  welcome: {
    title: "Let's fit the web to you",
    body: 'Five quick games, about three minutes in all. They show WebAble how you like to read, click and find things, so every site can work that way for you.',
    stays: 'What you do here stays on this computer.',
    start: 'Start',
    skip: 'Skip for now and use the standard settings',
    menu: "You can play the games any time from WebAble's menu.",
  },
  returning: {
    title: 'Welcome back. Pick up where you left off?',
    continue: 'Continue',
    startOver: 'Start over',
  },
  leave: {
    ask: "Want to stop here? What you've done so far is saved.",
    keep: 'Keep going',
    stop: 'Stop for now',
  },
  saveError: {
    ask: "That didn't save. Try once more?",
    retry: 'Try again',
  },
  header: {
    skipped: 'Skipped',
    step: (n: number, name: string) => `Step ${n} of 5: ${name}`,
  },
  before: 'Before you start',
  start: 'Start',
  skip: 'Skip this one',
  skippedNote: 'No problem. On to the next one.',
  sections: {
    read: {
      name: 'Reading size',
      title: 'Reading size',
      task: 'Read each sentence the way you normally would, then press Done reading. The sentences get smaller as you go.',
      before: 'Sit as you usually do, and wear your usual glasses if you use them.',
      success: "There's no right speed. Every few sentences we'll ask a quick question about what you read, just to check the sentence came through.",
      encourage: "Nice. That's your reading size.",
    },
    faint: {
      name: 'Faint words',
      title: 'Faint words',
      task: 'A word appears, then fades a little each time. Pick the matching word from the three below it.',
      success: "Keep going until it's too faint to tell. Guessing is fine; it's meant to get hard.",
      encourage: 'Got it. Now WebAble knows how faint is too faint.',
    },
    bubbles: {
      name: 'Pop the bubbles',
      title: 'Pop the bubbles',
      task: 'Tap each bubble as it appears. Some are small and some are far apart.',
      success: 'Go at your own pace. Near misses are fine; they help WebAble learn.',
      keyboard: 'Press Tab to move to the next bubble and Enter to pop it.',
      encourage: 'Good. That sets how big buttons should be.',
    },
    find: {
      name: 'Find it',
      title: 'Find it',
      task: "We'll name something on a small page. Find it and press it. There are three short rounds.",
      success: "Just find it as you normally would. The pages change a little between rounds; that's on purpose.",
      encourage: 'Thanks. That tells WebAble how busy is too busy.',
    },
    colours: {
      name: 'Sort the colours',
      title: 'Sort the colours',
      task: "Put the colour chips in order, so each one is next to the one most like it. Start from the one that's already in place.",
      success: 'Some are close. Go with what looks right to you.',
      keyboard: 'Use the arrow keys to pick a chip and Enter to place it.',
      encourage: "All done. Here's what we found.",
    },
  } satisfies Record<SectionId, SectionCopy>,
  read: {
    done: 'Done reading',
    thing: 'a dog',
    question: (thing: string) => `Was there ${thing} in that sentence?`,
    yes: 'Yes',
    no: 'No',
    cant: "I can't read this one",
    stop: "That's enough. We have your reading size.",
  },
  faint: {
    prompt: 'Which word did you see?',
    cant: "I can't tell",
    easier: 'Which is easier to read?',
    thisOne: 'This one',
    both: 'Both are fine',
    sample: 'The afternoon train leaves at four.',
  },
  bubbles: {
    pop: 'Pop the bubble',
    count: (popped: number, total: number) => `${popped} of ${total}`,
    total: 24,
  },
  find: {
    prompt: 'Find the train times',
    round: (n: number) => `Round ${n} of 3`,
    cant: "I can't find it",
    target: 'Train times',
  },
  colours: {
    done: 'Done',
    chip: 'Colour chip',
    place: 'Place the colour chip',
  },
  results: {
    title: "Here's how WebAble will fit the web to you",
    subline: 'Based on the five games. WebAble keeps adjusting as you browse, and you can change anything, any time.',
    chart: 'What helps you most',
    chartHint: 'Longer petals mean WebAble helps more there.',
    what: 'What',
    howMuch: 'How much WebAble helps',
    lot: 'A lot',
    some: 'Some',
    little: 'A little',
    noneWord: 'Not needed',
    benefits: 'What WebAble will do for you',
    less: 'Less',
    more: 'More',
    off: 'Turn off',
    changed: "Changed. You'll see it on the next page you open.",
    settled: 'Most pages already work well for you. WebAble will keep an eye out and only step in when a page makes something hard, like tiny text or a pop-up in the way.',
    see: 'See it on a page like…',
    original: 'Original',
    yours: 'With WebAble',
    drag: 'Drag to compare.',
    status: "You're set. WebAble is on.",
    where: 'It works on every site you visit. Look for the small WebAble button in the corner of the page.',
    change: 'Change a setting',
    retake: 'Retake the games',
    skipped: (name: string) => `You skipped ${name}. WebAble will learn that part as you browse, or you can`,
    playNow: 'play it now',
    allSkipped: 'WebAble is on with standard settings, and will learn what helps as you browse.',
  },
  pages: {
    news: 'News site',
    class: 'Online class',
    pharmacy: 'Pharmacy refill',
    bank: 'Bank statement',
    recipe: 'Recipe',
  },
  captions: {
    news: 'A news story with ads and related links all around it.',
    class: 'A course page with a video, a reading and a due date.',
    pharmacy: 'Refilling a prescription: small buttons and lots of fine print.',
    bank: 'A statement with a table of payments. It keeps its layout; only the text and buttons change.',
    recipe: 'A recipe under a long story and a lot of ads.',
  },
  benefits: {
    small_text: {
      low: (bodyPx: string) => `Text stays close to each site's own size, and never smaller than ${bodyPx} px.`,
      medium: (bodyPx: string) => `Text will be ${bodyPx} px on every site, with headings kept in proportion.`,
      high: (bodyPx: string) => `Text will be ${bodyPx} px everywhere. Pages switch to one column so nothing runs off the side.`,
    },
    faint_text: {
      low: "Very faint text will be darkened so it's easy to read.",
      medium: 'Grey and pale text will be made darker on every site.',
      high: 'All text will be as dark as it can go against its background, and a little bolder.',
      dark: 'Where a site offers it, pages will use a dark background.',
    },
    small_buttons: {
      medium: (minPx: string) => `Buttons and links will be at least ${minPx} px tall, so they're easier to hit.`,
      high: (minPx: string) => `Buttons and links will be at least ${minPx} px, with more space between them.`,
    },
    steady_clicking: {
      medium: 'If the pointer slips a little while you click, it still counts as the click you meant.',
      high: 'That, plus an accidental second press counts as one.',
    },
    moving_things: 'Slideshows, videos that play on their own and moving banners will be paused. Press play when you want them.',
    busy_pages: {
      level1: 'Busy pages will put the main content first and move ads and teasers out of the way.',
      level2: 'News, recipes and other busy pages will open simplified: just what the page is for. You can switch to the original page any time.',
    },
    long_reading: (lineHeight: string) => `Long articles will get more space between lines (${lineHeight}× spacing) and lines that aren't too long to follow.`,
    telling_colours: 'Where a page uses colour alone to say something, WebAble will add a word or a pattern too.',
  },
} as const;

export const PETAL_LABEL = {
  small_text: 'Small text',
  faint_text: 'Faint text',
  small_buttons: 'Small buttons',
  steady_clicking: 'Steady clicking',
  moving_things: 'Moving things',
  busy_pages: 'Busy pages',
  long_reading: 'Long reading',
  telling_colours: 'Telling colours apart',
} as const;

export const PETAL_EXPLAIN = {
  small_text: 'How much larger text makes reading easier for you.',
  faint_text: 'How much darker grey and pale text needs to be.',
  small_buttons: 'How much bigger buttons and links should be.',
  steady_clicking: 'How much a slip or a double press should be forgiven.',
  moving_things: 'How much slideshows, autoplay and moving banners get in your way.',
  busy_pages: 'How much ads, teasers and clutter slow you down.',
  long_reading: 'How much extra spacing helps on long articles.',
  telling_colours: 'How much pages that use colour alone need a label or pattern too.',
} as const;

const PAGE_OPTIONS = ['news', 'class', 'pharmacy', 'bank', 'recipe'] as const;
export type SamplePageId = (typeof PAGE_OPTIONS)[number];
export const SAMPLE_PAGES: readonly SamplePageId[] = PAGE_OPTIONS;

export type NeedId = keyof typeof PETAL_LABEL;

/** A number the way it should read in a sentence: 22, 22.5, 1.6. */
export function formatMeasure(n: number): string {
  if (!Number.isFinite(n)) return '16';
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function helpWord(score: number): string {
  if (score >= 75) return copy.results.lot;
  if (score >= 48) return copy.results.some;
  if (score >= 22) return copy.results.little;
  return copy.results.noneWord;
}

/** The "what changes" line for one need, using the fit's real sizes. Null when this need has nothing to say. */
export function benefitLine(id: NeedId, fit: FitProfile, extra?: OnboardingExtras | null): string | null {
  switch (id) {
    case 'small_text': {
      const px = effectiveTextPx(fit);
      const text = formatMeasure(px);
      if (px >= 29) return copy.benefits.small_text.high(text);
      if (px >= 20) return copy.benefits.small_text.medium(text);
      if (px > 16) return copy.benefits.small_text.low(text);
      return copy.benefits.small_text.low(text);
    }
    case 'faint_text': {
      const band = fit.contrast.band;
      const line = band === 'S' ? copy.benefits.faint_text.high : band === 'M' ? copy.benefits.faint_text.medium : copy.benefits.faint_text.low;
      return fit.polarity.value === 'dark' ? `${line} ${copy.benefits.faint_text.dark}` : line;
    }
    case 'small_buttons': {
      const min = fit.targets.minPx;
      if (min == null || min <= 24) return null;
      const text = formatMeasure(min);
      return min >= 64 ? copy.benefits.small_buttons.high(text) : copy.benefits.small_buttons.medium(text);
    }
    case 'steady_clicking': {
      if (!fit.clicks.steady.on) return null;
      return fit.clicks.debounce ? copy.benefits.steady_clicking.high : copy.benefits.steady_clicking.medium;
    }
    case 'moving_things':
      return fit.attention.motion.on ? copy.benefits.moving_things : null;
    case 'busy_pages': {
      if (fit.attention.structureLevel >= 2) return copy.benefits.busy_pages.level2;
      if (fit.attention.structureLevel === 1) return copy.benefits.busy_pages.level1;
      return null;
    }
    case 'long_reading': {
      const on = !!extra?.readingSupport || fit.spacing.lineHeight >= 1.58 || fit.text.largePrint;
      if (!on) return null;
      return copy.benefits.long_reading(formatMeasure(fit.spacing.lineHeight));
    }
    case 'telling_colours': {
      if (extra?.colourAssist === false) return null;
      if ((extra?.colourNeed?.score ?? 0) < 48) return null;
      return copy.benefits.telling_colours;
    }
  }
}
