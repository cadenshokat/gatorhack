<!--
Devpost "About the project". Paste everything below the line into the field.
Merged by Wren (Sid's Claude) from Caden's submission copy (via Lucius, 02:41) and Wren's draft. Numbers come only from
the "Say now" section of docs/CLAIMS.md and from the code on main; every formula is one the product actually uses.
Setup is described as it is on main (53e72f7): five short tasks. If a three-part setup ships instead, change the
"Setup" paragraph and the table only.
-->

---

## Inspiration

Reading the news, checking a tax refund or refilling a prescription gets hard when the text is too small, the buttons
are hard to hit, and the page keeps competing for your attention. Finding and changing accessibility settings, site by
site, adds even more work.

When we looked at who actually needs help, the answer surprised us. The typical person isn't a screen reader user.
They have a few mild, overlapping needs (text a bit larger, buttons a bit bigger, fewer distractions), would never call
themselves disabled, and never open a settings menu. One in four US adults reports a disability (CDC, 2022), the most
common kind is cognitive, and the rate climbs steeply with age. Most of what those people do online is ordinary and
important.

So we wanted a tool the person owns: one that learns what helps them once, without asking about their health, and
carries that fit from website to website.

## How we built it

**WebAble** is a Chrome extension built with TypeScript, Preact and WXT. A small Node.js and Hono server on the laptop
handles model requests, caching and API keys; the extension only talks to that server.

### 1. Learn what helps the person

Setup is five short tasks, each borrowed from a published measure, and every one can be skipped:

| Task | Borrows from | What it sets |
|---|---|---|
| Reading size | MNREAD reading test | text size |
| Faint words | Pelli-Robson contrast chart | how much to darken faint text |
| Pop the bubbles | Fitts's law and the ISO 9241 pointing test | click-area size, steady clicks |
| Find it | research on visual clutter and motion | how much to simplify busy pages, stopping motion |
| Sort the colours | Farnsworth D-15 | labels where colour alone carries meaning |

The tasks adapt as they go. Faint words uses a "2-down, 1-up" staircase: two right answers make the word fainter, one
wrong answer makes it darker. It settles where the person is right with probability $p$ such that

$$p^2 = \tfrac{1}{2} \quad\Rightarrow\quad p = \tfrac{1}{\sqrt{2}} \approx 0.707,$$

so it finds a usable threshold in a few dozen taps. Pop the bubbles leans on Fitts's law: the time to hit a target grows
with its distance $D$ and shrinks with its width $W$,

$$MT = a + b \log_2\!\left(\frac{D}{W} + 1\right),$$

and we set the smallest click area the person hits reliably. Reading size finds the critical print size (the smallest
text before reading slows down) and sets body text to about $1.4\times$ that, never below 16 px. The results page says
in plain words what will change ("Text will be 22 px on every site") and shows it on sample pages.

After setup, WebAble keeps learning from ordinary browsing. Repeated missed clicks or manual zooming on several sites
lead to a suggested adjustment, never a silent one.

### 2. Read the page

The extension extracts the page's structure, its content groups and controls, and data it can read locally, such as
recipe steps and table rows. It turns every part into structured evidence (tag, role, landmark, position, size, where
its links go) with names and numbers taken out before anything leaves the laptop.

### 3. Interpret it with Jev, decide with code

Jev, TypeSafe AI's decision model (version 1.14, released October 14, 2026), doesn't write text. It answers typed
questions with a probability on every answer: what each part is (one of 125 fine roles, such as a stat, a team logo, a
recipe step, an ad or a teaser for another page), whether it belongs to the page's task, whether it's the main action,
whether it's help, and what the page as a whole is for. A typical page is about 178 decisions, asked in parallel.

Shared policy code decides what's allowed. A part is folded away only when Jev is very sure it's clutter and fairly sure
it isn't needed:

$$\text{fold}(e) \iff P_{\text{ad}} + P_{\text{teaser}} + P_{\text{pop-up}} \ge 0.90 \;\wedge\; P_{\text{task}} \le 0.20 \;\wedge\; P_{\text{help}} \le 0.10.$$

Anything with even a 5% chance of being content, a field, a button or help is protected.

A typical read is about 81,000 input tokens, and Jev charges only for input, so at today's price

$$81{,}000 \times \frac{\$0.042}{10^{6}} \approx \$0.0034 \text{ per page}.$$

### 4. Build the presentation

On busy reading pages, local components rebuild the page around what it's for, using the page's own content: an
article, a recipe's ingredients and steps, a team's record and game history. Controls stay linked to the original
elements. Before the simplified page appears, Jev checks it against the original: does it lead with what the page
exists to show, and is anything missing? Sign-in, checkout, account and statement pages are never replaced, and one
switch, "Original page", brings the site's version back, remembered per site.

OpenAI models can propose structured layouts and write plain-language explanations of hard passages; Jev assesses each
proposal, and layouts come back as a constrained specification, never as executable page code.

### 5. Check the result

Code checks every change for clipped text, overlap and horizontal overflow, and reverses changes that fail. Explanations
get number, condition-word and sentence-coverage checks. One small WebAble button on each page lists what changed,
with Undo for each, and "Pause on this site".

We built it as a team of two, Caden and Sid, each working with AI coding agents that took tasks in a shared Slack
channel and pushed their own branches for review. All code was written during the hackathon.

## Challenges we ran into

- **Preserving meaning.** Recognising a number, a label and a table is only the start; their relationships matter. An
  early simplified view of floridagators.com's Kentucky history page led with a news teaser and dropped the record and
  the team logos. We added page-purpose questions, structured extraction and components for stats, scoreboards, tables,
  schedules and recipes, and the meaning check.
- **Keeping the page stable.** Zoom, responsive layouts, model results that arrive late and pages that change underneath
  us can interact badly. We added guards against repeated automatic switching, against late results changing a view
  someone is using, and against overriding a choice to keep the original page.
- **A page can try to steer the model.** A site can label a "subscribe" button "Close". Jev judges mainly from structure,
  and WebAble only ever presses two kinds of button: a chat window's own minimise button, after Jev picks the same one
  with the options in both orders, and a slideshow's own pause button.
- **A model that reads text, not pages,** with mid-tier accuracy and image input that's only days old. We designed the
  evidence it reads, act only on high probabilities, and let code checks, not the model, decide whether a change stays.
- **Making personalization understandable.** Earlier versions exposed too many modes and technical controls. We moved to
  one WebAble experience, clear task instructions, concrete results and a small in-page control with Undo and Pause.

## What we learned

- **Personalization needs two kinds of understanding:** of the person and of the page. A simpler-looking layout can still
  be harder to use if it loses context. Clear results, stable behaviour and an easy way back matter as much as the model.
- **A probability is a product decision.** Where to act ($0.90$ to fold, $0.05$ to protect) is where safety lives, and
  it's code we can read and test.
- **Small numbers add up.** When Jev's vocabulary grew to 125 roles, it spread 1–2% across dozens of unrelated roles.
  Summed into families, that crossed our 5% protect line on things Jev was sure were ads, so WebAble stopped hiding them.
  We now treat any single role at or below $0.02$ as zero before summing:

  $$P_{\text{family}} = \sum_{r \in \text{family}} P_r \cdot \mathbf{1}[P_r > 0.02].$$

- **Measure needs, never conditions.** A need is something WebAble can act on. A condition isn't, and naming one would
  claim an accuracy a short task doesn't have.
- **Count honestly.** "Nothing broken" is an empty claim on its own, because undoing every change also breaks nothing. In
  one earlier frozen build, 32 of 50 public sites met our stricter clean-fit criteria: the larger text held, with none of
  the overlap or horizontal overflow our checks look for. That's an automated prototype result, not evidence about real
  users. Testing with people who use accessibility support is next.
