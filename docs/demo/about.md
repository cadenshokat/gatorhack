<!--
Devpost "About the project". Paste everything below the line into the field (or use docs/demo/about-paste.md, which is
the same text with nothing to strip). Living document: Wren keeps it in sync with what Sid and Caden ask for.
Matches main at 3079808 (round 9). Numbers come only from docs/CLAIMS.md "Say now" and the code.
-->

---

## Inspiration

In high school, during COVID-19, we started a club to help senior citizens learn to use Zoom and online chat, so they could talk to their families while they couldn't see them in person. Sitting beside them, we saw how much of the web assumes sharp eyes, a steady hand and time to spare. That stayed with us.

Reading the news, checking a tax refund or refilling a prescription gets hard when the text is too small, the buttons are hard to hit, and the page keeps competing for your attention. Finding and changing accessibility settings, site by site, adds even more work.

When we looked at who actually needs help, the answer surprised us. The typical person isn't a screen reader user. They have a few mild, overlapping needs (text a bit larger, buttons a bit bigger, fewer distractions), would never call themselves disabled, and never open a settings menu. One in four US adults reports a disability (CDC, 2022), the most common kind is cognitive, and the rate climbs steeply with age. Most of what those people do online is ordinary and important.

So we wanted a tool the person owns: one that learns what helps them once, without asking about their health, and carries that fit from website to website. Our rule from the start: **learn the need, never the cause.**

## How we built it

**WebAble** is a Chrome extension built with TypeScript, Preact and WXT. A small Node.js and Hono server on the laptop holds the API keys and talks to the models; the extension only talks to that server. Shared logic, including every threshold, lives in one core package with tests.

### 1. Learn what helps the person

Setup takes a few minutes, and every part can be skipped. An instruction card before each task says what to do and what success looks like.

- **Reading.** First the person picks a comfortable size on a real paragraph. Then short true-or-false sentences step down in size, in the style of the MNREAD reading test, until reading slows. That finds the critical print size (CPS), the smallest text before reading slows down, and body text is set just above it:

$$\text{body} = 10^{\,\log_{10}\mathrm{CPS} + 0.06} \approx 1.15 \times \mathrm{CPS}.$$

- **Faint words.** Four-choice trials with words that get fainter, placed adaptively by a Bayesian method (QUEST+), so a few trials are enough. The result is a band, never a score: faint text is darkened to at least 4.5:1 or 7:1 contrast, or as dark as it goes.
- **Light or dark.** The same sentences on light and dark backgrounds. Dark wins only when it measurably helps, or when the measurement agrees with what the person says they prefer.
- **Pointing.** A ring of nine dots, in the style of the ISO 9241-9 pointing test, stepping through sizes to find the smallest button the person hits reliably. Clicks that slip off what the person pressed count everywhere in the flow. "Steady clicks" turns on only when the evidence is strong: with k slips in n presses (at least 8 presses),

$$P(\theta \ge 0.05 \mid k, n) \ge 0.70, \qquad \theta \sim \mathrm{Beta}\!\left(k + \tfrac12,\; n - k + \tfrac12\right).$$

- **Finding, on real websites.** We open three real sites in turn with WebAble switched off: Wikipedia (quiet), CNN's home page (busy) and an Allrecipes recipe (busy). On each, the person finds and clicks one thing. We time it and count wrong clicks and near misses; links don't navigate, so nothing happens by accident. Then two questions: which site was easier, and what got in the way.

The results page leads with the person's problems, in their own numbers, and only then the fix. For example: "**Busy pages slow you down.** Finding something on CNN took you three times as long as on Wikipedia. WebAble fixes this: busy pages become a clean, simple page." Sizes are words with a sample at the real size ("Larger", "Extra large"), never pixels.

After setup, WebAble keeps learning from ordinary browsing. Repeated missed clicks or zooming in on several sites lead to a suggested change, never a silent one.

### 2. Read the page

The extension turns every part of the page into structured evidence: tag, role, landmark, position, size, and where its links go. Names and numbers are taken out first. Data the page shows, like recipe steps, table rows and sports stats, is extracted on the laptop and never sent for these decisions.

### 3. Interpret it with Jev, decide with code

Jev is TypeSafe AI's decision model, public since September 15, 2026; version 1.14 added experimental image input on October 14. It doesn't write text. It answers typed questions with a probability on every answer:
- which of 125 kinds of element each part is (a stat, a team logo, a recipe step, an ad, a teaser for another page...);
- whether it belongs to the page's task, whether it's the main action, and whether it's help;
- what the whole page is for.

A typical page is about 178 decisions, asked in parallel.

Code decides what's allowed. A part is folded away only when Jev is very sure it's clutter and fairly sure it isn't needed:

$$\text{fold}(e) \iff P_{\text{ad}} + P_{\text{teaser}} + P_{\text{pop-up}} \ge 0.90 \;\wedge\; P_{\text{task}} \le 0.20 \;\wedge\; P_{\text{help}} \le 0.10.$$

Anything with even a 5% chance of being content, a field, a button or help is protected. Jev charges only for input, so a typical read of about 81,000 tokens costs

$$81{,}000 \times \frac{0.042\ \text{dollars}}{10^{6}} \approx 0.0034\ \text{dollars per page}.$$

### 4. Change the page

- **On busy reading pages** (news, recipes, sports records, guides), WebAble opens a simplified page built around what the page is for, using the page's own content. A sports record becomes a scoreboard and stat grid with both team logos; a recipe opens on its ingredients and steps. Before it appears, Jev checks it against the original: does it lead with the page's main information, and is anything missing? One switch, "Original page", brings the site's version back and is remembered per site. Sign-in, checkout, account and statement pages are never replaced.
- **Everywhere else, it adjusts the page in place:** larger text with headings kept in order, a centred column, faint text made darker, bigger click areas, steady clicks, moving things paused, and pop-ups that cover the page moved aside.
- **Hard paragraphs, rewritten for this person.** The person asks ChatGPT or Claude one question about how they like things explained and pastes the answer. A writing model turns it into plain points, each backed by a quote from the answer, and Jev drops any point the answer doesn't support. Then, on reading pages:
  1. Jev scores every paragraph for this person: how likely it's harder than it needs to be, and which one change would help most (plainer words, steps, shorter, or the main point first).
  2. A writing model rewrites only the paragraphs Jev picks.
  3. Code checks that numbers, conditions, quotes and links all survived, and Jev checks nothing was dropped or added, with one retry.
  4. The new paragraph swaps in place with a thin green line. Click the line to see the original.

### 5. Check every change

After each change, code checks the page for clipped text, overlapping text and anything scrolling sideways, and puts the change back by itself if a check fails. A small WebAble button on each page lists what changed, each with Undo, plus "Pause on this site". A Jev view shows how Jev read the page, with its probabilities, for anyone curious.

We're a team of two, Caden and Sid. We worked with several AI coding agents that took tasks in one Slack channel and pushed their own branches for review. All code was written during the hackathon.

## Challenges we ran into

**Making text bigger without breaking the page.** Our first version raised small text element by element. On real sites that broke the page's hierarchy: fine print ended up as big as body text, and headings could end up smaller than the text under them. We switched to zooming the whole page first, snapped to Chrome's own zoom steps, then a single map that only ever makes text larger and keeps headings above body text.

**The page that wouldn't sit still.** An early build kept re-fitting the page as it loaded, so the zoom flickered. We made a rule: plan the zoom and column once per page, change zoom at most twice, and never swap the page after the person has scrolled, clicked or typed.

**Keeping a page's meaning.** Recognising a number, a label and a table is only the start; how they relate matters. An early simplified view of floridagators.com's Kentucky history page led with a news teaser and dropped the record and the team logos, which is what that page exists to show. We added page-purpose questions, on-device extraction of stats, scoreboards, tables, schedules and recipes, a template per kind of page, and the meaning check that vetoes a simplified page that loses something.

**Jev reads text, not pages, and the order mattered.** Jev can't see a website, so we had to design the evidence it reads. When every part sat in one shared description, the same part could get a different answer depending on what came before it. Putting each part's evidence inside its own question fixed that, and let us split a page across parallel calls.

**A page can try to steer the model.** A site can label a "subscribe" button "Close". Jev judges mainly from structure rather than the site's own labels. For pick-one questions we ask with the options in both orders and act only if both agree. WebAble only ever presses two kinds of button by itself: a chat window's own minimise button and a slideshow's own pause button.

**A fast model with mid-tier accuracy.** Jev is fast and cheap, not perfect. It's strong at narrow yes-or-no questions about one thing and weaker at whole-page judgments. So we ask it narrow questions, act only on high probabilities, and let code checks, not the model, decide whether a change stays. Its image input is ten days old and experimental, so we use it for one extra check and never as the deciding vote.

**More categories didn't mean more accuracy.** Going from 60 kinds of element to 125 let Jev name more things, but on pages we hadn't tuned on, its accuracy held steady rather than improving. It also spread 1-2% across dozens of unlikely kinds; summed into families, that crossed our 5% "protect" line on things Jev was sure were ads, so WebAble stopped hiding them. We now count any single kind at or below 0.02 as zero:

$$P_{\text{family}} = \sum_{r \in \text{family}} P_r \cdot \mathbf{1}[P_r > 0.02].$$

**Rewriting without changing the facts.** A rewrite that loses a deadline or a dosage condition is worse than no rewrite. So every rewrite goes through code checks for numbers, conditions, quotes and links, then Jev's check that nothing was dropped or added. If it still fails after one retry, the person keeps the original, and the original is always one click away.

**Writing models that weren't given enough to go on.** When we asked a large model to lay out whole simplified pages from our page outline, it often folded away help links and left parts of the page out. The model wasn't the problem; it didn't have enough information about the page. We moved layout to code templates per kind of page, and kept writing models for writing.

**We built it like engineers.** When we tested it ourselves, the simplified page was the best thing WebAble did, but everything around it had too many named features, buttons nobody understood, pixel sizes, and an onboarding that felt like a chore. Fake practice pages weren't believable either. We cut it to one WebAble with no modes and one small button; replaced pixels with words like "Larger"; moved the finding task onto real websites; and made the results page lead with the person's own problems before the fixes.

**Testing in the wrong browser.** Headless test browsers reported fonts and zoom differently from real Chrome, so some fixes looked fine in tests and broke on screen. We now check changes in real Chrome at the resolution we demo on.

## What we learned

- **Personalization needs two kinds of understanding:** of the person and of the page. A simpler-looking layout can still be harder to use if it loses context. Clear results, stable behaviour and an easy way back matter as much as the model.
- **A probability is a product decision.** Where to act (0.90 to fold, 0.05 to protect) is where safety lives, and it's code we can read and test.
- **Ask a model the question it's good at.** Jev answered our narrow questions quickly and well; on the same ten pages it answered in under a third of a second for a third of a cent, where GPT-6 Sol took twelve seconds and five cents. Large models are better at writing. We use each for what it does best, and code makes the rules.
- **Measure needs, never conditions.** A need is something WebAble can act on. A condition isn't, and naming one would claim an accuracy a few minutes of tasks doesn't have.
- **Show people their own evidence.** "Finding something on CNN took you three times as long as on Wikipedia" lands in a way that a chart of settings never did.
- **Count honestly.** "Nothing broken" is an empty claim on its own, because undoing every change also breaks nothing. In one earlier frozen build, 32 of 50 public sites met our stricter clean-fit criteria: the larger text held, with none of the overlap or horizontal overflow our checks look for. That's an automated prototype result, not evidence about real users. Testing with people who use accessibility support is next.

## Privacy, plainly

What WebAble learns about how you read and click stays on your laptop. To decide what each part of a page is, Jev sees the page's structure with names and numbers taken out. Rewriting is different: to score and rewrite paragraphs, their text is sent to Jev and to OpenAI, and the answer you paste about how you like things explained is sent once to turn it into plain points. Rewriting is off on pages with password or payment fields, on mail, chat and banking sites, and on pages not in English.
