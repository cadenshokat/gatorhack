# WebAble mobile study: protocol `mobile-replica-4.3.0`

*Revised 3 Nov 2026 (morning): 4.3.0 (pictures of each round on the last questions, the full UMUX after each round,
only under 50 with no trouble stops someone) on 4.2.0 (three busy websites a round, each task's answer at the same depth in both
versions, the answer's depth recorded per website) on 4.1.0 (recipes in place of the football pages, the round ratings
in words, captions and comments kept small on the simplified page) on 4.0.0 (Caden's first in-person pilot: shorter,
find-the-answer tasks, live AI fitted to the person), on 3.0.0 (the committee's review of 28 Oct), on 2.1.0 (outcome
tasks, every scale point labelled, 28 Oct 2026), on 2.0.0, itself on 1.0.0 (27 Oct 2026). The code is in
`apps/study`; this file is the protocol, the measures and the analysis plan. When the code and this file disagree, fix
one of them before collecting data. Change the protocol version for any change to pages, tasks, wording, scoring or
engine. Choices still open for Caden and Dr. Rani are in `docs/STUDY-DECISIONS.md`. Sections below 0 still describe
3.0.0 where 4.0.0 to 4.2.0 do not say otherwise.*

## 0. What changed

### In 4.3.0

Changes made before the first participants (3 Nov):

- **Pictures on the last questions.** People mixed up "round 1" and "round 2". "Did the 2 rounds feel different?" now
  shows one website from each round, as it looked in that round (the round's first website, without or with
  WebAble), and each liking question shows that round's picture. The pictures are fixed screenshots at the typical
  text size in light mode (`public/shots`, made by `scripts/shots.mjs`), so for someone who chose large text or dark
  mode they are close to, not exactly, what they saw. Showing both pictures on the first question makes the difference
  visible before people say whether they felt one; read its answers with that in mind.
- **The full UMUX after each round** (Finstad 2010), 4 statements in place of UMUX-Lite's 2. Statements 1 and 3 are
  UMUX-Lite's, worded as before, so `umux_*` (UMUX-Lite) stays comparable with earlier sessions; the full score is
  `umux_full_*`. Statements 2 and 4 are negative: "Using these websites was frustrating" and "I had to spend too much
  time fixing mistakes on these websites". There is no validated 5-statement version.
- **Who can take part.** Only "Under 50" together with "None of these" stops someone; under 50 with a trouble, and 50
  or over with none, go on. "Under 50" is saved as `age_band = under_50`. The age question's line now reads "This
  study is for people aged 50 and over who often have trouble using websites". The agreement still asks people to
  confirm they are 50 or over: check this with the ethics approval.

### In 4.2.0

From Caden's design review (3 Nov 2026, about 2 am), before any participant:

- **Three websites a round, all busy.** Each round has a news story (AP News, as before), a health article and an
  entertainment story, one of each family, in a shuffled order: 6 scored websites a person in place of 4, so each
  condition has 3 tasks per person instead of 2. The recipes are dropped: a recipe page is laid out the way people
  expect (ingredients, then steps), so it tests little. The new families are sites with ads between paragraphs,
  sticky video and bars (pages, tasks and validation below). The study now takes about 20 minutes, and
  the start page and the agreement say so.
- **Each answer sits at the same depth in both versions.** Before, the simplified page moved the answer up by 1 to 3
  screens (the recipes' ingredients from 3.9 screens down to 0.7), so part of WebAble's advantage was less scrolling.
  Each task's answer now sits where the two versions match: `scripts/depth.mjs` measures the answer's top, in
  screens of the study's 664 px website frame, on the original page and on the adapted one (the simplified page,
  recorded AI answers, the typical text size). Rules: the adapted depth within 0.5 screens of the original; the
  original between 1.3 and 2.8 screens (past the first screen, so finding it takes looking); set A and B within 0.5
  of each other; the answer once on the page; a fact a reader would not already know. `depth.mjs --scan` lists every
  block of text with both depths. On AP the two versions agree for the first 2 screens and part company below (ads
  between paragraphs), so both AP questions come from the story's second paragraph (1.40 screens in both originals;
  1.12 and 1.24 adapted): "How many space agencies joined forces for the mission?" (5) and "How many years ago did
  van Gogh see the sky that may have inspired the painting?" (137).
- **The six websites** (depth in screens of the 664 px frame, the answer's top; adapted = the simplified page with the
  recorded AI answers; matched at the typical text size, shown also at the large one):

  | Family | Set | Copy (`replicas/`) | Question (answer) | Original | Adapted | Diff | Adapted, large |
  |---|---|---|---|---|---|---|---|
  | news | A | `ap-vangogh` (AP News) | How many years ago did van Gogh see the sky that may have inspired the painting? (137) | 1.40 | 1.24 | −0.16 | 2.99 |
  | news | B | `ap-mars` (AP News) | How many space agencies joined forces for the mission? (5) | 1.40 | 1.12 | −0.28 | 2.48 |
  | health | A | `hc-fiber-sleep` (Health.com) | How much fiber does the article say to aim for each day? (25 to 38 grams) | 1.74 | 1.24 | −0.50 | 3.06 |
  | health | B | `hc-whole-grains` (Health.com) | How many servings of whole grains do U.S. guidelines recommend each day? (2 to 4 servings) | 1.55 | 1.15 | −0.40 | 2.68 |
  | entertainment | A | `pp-millie` (PEOPLE) | In what year did Millie Bobby Brown move to her farm in Georgia? (2022) | 2.20 | 1.73 | −0.47 | 4.60 |
  | entertainment | B | `pp-karin` (PEOPLE) | In what year did Karin Slaughter's novel The Good Daughter come out? (2017) | 2.29 | 2.07 | −0.22 | 5.31 |

  What makes them busy: AP as before (7–9 ads, a video ad, a sticky header); Health.com a fixed header, 9 ads between
  paragraphs and one fixed at the bottom; PEOPLE a fixed app banner and header (a third of the first screen), an ad
  fixed at the bottom, a floating video player (a still in the copy) and about 10 ads between paragraphs. Every copy:
  no requests to other sites, no missing files, all behaviour checks pass, the simplified page opens and keeps the
  article's paragraphs, and the recorded AI answers replay with no misses in Chromium and WebKit in every recorded
  setting. Pixel differences from the live pages are over target in places and are the ad slots (the live screenshot
  draws them blank) and PEOPLE's playing video (a still in the copy): first screen 0–0.3% (Health.com) and 4.6–4.8%
  (PEOPLE); full page 1.2–3.9% (PEOPLE) and 8.4–12.9% (Health.com). Left out of the copies, as on Allrecipes: PEOPLE's
  late "Become a PEOPLE VIP" pop-up and an occasional full-screen ad; Health.com's endless feed of further articles.

  Known limits of the matching, to report:
  - The adapted answer sits a little higher on every page (0.16 to 0.50 screens, about a third of a screen on
    average): the simplified page drops the site's header and banner above the story. Every page is within the 0.5
    rule; the fiber page is on it (−0.50; −0.502 unrounded).
  - On PEOPLE and Health.com only the top of the story matches: below the first ad, every paragraph sits 0.6 to 5
    screens deeper on the original. So the PEOPLE answers are in the first paragraph, and the Health.com answers in
    the "At a glance" box near the top. The Health.com facts are repeated further down the article (fiber at about
    9 phone screens, whole grains at about 5.7); the box comes first in both versions and is where depth is measured.
    The whole grains article also says "the average of three daily servings recommended" further down, which is
    within the right answer.
  - The fiber amount (25 to 38 grams) is the U.S. guideline, which some people may know; `answer_seen` shows whether
    the answer was ever on screen, so a right answer without it can be counted as a guess.
  - The Karin Slaughter article is about a crime thriller series and mentions "a brutal act of violence" in its plot
    summary.
  - Tried and dropped: Healthline (blocked the capture browser after a few loads); WebMD and Verywell Health (WebAble's
    simplified page left out the article's paragraphs: its AI rewrite replaced a long article body with a short table,
    and its checks test numbers and links but not that the text is still there; an engine fault to fix after the
    study, not before it); five other PEOPLE articles and two other Health.com articles (no fact at matched depth).
- **The answer's depth for each person** (`metrics.answerDepth`, export `answer_depth`). Depth can be matched only at
  one text size: larger text makes the simplified page longer (at the large setting the AP answers sit 2.5 and 3.0
  screens down instead of 1.4). So each website records how far down the answer started, in the version and at the
  text size the person saw, for the analysis to adjust for.
- **The rewrites go out together, websites load ahead, the recipes open on the study link** (late on 2 Nov; see the
  last three points of 4.1.0).

### In 4.1.0

From Caden's review of 4.0.0 (2 Nov 2026, evening):

- **Recipes instead of football.** The Florida Gators opponent-history pages confused people who do not follow
  football. Each round's second website is now a recipe on Allrecipes (family `recipe`): set A "Simple Banana Bread"
  (`ar-banana-bread`, "How many cups of sugar go into the banana bread?", ⅔ cup) and set B "The Perfect Chocolate
  Chip Cookie" (`ar-cookies`, "How many cups of chocolate chips go into the cookies?", 1 cup). Both answers are an
  ingredient amount that is not a usual default, shown once on the page, about 3 screens down on the original (the
  news answers are 4–5); a floating "Ingredients" button on both opens the list, as on the live site, and the
  servings buttons (½x, 2x) rescale the amounts there too. Both pages carry the same furniture (header, sticky
  bottom ad, display ads, the share row, reviews). Validation: no outside requests or missing files and all behaviour
  checks pass; the first screen differs from live by 0.51–0.52% of pixels (target 0.5%, the header's slide-in
  timing) and the full page by 3–9% (target 2%: the live screenshot paints off-screen ad frames empty, the copy keeps
  the ads it showed). The Gators copies stay in `replicas/` and are no longer shown.
- **The round ratings in words.** "How much did you like using the websites in round N?" has 7 answers in words
  (Disliked it a lot, Disliked it, Disliked it a little, Neither liked nor disliked it, Liked it a little, Liked it,
  Liked it a lot), stored 1 to 7, in place of 1 to 10 with words only at the ends. The export keeps 4.0.0's 1 to 10
  ratings apart (`liking_scale`); the paired summary uses only the 7-point ones.
- **Small things stay small on the simplified page** (`apps/extension/src/ui/calm/plan.ts`, `model.ts`). On AP News
  the lead photo's caption had become a large subtitle under the headline, and the byline, date, "Leer en español"
  and a comment count ("15") sat at full reading size between the photo and the story: a long caption in the photo
  gallery was taken as the story's first paragraph. Captions and gallery text are no longer read as the story, its
  subtitle or its byline; the caption is small under the photo; the date and section are the small line above the
  headline; the byline is one small line; the gallery's other captions and counters are left out; readers' comments
  move into a closed "Comments" at the end (their words only, no reply or report buttons); and the lead photo is the
  page's own copy (the share image's address is on AP's servers, which the study site's security policy blocks).
  The AI answers for both AP pages were recorded again after this change.
- **A closed pop-up is not an alert.** On the cookie recipe the AI rated Allrecipes' "Ingredients" panel (closed until
  its floating button is tapped) as a pop-up that matters to the task (0.71, the bar is 0.70; 0.62 on the banana bread),
  and the simplified page then drew the whole recipe part that holds the panel as a warning card of large buttons
  ("Toggle Screen Wake", "Save", "Rate") above the ingredients. A kept pop-up now counts only while it shows, and a
  part counts as the pop-up only when it sits inside it or holds little more than it. Both recipes now open on the
  title, ingredients and steps.
- **Recorded in both engines.** Each adapted page's AI answers are now recorded in Chromium and then in WebKit
  (`record.mjs --engine webkit --add`), so iPhones replay the AI's read of every element: 4.0.0 had one element on the
  AP stories (the video and ad box at the end) that WebKit read differently and that had no recorded answer. All four
  adapted pages replay with no misses in either engine, in every recorded setting.
- **The recipes open on the study link** (3 Nov, about 1 am). A copy whose address ends in "/" (both recipes) was
  built as a file named `.html`, which GitHub Pages never publishes, so on the study link the recipe websites never
  opened ("This website is taking a long time to open"); the dev server served them, so every check before this
  passed. They are built as `index.html` now. Sessions saved before this fix are tests.
- **Adapted websites load ahead.** With live AI an adapted website took about 5 s (recipe) to 12 s (news) to be ready
  after its card came up: the news story's AI layout comes first, then the AI rewrites of its parts, about 4 s each.
  The adapted round's two websites now load one after the other, invisibly, behind the screens before that round
  (the practice website and the round's start; or round 1's statements, the break and round 2's start), and a website
  not ready by then loads behind the previous one's ease question. Nothing starts loading while a website is being
  timed, and nothing loads during the other condition's round. A website that loaded ahead appears when its card
  does, in the same frame; its card still stays up at least 2.5 s, and "taking a long time" now counts from when it
  started loading. The record keeps how long it loaded ahead (`preloadMs`, export `preload_ms`): the wait at the card
  was about `readyMs − preloadMs`. The AI's rewrites of a page's parts now all go out at once (6 requests, was 3).

### In 4.0.0

From the first in-person pilot (2 Nov 2026): it took 40 minutes, the participant stopped engaging after about 25, the
"find the link" tasks were ambiguous (on the park pages, look-alike sections such as park hours read as places the
closures might be, and tapping them did nothing), and WebAble's AI never responded to the person. Exclude that
pilot session from analysis (Caden finished it for the participant).

- **About 15 minutes.** The warm-up (5 activities, about 29 screens) becomes "Set up WebAble" (4–6 screens); the 10
  SUS statements after each round become UMUX-Lite's 2; each round has 2 websites (news and sports; the park pages
  are dropped: WebAble barely changed them and their tasks confused people); the comment after each round, the
  realism and "what happened" questions, the "Get ready" page, and the zoom, tap-the-wrong-thing and phone-holding
  questions are gone. About 40 screens in all.
- **Find-the-answer tasks** (the 1.0.0 tasks again, matched across sets): a question whose answer is on the page
  (a score in a results table, a number or year in a story, the practice's Friday high). The person taps
  **I found it** and picks from 4 answers, or **I cannot find it**. Success is unambiguous on either version of a
  page. Link taps do nothing, as before. Each website has **2 minutes** of active time; then the answer sheet opens
  by itself (`TrialRecord.timedOut`).
- **Shorter cards.** The card before a website is the question, which website it is in one line, and "Find the
  answer on the website, then tap I found it". The numbered how-to steps appear only on the practice.
- **Set up WebAble** (`src/shell/Warmup.tsx`, `src/experiment/tuning.ts`): "What gets in your way on websites?"
  (small text, tapping the wrong thing, busy pages, things that move, long pages full of words), the onboarding's own
  text size step, light or dark (two samples), and with live AI "How do you like information?" (steps, short points,
  paragraphs) and "How should websites be written for you?" (plain and short, as the website wrote it). Then a list
  of what WebAble will do, in the person's terms. The answers tune the fit (bigger buttons and steady taps, the
  simplified page sooner, motion stopped, light or dark) and become the AI's reader description (`ReaderProfile`,
  the same thing the extension builds from what a person's AI assistant knows about them).
- **A tap baseline** (`SessionRecord.baseline`, `src/shell/baseline.ts`): taps on the question screens before the first
  website (misses, near misses, repeats, changed answers, time to answer, distance from an answer's middle). It is a
  covariate for speed and accuracy, it sets how much bigger buttons get, and it is the "usual" miss rate WebAble's AI
  compares tapping on the websites with (`fit.baselines`).
- **Live AI on the adapted websites** (`src/replay/live.ts`, `VITE_STUDY_AI_ORIGIN`, the server at
  https://webable-gatorhack-ai.vercel.app). The AI's read of each page is still recorded and replayed (instant, the
  same for everyone). What depends on the person is asked live: AI-designed layouts (started while the card is up and
  put on before Start; after Start the engine offers them on the page and never swaps by itself), rewrites of the
  simplified page and paragraphs for this person's reader description, and struggle help (Jev judges tapping against
  the baseline; WebAble offers a fix on the page). If the server cannot answer, the recorded answers (written for a
  general reader) are used, and the session notes it. Each adapted trial's `delivery.ai` records the live calls, the
  layout outcome and any offers accepted.
- **Learning between websites.** Help the person accepts on one adapted website (bigger buttons, larger text, steady
  taps, the simplified page) stays on for the next adapted websites (`fit_learned` note).
- **Blue.** Primary buttons are blue (#0A5FD1, 5.9:1 with white); a chosen answer is light blue with a blue edge.
  Links on WebAble's simplified page are blue (#0040DD, 7.6:1) instead of ink, in the extension too.
- **Steps in words.** The header says "Step 2 of 6 · Set up WebAble" instead of the wordmark.
- **Agreement.** With live AI it says what is sent to the AI (the website's text and layout, how the person likes to
  read, numbers about tapping and scrolling; never their name, age or anything else about them) and who runs it
  (TypeSafe and OpenAI). Without `VITE_STUDY_AI_ORIGIN` it keeps the 3.0.0 wording ("Nothing you do is sent to an AI").
- **Approval.** Sending participants' tapping and reading preferences to outside AI companies is a change to what
  the exempt determination covers. Check with Dr. Rani whether it needs an amendment before running participants.
- **Analysis.** UMUX-Lite replaces the SUS as the usability measure (`umux_*` in the export; the SUS stays for
  earlier sessions). The tap baseline and the set-up answers are in `participants.csv`; `timed_out`, `ai_layout`,
  `ai_accepted` and `ai_calls_failed` in `trials.csv`.

### In 3.0.0

From Caden's methodology review with Dr. Rani on 28 Oct 2026.

- **Order: information, agreement, then questions.** The start page now gives the ethics review and its reference
  (`VITE_STUDY_APPROVAL`). The agreement is the second page, before any question; it ends "By tapping I agree to take
  part, you agree to take part in this study … If you do not want to take part, you can stop now." The two questions
  on who the study is for come right after it. Nothing is sent until they show the person can take part
  (`SessionRecord.eligible`), so someone who cannot take part still leaves with nothing recorded.
- **Demographics and an identifier.** About you adds first name (only to find anyone who took part twice; never part
  of the results; the export puts names in `repeats.csv` alone), gender, race and ethnicity (the 2024 US federal
  categories, OMB SPD 15, choose all that apply), and comfort with phones, computers and websites (1 I rarely use
  them … 7 Expert user, every point in words). The agreement lists them under "What we record".
- **Round ratings replace "Which round would you choose?".** After both rounds, each round is rated 1 to 10 ("How
  much did you like using the websites in round N?", 1 Did not like it at all … 10 Liked it a great deal), on screens
  that say which round used WebAble, in the person's own order. "Did the 2 rounds feel different?" (and what was
  different) now comes first, while people still do not know which round was which.
- **Realism is asked about the websites WebAble changed**: "How much did the websites WebAble changed still look and
  work like the real ones?" (same 7 answers and way out). Before 3.0.0 it asked about all the copies.
- **"Should we use your answers?" is dropped**: the agreement covers it. Its exclusion applies to earlier sessions only.
- **Wording:** a quiet place is a suggestion ("If you can, a quiet place where you will not be disturbed"); the
  practice task says "hourly forecast" (the page's own word, for the practice only); "Sentence:" sits above each
  true-or-false sentence in the warm-up; the round intro says "Then you answer some questions about the 3 websites";
  the task kept in view on a website is 18 px instead of 16 (inside the same 140 px bar, so the website's height,
  and the recorded AI answers, do not change).
- **Not changed, and why.** Round order was already counterbalanced (four sequences: original or adapted first,
  crossed with page set A or B first; invitations in shuffled blocks of four), as the committee asked. The two pages
  of a family still share one task (§3), so people do the same task twice on different pages of the same website;
  counterbalancing spreads that learning evenly over both conditions but does not remove it. Caden's decision,
  30 Oct 2026.
- **One link for everyone.** The plain study link now starts a real session (a new code, a random order of the four)
  instead of a preview; `?preview` or `?seq=` keeps a preview. Invitation links still work.
- **Approval:** first name and the demographic questions are new data; they belong in the amendment (§9).

### In 2.1.0

- **The quiz is gone. Each website task is now reaching a useful destination on the website**, instead of finding a
  fact and picking it from four choices. Example: "Before you visit, you want to check if any part of the park is
  closed or has a warning. Open the page that would tell you." The person taps the link that would open it, by any
  route; links never open, and a sheet asks "Is this what you were looking for?" (Yes, this is it / No, keep
  looking). Yes ends the task. Success is the outcome: the confirmed link goes to one of the task's destinations
  (§3, §6). "I cannot find it" is the way out, with its own "Do you want to stop looking?".
  - Basis: original vs adapted (or redesigned) websites with older or motor-impaired adults judged by reaching the
    right destination, with completion, time, errors and experience measured (Valencia et al. 2017; Patsoule &
    Koutsabasis 2014). Success defined by the outcome, any route allowed; adaptation may come out worse.
  - Not built: **choose an option that meets requirements** and **complete a short action** (form-like tasks). The
    frozen copies have no working listings or forms, WebAble's simplified page drops the Gators table's per-row link
    menus, and the one natural choice on a park page (Everglades: wet or dry season page) has no match on Biscayne.
    They need working study pages that WebAble keeps usable, checked in both versions (`docs/STUDY-DECISIONS.md` §11).
- **Every answer on every 1 to 7 scale carries words**, not only 1 and 7: the 10 statements (Strongly disagree,
  Disagree, Somewhat disagree, Neither agree nor disagree, Somewhat agree, Agree, Strongly agree; instrument 1.2.0),
  the ease question (Very easy, Easy, Somewhat easy, Neither easy nor hard, Somewhat hard, Hard, Very hard) and the
  realism question (Not at all like them … Exactly like them). The owner's direction, 28 Oct 2026.
- The ease question after a website reads "How easy or hard was this task?".

### In 2.0.0

- **Question and people.** Older adults (50 or over) who say websites often give them trouble: getting around a
  website, finding the information they need, or understanding what it says. Fine-motor disability is no longer the
  focus or a condition of taking part; touch is one part of what is measured.
- **Eligibility** is checked before the agreement with two questions. Answers from someone who cannot take part are
  not kept.
- **Two conditions only**, original and AI-assisted adapted. No fixed-settings condition.
- **Tasks stay realistic find-the-information tasks.** The 28 Oct proposal to replace them with tasks that name one
  control (`docs/STUDY-MEASURES.md`) is not adopted: it isolates touch accuracy but removes the navigating and
  finding that the question is about.
- **More evidence than the multiple-choice answer:** how each website ended, including whether the answer was ever
  on screen, plus time, interaction difficulties, ratings and a comment after each round.
- **What participants receive is described accurately.** The agreement and the thank-you page separate the person's
  own settings (from the warm-up) from the AI's page decisions (made once per website and the same for everyone),
  and the saved data records which one made each change.
- **The primary outcome and the sample size are open decisions**, not carried over (`docs/STUDY-DECISIONS.md` §1–2).
- **Approval.** UF exempt protocol ET00056117 covers adults with fine-motor disabilities. This population needs an
  amendment or a new determination before anyone is invited (§9).

## 1. Question

> Among older adults who report recurring web-use difficulties, how does AI-assisted interface adaptation affect task
> performance and perceived usability compared with original webpages?

Within each person, on their own phone, we compare frozen copies of real web pages as the sites made them
("original") with the same kind of page adapted by WebAble ("adapted").

**What this comparison can show:** the effect of the AI-assisted adaptation we tested (this engine, this warm-up,
these recorded AI decisions, these pages) against the original pages, for people like those who took part.

**What it cannot show:**
- that AI personalization is better than every fixed accessibility setup (none was tested);
- which change caused a difference (the adaptation is tested as a whole);
- anything about understanding: the tasks ask people to find a fact, and finding a fact is not evidence of
  comprehension (`docs/STUDY-DECISIONS.md` §4);
- anything about the parts of WebAble the study leaves out (§2).

## 2. The two conditions: what participants actually receive

**Original:** the frozen copy as the site made it.

**AI-assisted adapted:** WebAble's real engine (`apps/extension/src/engine` and `src/ui`, unchanged) runs on the same
copy behind a stand-in for the extension's messaging and storage (`apps/study/src/shim`). Every change it makes has
one of these sources, recorded per change in the delivery record (`ops[].source`, from the engine's ledger):

| Source | What it is | What it changed on our pages |
|---|---|---|
| **The person's settings** (`fit`) | Set by the warm-up (§5) before round 1, then fixed. Different for each person. | Text size, darker text, line spacing, heading size, bigger tap targets, ignoring a second tap that comes very quickly, stopping motion, unpinning the Gators top bar. |
| **The AI's page decisions** (`jev`) | The AI's read of each page, the meaning check before a simplified page opens, which button closes a pop-up, and how the simplified page lays out the page's parts. **Recorded once per copy and replayed**, so they are the same for everyone. | Fading less important parts, moving boxes that cover the page, opening the simplified page and laying it out (on the Mars story it shows one sentence as a short fact: "Time on Phobos: 100 days"). |
| **Safety checks** (`check`) | Rules that hold a change back or undo it if it breaks the page. | Size steps held back; changes undone. |

Some changes are logged without a ledger line (one `unobstruct` on the Mars story); the export counts these apart
(`ops_no_source`). Which changes apply can depend on the person's settings, so whether a simplified page opens is not
guaranteed to be the same for everyone, even though the AI's answers are.

**Not part of the study,** and not to be claimed: learning from what the person does, offers when someone seems to
struggle, paragraph rewrites, AI-designed layouts, the WebAble sheet and its "Original page" switch (hidden so nobody
can turn WebAble off mid-round), the simplified page's rows that close it to use something on the page itself (the
van Gogh story's "Play it on the page" video row; hidden, since there would be no way back), and any AI call during a session (nothing a participant does is sent to an AI).
The warm-up sets sizes and colours; it does not diagnose or test anything.

### The copies

Phones can't run the extension, and real sites can't be framed or measured from another site; live pages also change
between loads. So every participant gets **frozen copies of real pages**, served from the study site at each page's
own path (`apps/study/replicas/<id>/`): captured in an emulated iPhone (390 × 844, 3×), site scripts removed, the
behaviours the experience depends on (cookie notice, sticky header, sections, video, ads) rebuilt as small local
scripts, and checked against the live page (`manifest.json`, `validation`). The engine commit and the recorded
answers' version are stored with every session.

**Text size on a phone never narrows the page** (Caden's decision, 27 Oct 2026). The page stays at its own phone
width, and every text size on it is multiplied by the same factor (at most 2), the way a phone's own text-size setting
does; it goes through the same checks as every other change and is stored per trial (`textScale`).

## 3. Design

- **Within subjects,** two blocked rounds, one per condition. Each round has one page from each of three families:
  - **news:** an AP article (7–9 ads, a video ad, a sticky header);
  - **sports:** a floridagators.com opponent-history page (14 px text, a cookie notice over 39% of the first screen,
    a results table wider than the phone);
  - **gov:** an NPS park "Basic Information" page (14 px text, facts inside collapsed sections).
- **Matched pairs:** each family has two pages (set A and B) from the same template, with the answer at a similar
  depth. Known gaps: NPS answers 1.76 screens deep (Everglades) vs 0.87 (Biscayne); AP 3.57 (van Gogh) vs 4.11 (Mars),
  and only Mars has subheadings. Gators 4.72 vs 4.69. The pilot checks each pair is equally hard.
- **Counterbalancing:** four sequences (condition order × set order), handed out by invitation in shuffled blocks of
  four. Family order inside each round is shuffled from the participant's code. Half the people meet the adapted
  pages first, so the original pages are never a required first step.

| Sequence | Round 1 | Round 2 |
|---|---|---|
| 0 | original, set A | adapted, set B |
| 1 | adapted, set A | original, set B |
| 2 | original, set B | adapted, set A |
| 3 | adapted, set B | original, set A |

- **Calibration is separate from the scored rounds.** The warm-up uses its own content (sample text, short sentences,
  single words, a ring of dots), happens before round 1 for everyone, and sets the person's settings once; they do
  not change during or between rounds. Nothing from the scored pages feeds the settings. Using short original-page
  activities as calibration is an open option (`docs/STUDY-DECISIONS.md` §5).
- **Practice:** one page, the National Weather Service's Gainesville forecast (`nws-gainesville`), shown as the site
  made it, before round 1. Not scored. Whether it should also show the adapted version is open (decisions §6).
- **Blinding:** none is possible. The rounds are called Round 1 and Round 2; which one used WebAble is told at the end.

### The tasks: same goal, same destination, any route

Each family's two pages (set A and B) share one task, so the pair differs only in the page. The task names the need,
never the link's words or where it is. A destination counts by where the confirmed link goes (`targets` in
`replicas/<id>/task.json`), so every route to it counts: the page's own link, a menu, or WebAble's simplified page,
which passes the tap to the page's own link. Every target below was checked present in both versions on both pages
of its pair (28 Oct 2026, demo settings `rosa`).

| Family | Task (as the person reads it) | Destination | Ways there, original | Ways there, adapted |
|---|---|---|---|---|
| news (AP van Gogh / Mars) | You liked this story and want to read more by the reporter who wrote it. Open the page that lists their stories. | `/author/marcia-dunn` | The byline "By MARCIA DUNN" under the headline | Simplified page: the same byline |
| sports (Gators Kentucky / LSU) | You want to see how Florida has done against other teams too. Open the page that lists every team Florida has played. | `/sports/football/opponent-history` | "Back To History" at the top (under the cookie notice until it is closed) | Simplified page: "Back To History", near the end |
| gov (NPS Everglades / Biscayne) | Before you visit, you want to check if any part of the park is closed or has a warning. Open the page that would tell you. | `/ever/…` or `/bisc/planyourvisit/conditions.htm` | "Alerts 3/5" in the park's bar, "See 3/5 park alerts", the park menu | The same page with the person's settings (no simplified page) |
| practice (NWS) | You want to see what the weather in Gainesville will be like at each hour of the day. Open the hourly forecast. | Hourly or tabular forecast | "Hourly Weather Forecast", "Tabular Forecast" | Original only |

Known differences to watch in the pilot: on the sports pages the destination moves from the top (original) to near
the end (simplified page), and on the original the cookie notice covers it until closed. These are what the study
measures, in either direction. With real warm-up settings a simplified page may or may not open; the pilot repeats the
check with participants' own settings (`docs/STUDY-DECISIONS.md` §8). `scripts/e2e.mjs` does every task the way a
person would: a wrong link taken back with "No, keep looking", the cookie notice closed when it covers the link, then
the destination's own link on whatever version is showing.

## 4. Participants

**Who can take part:** adults aged 50 or over who say at least one of these often happens to them when they use
websites: "I find it hard to get around a website", "…to find the information I need", "…to understand what a
website says". No diagnosis and no health questions. A first name is asked only to find repeats (§9). The threshold ("often") and whether trouble reading or
tapping alone should qualify are open (`docs/STUDY-DECISIONS.md` §3).

**How it is checked:** two questions right after the agreement (from 3.0.0; before it in 2.x): age group (Under 50,
50–64, 65–74, 75–84, 85 or over) and the three kinds of trouble (tick all that apply, or "None of these"). Someone who
cannot take part sees "You cannot take part in this study", is told nothing was recorded, and can go **Back** in case
of a slip. Nothing is sent until these answers pass. There is no payment, so there is little reason to answer falsely.

**About you (after the age questions):** first name (only to find repeats), gender (Woman, Man, Another gender, Prefer
not to say), race and ethnicity (American Indian or Alaska Native; Asian; Black or African American; Hispanic or
Latino; Middle Eastern or North African; Native Hawaiian or Other Pacific Islander; White; any number, or Prefer not to
say), comfort with phones, computers and websites (1 I rarely use them, 2 Not comfortable, 3 A little comfortable, 4
Somewhat comfortable, 5 Comfortable, 6 Very comfortable, 7 Expert user), how often they zoom in to read on their
phone, how often they tap the wrong thing, and how they will hold the phone. These describe the sample; they are not
eligibility questions.

**Sample size:** open (`docs/STUDY-DECISIONS.md` §2). 4–6 pilots first, excluded from the analysis.

## 5. Procedure (about 20–25 minutes; measure it in the pilot before advertising a length)

1. Start page (who the study is for, what happens, how long, what you need, the ethics review and its reference).
2. Agreement: who is doing it and why; what you will do; **what WebAble changes** (your warm-up sets sizes; its AI
   looked at each website once before the study and its decisions are the same for everyone; it does not learn about
   you; nothing you do is sent to an AI); the copies; what we record and do not; risks; "not a test of your health,
   eyesight, hands or memory"; deleting answers; contact. "By tapping I agree to take part, you agree to take part in
   this study", confirming 50 or over; "If you do not want to take part, you can stop now."
3. Who the study is for: 2 questions (§4).
4. About you: 7 questions (§4), each with a short reason and, where it fits, a way out.
5. Get ready: upright, usual glasses, a quiet place if they can; "we are testing the websites, not you".
6. **Warm-up (calibration):** the onboarding's Reading and Pointing steps, unchanged in what they measure
   (comfortable size, the true/false ladder, faint words, light or dark, the ring of dots), with the study's own
   wording (`apps/study/src/shell/warmupWords.ts`). `deriveFit` turns them into the person's settings, fixed for the
   rest of the study. The onboarding's Finding step needs the extension and is skipped, so the settings it would feed
   (motion, clutter) take their defaults. "Skip the warm-up" gives the default settings.
7. Practice website.
8. Round 1: three websites. Each one: a page with the task and three numbered steps ("Use the website the way you
   usually would." "When you find what you need, tap it." "If you cannot find it, tap I cannot find it.") and
   "Links do not open other pages in this study. When you tap one, we ask if it is what you were looking for." (it
   stays at least 2.5 s in every condition while the page loads and WebAble prepares behind it) → Open the website →
   use it, with the task kept in view above Pause and "I cannot find it" → each tapped link: "Is this what you were
   looking for?" with the link's own words (Yes, this is it / No, keep looking) → the ease question. Then the 10
   statements, then "What was it like to use these 3 websites? (optional)". The round's start page says "Then you
   answer some questions about the 3 websites".
9. Break.
10. Round 2, the same way.
11. Last questions (5: whether the rounds felt different, a 1–10 rating of each round, realism of the websites
    WebAble changed, what else happened), then the thank-you page: the code, which round used WebAble and what it did for this person,
    in two lists: "From your warm-up, WebAble: …" and "WebAble's AI looked at each website once, before the study.
    Its decisions were the same for everyone. On your websites, it: …" (only changes the delivery records show and
    the person could see; changes under an open simplified page are left out).

**Wording** follows `docs/STUDY-WRITING.md` (one question per page, everyday words, "cannot" in full, words on every
answer of every rating, a help line on every page, nothing saved until Continue). A thin progress line runs across
the top of the screen with no words. Instructions give the goal, never the route. There is no timer on screen. Pause
stops the clock, and so does any sheet. Links never open, in both conditions; on a task, a tapped link brings up
"Is this what you were looking for?".

## 6. Measures

All taps, scrolls and visibility are measured by the frame runtime (`apps/study/src/frame`) and the shell
(`src/shell/TaskRunner.tsx`); definitions match `src/contracts.ts`. Which outcome is primary is open
(`docs/STUDY-DECISIONS.md` §1).

**Task performance (each website)**

| Measure | Definition |
|---|---|
| Destination reached (`correct`) | The link they confirmed with "Yes, this is it" goes to one of the task's destinations. |
| How it ended (`outcome`) | reached the destination; confirmed another page (`wrong_destination`); gave up after a way to the destination had been on screen; gave up without one ever on screen; skipped; technical. "On screen" means a link to the destination was in view at some point (original page: every link matching `answerSelector`; simplified page: the link's words). It is not proof the person noticed it. |
| Links tapped (`picks`) | Every link tapped during the task, in order, with the active time, where it goes, its words, whether it reaches the destination, and whether it was confirmed or taken back. From these: wrong links tapped, links taken back with "No, keep looking", whether the first link tapped was right, and the time to the first right one. A tap on the wrong link counts the same whether or not it was confirmed. |
| Active time | Visible, unpaused time from Open the website to "Yes, this is it" (or "Yes, stop looking"); time with a sheet open is not counted. Missing if hidden ≥ 5 min; flagged if hidden ≥ 60 s. Analysed as ln(s). |
| Time to a way there | Active time until a link to the destination was first on screen (`answerSeenMs`). |
| Interaction difficulties | Taps; misses (a tap on nothing interactive) and near misses (within 24 px); taps on links (navigation is off, the same in both conditions); a second tap within 500 ms on something that already responded; bursts of 3+ quick taps in one place (`rageEpisodes` in the data); taps the engine ignored (adapted only); sections opened; scroll travel and direction changes; pinch zoom (zoomed at least 1.10 times relative to the page at rest, the most zoomed, time zoomed). |

These describe what happened on these pages. **Slow work, repeated taps or misses are never labelled as a
cognitive, visual or motor impairment**, in the data, the analysis or any report.

**Perceived usability**

| Measure | Definition |
|---|---|
| SUS | Ten Brooke (1996) statements after each round, original order, meaning and tone, one per screen, answered 1–7 (Finstad 2010), with two published wording changes: "these websites" for "this system" and "awkward" for "cumbersome". From instrument 1.2.0 (protocol 2.1.0) every answer has words: Strongly disagree, Disagree, Somewhat disagree, Neither agree nor disagree, Somewhat agree, Agree, Strongly agree. Odd items r − 1, even items 7 − r; sum × 100/60 → 0–100. No score unless all ten are answered; never imputed. Flagged if all ten identical or two or more opposite pairs both ≥ 6. A 1–7 SUS cannot be compared with published 1–5 norms. |
| SEQ | After every website, "How easy or hard was this task?": 1 Very easy, 2 Easy, 3 Somewhat easy, 4 Neither easy nor hard, 5 Somewhat hard, 6 Hard, 7 Very hard (direction: Caden's decision, 27 Oct 2026; words on every answer from 2.1.0), stored with `seqScale: "easy-1"`; the export turns it back (8 − answer) so higher = easier. |

**Participant feedback**

| Measure | Definition |
|---|---|
| Round comment | "What was it like to use these 3 websites? (optional)" after each round's statements, so comments can be told apart by condition (`comments`). Replaces the single end-of-study "anything that was hard" question of 1.0.0. |
| Last questions (3.0.0) | In this order: "Did the 2 rounds feel different?" and, after yes, what was different (asked after both SUS and before anything says which round used WebAble, as a check that the difference was noticed); then each round rated 1 to 10, "How much did you like using the websites in round N?" (1 Did not like it at all … 10 Liked it a great deal; only the ends have words), each screen saying what that round was ("WebAble changed the websites for you, using your warm-up" or "the websites looked as they normally do") and which websites it had (`final.liking`); then how much the websites WebAble changed still looked and worked like the real ones (1 Not at all like them, 2 Very little like them, 3 A little like them, 4 Somewhat like them, 5 Mostly like them, 6 Very much like them, 7 Exactly like them, or "I have not used the real websites before"; `final.adaptedRealism`); then what else affected them. The ratings are given knowing which round used WebAble, so they are reported apart from the SUS and SEQ, which are blind. |
| Last questions (before 3.0.0) | Preferred round; the same "different" check; what else affected them; how real all the copies felt; "Should we use your answers?" |

**Delivery (manipulation check), each adapted page:** each change with its status and source (person's settings, AI
page decision, safety check), body text size before and after, text factor, simplified page open, how its parts were
laid out, replay misses, settle time. "Delivered" = at least one change stuck and something measurable changed.

**Not measured:** comprehension (`docs/STUDY-DECISIONS.md` §4). **Not recorded:** full names (a first name only, for
repeats), typed text on websites, screenshots, pointer paths, other tabs or apps, location.

**Device:** screen, pixel ratio, viewport, a 16 px reference line (catches phone-level text scaling), reduced motion,
dark mode, input types seen; noted again at each round to catch a change of phone.

## 7. Analysis plan (preregister after the pilots and the open decisions, before main collection)

- **Estimand:** within-person difference, adapted minus original, on these pages, averaged over set and round order,
  among people aged 50+ who report recurring trouble with websites. Intention to treat: settings that changed
  nothing and delivery failures stay in.
- **Primary outcome and confirmatory test:** open (`docs/STUDY-DECISIONS.md` §1). Until it is decided and
  preregistered, every outcome is reported as an estimate with an interval, none as a confirmatory test.
- **Models, whichever is primary:**
  - SUS: paired difference (mean, 95% CI, dz), Wilcoxon signed-rank and a BCa bootstrap as sensitivity;
    `lmer(sus ~ condition + period + set + (1|pid))`; round-1-only between-subjects contrast as a sensitivity check.
  - Destination reached: `glmer(correct ~ condition + period + family + (1|pid), binomial)`; outcome levels and wrong
    links tapped (Poisson GLMM) reported by condition.
  - Time: `lmer(log(active_s) ~ condition + period + set + family + (1 + condition | pid))`. Whether this uses
    correct answers only or all ended tasks is open (`docs/STUDY-DECISIONS.md` §7).
  - SEQ: `clmm`. Misses per tap and pinch zoom: binomial GLMMs.
  - Round ratings (1–10, 3.0.0): paired difference, adapted minus original, with a 95% CI and Wilcoxon signed-rank;
    reported as a rating given after the reveal, not as a blind outcome.
  - Random effects start maximal and are simplified if they do not converge.
- **Exploratory:** does the difference vary with the kind of trouble people reported, their age group, their comfort
  with phones, computers and websites, or the size their warm-up set? Comments are coded by two people for what helped and what got in the way, by condition.
- **Exclusions (decided now):** participant: a second session by the same person (found by hand from `repeats.csv`;
  the later session is excluded); before 3.0.0, answered "No" to "Should we use your answers?"; no touch input;
  changed phone between rounds. Task: technical failure (reported, and also counted as a failure in a sensitivity analysis).
  Never excluded for being slow, for a low SUS, for disliking WebAble, or for settings that changed nothing.
- `apps/study/scripts/export.mjs` writes `participants.csv` (with `troubles`, the demographics, the round ratings
  and comments by condition, and `possible_repeat`), `trials.csv` (with `outcome`, `ops_from_warmup`, `ops_from_ai`,
  `ops_no_source`), `repeats.csv` (sessions sharing a first name, the only file with names), `responses.json`
  (without names) and a descriptive `summary.md`.

## 8. What we may say afterwards

- Counts and intervals for this sample and these pages: "Of 32 people aged 50 or over who said websites often give
  them trouble, 24 rated the round with WebAble higher; the average difference was X points (95% CI …)."
- Say "the AI-assisted adaptation we tested", and say the pages were saved copies of real websites.
- Do not say it beats fixed accessibility settings, which change helped, that it improves understanding, or anything
  about learning, offers or rewrites. Never say "people with" anything, and never describe a participant's
  performance as an impairment. Simulation numbers stay labelled as simulations.

## 9. Ethics and data

- **Approval:** UF exempt protocol ET00056117 covers "adults with fine-motor disabilities". This study now recruits
  adults aged 50 or over who report trouble with websites, with no fine-motor criterion, asks two screening
  questions right after the agreement, and (from 3.0.0) records a first name, gender, race and ethnicity, and comfort
  with technology. File an amendment or a new exempt request before any invitation, and update
  `VITE_STUDY_APPROVAL` (shown on the agreement page) to the reference that covers it. Hold invitations until then.
- Minimal risk; a candidate for exempt category 3 (45 CFR 46.104(d)(3)), which UF decides. Participants are told up
  front that the pages are copies (no deception) and, from 2.0.0, how WebAble's changes are decided.
- Nothing is sent before the agreement and the screening answers; for someone who cannot take part the answers are
  cleared and never sent.
- First names: only to find anyone who took part twice. They travel with the coded session row (the study team
  alone can read it), are written by the export only to `repeats.csv`, and never appear in results.
- Storage: table `gatorhack_study_rows` in the existing WebAble Supabase project, insert-only for the public key
  (`apps/study/supabase/migrations`). Rows are coded; the researcher reads with the service key. "Leave and delete my
  answers" calls `gatorhack_study_withdraw`. Collection stays off (preview, nothing sent) until the contact, team,
  approval reference, retention and withdrawal date are set (`apps/study/.env.example`).
- Hosting: noindex, no referrer, a self-only content policy (no outside requests), robots disallowed. From 3.0.0 the
  plain study link works for anyone who has it (Caden's decision, 2 Nov 2026): each visit gets a new code and a random
  order (the committee allowed random assignment; the export counts each order), so share it only with people it is
  meant for. Invitation links still give exactly balanced orders.
- Copies of real brands: Caden's decision (27 Oct 2026) is that exact copies are fine for this non-commercial study.
  Keep them behind invitations and take them down when the study ends.

## 10. Before the first pilot

1. The amendment (§9) and the open decisions (`docs/STUDY-DECISIONS.md`).
2. Model answers recorded for every copy (`apps/study/scripts/record.mjs`) with zero replay misses in the canonical
   setting; re-record after any engine change and re-run `scripts/e2e.mjs` for all four sequences.
3. Fix the Mars story's simplified page asking AP's server for its top photo (the copy's `og:image` still points
   there; the live site's content policy blocks it, so that photo is missing in the adapted version only).
4. Run the whole flow on a real iPhone (Safari 17.4+) and a real Android phone (Chrome).
5. Set the agreement details and storage; deploy; send yourself an invitation and check the rows arrive.
6. Pilot 4–6 people from the target group: check each pair is equally hard, that the answer is reachable in the
   adapted version with their own settings, how long it takes, and whether any wording is hard.
7. Freeze the protocol, the copies' content hashes and the engine commit, then preregister.

## References

Brooke 1996 (SUS); Finstad 2010 (7-point SUS); Lewis & Sauro 2017 (dropping an item); Sauro & Lewis 2011 (respondent
mistakes); Sauro & Dumas 2009 (SEQ); Callan & Kortum 2014 (task vs test SUS); Revilla, Toninelli & Ochoa 2017 (item by
item on phones); Meade & Craig 2012 and Aust et al. 2013 (seriousness checks); Freeman 1989 (no carry-over pretest);
Barr et al. 2013 (random effects); Valencia et al. 2017 and Patsoule & Koutsabasis 2014 (outcome tasks on original vs
adapted or redesigned websites). Touch and motor literature: `docs/STUDY-MEASURES.md`.
