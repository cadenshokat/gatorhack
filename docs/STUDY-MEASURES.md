<!-- Research for the phone study's measures (28 Oct 2026): what to measure instead of, or alongside, the
     multiple-choice "find the fact" answer, for people with fine-motor disabilities. Two research passes, then every
     number below re-checked against its source by a third pass (63 claims: 47 confirmed, 15 corrected, 1 left as
     abstract-only). Corrected numbers are the ones used here. Sources in section 9. -->

# Measuring touch and physical effort in the phone study

> **Status (28 Oct 2026, protocol 2.0.0): partly superseded.** The study now asks about older adults (50+) who report
> recurring trouble with websites, not people with fine-motor disabilities, and touch is one part of what it
> measures. Three things below no longer apply:
> - **Named-control tasks (§1.1, §2, §5): not adopted.** The tasks stay realistic find-the-information tasks, because
>   naming the control removes the navigating and finding the question is about.
> - **Touch errors and physical effort as primary outcomes (§1, §4): not adopted.** The primary outcome is an open
>   decision (`docs/STUDY-DECISIONS.md` §1).
> - **15–25 people (§1.7, §6): does not apply.** It came from motor-impairment studies of touch errors
>   (`docs/STUDY-DECISIONS.md` §2).
>
> Still useful: the literature table, the touch measures as secondary "interaction difficulties" (`docs/STUDY.md`
> §6), and the cautions in §7. Read "people with motor impairments" below as the populations those studies used, not
> ours.

The study's approval covers adults with fine-motor disabilities. Right now each website task ends in a multiple-choice
answer, which tells us whether the person found and read a fact. That is mostly a reading and searching measure. This
document sets out what studies of people with motor impairments measured instead, what they found, and what that means
for our study.

## 1. The short answer

1. **Make the tap the task.** Every comparable study told people which control to use, so the intended target was
   known and every miss could be counted. Our tasks should end when the person opens, taps or expands a named thing on
   the page, not when they pick an answer.
2. **Count touch errors first.** A miss (touch lands on nothing) or a wrong activation (touch opens the wrong thing).
   This was the measure that moved most when targets got bigger: 42.1% → 7.0% errors for motor-impaired iPad users
   from 6 mm to 18 mm targets; misses down 84% from 10 mm to 30 mm buttons; 3.96% → 0.93% with ability-based
   interfaces.
3. **Count taps to success.** How many touches it took to hit the target. Older adults' accuracy, scored this way, fell
   sharply below 14 mm.
4. **Ask about physical effort once per round.** In the closest study to ours (adapted vs original web pages, 8 people
   with motor impairments), physical demand was the only workload score that differed, in favour of the adapted
   pages. "How tiring" ratings also fell for motor-impaired users with adapted interfaces, and not for others.
5. **Treat time as secondary.** Time moved less, and sometimes went the wrong way: bigger targets make pages longer,
   and one scroll-heavy task was 23.8 s faster on the original pages.
6. **Keep the rest, with smaller roles.** Keep the ease rating, the preference question and the zoom and scroll
   counts. Our frame already logs taps, misses, near misses, repeats and pinch zoom.
7. **Plan for 15 to 25 people.** Touch-error effects in past studies were large enough to show with 15 to 25 people.
   Completion rates were not: telling a 30-point difference in completion apart needs 38 to 47.

Nobody has published this exact study: real web pages, on participants' own phones, with people with motor
impairments, done remotely. The nearest are an adapted-vs-original web study on tablets in person (Valencia 2017) and
an unmoderated within-subjects test of browser reader view against the original page, run with people without motor
impairments (Li 2019).

## 2. Why a multiple-choice answer misses the point here

- **Hornbæk's review of 180 usability studies** files multiple-choice tests under "understanding", meaning the quality
  of what people took away. He does not file them under how well they could operate the interface. Across those
  studies:
  - completion time was measured in 57%;
  - error rates in 26%;
  - pass/fail completion in 13%;
  - understanding in 10%;
  - spatial accuracy (such as "mm from correct icon") in 4%.
- **A shaky hand barely touches a fact-finding task.** Most of the effort is scrolling and reading. The things
  WebAble changes for motor problems are bigger and better-spaced targets and fewer things in the way. Those only show
  up when the person has to hit something.
- **The motor studies all made the target known.** That is what lets you score a miss, a wrong activation and the
  number of attempts:
  - SUPPLE highlighted the next control "to study physical efficiency" apart from visual search.
  - Touch Guard used named actions in real apps.
  - Valencia used named menu items and "select a small link surrounded by others".
  - Chen used PIN entry.
  - Montague used a Sudoku game whose logic gave each tap's intended cell.

This changes one rule in the writing guide. "Instructions give the goal, never the route" still holds. But the goal
now names the control by its own words on the page. For example: "Open the section called Operating Hours &
Seasons." Do not say where it is or how to get there.

## 3. What comparable studies measured and found

| Study | Who | Task | What they measured | Main result |
|---|---|---|---|---|
| Valencia et al. 2017, *Interacting with Computers* | 8 adults with upper-body motor impairments (5 cerebral palsy), 41–60, tablet, at their organisation, home or lab | Real websites: named menu items, a small link among others, search tasks; adapted (12 mm targets, 20 px gaps, 24 pt text, higher contrast, open menu, no distractors) vs original | Task time, tasks finished, NASA-TLX subscales, preference | Physical Demand lower on adapted pages (W = 0, Z = −2.40, p < .05, effect size 0.85); no other TLX subscale differed. Small link among others: adapted 24.8 s faster (p = .055). Scroll-heavy task: original 23.8 s faster. More search tasks finished on the original (14 vs 7). 6 of 8 preferred adapted. |
| Gajos, Wobbrock & Weld 2008 (SUPPLE), CHI | 11 motor-impaired (19–56) + 6 not, desktop | Set values in real dialog boxes; next control highlighted | Time, error rate (share of operations with any click not needed to set the control), 1–7 ratings | Ability-based interfaces 28% faster for motor-impaired users; errors 3.96% → 0.93%; "tiring" 4.09 → 2.61 for motor-impaired users only |
| Zhong et al. 2015 (Touch Guard), W4A | 8 aged 51+ (4 Parkinson's, 2 MS, 2 essential tremor), Android phone | Real app tasks plus target trials | Error rate (share of trials with any wrong-target activation), acquisition time, SUS | 20.2% errors with plain tapping vs 7.0% with a list mode, but 1.7 s vs 3.7 s. Errors came from small nested and clustered targets. |
| Chen, Savage, Chourasia, Wiegmann & Sesto 2013, *Applied Ergonomics* | 38 with motor-control disabilities + 15 without; 15" kiosk touchscreen | PIN entry, buttons 10–30 mm | Miss ("landed outside of the intended button area and did not result in button activation"), error ("activated the wrong button"), time | Disabled group: 3.9× the misses, 2.9× the errors. Misses −84% and errors −59% from 10 to 30 mm; still improving at 30 mm. People preferred buttons smaller than their best ones. |
| Findlater et al. 2017, CHI | 16 with upper-body motor impairments + 16 without, iPad | Tap, drag, cross, steer; 6/12/18 mm | Error rate, time, extra touches, off-target "outliers" | Motor-impaired touch errors 42.1% (6 mm) → 7.0% (18 mm), across all four tasks; recommend at least 18 mm. Extra touches in 5.7% of tapping and 21.3% of dragging trials. Off-target trials kept as real errors (4.5% vs 0.5%). |
| Nunes et al. 2016, *Universal Access in the Information Society* | 39 people with Parkinson's, mean age 64, Android phone on a table | Tap targets 7–21 mm, spacing 0–10.5 mm | Accuracy = taps on target ÷ (targets + misses); touches to reach target | 97.8% at 14 mm, 94.0% at 10.5 mm, 79.8% at 7 mm. Spacing had no effect. Recommend 14 mm. |
| Kobayashi et al. 2011, INTERACT | 20 older adults (60s–70s), iPod touch or iPad | Tap, drag, pinch trials plus real use | Error = "tapped the screen outside of the target at least once during the trial"; time; offset | Small screen: 39% errors at about 4.7 mm vs 6.5% at about 7.8 mm. One person needed 32 touches for one target. Recommend at least 8 mm. |
| Leitão & Silva 2012, PLoP | 40 adults aged 65–95, phone | Tap and swipe, 7–21 mm | Accuracy = 1 ÷ tries | Accuracy significantly lower under 14 mm; best between 14 and 17.5 mm. Spacing had no effect. |
| Mott & Wobbrock 2019 (Cluster Touch), CHI | 12 motor-impaired (19–64) + 12 not, phone | 6 mm targets | Hit = touch inside the target's bounds | Native hit rate 74.5% vs 85.5% with their technique |
| Montague, Nicolau & Hanson 2014, ASSETS | 9 recruited through Parkinson's UK groups, 21–75, own use at home for 4 weeks | Sudoku; intended cell inferred from game logic | 23,474 gestures: recognised or not, wrong target, duration, offset | 39.9% of touches the phone did not recognise were intended taps on the right target; 14.1% of recognised taps hit the wrong target; offsets and durations changed between sessions |
| Guerreiro et al. 2010, ASSETS | 15 with tetraplegia, PDA | Tap 7/12/17 mm, centre, edge, corner | Miss, distance to centre, time | No gain from 12 to 17 mm; errors stayed near 20%; more errors near the top of the screen |
| Li et al. 2019, CHI | 391 online volunteers, unmoderated, own computers | Matched real pages, reader view vs original, within subjects | Reading speed, comprehension, ratings | Reader view 5% faster; comprehension the same. Phone trials were dropped. |

Two other results bear on single design choices:
- **Sticky headers.** Removing a sticky header made a laptop navigation task *slower*: 50.0 s without it vs 46.9 s
  with it, with errors equal (24 adults without disabilities; Murano & Kongshaug 2024). I found no study that measured
  what removing overlays or banners does to touch errors.
- **Practice.** People with MS doing touch tests on their own phones kept improving with repetition. Pinching improved
  86% over baseline across weeks (Woelfle 2021).

## 4. The measures, ranked

"Logged now" means our frame already records it (`FrameMetrics` in `apps/study/src/contracts.ts`).

| # | Measure | Definition | From our logs | Evidence | Logged now |
|---|---|---|---|---|---|
| **P1** | Touch errors | Per task: did any error happen (yes/no), and how many. Error = miss (a tap that activates nothing) + wrong activation (a tap that activates something other than the named target). Also per tap: errors ÷ taps. | Taps from `pointerdown`; misses already counted; wrong activation = an activation whose element is not the target | Chen, Findlater 2017, Kobayashi, Touch Guard, SUPPLE, Nunes | Misses, near misses, activations: yes. Which element was intended: **no** |
| **P2** | Taps to success | Taps from task start until the target activates. Accuracy = 1 ÷ taps (Leitão). | Count taps until the goal event | Leitão, Nunes, Kobayashi | Taps: yes. Goal event: **no** |
| **P3** | Physical effort | After each round: "How much physical effort did using these websites take?" 1 = very little, 7 = a great deal. Adapted from NASA-TLX Physical Demand (Valencia) and SUPPLE's "tiring" item. Use our 1–7 tap scale, not a 0–100 slider: a slider is itself a fine-motor test. | New question | Valencia, SUPPLE | **No** |
| S1 | Time to success | Visible time from opening the website to the goal event. Log-transform; report the geometric mean (Sauro, under 25 people). Keep failed and slow tasks; do not use error-free trials only. | Active time already kept | Sauro, Hornbæk, Chen (its error-free-only timing dropped 9 of the 38 disabled people) | Yes, ends at Answer today |
| S2 | Outcome levels | First tap right / right after errors / gave up ("I cannot do this") / timed out. Report counts; do not average the labels. | Goal event + attempts + give-up button | Hornbæk, NN/g, Sauro | Partly (skip only) |
| S3 | Unintended actions | Per task: activations of something else that opened or changed the page (link, menu, ad, cookie bar), long presses (≥ 400 ms), drags on a tap target, two-finger touches. | Activations, link attempts and repeats logged; long press and two-finger **no** | Montague, Kobayashi, Findlater 2017, Touch Guard | Partly |
| S4 | Zoom | Pinch and double-tap zoom: episodes, highest scale, time zoomed. Exploratory. | `visualViewport` | No validated precedent; Valencia found only 1 of 8 could zoom without significant problems | Pinch: yes |
| S5 | Scroll cost | Screens scrolled and direction changes. The cost side of bigger targets. | Already logged | Valencia (scroll-heavy task slower when adapted) | Yes |
| S6 | Ease and preference | SEQ per task and the round preference, as now | Already asked | Sauro & Dumas; Valencia; Chen | Yes |
| E1 | Touch offset | Distance from the touch to the target's nearest edge in mm (0 inside). mm per CSS px = 25.4 × devicePixelRatio ÷ screen ppi (iPhone 15: 0.166). Exploratory. | Tap log has coordinates; ppi needs the phone model | Mott & Wobbrock, Kobayashi | Partly |
| C1 | Baseline tapping | The warm-up's dots activity, used as each person's own baseline (a covariate), not an outcome | Already measured | Gajos 2020 (browser tapping tracks motor severity), Cluster Touch (per-person model) | Yes |
| C2 | Manipulation check | Each target's size in mm and distance to its nearest neighbour, in both versions | New | Chen, Nunes, Findlater (effects depend on actual size) | **No** |

SUS: today it is the primary outcome. The motor studies did not use it as a primary measure; Touch Guard used a
modified SUS as a secondary one. Our 1–7 version cannot be compared with published SUS norms. Recommendation: make P1
and P3 primary and keep SUS secondary.

Do not combine measures into one score. Hornbæk warns that a single combined number hides which part changed.

## 5. Designing tasks that test touch

1. **One named control per step, success on the goal event.** "Open the section called Operating Hours & Seasons", then
   "Tap Show Standard Hours." Success is the section opening. A miss is any tap before that which activates nothing.
2. **The target must exist in both versions.** On news and sports, the adapted condition opens the simplified page.
   That page drops the site's own menus. Either pick controls the simplified page keeps, such as a link in the
   article, or define the goal by the result (the section shown), not by one element. Tag each target in the frozen
   copy and check that WebAble keeps the tag.
3. **Include small, crowded targets.** Effects concentrated there:
   - Touch Guard's nested and clustered layouts;
   - Valencia's "small link surrounded by others";
   - Nunes's accuracy was already about 97% at 14 mm, so targets that size leave nothing for WebAble to improve.

   Our pages have plenty of small targets (scan at 393 px wide, iPhone 15):

   | Page | Interactive elements | Under 24 px (about 4 mm) | Under 44 px (about 7.3 mm) | Examples |
   |---|---|---|---|---|
   | AP News | 106 | 67–68 | 91 | Menu button 24 × 16 px |
   | Florida Gators | 70 | 40 | 53 | Menu toggle 48 × 66; "More Football links" 43 × 64 |
   | NPS Everglades | 77 | 35 | 55 | Section headers 371 × 52; "Show Standard Hours" 165 × 24 |
   | NPS Biscayne | 64 | 32 | 44 | Section headers 371 × 52 |

   Still to check: which menus and sections actually open in the frozen copies (their scripts may not run).
4. **Do not make "close the pop-up" a task.** WebAble removes the pop-up, so that task would not exist in the adapted
   condition. Leave the pop-up in the original as an obstacle inside other tasks, and count what it costs.
5. **Links stay off, but a tap on the named link counts as success.** The frame already knows where a link would go.
6. **Give a way out.** An "I cannot do this" button, and a time cap of 2 to 3 minutes per task (one web study used 3).
7. **Record what changes touch accuracy apart from WebAble:**
   - how the phone is held (already asked);
   - where the target sits on screen: tetraplegic users made more errors near the top of the screen;
   - the phone model, for mm;
   - for Parkinson's, optionally, time since last medication (mPower and Nunes both tracked medication state).

## 6. Analysis and sample size

- **Models.** Each with condition and round order as fixed effects, and a random intercept for participant and for
  task:
  - binomial mixed model for "any error" per task;
  - Poisson or negative-binomial for error counts, with log(taps) as the offset;
  - linear mixed model on log time;
  - ordinal model for the 1–7 ratings.

  Comparable studies used mixed models (SUPPLE, Touch Guard, Cluster Touch) or Wilcoxon and Friedman tests with
  8–16 people. Error counts pile up at zero; SUPPLE modelled them as counts rather than with ANOVA.
- **Robustness checks.**
  - Wilcoxon signed-rank on each person's adapted-minus-original difference.
  - McNemar exact test for "any error".
- **Keep off-target taps.** For people with motor impairments they are real errors, not outliers (Findlater 2017).
  For time only, flag extreme values within each person (3 × IQR on log time, as Komarov 2013 did). Never drop a
  person for being slow.
- **Sample size.**
  - Comparable studies: 8 to 16 people with motor impairments per group. Median group size across CHI and ASSETS
    accessibility papers: 13 (Mack 2021).
  - For a paired comparison at α .05 and 80% power (standard formula):
    | Standardised effect (d_z) | People needed |
    |---|---|
    | 0.8 | about 15 |
    | 1.0 | about 10 |
    | 0.5 | about 34 |
  - Past touch-error effects were large.
  - A 30-point difference in completion rate needs 38 to 47 people (Lewis & Sauro 2023). Completion should not be
    primary.
- **Pre-register.** Name P1 and P3 as primary before the main collection, as section 7 of STUDY.md already plans for
  SUS.

## 7. Cautions

- **Remote data is noisier.**
  - Touch error rates doubled online compared with the lab: 3.0% vs 6.4% (Findlater, crowd vs lab, 2017).
  - Passive logging of everyday use classed only about 25% of movements as deliberate, and only 4% for the oldest
    participant (Gajos 2012).
  - This is why the tasks should be defined, with a named target, rather than relying on free browsing.
- **Practice effects are big.**
  - Keep the practice website.
  - Keep counterbalancing condition order and which page set comes first (already done).
  - Add task position as a covariate.
- **People vary from day to day.** Offsets and tap durations changed between sessions (Montague; Hurst). Keep both
  conditions in one session, as now.
- **Preference is not performance.** Chen's participants preferred buttons smaller than the ones they did best with.
  Valencia's participants preferred the adapted pages even where they were slower. Report both, and do not let one
  stand for the other.
- **Bigger is not always better.** Enlarged pages are longer and need more scrolling. Report scroll cost next to the
  error gains.
- **Clearing away obstructions has not been studied for touch.** The one controlled sticky-header study found the
  header helped on a laptop. Measure this; do not assume it.
- **The physical-effort item is not validated on its own.** The TLX subscales are correlated and "likely measuring
  one dimension". In older adults the full TLX had good test–retest reliability (ICC .71–.81), but a single person's
  change of under 16 to 24 points (on 0–100) is within noise. Use it for group comparisons only.
- **WCAG sizes are a floor, not a target for this group.** WCAG asks for 24 or 44 CSS px, and no research data is tied
  to those numbers. On an iPhone 15, 44 px is about 7.3 mm. The studies above point to 14 to 18 mm for older and
  motor-impaired users.

## 8. What would change in the study

1. Rewrite the 7 tasks (6 plus practice) as named-control tasks. Each task gets a target tag, a goal event, and a
   version that works on the simplified page.
2. Frame: record the goal event, then derive wrong activation, taps to success, long presses, two-finger touches, and
   the target's size and position in mm.
3. Shell:
   - "I cannot do this" in place of the multiple-choice sheet;
   - a 2–3 minute cap;
   - the physical-effort question after each round;
   - ask the phone model (for mm).
4. Protocol (STUDY.md sections 6–7): primary outcomes become touch errors and physical effort; SUS becomes secondary.
5. Pilot with 3 to 5 people to check that the targets open in the frozen copies and that the tasks are not at
   ceiling.

## 9. Sources

Access: **full** = full text read and numbers checked; **abstract** = only the abstract was available.

1. Valencia X, Pérez JE, Arrue M, Abascal J, Duarte C, Moreno L (2017). Adapting the web for people with upper body motor impairments using touch screen tablets. *Interacting with Computers* 29(6):794–812. doi:10.1093/iwc/iwx013. Open copy: https://e-archivo.uc3m.es/bitstreams/66f34511-3141-495e-8eb0-9b60f573d7f9/download (full)
2. Gajos KZ, Wobbrock JO, Weld DS (2008). Improving the performance of motor-impaired users with automatically-generated, ability-based interfaces. CHI 2008. doi:10.1145/1357054.1357250. https://www.eecs.harvard.edu/~kgajos/papers/2008/kgajos-chi08-supple.pdf (full)
3. Zhong Y, Weber A, Burkhardt C, Weaver P, Bigham JP (2015). Enhancing Android accessibility for users with hand tremor by reducing fine pointing and steady tapping. W4A 2015. doi:10.1145/2745555.2747277. https://research.google.com/pubs/archive/43446.pdf (full)
4. Chen KB, Savage AB, Chourasia AO, Wiegmann DA, Sesto ME (2013). Touch screen performance by individuals with and without motor control disabilities. *Applied Ergonomics* 44(2):297–302. doi:10.1016/j.apergo.2012.08.004. https://pmc.ncbi.nlm.nih.gov/articles/PMC3572909 (full)
5. Findlater L, Moffatt K, Froehlich JE, Malu M, Zhang J (2017). Comparing touchscreen and mouse input performance by people with and without upper body motor impairments. CHI 2017. doi:10.1145/3025453.3025603. https://makeabilitylab.cs.washington.edu/media/publications/Findlater_ComparingTouchscreenAndMouseInputPerformanceByPeopleWithAndWithoutUpperBodyMotorImpairments_CHI2017.pdf (full)
6. Findlater L, Zhang J, Froehlich JE, Moffatt K (2017). Differences in crowdsourced vs. lab-based mobile and desktop input performance data. CHI 2017. doi:10.1145/3025453.3025820 (full)
7. Findlater L, Froehlich JE, Fattal K, Wobbrock JO, Dastyar T (2013). Age-related differences in performance with touchscreens compared to traditional mouse input. CHI 2013. doi:10.1145/2470654.2470703. https://faculty.washington.edu/wobbrock/pubs/chi-13.04.pdf (full)
8. Nunes F, Silva PA, Cevada J, Correia Barros A, Teixeira L (2016). User interface design guidelines for smartphone applications for people with Parkinson's disease. *Universal Access in the Information Society* 15(4):659–679. doi:10.1007/s10209-015-0440-1. https://mural.maynoothuniversity.ie/6621/1/PAS_user%20interface%202015.pdf (full)
9. Kobayashi M, Hiyama A, Miura T, Asakawa C, Hirose M, Ifukube T (2011). Elderly user evaluation of mobile touchscreen interactions. INTERACT 2011. doi:10.1007/978-3-642-23774-4_9. https://dl.ifip.org/db/conf/interact/interact2011-1/KobayashiHMAHI11.pdf (full)
10. Leitão R, Silva PA (2012). Target and spacing sizes for smartphone user interfaces for older adults. PLoP 2012. https://mural.maynoothuniversity.ie/6045/1/PS-Target-Spacing.pdf (full)
11. Mott ME, Wobbrock JO (2019). Cluster Touch: improving touch accuracy on smartphones for people with motor and situational impairments. CHI 2019. doi:10.1145/3290605.3300257. https://faculty.washington.edu/wobbrock/pubs/chi-19.02.pdf (full)
12. Mott ME, Vatavu R-D, Kane SK, Wobbrock JO (2016). Smart Touch: improving touch accuracy for people with motor impairments with template matching. CHI 2016. doi:10.1145/2858036.2858390. https://faculty.washington.edu/wobbrock/pubs/chi-16.01.pdf (full)
13. Montague K, Nicolau H, Hanson VL (2014). Motor-impaired touchscreen interactions in the wild. ASSETS 2014. doi:10.1145/2661334.2661362. http://web.tecnico.ulisboa.pt/hugo.nicolau/publications/2014/Montague-ASSETS-2014.pdf (full)
14. Guerreiro T, Nicolau H, Jorge J, Gonçalves D (2010). Towards accessible touch interfaces. ASSETS 2010. doi:10.1145/1878803.1878809. https://www.di.fc.ul.pt/~tjvg/amc/accessibletouch/files/26p-guerreiro2.pdf (full)
15. Nicolau H, Guerreiro T, Jorge J, Gonçalves D (2014). Mobile touchscreen user interfaces: bridging the gap between motor-impaired and able-bodied users. *Universal Access in the Information Society*. http://web.tecnico.ulisboa.pt/hugo.nicolau/publications/2014/Nicolau-UAIS2-2014.pdf (full; a PDA, not a phone)
16. Moffatt K, McGrenere J (2010). Steadied-bubbles: combining techniques to address pen-based pointing errors for younger and older adults. CHI 2010. https://www.cs.ubc.ca/labs/edapt/papers/moffatt2010.pdf (full; pen)
17. Gajos KZ, Reinecke K, Herrmann C (2012). Accurate measurements of pointing performance from in situ observations. CHI 2012. doi:10.1145/2207676.2208733. https://iis.seas.harvard.edu/papers/gajos12-accurateMeasurements.pdf (full)
18. Gajos KZ, Reinecke K, Donovan M, et al. (2020). Computer mouse use captures ataxia and parkinsonism, enabling accurate measurement and detection. *Movement Disorders* 35(2):354–358. doi:10.1002/mds.27915. https://pmc.ncbi.nlm.nih.gov/articles/PMC7028247/ (full)
19. Li Q, Morris MR, Fourney A, Larson K, Reinecke K (2019). The impact of web browser reader views on reading speed and user experience. CHI 2019. doi:10.1145/3290605.3300754. https://wildlab.cs.washington.edu/Publications_files/Li_CHI2019.pdf (full)
20. Komarov S, Reinecke K, Gajos KZ (2013). Crowdsourcing performance evaluations of user interfaces. CHI 2013. doi:10.1145/2470654.2470684. https://iis.seas.harvard.edu/papers/komarov13crowdsourcing.pdf (full)
21. Arrue M, Valencia X, Pérez JE, Moreno L, Abascal J (2019). Inclusive web empirical studies in remote and in-situ settings: a user evaluation of the RemoTest platform. *IJHCI* 35(7):568–583. doi:10.1080/10447318.2018.1473941 (full)
22. Murano P, Kongshaug P (2024). The usability of persistent and non-persistent headers on web pages. ICEIS 2024. doi:10.5220/0012554900003690. https://scitepress.org/Papers/2024/125549/125549.pdf (full)
23. Woelfle T, et al. (2021). Practice effects of mobile tests of cognition, dexterity, and mobility on patients with multiple sclerosis. *JMIR* 23(11):e30394. doi:10.2196/30394 (abstract)
24. Bot BM, et al. (2016). The mPower study, Parkinson disease mobile data collected using ResearchKit. *Scientific Data* 3:160011. doi:10.1038/sdata.2016.11. https://pmc.ncbi.nlm.nih.gov/articles/PMC4776701/ (full)
25. Hanson VL, Snow-Weaver A, Trewin S (2006). Software personalization to meet the needs of older adults. *Gerontechnology* 5(3):160–169. doi:10.4017/gt.2006.05.03.005.00 (full; usage only, no performance data)
26. Hornbæk K (2006). Current practice in measuring usability. *IJHCS* 64:79–102. doi:10.1016/j.ijhcs.2005.06.002. https://www.kasperhornbaek.dk/papers/IJHCS2006_MeasuringUsability.pdf (full)
27. Sauro J (2010). Average task times in usability tests: what to report? MeasuringU. https://measuringu.com/average-times/ (full)
28. Sauro J (2010). What to do with task times when users fail a task. MeasuringU. https://measuringu.com/?p=25 (full)
29. Lewis JR, Sauro J (2023). Sample sizes for comparing dependent proportions. MeasuringU. https://measuringu.com/sample-sizes-for-the-mcnemar-test/ (full)
30. Mack K, McDonnell E, Jain D, Wang LL, Froehlich JE, Findlater L (2021). What do we mean by "accessibility research"? CHI 2021. doi:10.1145/3411764.3445412. https://arxiv.org/pdf/2101.04271 (full)
31. Sauro J (2019). 10 things to know about the NASA TLX. MeasuringU. https://measuringu.com/nasa-tlx/ (full)
32. Devos H, et al. (2020). Psychometric properties of NASA-TLX and Index of Cognitive Activity as measures of cognitive workload in older adults. *Brain Sciences* 10(12):994. https://pmc.ncbi.nlm.nih.gov/articles/PMC7766152 (full)
33. Sauro J, Dumas JS (2009). Comparison of three one-question, post-task usability questionnaires. CHI 2009. https://measuringu.com/wp-content/uploads/2017/07/Sauro_Dumas_CHI2009.pdf (full)
34. Nielsen J (2013). Usability for senior citizens: improved, but still lacking. NN/g. https://www.nngroup.com/articles/usability-seniors-improvements/ (full)
35. W3C. Understanding SC 2.5.8 Target Size (Minimum) and SC 2.5.5 Target Size (Enhanced), WCAG 2.2. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html ; https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html (full)
36. Hart TA, Chaparro BS, Halcomb CG (2008). Evaluating websites for older adults: adherence to "senior-friendly" guidelines and end-user performance. *Behaviour & Information Technology* 27(3):191–199. doi:10.1080/01449290600802031 (abstract)
37. Chadwick-Dias A, McNulty M, Tullis T (2003). Web usability and age: how design changes can improve performance. CUU 2003. doi:10.1145/957205.957212 (abstract)
