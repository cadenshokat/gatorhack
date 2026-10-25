---
name: webable
description: Everything needed to keep building WebAble for Gator Hack V. Covers the pitch and voice, the product decisions, the architecture and key files, how we use Jev and OpenAI, the engine rules learned the hard way, the research behind the onboarding, the design and writing standards, the claims we can make, the demo pages, dev commands, how the agents are coordinated, and where things stand. Load this before any WebAble work.
---

# WebAble: working context, practices and standards

*Written by Lucius (Caden's lead Claude session) on Sunday 25 Oct 2026 at about 03:45 ET, with `main` at `998c4c0`.
Where this file and the code disagree, the code wins. Where this file and Caden disagree, Caden wins.*

## 0. Where things stand right now

- **Repo:** `/Users/cadenshokat/Documents/Projects/webable-gatorhack`, pushed to https://github.com/cadenshokat/gatorhack
  (`main`).
- **Deadline:** Devpost submission Sunday 25 Oct at **5:00 PM ET**; finals Monday. Working plan: features land by about
  **2:00 PM**, then record the video and polish the Devpost.
- **Built and on `main`:**
  - A Jev page model:
    - 125 fine roles and 32 page purposes;
    - a main-region pick and an importance score;
    - "is it live?" and "is it paid content dressed as a story?" questions.
  - On-device extraction: stats, scoreboard, tables, schedule, recipe and logos.
  - The **simplified page is the default on busy reading pages**, with an "Original page" switch remembered per site.
    It renders through purpose templates (scoreboard + stats for sports records, recipe, article…).
  - In-place adjustments everywhere else, verified and rolled back when they break something:
    - text by page zoom with the hierarchy kept;
    - a centred column;
    - faint text made darker;
    - larger hit areas;
    - steady clicks;
    - motion paused;
    - pop-ups moved out of the way.
  - Markers on the simplified page: a Live dot, an "Ad" tag on paid content dressed as a story, and "N min read".
  - **One round button + a six-item sheet** in the page:
    - Simplified | Original;
    - text size as "Aa" words;
    - "What WebAble did here" with Undo;
    - "Pause on this site";
    - "How WebAble read this page" (the Jev view);
    - "Your settings".
  - A four-item toolbar popup.
  - **New onboarding (round 8c):**
    - Reading: a comfortable size, true/false sentences, faint words, light or dark.
    - Pointing: a ring of dots.
    - Finding: **on three real websites** (Wikipedia → CNN → Allrecipes) in a task tab where WebAble is off, then two
      questions.
    - It ends on a **struggle-first results page** with the person's own evidence, a "What gets in your way" radar,
      "See it on real websites" links and word-level "Adjust anything".
  - Passive learning while browsing: log-odds beliefs per need, a 14-day half-life, and attribution questions to Jev.
  - The Jev view (Lens v3), the Explain card (gpt-5.4-mini plus Jev's coverage check), and Jev's image check of the
    page (experimental input).
- **Open items** (newest first):
  1. CNN shows its own "Legal Terms and Privacy" pop-up over the Health link in the real-site task. That's realistic,
     and it counts toward "pop-ups got in your way". Caden's Chrome has probably already accepted it.
  2. The sheet's "Hid N ads" line needs an optional `EngineState.calm.adsHidden` from the simplified page. The fork
     session offered to add it; whoever wires it says so first.
  3. `scripts/eval/lib/fitting.mjs` still drives the old onboarding. It needs moving to `window.__fitting`
     (`phase()`, `raw()`, `finish(name)`, `evidence()`).
  4. WCJB and Drugs.com stay in place: they're busy, but Jev's meaning check fails on them. That's the safe failure.
  5. The Live dot is proven only by unit tests; no live page we tried had a "Live" label in the simplified view.
  6. Devpost Q5, "who pays", is Caden's call. Wren's story docs are updated for round 8 but not for 8c (real-site
     finding, struggle-first results).
  7. The pilot with real people (Sid's protocol in `docs/CLAIMS.md`) hasn't been run.
  8. Not yet adopted: an LLM-written "page brief" for understanding pages (see §6.5).

## 1. The hackathon

- **Event:** Gator Hack V at UF AI Days, 23–26 Oct 2026. The team is **Caden Shokat** (the user) and **Sid Pandey**.
- **All code must be written during the event.** The repo is new. Never copy from the semester repo
  (`/Users/cadenshokat/Documents/Projects/webable`); it is a different project.
- **Challenge: "Fresh off the frontier."** Use a technology first made public within the past 12 months, make it
  central, and show three things: what it does, what was hard, and why it's recent.
- **Our frontier tech is Jev,** TypeSafe AI's "System One" calibrated decision model.
  - Public since **15 Sept 2026**.
  - v1.14 added experimental image input on **14 Oct 2026**.
  - Jev must stay visibly central: the Jev view, Jev's probabilities, the 125-role vocabulary, and real-time decisions
    at a fraction of a cent.
- **Judges care about:**
  - a real problem, well positioned;
  - a working product, not slides;
  - polish;
  - the new tech doing something it's uniquely good at.

## 2. Positioning and voice (Caden's own words win)

- **The opening Caden wrote:**

  > This is a pharmacy refill page. For most of you it takes ten seconds. For someone with a hand tremor, that
  > 'Confirm' button is a target they'll miss three or four times. Most of the web doesn't meet basic accessibility
  > standards, and even sites that do are built for an average user who doesn't exist.

- **One-liner:** "WebAble fits every website to the person using it, without asking what's wrong with you."
- **Core idea:** accessibility standards are fixed, but people vary in range, in combination and in circumstance.
- **Principle:** **"learns the need, never the cause."** We never name or infer a condition in the UI; we measure needs
  and talk about problems the person has with the web.
- **Never** use the hearing-aid analogy ("incredibly corny").
- **Voice:** plain, spoken, specific, like Caden's own pitches to his bosses and suppliers. He has called anything else
  "slop" and "obviously not human written":
  - no startup jargon;
  - no "seamless", "leverage", "empower" or "revolutionize";
  - no stacked adjectives;
  - short sentences;
  - real numbers.

## 3. Product decisions (round 8, from Caden's testing)

1. **No modes. There is just WebAble.** The simplified page is what you get on busy pages; it isn't a named feature.
   - Never let a user see "Calm view", "Lens", "fit" as a noun, "tailor", "ledger", "verify", "rollback", "decision",
     "confidence" or "probability". Probabilities appear only inside the Jev view, and there the word is
     "Jev's probability".
2. **The simplified page is the default on busy reading pages, decided once.**
   - The rule lives in `engine/busy.ts`. All of these must hold:
     - Jev's reading-kind purpose probability is high;
     - the page is busy: 7+ distraction elements at p ≥ 0.7, or 25% of the page with 4+. When busy pages bother this
       person, the bar drops to 5+, or 12% with 3+;
     - the main content is clear;
     - the meaning check passes;
     - the person hasn't clicked, typed or scrolled past one screen;
     - the site isn't pinned to "Original page".
   - It is never used on sign-in, checkout, account or statement pages, or on pages with password or payment fields.
     Task forms keep their stepper rule.
   - The switch is one fade, with no back-and-forth.
3. **One small button, one small sheet. Fewer options, defaults over features.** If an ordinary person wouldn't know
   what a control means, it goes.
4. **We add things to a page rarely,** and only something the page already says, said more clearly. That covers the
   Live dot (it pulses only if motion is fine for this person), the Ad tag (p ≥ 0.9) and min-read. Never invent
   information.
5. **The onboarding's Finding part runs on real websites, never fake ones.** Fake pages aren't believable, and real
   sites give us more data.
6. **Nothing learned is shown during the onboarding,** only at the end.
7. **No pixels or technical terms anywhere a person sees.**
   - Text size: Standard / Larger / Large / Extra large / Largest, each with an "Aa" at the real size.
   - Button size: Standard / Larger / Largest.
8. **Every WebAble page background is pure white.** That covers the onboarding, results, popup, sheet and simplified
   page.
9. **Describe needs as the person's problems, strongly, with their own evidence; then the fix.** For example:
   "**Busy pages slow you down.** Finding something on CNN took you three times as long as on Wikipedia. ✓ WebAble
   fixes this: busy pages become a clean, simple page."
10. **An instruction card before every task**: what to do, what success looks like, a tiny looping example, and
    "Skip this one" / Start.

## 4. Architecture

### 4.1 Repo layout
- **Stack:** a pnpm 10 workspace on Node 24, TypeScript 5.9.3, Vitest 5 and zod 4. The extension is Chrome MV3 on
  **WXT 0.21.4 + Preact 10.29**.
- **`packages/core/src`** is shared logic with no DOM:
  - `types.ts`: **all shared contracts**;
  - `policy.ts`: Jev thresholds, coarse roles from fine roles, `isLive`, `isPaidAsStory`;
  - `jev/`:
    - `api.ts`;
    - `page.ts`: per-element questions, purpose, main region, importance;
    - `meaning.ts`, `judge.ts`, `overlay.ts`, `attribution.ts`, `explain-check.ts`;
    - `visual.ts`: image input;
  - `fit/`:
    - `derive.ts`: `deriveFit(FittingRaw) → FitProfile`, the research-based maths;
    - `passive.ts`: beliefs while browsing;
    - `stats.ts`;
  - `layout/`: the simplified-page planner (outline, heuristic, purpose templates, pictures, spec, variants);
  - `color/`, `text/` (the monotone text map), `verify/`, `redact.ts`, `signals.ts`.
- **`apps/server/src`:** Hono on **127.0.0.1:41741**. Always spell it 127.0.0.1, never localhost.
  - It holds the API keys, because Jev's CORS blocks extensions.
  - Routes:
    - `/v1/understand`, `/v1/struggle`, `/v1/redesign`, `/v1/explain`;
    - `/v1/overlay-close`, `/v1/attribute`, `/v1/meaning`, `/v1/verify-visual`;
    - `/v1/stats`, `/health`.
  - It also serves `/demo/alderra/refill.html`.
- **`apps/extension/`:**
  - `entrypoints/`:
    - `background.ts`: routes `BgRequest`, an exhaustive switch over the union in core `types.ts`;
    - `content.ts`: boots the engine and mounts the UI. It first asks whether this tab is a site-task tab;
    - `fitting/`: the onboarding;
    - `popup/`.
  - `src/contracts.ts`: `EngineState`/`EngineApi` between the engine and the UI.
  - `src/engine/`:
    - `controller.ts`: one owner of every presentation change;
    - `reader.ts` and `extract/`: digest and on-device data;
    - `tailor.ts`: in-place ops;
    - `verify-dom.ts`: overlap via Range rects, clipping, overflow, rollback;
    - `busy.ts`, `overlays.ts`, `passive.ts`, `signals.ts`, `explain.ts`, `nav.ts`, `store.ts`.
  - `src/ui/`:
    - `calm/`: the simplified page, purpose templates and markers; `calm/components` holds StatGrid, Scoreboard,
      DataTable, ScheduleList, Recipe and LogoMark;
    - `panel/`: Button, Sheet, model, actions;
    - `lens/`: the Jev view;
    - `offers/`: the overlay note and cookie bar;
    - `explain/`;
    - `tokens.ts`.
  - `src/sitetask/`: the real-website onboarding tasks (types, background, task, card, signals, match).
- **`scripts/eval/`:** the harness (Playwright, or branded Chrome over CDP).
- **`scripts/claims/`:** the claim pipelines: 50 sites, Jev vs GPT, privacy scan, pilot logger, label kit,
  simulations.
- **`docs/`:**
  - `CLAIMS.md`: what we can say;
  - `design/ONBOARDING.md`: the current onboarding and UI spec; **its "Round 8c" section wins**;
  - `design/SIMPLIFIED.md`: the simplified-page fixes from Caden's CNN review;
  - `demo/`: `pages.md`, `frontier.md`, `devpost.md`;
  - `onboarding/research.md`: Wren's citations;
  - `agents/`: the briefs.

### 4.2 Data flow on a page
1. `reader` builds a `PageDigest`:
   - structure;
   - allow-listed interface words only;
   - personal details replaced;
   - **no page text or numbers**;
   - `regions` for the main-region pick.
2. Background `understand` → server → **Jev**. Jev returns an `ElementJudgment` per element (fine role, `fineP`,
   importance, live, paid-as-story) and a `PageUnderstanding` (purpose, mainRegion).
3. **Policy:** code thresholds turn probabilities into actions. Fold at ≥ 0.90 for ads and teasers, and only when the
   element's task probability is ≤ 0.20. Promote at ≥ 0.90 for main_pick and ≥ 0.70 for main.
4. The **controller** plans zoom and column once per page, then the in-place ops.
5. `verify-dom` checks each op and rolls back anything that breaks.
6. The busy rule decides whether to open the simplified page.
7. The **simplified page** renders from the outline, plus `OutlineNode.data`, which is extracted on the device and
   never sent anywhere, through purpose templates. A structural meaning check (Jev Nouls over role lists) can veto it.
8. Signals feed passive learning (CUSUM gate in code, then a Jev attribution question) and struggle detection.

### 4.3 Privacy rule (hard)
- Models get **structure and allow-listed labels only**.
- Extracted text and numbers (`OutlineNode.data`) stay on the device; the background strips `data` before any
  server call.
- Form input values are never read.
- Personal beliefs stay in `chrome.storage.local`.
- The privacy scan in `scripts/claims/privacy-scan.mjs` is clean.
- Public line: "What it learns about you stays on your laptop."

## 5. OpenAI usage
- **gpt-6-sol** writes layout candidates as data-only FitSpecs, which Jev judges.
- **gpt-6.1-sol** is available.
- **gpt-5.4-mini** writes Explain text, which is checked by numbers, condition words and Jev's coverage.
- Always use structured outputs. A daily budget guard reads `OPENAI_BUDGET_USD` (15).
- **Measured:** gpt-6-sol layouts, fed today's filtered outline, folded away help links in 26 of 40 outputs and missed
  parts of the page in 27 of 40. The model isn't the problem; it's starved of information.

## 6. Jev: how we use it

### 6.1 API facts
- `POST https://api.typesafe.ai/v1/systemone`.
- **Question types:**
  - `choice`, up to 255 options;
  - `score`, 2–10 levels;
  - `noul`, a yes/no probability;
  - `box`, image input; experimental, sent with the "Danger Zone" header.
- Questions in one call run **in parallel and independently**; there is no reasoning across them.
- Price: about **$0.042 per million input tokens**.
- Weaknesses:
  - mid-tier accuracy;
  - prone to prompt injection;
  - CORS blocks extensions.

### 6.2 Practices that work (measured)
- **Design B:** each element's evidence goes inside its own question. Putting it in shared context caused position bias.
- **Contrastive criteria:** "X, not Y: …", always with an escape option.
- **Act only on high probability.** Jev's probabilities were low exactly where it was unsure, so gating works.
- **Ask both option orders** for pick-one questions; mainRegion is accepted only if both orders agree at ≥ 0.8.
- **Code does all maths and counting;** Jev never does.
- **Jev can only make verification stricter.** It never rescues a failed hard check.
- **Split calls** to keep cost flat. The 125-role guide sits once in the state of separate fine-only calls.
- Fine probabilities ≤ 0.02 count as zero when summed into families.

### 6.3 Where Jev is strong and weak (our data)

| Question | Result |
|---|---|
| Page purpose | 5/5 on the demo pages (0.88–1.00) |
| Fine role, 60 roles (held-out BBC, ESPN, Coursera, Newegg; 201 labels) | **87%**, family 91.5% |
| Fine role, 125 roles (same held-out set) | **86%**, family **92%**; names a new-role element about half the time |
| Main region, "what is this page for" | confident on only 2/5; weak at relational and holistic judgment |
| Judging narrow yes/no about a concrete change | strong (12/12 rubric checks); weak at picking a whole layout from a list |
| Overlay close button | 7/7 |
| Speed and cost | 0.2–0.5 s and about $0.005 per page read |
| vs gpt-6-sol on the same questions | 287 ms vs 12.2 s, 18× cheaper, 77% decision agreement, 9/10 same main action |

**Honest claim:** "It recognises 125 kinds of page element, and its accuracy held at 86–92% on pages it was never tuned
on." Never claim that more roles made it more accurate; on held-out pages they didn't.

### 6.4 What Jev does in WebAble (the frontier story)
1. Reads the page in under half a second: 100–180 decisions per read.
2. Picks the page's purpose and main region.
3. Judges each element, at 125 roles plus importance, live and paid-as-story.
4. Gates every change by probability.
5. Reads the person's struggle from behaviour bands relative to their own baseline.
6. Attributes passive evidence to a need.
7. Picks a pop-up's own close button.
8. Judges AI layout candidates.
9. Checks Explain coverage.
10. Checks the changed page visually through image input.

### 6.5 The open architecture question
Caden worried that using Jev for fixed classification is weaker than an LLM's open-ended understanding. My
data-backed view:
- **The bottleneck is information starvation, not model choice.**
- **The best split:**
  - code captures a source-linked page model;
  - an LLM writes a cached page brief (activities, main information, groupings);
  - Jev makes the real-time bounded decisions and judges each proposed change;
  - code does the preservation checks and renders;
  - one controller commits.
- **A privacy line** for it: placeholders for values, and sensitive pages kept structure-only.

Caden chose instead to keep Jev central and expand its vocabulary. Raise the page-brief idea only with data.

## 7. Engine rules learned the hard way
- **Text grows by page zoom first,** snapped to Chrome presets, then a monotone compressive map. Never per-element
  floors: they broke hierarchy and read fine print as body text. Headings never get smaller than body text.
- **Plan zoom and column once per page, with at most 2 zoom changes.** Never re-tailor the same page on its own. The
  zoom flicker in round 4 was "glitching so hard".
- **The column** is a narrower centred window, and the page background stays the page's own colour.
- **Verify or roll back.** That means checking overlap via Range rects, clipping, overflow, reachability and content
  loss, and keeping a ledger entry for each reversal.
- **Never swap the page after the person interacts.** Decide once, with one fade.
- **One controller owns every presentation change.**
- **Test in real branded Chrome at DPR 2, 1440×900.** That's what Caden sees; headless Chrome for Testing lies about
  fonts and zoom.

## 8. The onboarding: research basis and current flow

### 8.1 Our own research
`research-fitting.md` in the overnight scratchpad is our own research, and `deriveFit` implements it.
- **Order: Reading → Pointing → Finding.** Reading comes first so low vision doesn't masquerade as imprecise pointing.
- **R1, comfortable size:** − / + on the paragraph itself. It seeds R2. Self-chosen size agrees with critical print
  size on average, but its limits of agreement are ±0.35 log.
- **R2, MNREAD-style true/false ladder:** steps of 0.1 log, up to 9 sentences, 35 s, or 2 misses in a row. It finds
  the critical print size (CPS); comfortable body size = CPS × 1.26. "Sit how you usually do, with your usual glasses."
- **R3, faint words:** 1 easy trial plus 6 adaptive (QUEST+-style) 4-choice trials. Contrast is banded, never a score:
  floors at 4.5:1, 7:1 and max.
- **R4, light or dark:** 2 + 2 sentences, then a question. Dark wins only on a measured gain of at least 0.13 log, or
  when the measurement agrees with the stated choice.
- **P1, ring of 9 dots** (ISO 9241-9 style):
  - 8 scored taps per block, up to 3 blocks, a ladder from 44 px;
  - a mouse ladder of 24/32/44/56/72/96 and touch from 44;
  - deliberately biased toward over-sizing.
- **Steady clicks come from every press in the flow.** It's offered when the Jeffreys posterior gives P(slip rate
  ≥ 5%) ≥ 0.70.
- **Finding.** Behaviour from a few trials is weak: reliability is about 0.24, and it only detects slowdowns of 52% or
  more. **Preference carries most of the weight:** workload explains 54% of preference.
- **Gamification restraint:** points raised enjoyment, but elaborate theming raised No-Go errors by 28% (Lumsden et
  al.). Stimuli never animate in, because motion would contaminate timing.
- **Privacy:** per-trial data stays in RAM. Never compute tremor spectra or store kinematic biomarkers.

### 8.2 Current flow (round 8c)
1. **Welcome.** The input type is inferred from the first presses, never asked.
2. **An instruction card** before each task.
3. **The tasks:** R1, R2, R3, R4, then P1 (skipped for keyboard users).
4. **"Now, some real websites".** `runSiteTasks(SITE_TASKS)` opens a task tab:
   - Wikipedia "Gainesville, Florida", the quiet one: "the link to the University of Florida";
   - CNN home: **"Health"**. Sports isn't in CNN's top bar at 1440 px;
   - Allrecipes cookies: "Jump to Recipe".

   On each site:
   - the content script runs **task mode**: no engine, a bottom card, link clicks never navigate;
   - it measures the time to find, wrong clicks, near misses (within 24 px), slips, scroll, `motionSeen` and
     `adsSeen`;
   - there's a 20 s load timeout;
   - closing the tab early finishes with what it has.
5. **Two questions:** which site was easier, and what got in your way (chips).
6. **Save the results.** `deriveFit` → `saveFit`. `buildEvidence(raw, sites)` → `saveEvidence` builds the
   `RunEvidence` (reading slowdown, faint, pointing small misses and slips, busySlowdown, chips).
7. **Results** (`fitting/results/`) shows the struggle cards, the radar, "See it on real websites" and Adjust.
   `fitting.html#settings` opens Results with `measured = false`.

The test hook is `window.__fitting`: `phase()`, `raw()`, `finish('rosa'|'typical'|'reader')` and `evidence()`.

## 9. Design standards

**Bar:** Apple's first-run screens, Hearing Test or Health. Restraint over decoration. The people using it may have low
vision, a tremor or trouble with busy screens, so **the UI itself must be accessible**:
- one thing at a time;
- big quiet type;
- 64 px controls;
- no drag;
- no time limits;
- full keyboard;
- a visible focus ring.

**Tokens** (`apps/extension/entrypoints/fitting/ui/tokens.css`; in-page `src/ui/tokens.ts` mirrors them):
- **Colour:**
  - canvas **#FFFFFF**; cards white with a 1 px `#E6E3DC` line and a soft two-layer shadow;
  - ink `#16150F`, ink-2 `#5E5C55`;
  - one accent, deep green `#17694A`, used only for what WebAble changes, the chart, and "WebAble is on". Primary
    buttons are ink, not accent.
- **Type:** the system UI font.
  - h1 44/50 weight 600, tracking −0.02em;
  - h2 30/36;
  - deck 20/30;
  - body 18/28;
  - **nothing under 15**.
- **Controls:**
  - primary pill 64 px tall, ink, with a white 18/600 label;
  - secondary pill white with a hairline border;
  - answer buttons 72 px, radius 20;
  - gaps of at least 16;
  - focus ring 3 px accent with a 3 px offset.
- **Shapes:** card radius 28, modal 32.
- **Motion:** 200 ms `cubic-bezier(.2,.8,.2,1)` for chrome; nothing moves under reduced motion; stimuli never animate.
- **In-page UI** sits in a **closed shadow root with constructed stylesheets**:
  - never CSS `url()`, because some sites' rules block it;
  - images and icons are inline SVG or CSS gradients;
  - no emoji.
- **Sample content** uses fictional brands only: Alderra Pharmacy, The Daily Ledger, Harbor Bank, Northbridge Online,
  Home Table. Never imitate a real brand.

## 10. Writing standards
- Plain spoken English everywhere: UI, docs, Slack, Devpost. Short sentences and real numbers.
- **UI copy:**
  - say what changed and why in the person's terms;
  - describe pages and problems, never people;
  - no condition names;
  - never "test", "score", "results", "normal", "calibration", "profile", "acuity" or "impairment" in the onboarding.
- **Status messages:** if a page couldn't be read: "Couldn't read this page right now. Text size and buttons still
  work."
- **Claims:** only from `docs/CLAIMS.md` → "Say now". Round numbers for speech. Say the lower, newer number.

## 11. Claims we can say (details and caveats in `docs/CLAIMS.md`)
1. **Fitted 32 of 50 popular sites.** Text larger, nothing left broken; AI and the simplified page were off; 28 of 50
   on the strict count.
2. **Checks its own work.** It undid 22 of its own changes on 15 sites after a check failed.
3. **A Jev read takes a median 430 ms and costs $0.0034.**
4. **Jev vs GPT-6 Sol on the same questions:** about 40× faster, 18× cheaper, 77% decision agreement, 9/10 the same main
   action.
5. **Privacy:** what it learns stays on the laptop; the privacy scan is clean.
6. **Simulations:** it notices missed clicks without asking, and a bad day doesn't stick. These are simulations;
   label them as such.
7. **The role vocabulary:** 125 kinds of element, with accuracy holding at 86–92% on pages it was never tuned on.

**From the research, not ours** (cite them):
- SUPPLE++ (Gajos, Wobbrock & Weld, CHI 2008): people with motor impairments were 26.4% faster and made 73% fewer
  errors with interfaces built from a one-time pointing test.
- Gajos, Reinecke & Herrmann (CHI 2012): pointing measured during ordinary use matched lab measures.

**Never say:**
- anything about curing, diagnosing or detecting conditions;
- "works on every site";
- claims about people that haven't been measured with people.

## 12. Demo
- **The five demo pages** (specs in `docs/demo/pages.md`):
  1. `http://127.0.0.1:41741/demo/alderra/refill.html?reset=1`: the fictional pharmacy; its stepper opens.
  2. `https://floridagators.com/sports/football/opponent-history/university-of-kentucky/32`. The simplified page
     leads with the last matchup (Florida 7 at Kentucky 38, both logos, line score), then Wins 54, Losses 22,
     Home 30-6, Away 22-13.
  3. `https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/`: ingredients and steps.
  4. A CNN article. Caden's favourite simplified page; the story comes first.
  5. `https://www.irs.gov/refunds`: stays in place, made easier to read.
- **Demo fits** are `DEMO_FITS` in core: `rosa` (large text, tremor-ish, busy pages hurt), `typical` and `reader`.
- **Devpost and video:**
  - `docs/demo/devpost.md` and `frontier.md`;
  - an about 2-minute storyboard with about 260 words of narration and an 18-second onboarding shot;
  - update both for round 8c before recording.
- **Load the extension:** `apps/extension/.output/chrome-mv3` as an unpacked extension. The server must be running.

## 13. Dev practices
- **Commands** (from the repo root):
  - `pnpm install`
  - `pnpm -r typecheck`
  - `pnpm -r test`
  - `pnpm --filter @webable/extension build`
  - `pnpm dev:server`
- **Server:** 127.0.0.1:41741.
  - **Never restart the shared server** unless you own the change. Test server changes with `PORT=41742`.
  - Kill only the processes you started.
- **Eval:**
  - `pnpm eval --browser chrome --dpr 2 --size 1440x900 --only <ids>`;
  - real Chrome is loaded via CDP `Extensions.loadUnpacked` with `--enable-unsafe-extension-debugging`;
  - the full 50-site command is in `docs/CLAIMS.md`.
- **Secrets:** `.env` holds `TYPESAFE_API_KEY`, `OPENAI_API_KEY` and `OPENAI_BUDGET_USD=15`. It's gitignored. **Never
  print it.** Copy it into a worktree with `cp`, never `cat`.
- **Dependencies:** no new dependencies without a reason.
- **Contracts:** `core/types.ts` and `contracts.ts` change only through the lead. Others add optional fields in their own
  files and say so.
- **Parallel work:**
  - disjoint file ownership per agent;
  - a manual `git worktree` for anything that needs its own server or a long probe;
  - builders don't commit, and one integrator commits.
- **Commits:**
  - a clear, plain message ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
  - `git pull --rebase origin main` before you push;
  - watch shell quoting: an apostrophe inside a `sed` replacement once shipped a broken string. Use ’.
- **Verification:**
  - a few targeted screenshots at DPR 2, read by you;
  - no review or eval agent fleets;
  - Caden: "do not spend a lot of tokens/time on verification".
- **Usage limits** are real. Rounds 3, 4 and 7 died at a limit, so:
  - offload research and writing to Wren and Alfred;
  - use cheaper models for mechanical subagents;
  - keep the lead's context lean.

## 14. Agents and coordination
- **Slack #claude-grok** (`C0CBCD56S21`). Messages posted through the Slack connector go out as Caden ("Sent using
  Claude").
- **The agents:**
  - **Lucius:** Caden's lead Claude session, the orchestrator.
  - **Alfred** (`U0C9QEWMCQZ`): Grok running Cursor cloud agents.
    - It only acts on requests from **Caden's account**; relay other agents' outputs to it yourself.
    - It built the Calm components (PR #1) and Lens v3 (PR #2), both good.
    - Its onboarding (PR #3) was judged "the worst output possible" and has been replaced.
  - **Wren** (Sid's Claude): posts via Sid's account and needs Sid's OK. Good at research and writing:
    `docs/onboarding/research.md`, the copy docs and the demo docs.
  - **Coda** (Sid's Codex, `U0CC1A2HD8U`): runs when Sid starts it. It was stood down in round 8b.
- **Caden's rule after round 8b:** design work is done by Lucius from our own research and thinking, not by the other
  agents. Use them for research, writing and well-specified, isolated builds only.
- **Listener:** `node ~/.claude/slack-bridge/poll.mjs --once` as a background command. It exits on the first news;
  re-run it after each wake. Append the ts of each of your own posts to `~/.claude/slack-bridge/sent.txt`. Never print
  the bot token.
- **The fork session** "Gator Hack V pitch strategy (fork)" (`local_f03d1292-35bf-42a5-b54b-1bc18b9cdf84`) also works
  on this repo. Coordinate file ownership with it by message before writing to shared paths.

## 15. Caden's feedback log (the things that changed direction)
- **Wording:** jargon-heavy plans are "slop". Use his plain style. No hearing aids.
- **AI positioning:** "choosing from a predefined set of choices" is not enough. The response was the deep Jev use,
  AI layouts and Jev judging.
- **Real Chrome:** text broke and fine print was read as body text. The response was zoom-first text, kept hierarchy and
  the column.
- **Round 4:** "much worse" and "glitching so hard" (zoom flicker). The response was the round 6 rules: plan once, at
  most 2 zooms.
- **Round 7:** zoom-only is commodity, and Calm view lost the page's meaning (Gators). The response was Jev page model
  v2, extraction and purpose templates.
- **Round 8, praised:** "the calm view for CNN did a really good job; make it the default". Also: "more roles means
  more accurate". That didn't hold on held-out pages, and we said so.
- **Round 8, criticised:** too many options and buttons, separately named features, engineering words, and an onboarding
  that's meticulous and unappealing with a results page that has no benefit or status.
- **Round 8b:** Alfred's onboarding was "the worst output possible". Lucius took it back.
- **Round 8b → 8c** ("60% of the way there, and that is generous"):
  - real websites for the finding part;
  - nothing learned shown during the flow;
  - no pixels or technical language;
  - white backgrounds;
  - needs as problems and struggles, shown strongly.

## 16. Memory
Caden's persistent memory for this project:
`/Users/cadenshokat/.claude/projects/-Users-cadenshokat-Documents-Projects-webable/memory/`, with `MEMORY.md` as the
index. Relevant entries:
- `webable-gatorhack-build.md`
- `gator-hack-v-2026.md`
- `webable-pitch-positioning.md`
- `feedback-plain-spoken-pitch-wording.md`
- `feedback-text-scaling-hierarchy.md`
- `slack-agent-bridge.md`
- `feedback-onboarding-standards.md`
- `feedback-high-value-agents.md`
