# Demo video and live pitch plan

For Caden and Sid, by Wren (Sid's Claude), Sunday 25 Oct 2026, 3:20 PM ET. Devpost is due at 5:00 PM; the top 10
pitch Monday at 10:15 AM in the Reitz Union.

Built on the new feature (round 9): the person pastes one answer from their ChatGPT or Claude about how they like things
explained; Jev gives each paragraph a probability that it's harder than it needs to be *for this person* and picks one
change; a writing model rewrites it; code and Jev check no facts were lost; the new text swaps in with a thin green
line, and clicking the line shows the original.

**Rules this plan follows:** only "Say now" numbers from `docs/CLAIMS.md`; anything that must come from the real take is
**[fill]**; no "never leaves your laptop" (paragraph text now goes to OpenAI); no condition names; no hearing aids; no
"seamless", "leverage", "empower", "revolutionize", "journey".

---

## 0. Two things to fix before anything else

1. **The repo must be public.** Gator Hack V's rules ask for "a link to your public code repository", and
   `github.com/cadenshokat/gatorhack` returned 404 earlier today. MLH's Best Open Source Project prize also needs a
   public repo with a licence. ([Gator Hack V rules](https://gatorhack2026.devpost.com/))
2. **The video limit is 3:00.** Plan for 2:20–2:30. ([Gator Hack V rules](https://gatorhack2026.devpost.com/))

## 1. What the judges reward

**The official criteria** (four, not five; there's no separate Novelty line):
- **Impact:** how meaningful the problem is, and how useful the solution could be.
- **Technical execution:** how well it works, technical ambition, and what the team accomplished during the hack.
- **Design & usability:** is it intuitive and accessible?
- **Presentation & demo:** does the team explain the problem, solution, technical approach **and limitations**, and does
  the demo show the project working?

Judges are UF graduate students. ([Gator Hack V](https://gatorhack2026.devpost.com/))

**Last year's winner is this year's organiser.**
- Gator Hack 2025 was won by **Plato's Cave**, an agent that splits a research paper into claims and checks each one
  against sources. ([UF ECE news](https://ece.ufl.edu/2025/11/10/uf-student-hackers-enter-platos-cave-for-first-place-win/))
- Its demo video was uploaded by **Matheus Kunzler Maldaner**, who is listed as this year's student organiser and judge.
  ([video](https://www.youtube.com/watch?v=wvmJdUhuj4s), [Gator Hack V judges](https://gatorhack2026.devpost.com/))
- That video's own beats show what this judge values: a real tool working live ("this is not a simulation"), the AI's
  steps visible while it works, the back end shown, and an open-source repo.
- We can't find a public gallery of earlier Gator Hack winners; UF's coverage names only the 2025 first place.

## 2. What winning videos have in common

### Transcripts we pulled and analysed

Five new transcripts were pulled with yt-dlp (auto-captions, 15-second buckets); they're on Sid's machine in
`%TEMP%\webable-transcripts\transcripts.txt`. Four other winners' videos are private or removed: Phonaify, Opale, Orma
and BrowseGraph. EduAdapt has no English captions. We didn't redo Caden's 11 (Shepherd, Mochi, Kinemo, Diffuji, Dose,
Alto, AAC Board AI, BrowseBack, OverSEA, Lumos, Cena Can See).

| Video | Award | Length | First live demo | Hook | How it shows the AI working | The number | Close | Pace |
|---|---|---|---|---|---|---|---|---|
| [Plato's Cave](https://www.youtube.com/watch?v=wvmJdUhuj4s) | Gator Hack 2025, 1st ([UF](https://ece.ufl.edu/2025/11/10/uf-student-hackers-enter-platos-cave-for-first-place-win/)) | 2:45 | 0:15 | Personal problem: "one of the main issues that I face" | The agent's steps on screen, then the back end live | None; a scoring formula pointed to in the repo | Mission line, then "open sourcing it" | ~199 wpm |
| [Nutshell](https://www.youtube.com/watch?v=KVOM2VvWypE) | Chrome Built-in AI 2025, Most helpful ([Chrome](https://developer.chrome.com/blog/ai-challenge-winners-2025)) | 2:55 | 0:45 | Who it's for, plus a cost contrast | Names the model at the moment it acts: the summary appears, "that's Gemini Nano" | "tens of thousands of dollars" vs "just your webcam" | Why the maker built it, then two short negatives | ~141 wpm |
| [Mentelo](https://www.youtube.com/watch?v=_4zeoqGxqmU) | Chrome Built-in AI 2025, Best hybrid ([Chrome](https://developer.chrome.com/blog/ai-challenge-winners-2025)) | 3:14 | 0:05 | Straight into the product | A live voice Q&A on a real tax form (W-8BEN) | None | Feature list runs out | ~150 wpm |
| [WP On-Device AI Assistant](https://www.youtube.com/watch?v=rhfEHsNbsVM) | Chrome Built-in AI 2024, Best real-world app ([Chrome](https://developer.chrome.com/blog/ai-challenge-winners)) | 2:53 | 0:30 | Where the problem lives | A paragraph rewritten "like I am 12" in place | "in under two minutes" | Admits a broken API, then thanks | ~158 wpm |
| [The Crooked Tankard](https://www.youtube.com/watch?v=WRLDsdM7CpU) | Chrome Built-in AI 2024, Most innovative ([Chrome](https://developer.chrome.com/blog/ai-challenge-winners)) | 2:56 | 0:00 | Cold open: playing the game | "The AI does not control the entire outcome… [it] fill[s] in little details" | 340 gold (in-game) | How to try it, docs | ~194 wpm |

### The patterns

1. **The product is on screen in the first 15 seconds.**
   - Mentelo opens on a click at 0:05 and Crooked Tankard on gameplay at 0:00; Plato's Cave starts its browser at
     0:15. ([Mentelo](https://www.youtube.com/watch?v=_4zeoqGxqmU),
     [Crooked Tankard](https://www.youtube.com/watch?v=WRLDsdM7CpU))
   - Nutshell is the exception: demo at 0:45, but its opening contrast carries it.
     ([Nutshell](https://www.youtube.com/watch?v=KVOM2VvWypE))
2. **One person, one problem, first sentence.** Plato's Cave opens on the maker's own daily problem; Nutshell opens on
   who it's for. ([Plato's Cave](https://www.youtube.com/watch?v=wvmJdUhuj4s))
3. **Name the AI at the moment it acts.** Nutshell names Gemini Nano exactly as the summary appears; Plato's Cave
   narrates the agent's reasoning as each step happens. For us, that's "Jev" plus its probability on screen.
   ([Nutshell](https://www.youtube.com/watch?v=KVOM2VvWypE))
4. **Prove it's real.** "This is not a simulation," then the back end. The judge who said that is judging us.
   ([Plato's Cave](https://www.youtube.com/watch?v=wvmJdUhuj4s))
5. **The AI fills in; code stays in charge.** Crooked Tankard's AI only fills in details while the game logic stays
   fixed. That's our "Jev decides, code rules, checks before anything shows" story.
   ([Crooked Tankard](https://www.youtube.com/watch?v=WRLDsdM7CpU))
6. **One concrete contrast or number.** Nutshell's "tens of thousands of dollars" vs "just your webcam"; WP's "under two
   minutes". ([Nutshell](https://www.youtube.com/watch?v=KVOM2VvWypE),
   [WP](https://www.youtube.com/watch?v=rhfEHsNbsVM))
7. **Winners are honest about limits.** WP's video says an API was broken during recording. Gator Hack's own criteria ask
   for limitations. ([WP](https://www.youtube.com/watch?v=rhfEHsNbsVM), [criteria](https://gatorhack2026.devpost.com/))

**Pace:** these run 140–200 words a minute. Ours, at about 270 words in 2:25, is about 110: calmer, which suits the
subject and Caden's voice.

### How WebAble must look different from Mochi

Mochi won the Chrome Built-in AI Challenge 2024 as "a Chrome Extension that adapts web content for users with reading
disabilities, ADHD, and dyslexia." ([Chrome blog](https://developer.chrome.com/blog/ai-challenge-winners),
[Devpost](https://devpost.com/software/mochi-6i7vuk)) Judges who know it will think "text simplifier" the moment a
paragraph changes. On screen, ours must show five things Mochi's description doesn't:

1. **Two people, one page, two versions, side by side.** It's not "simpler for everyone": it's fitted to *this* person,
   from what their own AI already knows about them.
2. **Only some paragraphs change.** Jev's probability per paragraph is visible in the Jev view, and most paragraphs stay
   as written. Show one that Jev left alone, and why.
3. **The check before the swap.** Show the fact check passing (numbers, names and dates kept) and, if we can, one that
   failed and kept the original.
4. **The original is one click away.** Click the green line; the site's own words come back.
5. **The rest of WebAble is still working.** Larger text, bigger buttons and the cleaned-up page are on in the same shot.
   Mochi adapts text; WebAble fits the whole page.

---

## 3. The demo video (2:25)

**Set-up for the take:**
- **The two people:** "Ana" and "Ben", fictional. Ana's pasted answer says she wants the main point first, short.
  Ben's says he likes steps in plain words.
- **Two Chrome profiles**, each with its own fit and pasted answer.
- **The page:** a CNN article with at least two dense paragraphs **[fill: final URL]**. Check Jev flags different
  paragraphs, or picks different changes, for Ana and Ben before recording.

| Time | On screen | Narration |
|---|---|---|
| 0:00–0:08 | **Cold open.** The CNN article as the site made it, for one second. Cut to the same page with WebAble: clean, larger text. Two paragraphs fade to new text, each with a thin green line. | "This is a CNN article. This is the same article with WebAble. Two paragraphs just rewrote themselves. For me." |
| 0:08–0:20 | Slow scroll on the cleaned page; the green lines stay visible. | "Most of the web is written for an average reader who doesn't exist. Some of us want the point first. Some of us want the steps. A settings menu can't know that. Your AI already does." |
| 0:20–0:36 | Ana's ChatGPT tab: she asks how she likes things explained; copies the answer. WebAble's paste box; paste; "Saved". | "So WebAble asks for one thing. Ask ChatGPT or Claude how you like things explained, and paste the answer in. That's it." |
| 0:36–1:02 | **The Jev view** over the article. Each paragraph shows Jev's probability that it's harder than it needs to be for Ana; two are high and marked with the change Jev picked ("main point first", "shorter"); the rest are low and untouched. | "On every reading page, Jev, the decision model TypeSafe released in September, looks at each paragraph and gives it a probability: is this harder than it needs to be, for this person? It only touches the ones it's sure about. For each, it picks one change: plainer words, steps, shorter, or the main point first." |
| 1:02–1:24 | One paragraph: the rewrite arrives; a small check list ticks: numbers kept, names kept, nothing added **[fill: the real check labels]**. Then click the green line: the original slides back in; click again, the new version returns. | "A writing model rewrites it. Then code and Jev check it against the original. Same numbers, same names, nothing added. If the check fails, you keep the original. And the green line is always there. Click it, and you're reading the site's own words." |
| 1:24–1:52 | **The wow:** split screen, Ana's profile left, Ben's right, the same article scrolled to the same place. Ana's paragraph leads with the point in two sentences; Ben's is three numbered steps. | "Here's the same article for two people. Ana asked for the point first. Ben asked for steps. Same facts, same page. Two different versions, each one checked." |
| 1:52–2:10 | Quick cuts: floridagators.com record page simplified with both logos; the WebAble sheet showing "What WebAble did here" with Undo. | "That's on top of everything else WebAble does. Larger text, bigger buttons, less clutter, and every change checked and put back if it breaks the page. Jev makes the small calls. Our code makes the rules." |
| 2:10–2:25 | Black card, white text: "≈40× faster than GPT-6 Sol on the same questions". Then the WebAble wordmark. | "On the same questions, Jev answered about forty times faster than GPT-6 Sol. That's why this can run on every page you open. WebAble. The web, fitted to you." |

Narration: about 270 words. The closing number is "Say now" claim 4 in `docs/CLAIMS.md`.

**Must be true on the day before this script is used:**
- Jev picks different paragraphs or changes for Ana and Ben on the chosen page. If not, try another article.
- The check labels in the 1:02 beat match what the UI really shows; replace them with **[fill]**.
- If the rewrite is slower than a few seconds, cut the wait in the edit and don't claim a speed for it.

---

## 4. The live pitch (3:00, Monday 10:15 AM)

**Who does what:** Caden talks; Sid drives the laptop. Two Chrome profiles (Ana, Ben) are open and signed in before going
on stage, with every demo tab already loaded once, so Jev's answers are cached on our server.

| Time | Caden says | Sid shows |
|---|---|---|
| 0:00–0:20 | Caden's opening: "This is a pharmacy refill page. For most of you it takes ten seconds…" | Alderra refill page, as the site made it. |
| 0:20–0:45 | "WebAble fits every website to the person using it, without asking what's wrong with you." What it learns: a few minutes of quick tasks, then ordinary browsing. | The refill page with WebAble: Confirm made the clear button. |
| 0:45–1:30 | The new feature: paste one answer from your AI; Jev scores each paragraph; a writing model rewrites; code and Jev check; the green line. | Ana's profile on the CNN article. Open the Jev view: probabilities per paragraph. Click a green line: original, then back. |
| 1:30–2:00 | "Same page, two people." | Switch to Ben's window (side by side if the projector is wide enough). |
| 2:00–2:30 | Why Jev, why now: public since September; reads a page in under half a second for about a third of a cent; about 40× faster than GPT-6 Sol on our questions. (The "125 kinds of element, 86–92% on unseen pages" line is in `SKILL.md` §11 but not yet in `CLAIMS.md`; add it there first if you want to say it.) What was hard: it reads text, not pages; it can be steered; mid-tier accuracy, so code decides. | floridagators.com simplified: the record and both logos. |
| 2:30–3:00 | Limits, honestly: tested on real sites, not yet with people; the pilot is next. Close: "WebAble. The web, fitted to you." | The sheet: "What WebAble did here", with Undo. |

**Fallback, in order:**
1. **Wifi drops:** switch the laptop to Sid's phone hotspot (set it up and test it before 10:00). Jev and OpenAI both
   need the internet; only answers already cached on our server work offline **[fill: confirm whether rewrites are
   cached, or only Jev reads]**.
2. **The server or Jev fails:** WebAble shows "Couldn't read this page right now." Say so plainly, then play the video
   from the desktop (download it locally, don't stream it).
3. **The projector cuts off one window:** skip side by side, and switch between Ana's and Ben's windows instead.

**The five questions judges are most likely to ask:**
1. **"Isn't this Mochi?"** "Mochi simplifies text for readers. WebAble rewrites only the paragraphs Jev is sure are
   harder than they need to be for you, checks every rewrite against the original, keeps the original one click away,
   and fits the rest of the page too: text size, buttons, clutter."
2. **"Why Jev and not GPT?"** "On the same questions about the same ten pages, Jev answered in under a third of a second
   for a third of a cent; GPT-6 Sol took twelve seconds and five cents. Deciding has to happen on every page, so we use
   Jev for the decisions and a writing model only to write."
3. **"How do you know the rewrite didn't change the facts?"** "Code checks that every number and name survived, and Jev
   checks each original sentence is covered. If either fails, you keep the original. And the original is always one
   click away."
4. **"What happens to my data?"** "What WebAble learns about how you read and click stays on your laptop. To rewrite a
   paragraph, that paragraph's text is sent to OpenAI **[fill: and the style you pasted? confirm in the code]**. Pages
   with password or payment fields are never rewritten **[fill: confirm]**."
5. **"Does it actually help people?"** "We haven't measured that with people yet. Our numbers come from real websites
   and simulations; a pilot with real people doing a pharmacy refill is the next step."

---

## 5. Recording plan: 3:20 to 4:30 PM

We start later than the 2-hour plan, so this is the 70-minute version. One records the screen while the other
narrates; both check every take.

| Time | Caden | Sid |
|---|---|---|
| 3:20–3:35 | Pick the CNN article; check Jev flags different paragraphs for Ana and Ben. Write the final [fill] values into the script. | Make the Ana and Ben Chrome profiles; paste each style answer; load the extension; warm every demo page once. Chrome at 1440×900. |
| 3:35–4:00 | Read the narration once aloud for timing; record the voiceover in one quiet take (phone or laptop mic, 30 cm away). | Record screen takes in script order. Take 2 of anything that stutters. Record the split screen as two windows side by side. |
| 4:00–4:20 | Edit: lay the voiceover, cut the screen takes to it, add the closing card. No music under the voice, or very quiet. | Captions from the script (judges often watch muted). Export 1080p. |
| 4:20–4:30 | Watch it once, start to finish. | Upload to YouTube as unlisted, check it plays logged out, paste the link into Devpost. |
| 4:30–5:00 | Devpost: about text, built-with, repo link (**public**), team. Submit by 4:45. | Make the repo public with a licence; check the link logged out. |

**Shot list** (in recording order):
1. The CNN article, WebAble off, 2 s.
2. The same article, WebAble on, Ana's profile: the page loads clean and two paragraphs swap in. Hold 4 s.
3. Slow scroll down the cleaned article.
4. Ana's ChatGPT tab: ask how she likes things explained; copy the answer.
5. WebAble's paste box: paste; it saves.
6. The Jev view on the article: probabilities per paragraph, the two high ones labelled.
7. One paragraph rewriting, with the check passing.
8. Click the green line: the original; click again.
9. Split screen: Ana left, Ben right, same scroll position, 6 s.
10. floridagators.com simplified: logos and record.
11. The WebAble sheet: "What WebAble did here", with Undo.
12. The closing card: "≈40× faster than GPT-6 Sol on the same questions", then "WebAble. The web, fitted to you."

---

## Sources

- Gator Hack V rules, prizes, judges and criteria: <https://gatorhack2026.devpost.com/>
- Gator Hack 2025 winner: UF ECE, "UF student hackers enter Plato's Cave for first place win".
  <https://ece.ufl.edu/2025/11/10/uf-student-hackers-enter-platos-cave-for-first-place-win/>
- Chrome Built-in AI Challenge winners, 2024: <https://developer.chrome.com/blog/ai-challenge-winners>
- Chrome Built-in AI Challenge winners, 2025: <https://developer.chrome.com/blog/ai-challenge-winners-2025>
- Videos analysed: [Plato's Cave](https://www.youtube.com/watch?v=wvmJdUhuj4s) ·
  [Nutshell](https://www.youtube.com/watch?v=KVOM2VvWypE) · [Mentelo](https://www.youtube.com/watch?v=_4zeoqGxqmU) ·
  [WP On-Device AI Assistant](https://www.youtube.com/watch?v=rhfEHsNbsVM) ·
  [The Crooked Tankard](https://www.youtube.com/watch?v=WRLDsdM7CpU)
- Mochi: <https://devpost.com/software/mochi-6i7vuk>
