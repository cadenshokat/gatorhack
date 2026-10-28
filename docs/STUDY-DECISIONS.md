# Open research decisions for the phone study (protocol 2.0.0)

*28 Oct 2026, for Caden and Dr. Rani. The protocol is `docs/STUDY.md`. These are choices the 28 Oct revision leaves
open on purpose. Each has the options, a suggestion with its reason, and what would change in the study. Nothing
here is built unless it says so.*

**Research question:** Among older adults who report recurring web-use difficulties, how does AI-assisted interface
adaptation affect task performance and perceived usability compared with original webpages?

## 1. The primary outcome

The question names two things: task performance and perceived usability. The study measures both. What is open is
which one carries the confirmatory test.

| Option | For | Against |
|---|---|---|
| **A. SUS alone** (perceived usability, paired difference); performance as key secondary | One validated score per person per condition; the most power for the participants we can get; 1.0.0 already planned it. | Leaves "task performance" without a confirmatory test. A 1–7 SUS can't be compared with published norms. |
| **B. Two primaries, SUS and destinations reached**, Holm-adjusted | Matches the two halves of the question. | Success is coarse: 3 websites per condition gives each person 0–3. If the pilot finds nearly everyone succeeds, this outcome can't move. Splitting α needs more people. Wrong links tapped per task is a finer performance measure to consider. |
| **C. A performance primary** (correct answers, or time) | Behaviour, not opinion. | Same coarseness; time on bigger, longer pages can go either way (one adapted-page study found a scroll-heavy task 23.8 s slower when adapted, `docs/STUDY-MEASURES.md`). |

**Suggestion:** decide after the pilot. If pilot success is well below 100% in both conditions, B. If nearly everyone
succeeds, A, with outcome levels, time and interaction difficulties as preregistered secondaries.
**Changes:** `docs/STUDY.md` §7 and the export summary's headings.

## 2. Sample size

The touch-error numbers in `docs/STUDY-MEASURES.md` (15–25 people) came from studies of people with motor
impairments, measuring touch errors. They don't carry over to this population or these outcomes.

- **If SUS is primary (A):** an exact paired t at α .05, two-sided, has 80% power for dz = 0.51 at n = 32 and
  dz = 0.60 at n = 24. With an SD of SUS differences of 14–18, that is about 7–9 SUS points. Whether 7–9 points is the
  smallest difference worth finding is a choice to make.
- **If correct answers are primary (B or C):** power depends on the pilot's success rates and how much people
  differ. It needs a simulation from pilot data. For comparison, telling a 30-point difference in completion rate
  apart needed 38–47 people (Lewis & Sauro 2023, in `docs/STUDY-MEASURES.md`).
- Keep N a multiple of 4 so the four sequences stay balanced.

**Suggestion:** set N after the pilot's SDs and success rates, with 32 as the working figure. Write the smallest
difference worth finding into the preregistration before collection.

## 3. Who can take part: the threshold and the wording

**As built:** 50 or over, and ticks at least one of "I find it hard to get around a website", "…to find the
information I need", "…to understand what a website says" under the question "Which of these often happen to you
when you use websites?". "None of these" stops them.

Open:
- **"Often" or "sometimes"?** "Often" matches "recurring" but may be strict for recruitment.
- **Should trouble reading the text, or tapping the right thing, count on its own?** It doesn't now. Those are asked
  after the agreement as descriptions ("How often do you zoom in to read?", "How often do you tap the wrong thing?").
  Someone with shaky hands who says only "I tap the wrong thing" would be turned away today.
- **A time frame** ("In the last month, …") would make "often" more concrete.
- **A validated measure of phone skill for describing the sample.** The 16-item Mobile Device Proficiency
  Questionnaire (Roque & Boot 2018) was built for older adults. It is not a screener and adds a few minutes. Check its
  wording and terms of use before adopting it.
- **Back after being turned away.** Built so a mis-tap isn't final. With no payment there is little reason to change
  an answer to get in. If payment is added, reconsider.

**Suggestion:** keep "often" and the three kinds of trouble for the amendment. Decide the reading and tapping question
with Dr. Rani, since it decides whether people whose main trouble is physical are in the study.

## 4. Comprehension

From protocol 2.1.0 the tasks ask people to reach a useful destination (a reporter's page, a park's alerts page, a
list of opponents). That shows they could find their way and recognise the right link. It does not show they
understood the page's content. Nothing claims understanding, and the simplified page does not rewrite sentences (on
the Mars story the AI lays one sentence out as a short fact, which no task now depends on).

| Option | What it means |
|---|---|
| **A. Don't measure understanding** (as built) | Report finding only. The "understanding" part of the eligibility question still describes who took part. |
| **B. Make some tasks need interpreting or applying** | Examples: "You get to Convoy Point at 5:45 p.m. Can you still go in?" (it closes at 5:30); "You reach the Everglades entrance at 5:00 p.m. Will staff be there?" (they finish at 4:30); "By how many points did Florida beat Kentucky in 1990?" (47–15, so 32). Each needs a new matched partner and a new pilot. |
| **C. Separate questions about what the article said** | A reading test. It moves away from using websites on a phone. |

**Suggestion:** A for this study. If understanding matters to the claim, B on the park and sports pages, where an
"apply it" question is natural, not on the news stories.

## 5. Calibration from short original-page activities

**What the warm-up feeds today:** the size activity and the true/false sentences set text size; the faint words set
contrast; light or dark sets colours; the dots set tap-target size and the double-tap guard. The onboarding's Finding
step (real websites) would set motion and clutter. The sandbox skips it, so those two take their defaults.

**What a short original-page activity could add:** it shows *whether* someone has trouble on a real page (they zoom,
miss links, scroll back and forth). It is poor at measuring *how much* bigger text or targets need to be, because
the page's own design gets in the way. So it could stand in for the skipped Finding step, but not for the reading
or dots activities.

**Rules if it is added:** its own content (never a scored page); before round 1 for everyone; settings fixed after it;
condition order still counterbalanced.

**Suggestion:** no change before the pilot. The practice page is already an original page with separate content and
is fully logged, so the pilot can show what it would add at no cost. Then decide whether it should feed motion and
clutter, or replace the light-or-dark activity (about 1 minute).

## 6. The practice page shows only the original version

Everyone practises on the original Gainesville forecast. People who get the adapted round first meet the simplified
page for the first time in a scored task. People who get the original round first don't have that disadvantage.

| Option | Cost |
|---|---|
| Keep as is | Some novelty cost in the adapted round for half the people; the period term in the model only partly covers it. |
| Practise in round 1's condition | The other half meets the unfamiliar version unpractised in round 2. |
| Practise both versions, in round 1's order | About 1–2 more minutes. The forecast page has no recorded AI answers yet, so they would need recording (`scripts/record.mjs nws-gainesville`). |

**Suggestion:** practise both versions if the pilot timing allows.

## 7. Time: only correct answers, or all tasks?

1.0.0 analysed log time on correct answers only. With older adults and harder pages, many tasks may end in a wrong
answer or giving up. Leaving those out favours whichever condition people give up on sooner.

Options:
- (a) correct answers only, as before;
- (b) all ended tasks, with the outcome in the model;
- (c) time to a correct answer as a time-to-event outcome, with wrong answers and giving up counted as "not reached by
  this time".

**Suggestion:** preregister (c) as the main time analysis and (a) as a sensitivity check.

## 8. Same information in both versions, with each person's own settings

`scripts/e2e.mjs` does every task through the real tap on every website, in whatever version is showing. It has run
with demo settings, not with real people's settings. With them:
- **News:** the reporter's byline is in the simplified page as on the original.
- **Gators:** "Back To History" moves from the top of the original (under the cookie notice until it is closed) to
  near the end of the simplified page.
- **Park pages:** keep their own layout, so every way to the alerts page is there in both versions.

Real settings could change whether a simplified page opens. **Suggestion:** during the pilot, rerun the check with
each pilot's saved settings, and accept the route differences above as part of the adaptation. Routes may differ; the
goal and the information may not.

## 9. Approval

The exempt determination ET00056117 covers adults with fine-motor disabilities. What changed for the amendment:
- the population (50 or over, self-reported trouble with websites, no disability criterion);
- two screening questions before the agreement, whose answers are kept only for people who take part;
- the agreement text: who it is for, "What WebAble changes", and "not a test of your health, eyesight, hands or
  memory";
- the end-of-round comment.

No invitations until it is approved. `VITE_STUDY_APPROVAL` must then show the new reference.

## 10. Optional: an effort question after each round

The earlier motor research suggested asking "How much physical effort did using these websites take?" (1–7) after
each round. For this broader question, a matching "How much mental effort …?" would cover finding and understanding.
Two more screens per round. Neither item is validated alone, so they suit group comparisons only.
**Suggestion:** leave out unless Dr. Rani wants a workload measure; SUS, SEQ and the comment already ask about
experience.

## 11. Choice and short-action tasks (not built)

The measures research recommended three task types per condition: reach a destination, choose an option that meets
simple requirements, and complete a short action (Patsoule & Koutsabasis 2014; Mirski et al.; Rapson et al. 2026).
2.1.0 builds only the first, because the other two are not supported equally in both versions of these copies:
- the copies are frozen and have no working listings or forms to choose from or fill in;
- WebAble's simplified page drops the Gators results table's per-row link menus, so "open the recap of a home win"
  would work on the original only;
- the one natural choice on a park page (Everglades: open the wet-season or dry-season page for a July trip) has no
  matching choice on the Biscayne page.

**What it would take:** a working study page per family (for example a park activity list with times and prices and
an "Add to my visit plan" button, or a short event sign-up that stops at a review screen), copied the same way, with a
check that WebAble keeps every option and control usable. The task engine already scores any number of destinations,
so a choice task needs only its pages and a list of which options meet the requirement.
**Suggestion:** decide whether the thesis needs these before the pilot; they add pages to build and match, and a new
pilot.
