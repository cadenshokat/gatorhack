# Fresh off the frontier: the story for the video and Devpost

Gator Hack asks every team to show what their new technology does, what was hard, and why it's recent. This is ours,
in plain spoken language. Every number in it comes from the "Say now" section of `docs/CLAIMS.md`; if a number changes
there, change it here. Written by Wren (Sid's Claude) for round 7.

## What Jev is, and why it's recent

Jev is a decision model from TypeSafe AI. It doesn't write text. You give it a description of a situation and typed
questions about it: yes or no, pick one of these options, or rate on a scale. It answers every question with a
probability, quickly and cheaply, in a form code can use directly.

It is very new:
- TypeSafe announced Jev on **September 15, 2026**. Its developer libraries went public the same week (JavaScript on
  September 11, Python on September 14).
- **Jev 1.14** came out on **October 14, 2026**, ten days before Gator Hack. It added image input and a question type that
  finds things in a picture. TypeSafe calls both experimental: they're off unless you send a special "Danger Zone"
  header, and its docs say they "aren't yet up to our standards to call ready for production."

So everything WebAble does with Jev was built on a model that's about six weeks old, and the image part on one that's
ten days old.

Sources: `docs.typesafe.ai/models`, `docs.typesafe.ai/images`, and the SDK changelogs at
`docs.typesafe.ai/sdk/javascript/changelog` and `docs.typesafe.ai/sdk/python/changelog`.

## What it does in WebAble

WebAble fits web pages to the person using them: larger text, bigger click targets, fewer distractions. Code does the
fitting. Jev does the part code can't: it reads the page and says what each part is for.

- **Jev reads the page.** For every part of a page, WebAble asks Jev what job it does (the page's content, a form field,
  the main button, navigation, an ad, a teaser for other content, a pop-up, help...), whether it's part of the page's main
  task, whether it's the main action, and whether it's a way to get help. A typical read is about 178 of these decisions.
- **Code decides, and only on confident answers.** WebAble folds something away only when Jev is at least 90% sure it's
  an ad, a teaser or a pop-up, and less than 20% sure it's part of the task. Anything that might be content, a field or
  help is protected and never folded. It outlines a main button only when Jev is at least 90% sure.
- **Round 7: the page's meaning.** Jev now also says what the page is for (a record, an article, a recipe, a form...),
  which region holds the information the page exists to show, and a finer role for each part (a stat, a team logo, a
  recipe step). Calm view rebuilds the page around that.
- **A meaning check.** Before Calm view shows anything, Jev compares it with the original: does it lead with what the
  page exists to show, and is anything from it missing? If it fails, Calm view isn't offered on that page.
- **Every change is checked.** After each change, code checks the page for text that's cut off, overlapping or
  scrolling sideways, and puts the change back if a check fails.

## What was hard

- **Jev reads text, not pages.** It can't see a website, so we turn each page into structured evidence: for every part,
  its tag, role, landmark, position, size, how much text it has, and where its links go. Names and numbers are taken out
  before anything leaves the laptop.
- **Its answers shifted with the order of the page's parts.** When we listed every part in one shared description, the
  same part got a different answer depending on what came before it. We fixed it by putting each part's evidence inside
  its own questions. Answers stopped depending on order, and we can split a page across parallel calls.
- **It can be steered by the page.** A website can label a button "Close" when it actually subscribes you. So Jev judges
  mainly from structure (tag, role, size, where the link goes), and on pages with ad frames or links to other sites each
  question carries a note that labels are written by the website and may be misleading.
- **Its accuracy is mid-tier.** It's fast and cheap, not perfect. So WebAble acts only on high probabilities, protects
  anything that might matter, and checks every change on the page afterwards.
- **Its server won't take calls from a browser extension.** So we built a small server that runs on the laptop, holds
  the API key, caches answers and talks to Jev. The extension only talks to that server.
- **Its image input is experimental.** We use it for one extra check, comparing screenshots before and after a change.
  The code checks are still what decide whether a change stays.

## The numbers we can say

From `docs/CLAIMS.md`, "Say now". Use these words, not stronger ones.

- "We pointed WebAble at 50 sites people use every day. On 32 of them it made the text larger and left nothing broken."
- "Every change gets checked, and when a change breaks something, WebAble puts it back by itself." (On the 50-site run it
  undid 22 of its own changes on 15 sites.)
- "Jev reads the page before you do. On the 50-site run the typical read took under half a second and cost about a third
  of a cent."
- "We asked Jev and GPT-6 Sol the same questions about the same ten pages. Jev answered in under a third of a second for
  a third of a cent. GPT took twelve seconds and five cents." Never "more accurate than GPT": we measured speed, cost and
  agreement, not accuracy.
- "What WebAble learns about you never leaves your laptop. To read a page, it sends the page's structure, with names and
  numbers taken out."
- Simulation numbers (missed clicks, the warm-up) only with the word "simulation".

## The 2-minute video

Five pages, about 280 words of narration. Record the screen in Chrome at 1440×900 with the URLs from
`docs/demo/pages.md`. Each page shows the original for a moment, then WebAble's version. Lines in brackets are on-screen
text, not narration.

The storyboard shows what round 7 is meant to do. Before recording, check each page against what actually ships, and
cut any line the build doesn't back up.

| Time | Shot | On screen | Narration |
|---|---|---|---|
| 0:00–0:12 | Title, then Alderra as the site made it | [WebAble · built on Jev, TypeSafe AI, Sept 2026] Cursor drifts over the small grey Confirm button | "A lot of the web is hard to use if you need bigger text, steadier clicks or fewer distractions. WebAble fits each page to the person using it. It runs on Jev, a decision model TypeSafe released in September." |
| 0:12–0:35 | Alderra refill | WebAble's panel shows Jev's read; the carousel stops, offers fold, prescriptions move up, Confirm refill grows to full width; click it, "Refill requested ✓" | "On this pharmacy page, the button that matters is small and grey, right next to a big one that takes you shopping. Jev reads every part of the page and says what it's for, with a probability. WebAble acts only on answers Jev is very sure of. Here it puts the prescriptions first and makes Confirm the button you can't miss." |
| 0:35–0:55 | floridagators.com, Kentucky history | Original with the scoreboard slider and menus; Calm view opens on both logos, the 7–38 scoreboard and the stat grid | "Some pages exist to show information. This one is Florida's record against Kentucky. Jev finds the record and both team logos, and WebAble leads with them: 54 wins, 22 losses, and last year's 7 to 38." |
| 0:55–1:12 | Allrecipes, Best Chocolate Chip Cookies | Scroll fast past the video and ads to show the distance; then WebAble's version opens on ingredients and steps | "On this recipe, the ingredients start six screens down, past a floating video and the ads. WebAble opens with the ingredients and the steps, and keeps the times." |
| 1:12–1:30 | CNN article | Zoom in with Ctrl +; WebAble's offer appears; accept; the article reflows at the larger size with its photos | "On a news article, the story is what matters. You zoomed in on two sites, so WebAble offers larger text everywhere, and keeps the photos that go with the story." |
| 1:30–1:42 | IRS refund page | Original with both buttons below the fold; WebAble brings up the two large buttons and the "what you'll need" list | "On the IRS refund page, the two ways to check are just below the first screen. WebAble brings them up and makes them easy to press." |
| 1:42–2:00 | Results card, then the five pages side by side | [32 of 50 sites · under half a second per read · about a third of a cent] | "We pointed WebAble at 50 sites people use every day. On 32 of them it made the text larger and left nothing broken. Every change gets checked, and when a change breaks something, WebAble puts it back by itself. Jev reads a typical page in under half a second, for about a third of a cent. And what WebAble learns about you never leaves your laptop." |

Notes for the shoot:
- The CNN shot is the live "zoomed in on two sites" moment. `docs/CLAIMS.md` says to run it three times in a row from a
  fresh profile first; it worked on 2 of 4 tries in testing. If it doesn't hold, film the larger text without the zoom
  and change the line to "WebAble sets the text at the size you need, and keeps the photos that go with the story."
- Fix the IRS body-text measurement first (see `docs/demo/pages.md`), or the IRS shot shows no change.
- Accept or reject cookie notices before each take. WebAble won't close them, and they'd cover the shot.
- Keep the narration in this voice: say what's on screen and what changed. No "revolutionary", no "seamless", nothing
  about compliance, and never name a condition.
