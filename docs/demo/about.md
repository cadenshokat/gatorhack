<!--
Devpost "About the project". Paste everything below the line into the field.
Written by Wren (Sid's Claude) with Lucius (Caden's Claude Code). Numbers come only from the "Say now" section of
docs/CLAIMS.md and from the code on main; formulas are the ones the product actually uses.
-->

---

## What inspired us

Most of the web is built for someone with sharp eyes, a steady hand and time to spare. Everyone else pays for it in
small ways: grey text that's too faint, a button that's too small to hit the first time, a recipe buried six screens
under a story and the ads.

**Sid** started by asking who actually needs help. The answer surprised us. The typical person isn't a screen reader
user; they're someone with a few mild, overlapping needs who would never call themselves disabled and never opens a
settings menu. One in four US adults reports a disability (CDC, 2022), the most common kind is cognitive, and the rate
climbs steeply with age. Those people mostly do ordinary, high-stakes things online: read the news, refill a
prescription, check a tax refund. So we wanted a tool that learns what a person needs without a setup screen, and never
asks about their health.

**Caden** [CADEN'S INSPIRATION, from Lucius]

The tools that exist today mostly zoom the whole page, which breaks layouts, or are overlays a website installs on
itself with promises about compliance. We wanted the opposite: a tool the person owns, that fits every page to them and
only does what it can check.

## How we built it

**WebAble** is a Chrome extension (TypeScript, Preact, WXT) with a small server that runs on the laptop (Node and Hono).
The server holds the API keys and talks to the models; the extension only talks to the server.

**It starts with five quick games**, each borrowed from a published measure, each stopping as soon as it's sure:

| Game | Borrows from | Sets |
|---|---|---|
| Reading size | MNREAD reading test (critical print size) | text size, reading support |
| Faint words | Pelli-Robson contrast chart | how much to darken faint text, light or dark |
| Pop the bubbles | Fitts's law and the ISO 9241 pointing test | button size, steady clicks |
| Find it | research on visual clutter and motion capture | how much to simplify busy pages, stopping motion |
| Sort the colours | Farnsworth D-15 | labels where colour alone carries meaning |

The games are adaptive. Faint words, for example, uses a "2-down, 1-up" staircase: two right answers make the word
fainter, one wrong answer makes it darker. That settles where the person is right with probability $p$ such that

$$p^2 = \tfrac{1}{2} \quad\Rightarrow\quad p = \tfrac{1}{\sqrt{2}} \approx 0.707,$$

so it finds a usable threshold in a few dozen taps (Levitt, 1971). Pop the bubbles leans on Fitts's law, which says the
time to hit a target grows with its distance $D$ and shrinks with its width $W$:

$$MT = a + b \log_2\!\left(\frac{D}{W} + 1\right).$$

We fit a person's misses, near misses and jitter at three sizes, and set the smallest button size they hit reliably.
Reading size finds the critical print size (the smallest text before reading slows down), and body text becomes about
$1.4\times$ that, never below 16 px.

**Then Jev reads every page.** Jev is TypeSafe AI's decision model, released in September 2026. It doesn't write text;
it answers typed questions with a probability on every answer. For each part of a page we ask what it is (one of 125 fine
roles: a stat, a team logo, a recipe step, an ad, a teaser for another page...), whether it's part of the page's task,
whether it's the main action, and whether it's a way to get help. A typical page is about 178 decisions, asked in
parallel.

**Code decides, never the model.** An element is folded away only when Jev is very sure it's clutter and fairly sure it
isn't needed:

$$\text{fold}(e) \iff P_{\text{ad}} + P_{\text{teaser}} + P_{\text{pop-up}} \ge 0.90 \;\wedge\; P_{\text{task}} \le 0.20 \;\wedge\; P_{\text{help}} \le 0.10.$$

Anything with even a 5% chance of being content, a field, a button or help is protected and never touched.

**On busy reading pages, you just get the simplified page**, built around what the page exists to show: a sports record
becomes a stat grid with both team logos, a recipe opens on its ingredients and steps. Before it appears, Jev checks it
against the original: does it lead with the page's main information, and is anything missing? If not, you get the
original page, adjusted in place. One switch, "Original page", brings the site's version back and is remembered per
site. Sign-in, checkout, account and statement pages are never replaced.

**Every change is checked.** After each change, code looks for text that's cut off, overlapping or scrolling sideways,
and puts the change back by itself if a check fails.

**It's cheap enough to run on every page.** A typical read is about 81,000 input tokens at Jev's price of $0.042 per
million:

$$81{,}000 \times \frac{\$0.042}{10^{6}} \approx \$0.0034 \text{ per page},$$

and on our 50-site run the typical read took under half a second.

**How the two of us worked:** Caden and Sid, each with an AI assistant, plus Grok in Cursor and Codex, took tasks in one
Slack channel and pushed their own branches for review. Lucius (Caden's Claude Code) coordinated and built the engine;
Wren (Sid's Claude) wrote the research, the demo specs and the words people see in the onboarding and on the page. All code was written during the
hackathon.

## What we learned

- **A probability is a product decision.** Where to act ($0.90$ to fold, $0.05$ to protect) is where safety lives, and
  it's code we can read and test, not a model's mood.
- **Small numbers add up.** When Jev's vocabulary grew to 125 roles, it spread 1–2% across dozens of unrelated roles.
  Summed into families, that crossed our 5% "protect" line on things Jev was sure were ads, so WebAble stopped hiding
  them. We now treat any single role at or below $0.02$ as zero before summing.
- **The evidence matters more than the wording.** Jev can't see a page, so we describe each part as structured evidence.
  Putting each part's evidence inside its own questions, instead of one shared list, stopped its answers from depending
  on the order of the page.
- **Measure needs, never conditions.** A need is something WebAble can act on; a condition isn't, and naming one claims an
  accuracy a 30-second game doesn't have. Ability-based design (Wobbrock et al., 2011) says the same thing.
- **Agreement isn't accuracy, and "nothing broken" isn't success.** Undoing every change also breaks nothing, so our count
  requires the larger text to have actually held.

[CADEN'S LEARNING, from Lucius]

## Challenges we faced

- **Jev reads text, not pages,** so we had to design the evidence it sees for every part of a page, and strip names and
  numbers out before anything leaves the laptop.
- **A page can try to steer it.** A site can label a "subscribe" button "Close". Jev judges mainly from structure, and
  WebAble only ever presses two kinds of button: a chat window's own minimise button, after Jev picks the same one with
  the options in both orders, and a slideshow's own pause button.
- **Its accuracy is mid-tier.** Fast and cheap, not perfect, so we act only on high probabilities and check every change.
- **Its image input is ten days old and experimental,** so we use it for one extra check and let code decide.
- **The simplified page got a page's meaning wrong.** On floridagators.com's Kentucky history page it led with a news
  teaser and dropped the record and the logos. That's why Jev now says what each page is for, and why the meaning check
  exists.
- **We built it like engineers.** When we tested it ourselves, the simplified page was the best thing WebAble did, but
  everything around it had too many named features, buttons nobody understood and an onboarding that felt like a chore.
  We cut it to one WebAble, one small button and plain words.

[CADEN'S HARDEST MOMENT, from Lucius]

## Where it stands

On 50 sites people use every day, WebAble made the text larger and left nothing broken on 32. When a change broke
something, it put it back by itself. Asked the same questions about the same ten pages, Jev answered in under a third of a
second for a third of a cent; GPT-6 Sol took twelve seconds and five cents. And what WebAble learns about you never leaves
your laptop. Next, we test it with people.
