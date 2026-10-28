# WebAble mobile study: protocol `mobile-replica-2.0.0`

*Revised 28 Oct 2026 from 1.0.0 (27 Oct 2026). The code is in `apps/study`; this file is the protocol, the measures
and the analysis plan. When the code and this file disagree, fix one of them before collecting data. Change the
protocol version for any change to pages, tasks, wording, scoring or engine. Choices still open for Caden and
Dr. Rani are in `docs/STUDY-DECISIONS.md`.*

## 0. What changed in 2.0.0

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

### Same goal, same information, different routes

Each task has the same goal and the same answer in both conditions; the route to it may differ because the adapted
page is laid out differently. `scripts/e2e.mjs` checks on every website that the answer is in the layer the person
sees (the page, or the simplified page), tapping "Show all … rows" when that is the route.

| Page | Original | Adapted (demo settings `rosa`, 28 Oct 2026) |
|---|---|---|
| AP van Gogh | The sentence in the article | Simplified page; the same sentence |
| AP Mars | The sentence in the article | Simplified page; the answer as a short fact ("Time on Phobos: 100 days"), matched by `answerTextSimplified` |
| Gators Kentucky / LSU | A row of the full results table | Simplified page; the first 10 rows, then **Show all 76 / 72 rows** (one more tap) |
| NPS Everglades / Biscayne | Inside a collapsed section | The same page with the person's settings and fading; no simplified page |

With real warm-up settings this may differ (for example a simplified page may or may not open); the pilot repeats
the check with participants' own settings (`docs/STUDY-DECISIONS.md` §8).

## 4. Participants

**Who can take part:** adults aged 50 or over who say at least one of these often happens to them when they use
websites: "I find it hard to get around a website", "…to find the information I need", "…to understand what a
website says". No diagnosis, no health questions, no names. The threshold ("often") and whether trouble reading or
tapping alone should qualify are open (`docs/STUDY-DECISIONS.md` §3).

**How it is checked:** two questions after the start page and before the agreement: age group (Under 50, 50–64,
65–74, 75–84, 85 or over) and the three kinds of trouble (tick all that apply, or "None of these"). Someone who
cannot take part sees "You cannot take part in this study", is told nothing was recorded, and can go **Back** in case
of a slip. Nothing is sent before the agreement; for someone who can take part, the two answers are saved with the
rest of the session after "I agree to take part". There is no payment, so there is little reason to answer falsely.

**About you (after the agreement):** how often they zoom in to read on their phone, how often they tap the wrong
thing, and how they will hold the phone. These describe the sample; they are not eligibility questions.

**Sample size:** open (`docs/STUDY-DECISIONS.md` §2). 4–6 pilots first, excluded from the analysis.

## 5. Procedure (about 20–25 minutes; measure it in the pilot before advertising a length)

1. Start page (who the study is for, what happens, how long, what you need).
2. Who the study is for: 2 questions (§4).
3. Agreement: who is doing it and why; what you will do; **what WebAble changes** (your warm-up sets sizes; its AI
   looked at each website once before the study and its decisions are the same for everyone; it does not learn about
   you; nothing you do is sent to an AI); the copies; what we record and do not; risks; "not a test of your health,
   eyesight, hands or memory"; deleting answers; contact. "I agree" confirms 50 or over.
4. About you: 3 questions, each with a short reason and a way out.
5. Get ready: upright, usual glasses, quiet place; "we are testing the websites, not you".
6. **Warm-up (calibration):** the onboarding's Reading and Pointing steps, unchanged in what they measure
   (comfortable size, the true/false ladder, faint words, light or dark, the ring of dots), with the study's own
   wording (`apps/study/src/shell/warmupWords.ts`). `deriveFit` turns them into the person's settings, fixed for the
   rest of the study. The onboarding's Finding step needs the extension and is skipped, so the settings it would feed
   (motion, clutter) take their defaults. "Skip the warm-up" gives the default settings.
7. Practice website.
8. Round 1: three websites. Each one: a card with the task as a "Find out …" sentence and three numbered steps (the
   card stays at least 2.5 s in every condition while the page loads and WebAble prepares behind it) → Open the
   website → find the fact, with the task kept in view above Pause and Answer → the answer sheet (four choices, "or",
   "I could not find it", Continue) → the ease question. Then the 10 statements, then "What was it like to use these
   3 websites? (optional)".
9. Break.
10. Round 2, the same way.
11. Last questions (5), then the thank-you page: the code, which round used WebAble and what it did for this person,
    in two lists: "From your warm-up, WebAble: …" and "WebAble's AI looked at each website once, before the study.
    Its decisions were the same for everyone. On your websites, it: …" (only changes the delivery records show and
    the person could see; changes under an open simplified page are left out).

**Wording** follows `docs/STUDY-WRITING.md` (one question per page, everyday words, "cannot" in full, every rating
page says what 1 and 7 mean, a help line on every page, nothing saved until Continue). A thin progress line runs
across the top of the screen with no words. Instructions give the goal, never the route. There is no timer on
screen. Pause stops the clock. Links on the copies are turned off in both conditions with the same note.

## 6. Measures

All taps, scrolls and visibility are measured by the frame runtime (`apps/study/src/frame`) and the shell
(`src/shell/TaskRunner.tsx`); definitions match `src/contracts.ts`. Which outcome is primary is open
(`docs/STUDY-DECISIONS.md` §1).

**Task performance (each website)**

| Measure | Definition |
|---|---|
| Correct answer | The chosen answer is correct. The multiple-choice answer checks the information found; it is not the only evidence of performance. |
| How it ended (`outcome`) | correct; correct but the answer never on screen; wrong after the answer was on screen; wrong without it; gave up after it was on screen; gave up without it; skipped; technical. "On screen" means the answer's sentence was in view at some point (original page by selector; simplified page by its words, `answerTextSimplified` where the AI laid it out differently). It is not proof the person read it. |
| Active time | Visible, unpaused time from Open the website to Answer; answer-sheet time not counted. Missing if hidden ≥ 5 min; flagged if hidden ≥ 60 s. Analysed as ln(s). |
| Time to reach the answer | Active time until the answer was first on screen (`answerSeenMs`). |
| Interaction difficulties | Taps; misses (a tap on nothing interactive) and near misses (within 24 px); taps on links (navigation is off, the same in both conditions); a second tap within 500 ms on something that already responded; bursts of 3+ quick taps in one place (`rageEpisodes` in the data); taps the engine ignored (adapted only); sections opened; scroll travel and direction changes; pinch zoom (zoomed at least 1.10 times relative to the page at rest, the most zoomed, time zoomed). |

These describe what happened on these pages. **Slow work, repeated taps or misses are never labelled as a
cognitive, visual or motor impairment**, in the data, the analysis or any report.

**Perceived usability**

| Measure | Definition |
|---|---|
| SUS | Ten Brooke (1996) statements after each round, original order, meaning and tone, one per screen, answered 1–7 (Finstad 2010), with two published wording changes (instrument 1.1.0): "these websites" for "this system" and "awkward" for "cumbersome". Odd items r − 1, even items 7 − r; sum × 100/60 → 0–100. No score unless all ten are answered; never imputed. Flagged if all ten identical or two or more opposite pairs both ≥ 6. A 1–7 SUS cannot be compared with published 1–5 norms. |
| SEQ | After every website: 1 = Very easy … 7 = Very hard (Caden's decision, 27 Oct 2026), stored with `seqScale: "easy-1"`; the export turns it back (8 − answer) so higher = easier. |

**Participant feedback**

| Measure | Definition |
|---|---|
| Round comment | "What was it like to use these 3 websites? (optional)" after each round's statements, so comments can be told apart by condition (`comments`). Replaces the single end-of-study "anything that was hard" question of 1.0.0. |
| Last questions | Preferred round; "Did the 2 rounds feel different?" and, after yes, what was different (asked after both SUS, as a check that the difference was noticed); what else affected them; how real the copies felt (1–7, or "I have not used the real websites before"); "Should we use your answers?" |

**Delivery (manipulation check), each adapted page:** each change with its status and source (person's settings, AI
page decision, safety check), body text size before and after, text factor, simplified page open, how its parts were
laid out, replay misses, settle time. "Delivered" = at least one change stuck and something measurable changed.

**Not measured:** comprehension (`docs/STUDY-DECISIONS.md` §4). **Not recorded:** names, typed text on websites,
screenshots, pointer paths, other tabs or apps, location.

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
  - Correct answer: `glmer(correct ~ condition + period + family + (1|pid), binomial)`; outcome levels reported as
    counts by condition.
  - Time: `lmer(log(active_s) ~ condition + period + set + family + (1 + condition | pid))`. Whether this uses
    correct answers only or all ended tasks is open (`docs/STUDY-DECISIONS.md` §7).
  - SEQ: `clmm`. Misses per tap and pinch zoom: binomial GLMMs.
  - Random effects start maximal and are simplified if they do not converge.
- **Exploratory:** does the difference vary with the kind of trouble people reported, their age group, or the size
  their warm-up set? Comments are coded by two people for what helped and what got in the way, by condition.
- **Exclusions (decided now):** participant: answered "No" to "Should we use your answers?"; no touch input; changed
  phone between rounds. Task: technical failure (reported, and also counted as a failure in a sensitivity analysis).
  Never excluded for being slow, for a low SUS, for disliking WebAble, or for settings that changed nothing.
- `apps/study/scripts/export.mjs` writes `participants.csv` (with `troubles` and the round comments by condition),
  `trials.csv` (with `outcome`, `ops_from_warmup`, `ops_from_ai`, `ops_no_source`), `responses.json` and a
  descriptive `summary.md`.

## 8. What we may say afterwards

- Counts and intervals for this sample and these pages: "Of 32 people aged 50 or over who said websites often give
  them trouble, 24 rated the round with WebAble higher; the average difference was X points (95% CI …)."
- Say "the AI-assisted adaptation we tested", and say the pages were saved copies of real websites.
- Do not say it beats fixed accessibility settings, which change helped, that it improves understanding, or anything
  about learning, offers or rewrites. Never say "people with" anything, and never describe a participant's
  performance as an impairment. Simulation numbers stay labelled as simulations.

## 9. Ethics and data

- **Approval:** UF exempt protocol ET00056117 covers "adults with fine-motor disabilities". This study now recruits
  adults aged 50 or over who report trouble with websites, with no fine-motor criterion, and asks two screening
  questions before the agreement. File an amendment or a new exempt request before any invitation, and update
  `VITE_STUDY_APPROVAL` (shown on the agreement page) to the reference that covers it. Hold invitations until then.
- Minimal risk; a candidate for exempt category 3 (45 CFR 46.104(d)(3)), which UF decides. Participants are told up
  front that the pages are copies (no deception) and, from 2.0.0, how WebAble's changes are decided.
- Screening answers are not sent anywhere before the agreement; for someone who cannot take part they are cleared
  and never sent.
- Storage: table `gatorhack_study_rows` in the existing WebAble Supabase project, insert-only for the public key
  (`apps/study/supabase/migrations`). Rows are coded; the researcher reads with the service key. "Leave and delete my
  answers" calls `gatorhack_study_withdraw`. Collection stays off (preview, nothing sent) until the contact, team,
  approval reference, retention and withdrawal date are set (`apps/study/.env.example`).
- Hosting: noindex, no referrer, a self-only content policy (no outside requests), robots disallowed, links only by
  invitation.
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
Barr et al. 2013 (random effects). Touch and motor literature: `docs/STUDY-MEASURES.md`.
