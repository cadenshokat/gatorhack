<!-- The writing guide behind every participant-facing word in apps/study (27 Oct 2026). Built from GOV.UK, W3C WAI,
     NN/g, MeasuringU and 16 practitioner articles; sources in section 5. "(current)" examples quote the study's wording
     before the rewrite. -->

# Writing guide for the WebAble phone study

This guide is for whoever rewrites the words people see in the study. That means every page in `webable-gatorhack/apps/study/src` and the warm-up pages in `apps/extension/entrypoints/fitting/tasks`.

The people taking part are adults aged 50 or over who say websites often give them trouble: getting around a website, finding the information they need, or understanding what it says (protocol 2.0.0, 28 Oct 2026; it was any adult aged 18 or over). Many are not confident with technology, and some have shaky hands or poor eyesight. They do the study alone, on their own phone, and there is nobody they can ask.

Check every sentence like this: could a 75-year-old who rarely uses websites read it once, out loud, and know exactly what to do next?

In this guide, "(current)" marks wording taken from the live study code on 27 October 2026.

## Already decided by the study owner

- The ease rating goes from 1 (very easy) to 7 (very hard).
- Progress is shown as one thin line across the top of the screen, above the header, with no words (changed 28 Oct 2026; it was a segmented bar under the header).
- Wikipedia is not used. Do not mention it anywhere.
- Describe only what WebAble does in the study: settings from the person's warm-up, and AI decisions made once per website before the study (the same for everyone). Never say or imply that it learns about the person, tests or diagnoses anything (memory, thinking, eyesight, hands), or that the study tries everything the full product does (28 Oct 2026).
- None of the text may sound machine-written.
- Phone first. Answer buttons stack at full width. The "which word" buttons on phones were broken.

## Facts to confirm before you write

Do not guess any of these. Get each one from the code or the study owner.

- How long the study takes: use the median time from a pilot, rounded up.
- Who runs the study: team, university, ethics approval reference, contact email, and who to complain to.
- What is recorded. The current agreement page says: taps, scrolling and zooming on study pages; time on each website; answers; warm-up sizes; screen size, browser and display settings; age range.
- Who sees the answers, how long they are kept, and whether there is a deadline for asking to delete them.
- Whether answers are kept when someone leaves part-way. Also whether they can come back later with the same link.
- Whether Back works inside each warm-up activity.
- Whether practice answers are used.
- Whether the warm-up can offer "I cannot read it" and "I cannot see a word" as answers.
- Exactly what WebAble changed for this person. This goes in the reveal on the last page. Since the latest change it no longer narrows the page on phones, and it now simplifies news articles.

---

## 1. The rules, ranked

The rules are ranked by how much they matter for older, less confident people using a phone on their own.

### 1. Use everyday words. Never show study or technical words.
- **Why.** Uncommon words can make text impossible to follow for people with memory or language problems, including dementia. Older readers read every word and take longer to link a rare word to its meaning.
- **Good.** "Make the text bigger or smaller until it is easy to read."
- **Bad (current).** "Finds a text and button size that suit you." / "Stay in this browser until the end." / a button labelled "More contrast".
- **Sources.** https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p01-clear-words/ ; https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/style-guides/a-to-z-style-guide/ ; https://www.nngroup.com/articles/plain-language-experts/ ; https://uxdesign.cc/golden-microcopy-helping-older-users-use-your-product-f0f1b173aa3e

### 2. Put one idea in each sentence. Keep most sentences under 12 words and none over 20.
- **Why.** Readers take in over 90% of the information when sentences average 14 words, and under 10% at 43 words. GOV.UK splits any sentence over 25 words, and NN/g sets 15 to 20 words as the limit for general readers. Lower-literacy readers read word by word. The tighter limit here is our own choice for this audience.
- **Good.** "On each website, look for one fact. Then answer 2 short questions."
- **Bad (current).** "What we record" is a single 45-word sentence joined by 5 semicolons: "Where and when you tap, scroll and zoom on the study pages; how long each website takes…"
- **Sources.** https://insidegovuk.blog.gov.uk/2014/08/04/sentence-length-why-25-words-is-our-limit/ ; https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/ ; https://www.nngroup.com/articles/writing-for-lower-literacy-users/ ; https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p05-succinct-text/

### 3. Ask one question or one decision per page, and make the question the page heading.
- **Why.** It lets people go at their own pace and gives them a small success on each page. It works best on a phone, and screen readers read the question once. GOV.UK starts every form this way.
- **Good.** Heading: "How often do you zoom in to read on your phone?" Then 4 stacked answers, then **Continue**.
- **Bad.** All 10 statements on one page as a grid. Or a page headed "About you" that holds 4 questions.
- **Sources.** https://design-system.service.gov.uk/patterns/question-pages/ ; https://www.gov.uk/service-manual/design/form-structure ; https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/ ; https://www.smashingmagazine.com/2024/02/guide-designing-older-adults/

### 4. Give the instructions as numbered steps before an activity, and keep a one-line version on screen during it.
- **Why.** People with weaker working memory cannot hold several instructions at once. Older users miss hints that disappear, and people do not remember instructions given up front.
- **Good.** Before: "1. Read the sentence. 2. Tap **True** or **False**." During, always visible: "The sentences get smaller each time."
- **Bad.** Instructions in a pop-up that closes when the activity starts.
- **Sources.** https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p09-separated-instructions/ ; https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p07-step-instructions/ ; https://www.nngroup.com/articles/recognition-and-recall/ ; https://uxdesign.cc/golden-microcopy-helping-older-users-use-your-product-f0f1b173aa3e

### 5. Never make people remember something from an earlier page.
- **Why.** Older people recalled 49% of things introduced early in a session, compared with 63% for younger people. Each page must carry everything needed to act on it.
- **Good.** The task sentence is pinned above the website and repeated as the heading of the answer sheet. Every rating page says "1 means very easy. 7 means very hard."
- **Bad.** The meaning of the scale explained once on an intro page. A task shown once and then hidden behind the website.
- **Sources.** https://www.w3.org/WAI/WCAG2/supplemental/patterns/o6p05-low-cognition/ ; https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html ; https://www.nngroup.com/articles/usability-seniors-improvements/ ; https://www.nngroup.com/articles/usability-testing-older-adults/

### 6. Say once, early, that we are testing the websites and not the person. Make "I could not find it" a normal answer.
- **Why.** Older people blamed themselves for problems 90% of the time, compared with 58% for younger people, and they were about twice as likely to give up. Giving them an accepted way out keeps them in the study. Repeating "no pressure" on every page sounds patronising.
- **Good.** On the get-ready page: "We are testing the websites, not you. Some websites are hard to use. That is what we want to find out."
- **Bad.** "Try to get as many right as you can." Or "No pressure!" on every page.
- **Sources.** https://www.nngroup.com/articles/usability-testing-older-adults/ ; https://www.nngroup.com/articles/usability-seniors-improvements/ ; https://www.nngroup.com/articles/unmoderated-usability-testing/ ; https://uxdesign.cc/a-guide-to-interface-design-for-older-adults-31109468d46d

### 7. Use literal words only. No idioms, jokes, praise, exclamation marks or advertising words.
- **Why.** Figurative wording that is meant to make instructions friendlier stops some people finishing the task. Older adults trust cute copy less. These are also the words that make text sound machine-written.
- **Good.** "The warm-up has 2 parts. First you read some text. Then you tap some dots."
- **Bad.** "Let's warm up! Time to stretch those eyes before we dive in." Also (current): "on busy reading pages a clean, simple page".
- **Sources.** https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p04-literal-language/ ; https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/right-tone/ ; https://www.nngroup.com/articles/better-usability-tasks/ ; https://uxdesign.cc/golden-microcopy-helping-older-users-use-your-product-f0f1b173aa3e

### 8. Use one word for one thing and one label for one action, everywhere.
- **Why.** Giving the same function different labels on different pages fails WCAG 3.2.4 (failure F31). Readers who cannot scan treat a new word as a new instruction.
- **Good.** "Skip this question" on every rating and statement page. "Skip this website" only where a whole website is skipped. **Continue** on every question page.
- **Bad (current).** "Skip this one" is used for skipping a website on one page and skipping a statement on another. "Next" appears on statements but "Continue" everywhere else.
- **Sources.** https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html ; https://www.w3.org/WAI/WCAG2/supplemental/patterns/o1p03-consistent-design/ ; https://www.nngroup.com/articles/writing-for-lower-literacy-users/

### 9. Refer to a button by its exact words, in bold. Never by colour, shape or position, and never say "click".
- **Why.** Colour and position change with phone size and text size, and people with poor sight or a screen reader cannot follow them.
- **Good.** "When you find it, tap **Answer**."
- **Bad.** "Tap the blue button at the bottom when you are done."
- **Sources.** https://www.gov.uk/service-manual/design/writing-for-user-interfaces ; https://styleguide.mailchimp.com/writing-for-accessibility/ ; https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/style-guides/a-to-z-style-guide/

### 10. Button labels say what happens. Use **Continue** on question pages and a named action where a new part starts.
- **Why.** GOV.UK uses "Continue", not "Next". NN/g found that generic labels do not tell people what comes next. Older users are less willing to tap a button just to find out what it does. Use 1 main button per page.
- **Good.** "Start now", "I agree to take part", "Start the warm-up", "Open the website", "Start round 2", "Send my answers".
- **Bad.** "Next", "Submit", "Proceed", "Let's go", "Got it", or an arrow on its own.
- **Sources.** https://design-system.service.gov.uk/components/button/ ; https://www.nngroup.com/articles/wizards/ ; https://uxdesign.cc/golden-microcopy-helping-older-users-use-your-product-f0f1b173aa3e

### 11. Before people start, tell them how long it takes, what they will do, what to have ready, and that there is no time limit.
- **Why.** People need this to decide whether to start and to plan their time. When people fail, it is often because nobody told them what they would need.
- **Good.** "This takes about 25 minutes. There is no time limit." Then the 6 parts as a numbered list, then "You need: …"
- **Bad.** "This quick study won't take long. Let's get started!"
- **Sources.** https://design-system.service.gov.uk/patterns/start-using-a-service/ ; https://www.w3.org/WAI/WCAG2/supplemental/patterns/o5p04-task-expectations/ ; https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p09-data-loss/ ; https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/

### 12. Show where people are. The bar shows the part, a caption shows the count inside it, and a plain line says when a part ends.
- **Why.** Knowing how much is left helps people judge whether they can finish, and helps them find their place again after a distraction.
- **Good.** Bar label: "Part 4 of 6: Round 1". Caption: "Website 2 of 3". At the end of a part: "Round 1 is finished. Next: a short break."
- **Bad.** "43% complete", "Almost there!", or jumping to the next part without saying so.
- **Sources.** https://www.w3.org/WAI/WCAG2/supplemental/patterns/o1p04-clear-steps/ ; https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p10-status-feedback/ ; https://www.nngroup.com/articles/wizards/ ; https://design-system.service.gov.uk/patterns/question-pages/

### 13. Write each website task as a real goal with exact details and no route to follow.
- **Why.** If a task uses the website's own labels, it tests word matching, not finding. Listing steps removes the difficulty we are measuring and makes the two rounds harder to compare. A vague task leaves people unsure, and with nobody to ask, they guess.
- **Good.** "Find out what time the Convoy Point grounds close each day."
- **Bad.** "Tap Plan Your Visit, then Hours, and look at the closing time." Or "How would you find the opening hours?"
- **Sources.** https://www.nngroup.com/articles/task-scenarios-usability-testing/ ; https://www.nngroup.com/articles/better-usability-tasks/ ; https://userbrain.com/blog/write-better-tasks-to-improve-usability-testing

### 14. Do not hint at what we hope to find. Describe WebAble in neutral words, and do not say which round used it until the last page.
- **Why.** Leading wording biases answers. People taking part want to please the researchers. Praising WebAble before the rounds would push ratings up; this point is our inference from NN/g's guidance on leading questions.
- **Good.** "In one round, the websites are shown through WebAble, a program we are testing. In the other round, they look as they normally do. We will tell you which was which at the end."
- **Bad.** "WebAble makes websites easier for you." Or, in the last questions: "Why were the websites without WebAble harder?"
- **Sources.** https://www.nngroup.com/articles/leading-questions/ ; https://www.nngroup.com/articles/better-usability-tasks/ ; https://www.nngroup.com/articles/unmoderated-usability-testing/

### 15. On a rating page, the question uses the same words as the scale ends, and the direction never changes.
- **Why.** If the question says "difficult" and the label says "hard", people have to translate between them. The study uses 2 scales that run in opposite directions, so the words must be visible every time.
- **Good.** "How easy or hard was it to find the answer?" Hint: "1 means very easy. 7 means very hard." 1 is labelled "Very easy" and 7 "Very hard".
- **Bad (current).** "How easy or difficult was it to complete this task?" with the labels "Very easy" and "Very hard".
- **Sources.** https://www.pewresearch.org/writing-survey-questions/ ; https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p13-numerical-alternatives/ ; https://measuringu.com/reversing-seq-endpoints-means/

### 16. Give every question an honest way out, placed last after the word "or".
- **Why.** Answer options must cover every real answer. Forcing a guess gives bad data and makes people feel they have failed. People cannot clear a radio button once they have picked one.
- **Good.** 4 times, then "or", then "I could not find it". On personal questions: "Prefer not to say".
- **Bad.** No way out at all. Or "Can't find / N/A" as the second option. Or a small grey link under the real options.
- **Sources.** https://design-system.service.gov.uk/components/radios/ ; https://www.gov.uk/service-manual/design/designing-good-questions ; https://www.pewresearch.org/writing-survey-questions/

### 17. Under each personal question, say why we ask it in one short hint with no full stop.
- **Why.** Older adults are wary of giving personal details. A concrete reason lowers that worry.
- **Good.** "We ask this to compare results between age groups"
- **Bad.** No reason at all. Or "This helps us tailor your experience."
- **Sources.** https://design-system.service.gov.uk/patterns/question-pages/ ; https://design-system.service.gov.uk/patterns/equality-information/ ; https://uxdesign.cc/golden-microcopy-helping-older-users-use-your-product-f0f1b173aa3e

### 18. Use the active voice and the present tense. The study is "we", the reader is "you", and answers the reader picks say "I".
- **Why.** The active voice shows who does what. Passive sentences hide it and are harder to trust.
- **Good.** "We do not record your name." Option: "I could not find it".
- **Bad.** "No personally identifiable information will be collected."
- **Sources.** https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p02-simple-tense/ ; https://www.gov.uk/service-manual/design/writing-for-user-interfaces ; https://digital.gov/guides/plain-language/writing

### 19. Write negatives in full and say things positively. No double negatives and no "if anything" asides.
- **Why.** "Can't" and "don't" are easy to misread as their opposite. Nested clauses are hard to follow.
- **Good.** "You cannot go back to a website after you answer." / "Did the 2 rounds feel different?", then "What was different? (optional)"
- **Bad (current).** "What, if anything, was different between the two rounds?" / "Where, if anywhere, did you have trouble?"
- **Sources.** https://www.gov.uk/service-manual/design/writing-for-user-interfaces ; https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p03-double-negatives/ ; https://www.pewresearch.org/writing-survey-questions/

### 20. Error messages say what to do, in the question's own words, with no blame, no "please" and no "sorry".
- **Why.** Older users often miss error messages or take them as a sign they have failed. A specific fix keeps them going.
- **Good.** "Choose a number from 1 to 7, or tap **Skip this question**."
- **Bad (current).** "You didn't choose a number. Tap 'Skip this one' again to go on without one."
- **Sources.** https://design-system.service.gov.uk/components/error-message/ ; https://www.nngroup.com/articles/usability-for-senior-citizens/ ; https://www.smashingmagazine.com/2024/02/guide-designing-older-adults/

### 21. Say what a choice does before people tap it, and do not move on until they tap Continue.
- **Why.** A page that moves on its own makes people with shaky hands tap the wrong thing. Right now the ease rating and the answer sheet move on the moment something is touched. One shaky tap records a wrong answer that cannot be fixed. This is a change for the developer as well as the writer.
- **Good.** The number they tap stays highlighted until they tap **Continue**. In the leave dialog: "If you delete your answers, we cannot get them back."
- **Bad (current).** The ease rating saves and moves on as soon as a number is touched.
- **Sources.** https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p01-unexpected-movement/ ; https://www.w3.org/WAI/WCAG2/supplemental/patterns/o7p03-supported-choice/ ; https://design-system.service.gov.uk/components/radios/

### 22. Before anything changes by itself, say what will happen, how long it takes, and whether Back works.
- **Why.** Content should move only when the user makes it move. When it cannot, people need to know in advance.
- **Good.** "The dots appear one at a time in different places. There are 20 dots. This takes about 1 minute. You cannot go back during this part."
- **Bad.** Dots start appearing with no warning.
- **Sources.** https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p01-unexpected-movement/ ; https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p02-back-undo/ ; https://www.w3.org/WAI/WCAG2/supplemental/patterns/o5p04-task-expectations/

### 23. On the agreement page, give every required fact in short headed sections, then a "yes" in the reader's own words and an obvious "no".
- **Why.** Agreement counts only if people understand what they are agreeing to. GOV.UK lists the facts they must be given. For online research, it asks for a positive "yes" after the information.
- **Good.** Sections headed "What you will do", "What we record" and so on, each 3 sentences or fewer or a short list. Then the button "I agree to take part" and a link "I do not want to take part".
- **Bad (current).** "What we record" written as one 45-word sentence, and a small "I'm 18 or older" checkbox as the only way to confirm.
- **Sources.** https://www.gov.uk/service-manual/user-research/getting-users-consent-for-research ; https://dfedigital.blog.gov.uk/2025/07/16/creating-3-principles-of-informed-consent-for-user-research ; https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p05-succinct-text/

### 24. Show the deletion code large, say what it is for, and tell people to write it down or take a photo of it.
- **Why.** Do not make people memorise or copy strings without prompting them. Long codes are hard to copy correctly for someone with a tremor and poor sight.
- **Good.** "Your code: K7M4. You need this code if you want us to delete your answers. Write it down or take a photo of this screen."
- **Bad (current).** "Keep it if you later want your answers deleted." This appears when no contact email is set, so it gives no way to use the code.
- **Sources.** https://www.w3.org/WAI/WCAG2/supplemental/patterns/o6p05-low-cognition/ ; https://www.w3.org/WAI/people-use-web/user-stories/story-nine/ ; https://design-system.service.gov.uk/patterns/confirmation-pages/

### 25. Put a short help line with a contact address on every page.
- **Why.** Nobody is there to ask, and anything that can be misunderstood will be. A way to reach a person must be easy to find at every step.
- **Good.** "Questions? Email study@example.edu"
- **Bad.** The contact address appears only inside the agreement text.
- **Sources.** https://www.w3.org/WAI/WCAG2/supplemental/patterns/o7p01-human-help/ ; https://www.nngroup.com/articles/remote-usability-tests/

---

## 2. Words and phrasings

### 2.1 One word for one thing

| Thing | Always write | Never write |
|---|---|---|
| Pressing a button | tap | click, press, hit, select |
| Picking an answer | choose | select, pick, indicate, rate |
| The 7 test websites | website, websites | site, page, web page, copy, replica, app, interface |
| The study's own page | this page | screen, app, browser, tab |
| The phone's glass | screen (only for "take a photo of this screen") | display |
| Being hard to do | hard | difficult, challenging |
| What they choose | answer | response, input, selection |
| About-you and last questions | question | item, field |
| The 10 agree/disagree lines | statement | item, question, survey |
| Our software | WebAble, "a program we are testing" | AI, extension, tool, app, adaptation, the system |
| Holding the phone | upright, sideways | portrait, landscape, orientation |

### 2.2 Plain swaps

| Instead of | Write |
|---|---|
| participant, user | you (or "people taking part") |
| task, complete the task | find, find out, look for |
| session | the study |
| condition, adapted condition | round, "the round with WebAble" (only on the last page) |
| adaptation, adapted, tailored | changed |
| calibration, fitting, measurement | warm-up |
| stimulus, sample text | the word, the sentence, the text |
| demographics | about you |
| questionnaire, SUS, survey | 10 statements |
| Likert scale, SEQ | choose a number from 1 to 7 |
| replica, snapshot, saved copy | copies of real websites. We saved them so everyone sees the same thing. |
| font, type size | text, size of the text |
| contrast | how dark the text is, lighter, darker |
| browser | this page |
| device | phone |
| browsing | using websites |
| approximately | about |
| assist | help |
| begin, commence | start |
| proceed | continue, go on |
| withdraw | stop taking part, leave the study |
| request deletion of your data | ask us to delete your answers |
| data | your answers, what we record |
| de-identified, anonymised | We do not record your name. |
| retention | how long we keep your answers |
| voluntary | your choice |
| consent, informed consent | agree to take part |
| eligible | can take part |
| staffed (current task wording) | open, or what the page actually says |
| frequently (outside the statements) | often |
| prior to | before |
| in order to | to |

### 2.3 Button and link labels

Each page has one main button. Any second action is a plain link written in full.

| Page | Main button | Other links |
|---|---|---|
| Welcome | Start now | |
| Agreement | I agree to take part | I do not want to take part |
| About you (each question) | Continue | Back |
| Get ready | Start the warm-up | Back |
| Warm-up instruction page | Start | Skip the warm-up |
| Text size | This size is comfortable | Make text bigger, Make text smaller (2 buttons the same size) |
| True or false | True, False | I cannot read it |
| Which word | the 4 words, one per row | I cannot see a word |
| Light or dark page | The light page, The dark page | |
| End of warm-up | Go to the practice website | |
| Website task page | Open the website | Skip this website |
| While on a website | Answer | Pause |
| Answer sheet | Continue | Go back to the website |
| Ease rating | Continue | Skip this question |
| Start of a round | Start round 1, Start round 2 | |
| Statements intro | Continue | |
| Each statement | Continue | Skip this question |
| Break | Start round 2 | |
| Last questions | Continue, and "Send my answers" on the last one | Skip this question |
| Paused | Go back to the website | Skip this website, Leave the study |
| Leave dialog | No, stay in the study | Leave and keep my answers, Leave and delete my answers |
| Header | Leave | |
| Slow website | Try again | Skip this website |

Never use these labels: Next, Submit, Proceed, OK, Done, Go, Got it, Begin, Get started, Let's go, or an arrow or tick on its own.

### 2.4 Names for the parts of the study

Use these exact names in the bar, on the welcome page and in the text. The code already has the same 6 parts (`PARTS` in `shell/ui.tsx`).

| Bar segment | Bar label | What it covers | How to describe it the first time |
|---|---|---|---|
| 1 | Getting started | welcome, agreement, 4 questions about you, get ready | "Answer 4 questions about you." |
| 2 | Warm-up | reading activities, tapping dots | "Read some text and tap some dots." |
| 3 | Practice | one practice website | "Try one website for practice." |
| 4 | Round 1 | 3 websites and 10 statements | "Find one fact on each of 3 websites. Then answer 10 short statements." |
| 5 | Round 2 | break, 3 websites and 10 statements | "The same again with 3 different websites." |
| 6 | Last questions | final questions | "Answer a few last questions." |
| (all filled) | Finished | thank-you page | |

The label under the bar reads "Part 4 of 6: Round 1". Captions inside a part read "Question 2 of 4", "Website 2 of 3" and "Statement 3 of 10".

### 2.5 Numbers, dates and punctuation

- Write "one" in words. Use digits for 2 and over: "3 websites", "10 statements", "about 25 minutes".
- Use "to" for ranges ("20 to 25 minutes"), not a dash or "~".
- Write the month of a date in words: "30 November". Never "30/11".
- Write answer options for times, prices and temperatures exactly as the website shows them, so nobody has to convert anything. List them from lowest to highest.
- Use sentence case for every heading, button and label. Never capitals for emphasis, never italics, and no colon at the end of a label.
- Bold is only for button names inside instructions: "tap **Answer**".
- Do not use "e.g.", "i.e.", "etc.", "&", or "/" to mean "or".
- In text people read, do not use em dashes, semicolons or brackets. Split the sentence instead. "(optional)" in a question label is the one exception.
- No exclamation marks and no emoji.
- Do not use negative contractions ("can't", "don't", "won't", "couldn't"). Positive ones such as "you'll" are allowed, but the full form is clearer in instructions.

### 2.6 Words and habits that sound machine-written

None of these appear on any page.

**Words.** delve, dive in, journey, seamless, effortless, experience (meaning "using something"), tailored, personalised, empower, unlock, elevate, enhance, leverage, utilise, robust, streamline, crucial, key (as an adjective), comprehensive, game-changer, transform, ensure, foster, navigate (meaning "deal with"), landscape, realm, testament, moreover, furthermore, additionally, "in order to", "it is worth noting", "please note", "rest assured", "don't worry", "no worries", "you're all set", "hang tight", "quick check-in", "awesome", "great job", "well done", "almost there", "Let's …", "Here's what you need to know", "simply", "just" (as in "just tap"), "quick" and "easy" when describing our own steps.

The last few ("simply", "just", "quick", "easy") are our inference from the advice not to talk down to people. If a step feels hard to someone, calling it "easy" tells them they failed.

**Habits.**
- Contrasts written as "It's not X. It's Y." or "not just X, but Y". A plain "We are testing the websites, not you" is fine because that is the actual point.
- Listing things in threes for rhythm ("quick, easy and stress-free"). Give the real number of things, or a fact.
- Opening lines that warm up to the point ("Before we begin, here's a quick overview…") and closing lines that sum up ("In short, just tap the dots!"). Start with the instruction.
- Praise after a step ("Great choice!"). End a part with a plain fact: "Round 1 is finished."
- Reassurance repeated on several pages, or promises in place of facts ("Your privacy is our top priority"). State the fact once: "We do not record your name."
- Vague benefit statements ("WebAble makes the web work better for you"). Say what changed: "It made the text bigger."
- Talking about the software as if it were a person ("WebAble wants to help").
- Phrases that look meaningful but say nothing (current: "Nothing counts while you're paused", "Nothing happens to you either way"). Say the concrete fact: "The time you spend paused is not counted."
- Lists made of bold labels followed by fragments, and paragraphs that are all the same length.

Read every page out loud before you finish it. If you would not say a sentence to a neighbour, rewrite it.

---

## 3. Patterns for each kind of page

Every page has the same frame, in this order:

1. A thin progress line across the top of the screen, with no words.
2. Header, with **Leave** on the right (except on the welcome, agreement and thank-you pages).
3. **Back**, where going back is allowed.
4. Caption, which is the count inside the part ("Website 2 of 3").
5. Heading.
6. Body.
7. Main button, then any link.
8. Help line: "Questions? Email [address]".

The browser tab title copies the heading: "How old are you? – WebAble study". When a page has an error, the title starts with "Error: ". Never put answers in the title or the address.

Below, square brackets mark facts to fill in. Do not invent them.

### 3.1 Start page (welcome)

Structure: heading → purpose in one sentence → time and no time limit → what you will do (numbered, matching the bar) → what you need → who can take part → main button.

```
Part 1 of 6: Getting started

Help us test websites on phones

We are a team at [university]. We want to find out what makes websites easy or hard to use on a phone.

This study is for people aged 50 or over who often have trouble using websites.

This takes about [25] minutes. There is no time limit.

What you will do
1. Answer 5 questions about you.
2. Warm-up. Read some text and tap some dots.
3. Try one website for practice.
4. Round 1. Find one fact on each of 3 websites.
5. Round 2. The same again with 3 different websites.
6. Answer a few last questions.

You need
• your phone, held upright
• your glasses, if you use them to read
• a quiet place where nobody will interrupt you

[Start now]

Questions? Email [address]
```

Do not mention WebAble here; the agreement page explains it. Do not say "quick" or "easy". Keep the welcome page free of the reasons for the study beyond one sentence.

### 3.2 Agreement page (consent)

Structure: heading → short sections in this order → declaration → button "I agree to take part" → link "I do not want to take part". Each section is 3 short sentences or a short bulleted list. Everything GOV.UK requires is included.

```
Part 1 of 6: Getting started

Before you agree to take part

Who is doing this study
[Team] at [university] is doing this study. [Ethics approval reference.]

What you will do
You look for one fact on 7 websites. Then you answer some questions. It takes about [25] minutes.
In one round, the websites are shown through WebAble, a program we are testing. In the other round, they look as they normally do. We will tell you which was which at the end.

The websites are copies
We saved copies of real websites so everyone sees the same thing. Links on them are turned off. You will not sign in, buy anything or type personal details.

What we record
• your answers
• how long each website takes you
• where you tap, scroll and zoom on our pages
• the text size you choose in the warm-up
• your phone's screen size and display settings
• your age group

What we do not record
• your name
• anything you type on the websites
• pictures or recordings of your screen
• where you are

Who sees your answers
Only the study team. We store your answers under a code, not your name. We keep them for [time].

Risks
Some websites may be tiring to read. You can take a break at any time.
There is no payment.

Taking part is your choice
You can stop at any time. You do not have to give a reason. To stop, tap Leave at the top of the page.

Deleting your answers
At the end you get a code. Email us that code [before 30 November] and we will delete your answers.

Questions or complaints
Email [address]. To complain, contact [ethics office and address].

By tapping I agree to take part, you confirm that:
• you are 50 or over
• you have read this page
• you want to take part

[I agree to take part]
I do not want to take part
```

The "I do not want to take part" link goes to a page that says: "You have chosen not to take part. We have not recorded anything. You can close this page."

Do not use: "consent form", "terms", "voluntarily", "de-identified", "data controller", "retention", "withdraw", or a ticked-by-default box.

Note on time: telling people we record time may make some of them hurry. GOV.UK still requires us to say what we record. Say it once here, and say "There is no time limit" on the welcome page and the get-ready page.

If the study might recruit anyone who cannot agree on their own, GOV.UK says a carer or responsible adult must also agree. Decide how to handle that before launch.

### 3.3 One-question page (about you, last questions)

Structure: caption with the count → the question as the heading → one-line hint saying why we ask (no full stop) → stacked answers with nothing chosen in advance → "or" → "Prefer not to say" → **Continue**.

```
Part 1 of 6: Getting started
Back

Question 2 of 4
How often do you zoom in to read on your phone?
We ask this to compare results between people

( ) Never
( ) Sometimes
( ) Often
( ) Almost always
or
( ) Prefer not to say

[Continue]
```

- A personal question gets "Prefer not to say" and no separate skip link. Rating and statement pages get the link "Skip this question".
- For a question about how they hold the phone (current wording: "Please hold it the same way the whole time"), write: "Hold it the same way until the end."
- For an open question, put "(optional)" in the heading and the hint "Do not include names". Never put placeholder text inside the box (current: "Anything to add (optional)").
- Split double questions. Instead of "What, if anything, was different between the two rounds?", ask "Did the 2 rounds feel different?" with the answers "Yes", "No" and "I am not sure". If they answer "Yes", ask "What was different? (optional)".
- If nothing is chosen when they tap **Continue**, show "There is a problem" at the top, and next to the question: "Choose how often you zoom in, or choose Prefer not to say". Never grey out **Continue**.

### 3.4 Get ready (before the warm-up)

This is the one page that says "we are testing the websites, not you". Do not repeat that line elsewhere.

```
Part 1 of 6: Getting started

Get ready

1. Hold your phone upright, the way you usually do.
2. Put on your glasses if you use them to read.
3. Sit somewhere quiet.

Keep this page open until the end. You can pause on any website.

We are testing the websites, not you. Some websites are hard to use. That is what we want to find out.

There is no time limit.

[Start the warm-up]
```

The current text "Turning on Do Not Disturb helps" names a phone setting that many people cannot find. Leave it out.

### 3.5 Instruction page before a warm-up activity

Structure: caption → a heading that names the activity as an instruction → one sentence on what happens → numbered steps → one example with the right answer, where the activity is new → how long it takes, and whether Back works → **Start**. During the activity, the heading becomes the question and one instruction line stays on screen.

**Text size**
```
Warm-up: reading
Make the text a comfortable size

You will see some sample text.
1. Tap Make text bigger or Make text smaller.
2. Stop when you can read the text easily.
3. Tap This size is comfortable.

[Start]
```
During the activity, use two large buttons, "Make text bigger" and "Make text smaller", then **This size is comfortable**. Do not use a slider.

**True or false**
```
Warm-up: reading
Read short sentences

1. Read the sentence.
2. Tap True or False.
The sentences get smaller each time. If you cannot read one, tap I cannot read it.

Example: "Fish live in water." This is true, so you would tap True.

This takes about 1 minute.
[Start]
```
During the activity: heading "Is this sentence true or false?". Instruction line: "The sentences get smaller each time." Buttons: **True** and **False** side by side, then "I cannot read it" on its own row.

**Fading word** (the page that is broken on phones)
```
Warm-up: reading
Find the word

You will see a word. It gets lighter each time.
1. Look at the word.
2. Tap the same word in the list below it.
If you cannot see a word, tap I cannot see a word.

[Start]
```
During the activity: heading "Which word can you see?". Instruction line: "The word gets lighter each time." Show the 4 words as full-width buttons stacked one per row, each at least 48px tall with about 12px between them, in large text. Then "or", then "I cannot see a word" at the same size. Never a 2 by 2 grid or a wrapping row. If the "More contrast" button stays, rename it to say what it does, for example "Make the word darker".

**Light or dark page**
```
Warm-up: reading
Compare a light page and a dark page

You will read the same text on a light page and on a dark page. Then choose the one that was easier to read.

[Start]
```
Question: "Which page was easier to read?" Answers: "The light page", "The dark page", "No difference" (add the last only if the analysis allows it).

**Dots**
```
Warm-up: tapping
Tap the dots

Dots appear one at a time in different places on the screen.
Tap each dot as soon as you see it.
There are [20] dots. This takes about 1 minute.
You cannot go back during this part.

[Start]
```

**End of the warm-up**
```
The warm-up is finished.
Next: one practice website.
[Go to the practice website]
```
The current text is "That's the warm-up done." Replace it with the wording above.

### 3.6 Start of a round

Use an interruption-style page only at the start of each round and at the break. Use them sparingly, because people stop reading them.

```
Part 4 of 6: Round 1

Round 1

You will see 3 websites. On each one, look for one fact.
After each website, tell us how easy or hard it was.

[Start round 1]
```

### 3.7 Website task

**Task page (before the website opens).** Structure: caption → the task as the heading (a "Find out…" sentence) → at most one sentence of context → numbered steps → a note about links → **Open the website** → "Skip this website".

```
Part 4 of 6: Round 1

Website 2 of 3
Find out what time the Convoy Point grounds close each day

1. Look for the answer on the website, the way you usually would.
2. When you find it, tap Answer.
3. If you cannot find it, tap Answer and choose I could not find it.

Links on this website are turned off. That is normal.

[Open the website]
Skip this website
```

**While on the website.** A thin strip stays fixed above the website. It shows the same sentence, "Find out what time the Convoy Point grounds close each day", with **Answer** and **Pause**. Never hide the task.

**Practice website.** The caption is "Practice". Add one line: "This one is for practice. [We do not use this answer.]" Only add the second sentence if it is true.

**If the website is slow.** "This website is taking a long time to open." Button: **Try again**. Link: "Skip this website". Do not show a greyed-out button with "Getting the website ready…". Use a plain line of text instead: "The website is opening."

**Writing the task sentence.**
- Start with "Find out". Give the exact detail (day, place, year). Name things the way the article does if it needs a name to be specific. Never use the website's own menu, button or heading words.
- Do not tell people to scroll, search, zoom or use the menu.
- Use at most one sentence of context. Do not mention family members, money worries, health, religion or politics. Do not use jokes or joke names.
- Do not use dates that move. These are saved copies, so "this weekend" or "on Friday" may not match the reader's calendar. Fix the date in the sentence instead.

How the current task sentences should change:

| Current | Problem | Rewrite |
|---|---|---|
| How many days will the little rover, Idefix, spend driving around Phobos? | Name set off by commas, and "little" adds nothing | Find out how many days the rover Idefix will spend driving on Phobos |
| What year did Kim, who led the study, travel to France to look at the night sky? | Clause in the middle, and "study" will be confused with our study | Find out what year Kim went to France to look at the night sky |
| How warm will it get in Gainesville on Friday? | "Friday" depends on the date the page was saved | This weather forecast was saved on [day month]. Find out how warm it will get on Friday |
| Until what time is the Everglades park entrance staffed each day? | "Until what time" and "staffed" | Find out what time [the park entrance closes] each day (check against what the page says) |
| What was the score when Florida played Kentucky in 1990? | Fine as a question | Find out the score when Florida played Kentucky in 1990 |

### 3.8 Answer sheet

Structure: the task as a question heading, using the same words as the task sentence → the 4 answers stacked full width, nothing chosen in advance, lowest to highest → "or" → "I could not find it" at the same size → **Continue** → "Go back to the website".

```
What time do the Convoy Point grounds close each day?

( ) 4:30 p.m.
( ) 5:00 p.m.
( ) 5:30 p.m.
( ) 6:00 p.m.
or
( ) I could not find it

[Continue]
Go back to the website
```

Write "I could not find it", not "I couldn't find it". "Go back to the website" says more than "Keep looking" (current) about where the link takes them. Picking an answer must not send it. Only **Continue** sends it.

### 3.9 Rating question, 1 to 7

**Ease rating, after each website**
```
Website 2 of 3
How easy or hard was it to find the answer?
1 means very easy. 7 means very hard.

[1] Very easy
[2]
[3]
[4]
[5]
[6]
[7] Very hard

[Continue]
Skip this question
```

- On a phone, stack the 7 options with 1 at the top. Each row is full width and at least 48px tall. A single row of 7 is acceptable only if every number is at least 44 by 44px and the words sit under 1 and 7. A 375px phone with 16px side margins only just fits this.
- Keep the numbers. Label only the two ends. Use the same layout on all 7 ease ratings, including the practice one.
- The tapped number stays highlighted with a tick. Nothing moves until **Continue** is tapped.
- If nothing is chosen: "Choose a number from 1 to 7, or tap **Skip this question**".

**The 10 statements, after each round.** Start with an intro page:
```
Part 4 of 6: Round 1

10 statements about round 1

These are about the 3 websites you just used:
• [website name 1]
• [website name 2]
• [website name 3]

For each statement, choose how much you agree.
1 means strongly disagree. 7 means strongly agree.

[Continue]
```
Then one page per statement:
```
Statement 3 of 10
I thought these websites were easy to use.
1 means strongly disagree. 7 means strongly agree.

[1] Strongly disagree
…
[7] Strongly agree

[Continue]
Skip this question
```

The agree scale and the ease scale run opposite ways. On the ease scale the good end is 1. On a positive statement the good end is 7. That is why the end words must appear on every page, and why the hint line is worded the same way every time. For the statement wording itself, see 4.3.

### 3.10 Pause and leave dialogs

These open only when the person taps **Pause** or **Leave**. Never open one on its own.

**Paused (on a website)**
```
You have paused this website

There is no time limit. The time you spend paused is not counted.

[Go back to the website]
Skip this website
Leave the study
```
Current text: heading "Paused", body "Nothing counts while you're paused".

**Leave**
```
Do you want to leave the study?

You can stop at any time. You do not have to give a reason.

[No, stay in the study]
Leave and keep my answers
Leave and delete my answers
If you delete your answers, we cannot get them back.
```
Current text: "Nothing happens to you either way." Cut it.

**After leaving**
- Answers kept: "You have left the study. We have kept your answers so far. Your code is [K7M4]. You can close this page."
- Answers deleted: "You have left the study. We have deleted your answers. You can close this page."

**Phone held sideways**: "Turn your phone upright to carry on." Do not use "please".

### 3.11 Round break

```
Part 5 of 6: Round 2

Round 1 is finished

Take a break if you want. There is no time limit.

Round 2 has 3 different websites. It works the same way as round 1.

[Start round 2]
```
Current text: "Take a break if you'd like. Round 2 has three different websites, and works the same way." Write "3", and repeat "round 1" so it is clear what "the same way" refers to.

### 3.12 Thank-you page

Structure: a panel stating the outcome → whether the answers are saved → the code with what to do with it → which round used WebAble and what it changed → that the websites were copies → one thank-you sentence → contact → "You can close this page." Keep links and buttons out of the panel.

```
Finished

You have finished the study
Your answers are saved.

Your code
K 7 M 4
You need this code if you want us to delete your answers.
Write it down or take a photo of this screen.
To delete your answers, email [address] with this code [before 30 November].
[Copy code]

Which round used WebAble
Round 2 used WebAble. It made the text the size you chose in the warm-up. It made the buttons bigger. On the news websites, it showed a simpler version of the article.
In round 1, the websites looked as they normally do.

The websites were copies we saved, so everyone saw the same pages.

Thank you for taking part.

Questions? Email [address]
You can close this page.
```

- Describe only the changes that actually happened for this person. Do not mention narrowing the page.
- Use a short code with no characters that look alike (no 0 and O, no 1, l and I). Spacing the characters out makes it easier to copy.
- Current text: heading "Thank you.", with "All done" above it. Make the heading the outcome. The thanks goes in the body.
- If saving is still in progress: "We are still saving your answers. Keep this page open." If it fails: "Your answers have not been sent yet. Keep this page open. We will try again."

---

## 4. The evidence on 4 questions

### 4.1 Progress indicators and step counts

What the sources say:
- **GOV.UK.** Test with no indicator first, and fix the order or number of questions before adding one. If people still struggle, add a simple text caption such as "Question 3 of 9". Show a total only if it can be counted reliably. Never use an indicator that does all 3 of these: shows every step, lets people jump between steps, and shows the current step. Such indicators are often missed, fit badly on small screens and confuse some users. The Carer's Allowance team removed a 12-step indicator and completion did not change. That team's own blog post could not be found. https://design-system.service.gov.uk/patterns/question-pages/
- **W3C COGA.** In a multi-step process, show which steps are done, which is current and which are to come. Mark done steps with a tick and make the name of the next step easy to see. Keep the indicator in the same place and the same order on every page. Do not show status by colour alone (WCAG 1.4.1). https://www.w3.org/WAI/WCAG2/supplemental/patterns/o1p04-clear-steps/ ; https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p10-status-feedback/ ; https://www.w3.org/WAI/WCAG22/Understanding/location.html ; https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html
- **NN/g.** Show all steps from the start, highlight the current one, and say how many there are. A step count lets people estimate the time left better than a percentage does. Bars that stall or jump frustrate people. Step indicators usually sit across the page, above the content. https://www.nngroup.com/articles/wizards/ ; https://www.nngroup.com/articles/progress-indicators/ ; https://www.nngroup.com/articles/navigation-you-are-here/ ; https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/
- **Practitioners.** Working memory declines with age, so show progress and remind people of the goal. https://www.smashingmagazine.com/2015/02/designing-digital-technology-for-the-elderly/ ; https://uxdesign.cc/a-guide-to-interface-design-for-older-adults-31109468d46d

What the study uses (the owner's decision, 28 Oct 2026). One thin line runs across the top of the screen, above the header, and fills in ink as the study goes. It has no segments and no words under it. This is close to GOV.UK's default of no indicator, so the work of saying where the person is falls on the caption above each heading:
1. The line fills by part (6 equal shares, as in 2.4) and by question inside a part, so it never jumps back.
2. Nothing in it can be tapped.
3. A screen reader hears "Part 4 of 6: Round 1" from it. Nothing visible depends on it.
4. Every page's caption says where the person is: "Warm-up, activity 2 of 5", "Round 1, website 2 of 3", "Question 3 of 6".
5. There are no percentages and no "Almost there".

The pilot should check that people still know which part they are in.

### 4.2 Running the ease scale from 1 = very easy to 7 = very hard

What the evidence says:
- The standard Single Ease Question runs the other way: 1 = very difficult, 7 = very easy. Its direction has been flipped before. In 2009 "very easy" was on the left. https://www.nngroup.com/articles/quant-ux-glossary/ ; https://measuringu.com/evolution-of-seq/
- MeasuringU tested both directions with 301 people in an unmoderated study. The averages were the same (a difference of 0.05, p = .80). https://measuringu.com/reversing-seq-endpoints-means/
- The spread of answers was not the same. On the hard task, the share choosing the "very easy" end differed by 9.9 points (p = .01). https://measuringu.com/reversing-seq-endpoints-response-distributions/
- Which direction people prefer is unclear. One write-up says that among people with a preference, "very easy on the left" was preferred almost 2 to 1. A later summary reports 29% preferring the standard order, 18% the reversed order and 53% no preference. https://measuringu.com/evaluation-of-three-seq-variants/
- The bias towards the left side of a scale is small, about 0.2 to 0.3 of a point on a 5-point scale. It affects both rounds equally, so comparisons inside the study are safe. https://measuringu.com/left-side-bias/ ; https://measuringu.com/rating-scale-best-practices-8-topics-examined/
- Keep the numbers on the scale. Numbered versions were preferred about 2 to 1. Labelling only the two ends gave the same averages as labelling every point. https://measuringu.com/evaluation-of-three-seq-variants/ ; https://measuringu.com/labeling-scales/

Conclusion: the owner's direction is defensible. Conditions:
1. Use the same direction on every ease rating, including the practice.
2. Compare the WebAble round with the other round inside this study.
3. Before comparing with published SEQ figures, recode each score as 8 minus the score. Do not compare the share of 1s with published "top-box" benchmarks.
4. Record the reversal in the protocol.

How to label it: the question is "How easy or hard was it to find the answer?". "Easy" comes first because 1 is easy. Put "Very easy" beside 1 and "Very hard" beside 7. Add the line "1 means very easy. 7 means very hard." on every rating page.

No study has tested "hard" against "difficult". MeasuringU found that small changes to the question wording made no difference, and "hard" is the more common word. https://www.pewresearch.org/writing-survey-questions/

The risk to manage: the 10 statements run from 1 = strongly disagree to 7 = strongly agree. On a positive statement the good answer is 7, but on the ease scale it is 1. The words on every page are the fix. Check in the pilot that nobody mixes them up.

### 4.3 Changing the System Usability Scale wording

Current state: `experiment/sus.ts` uses the original alternating statements (Brooke 1996), on a 7-point scale, with "system" and "cumbersome".

What the evidence supports:
- Changing "system" to "website" adds clarity without losing what the scale measures. https://measuringu.com/change-standardized/ The all-positive version from 2011 already used "website". https://measuringu.com/papers/sauro_lewisCHI2011.pdf
- Changing "cumbersome" to "awkward" (Finstad 2006) is widely adopted, including by MeasuringU. https://measuringu.com/is-the-sus-too-antiquated/
- The all-positive version had 213 unmoderated users. Its scores were no different from the standard version, and it was as reliable (alpha .96 against .92). With the alternating version, 13% of questionnaires had mistakes by the person answering and 11% of research datasets were scored wrongly. MeasuringU says the all-positive version can be used "with confidence". https://measuringu.com/positive-negative/ ; https://measuringu.com/10-things-sus/
- The trade-off: MeasuringU still usually runs the standard version in unmoderated studies, because mixed wording catches people who give the same answer every time. The current code uses opposite pairs to flag that. https://measuringu.com/is-the-sus-too-antiquated/
- Changing the order, adding or removing statements, or changing the tone risks losing comparability. Any other change should be recorded. https://www.nngroup.com/articles/measuring-perceived-usability/ ; https://measuringu.com/change-standardized/
- A 7-point SUS cannot be compared with the average of 68. The code already compares scores within this study only. https://measuringu.com/scale-points/

Untested changes in this study, which should be written into the instrument version and the methods:
- Asking about 3 websites at once ("these websites"). The scale was built for one system. List the 3 website names on the intro page to help people remember them. https://www.nngroup.com/articles/measuring-perceived-usability/
- Any rewording beyond the two swaps above. Hard words remain: "frequently", "unnecessarily complex", "technical person", "various functions … well integrated", "inconsistency", "intuitive", "get going". MeasuringU warns against rewording statements because some people dislike them, unless the new wording is tested against the original.

Recommendation: the owner decides.
- If the statements are not yet fixed in a preregistration, use the all-positive version with the two swaps. People who are older, less confident and slower readers are exactly the people who forget to flip their answers on negative statements.
- If they are already preregistered, keep the standard version and make only the two swaps.

Option A: all-positive, with "these websites" (verified against https://measuringu.com/positive-negative/)
1. I think that I would like to use these websites frequently.
2. I found these websites to be simple.
3. I thought these websites were easy to use.
4. I think that I could use these websites without the support of a technical person.
5. I found the various functions in these websites were well integrated.
6. I thought there was a lot of consistency in these websites.
7. I would imagine that most people would learn to use these websites very quickly.
8. I found these websites very intuitive.
9. I felt very confident using these websites.
10. I could use these websites without having to learn anything new.

Score each statement as the answer minus 1, add them up, and multiply by 100/60. The current `contribution()` would need to change.

Option B: standard, with "these websites" and "awkward"
1. I think that I would like to use these websites frequently.
2. I found these websites unnecessarily complex.
3. I thought these websites were easy to use.
4. I think that I would need the support of a technical person to be able to use these websites.
5. I found the various functions in these websites were well integrated.
6. I thought there was too much inconsistency in these websites.
7. I would imagine that most people would learn to use these websites very quickly.
8. I found these websites very awkward to use.
9. I felt very confident using these websites.
10. I needed to learn a lot of things before I could get going with these websites.

Scoring stays as it is in `sus.ts`.

### 4.4 Writing unbiased tasks

From NN/g, MeasuringU and Userbrain:
1. Start from a real reason someone would visit, with all the detail needed (day, place, name) and no route. https://www.nngroup.com/articles/task-scenarios-usability-testing/
2. Do not use the website's own labels. If the page has a "Plan your visit" menu, the task must not say "plan your visit". Names in the content that the task needs to be specific are fine. https://www.nngroup.com/articles/better-usability-tasks/
3. Tell, do not ask. Write "Find out…", never "How would you…" or "Where would you tap…". https://www.nngroup.com/articles/better-usability-tasks/
4. Do not describe steps or behaviour: no "scroll", "use the search box", "zoom in" or "look in the menu". "The way you usually would" is fine. https://www.nngroup.com/articles/better-usability-tasks/
5. Use at most one sentence of context. No family members, no jokes or joke names, and no touchy topics (health, money, age, religion, politics). https://www.nngroup.com/articles/better-usability-tasks/
6. Make the fact something a real visitor wants and something that takes a little reading to find, not the first headline. Avoid facts that change with the date on a saved copy. https://www.nngroup.com/articles/better-usability-tasks/
7. Say exactly when the task ends and what to do if they cannot find the fact. In unmoderated tests, nobody else will tell them. https://www.nngroup.com/articles/unmoderated-usability-testing/
8. Keep the task on screen the whole time. Older people forget more of what they read at the start. https://www.nngroup.com/articles/usability-testing-older-adults/
9. Ask follow-up questions neutrally. Ask "What was easy or hard about…", not "Why was … frustrating". Do not name parts of the website, and do not reveal or praise WebAble before the last page. https://www.nngroup.com/articles/leading-questions/
10. Write the tasks in the same style in both rounds, so the wording itself does not make one round easier. This is our inference.
11. Before launch, pilot the whole flow with 1 or 2 older adults on their own phones, and expect to rewrite several times. https://www.nngroup.com/articles/pilot-testing/ ; https://userbrain.com/blog/write-better-tasks-to-improve-usability-testing

---

## Before launch

- Read every page out loud. Ask 2 or 3 people aged 65 or over to read each page aloud on their own phone and say what they would do next. Fix every word they stumble on. https://uxdesign.cc/golden-microcopy-helping-older-users-use-your-product-f0f1b173aa3e ; https://www.pewresearch.org/writing-survey-questions/
- Run each page through a readability checker. Aim for about grade 6 on the welcome, agreement and task pages, and no higher than grade 8 anywhere. https://www.nngroup.com/articles/writing-for-lower-literacy-users/ ; https://www.nngroup.com/articles/plain-language-experts/
- Search all the copy for the words in 2.2 and 2.6, for "please", "click", "Next", "!", "—" and ";", and for "Wikipedia" (it is still in the old `webable/apps/web/components/study/StudyApp.tsx`).
- Check that every label in 2.3 is used for one action only, and that every ease rating runs from 1 = very easy.
- Check every promise against the code: saved answers, no time limit, the deletion deadline, and "links are turned off".

---

## 5. Sources read

These come from the four research reports, which read every page listed here. The positive SUS wording in 4.3 was checked again directly. A few claims could not be confirmed and are marked as such where they appear: the Carer's Allowance blog post could not be found, and the "reading age of 9" figure is not stated on any current GOV.UK page, so it is not used here.

### Official guidance and research (117)

**GOV.UK Design System, Service Manual and publishing guidance (33)**
- Question pages. https://design-system.service.gov.uk/patterns/question-pages/
- Start using a service. https://design-system.service.gov.uk/patterns/start-using-a-service/
- Button. https://design-system.service.gov.uk/components/button/
- Back link. https://design-system.service.gov.uk/components/back-link/
- Radios. https://design-system.service.gov.uk/components/radios/
- Checkboxes. https://design-system.service.gov.uk/components/checkboxes/
- Text input (hint and label rules). https://design-system.service.gov.uk/components/text-input/
- Error message. https://design-system.service.gov.uk/components/error-message/
- Error summary. https://design-system.service.gov.uk/components/error-summary/
- Validation. https://design-system.service.gov.uk/patterns/validation/
- Textarea. https://design-system.service.gov.uk/components/textarea/
- Confirmation pages. https://design-system.service.gov.uk/patterns/confirmation-pages/
- Check answers. https://design-system.service.gov.uk/patterns/check-answers/
- Task list. https://design-system.service.gov.uk/components/task-list/
- Complete multiple tasks. https://design-system.service.gov.uk/patterns/complete-multiple-tasks/
- Step by step navigation. https://design-system.service.gov.uk/patterns/step-by-step-navigation/
- Interruption pages. https://design-system.service.gov.uk/patterns/interruption-pages/
- Panel. https://design-system.service.gov.uk/components/panel/
- Check a service is suitable. https://design-system.service.gov.uk/patterns/check-a-service-is-suitable/
- Equality information. https://design-system.service.gov.uk/patterns/equality-information/
- Navigate a service. https://design-system.service.gov.uk/patterns/navigate-a-service/
- Headings. https://design-system.service.gov.uk/styles/headings/
- Details. https://design-system.service.gov.uk/components/details/
- Warning text. https://design-system.service.gov.uk/components/warning-text/
- Designing good questions. https://www.gov.uk/service-manual/design/designing-good-questions
- Structuring forms. https://www.gov.uk/service-manual/design/form-structure
- Writing for user interfaces. https://www.gov.uk/service-manual/design/writing-for-user-interfaces
- Getting informed consent for user research. https://www.gov.uk/service-manual/user-research/getting-users-consent-for-research
- A to Z style guide. https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/style-guides/a-to-z-style-guide/
- Use clear language. https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/
- Use the right tone. https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/right-tone/
- Create a clear structure. https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-structure/
- Writing guidelines and Meet user needs. https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/meet-user-needs/

**W3C Web Accessibility Initiative (45)**
- Making Content Usable for People with Cognitive and Learning Disabilities. https://www.w3.org/TR/coga-usable/
- Cognitive accessibility design patterns (index). https://www.w3.org/WAI/WCAG2/supplemental/
- Use clear words. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p01-clear-words/
- Use a simple tense and voice. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p02-simple-tense/
- Avoid double negatives or nested clauses. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p03-double-negatives/
- Use literal language. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p04-literal-language/
- Keep text succinct. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p05-succinct-text/
- Use clear formatting and punctuation. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p06-format-punctuation/
- Separate each instruction. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p09-separated-instructions/
- Use white spacing. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p10-whitespace/
- Explain implied content. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p12-implicit-explained/
- Provide alternatives for numerical concepts. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p13-numerical-alternatives/
- Make the purpose of your page clear. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o1p01-clear-purpose/
- Use a familiar hierarchy and design. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o1p02-familiar-design/
- Use a consistent visual design. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o1p03-consistent-design/
- Make each step clear. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o1p04-clear-steps/
- Clearly identify controls and their use. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o1p05-clear-controls/
- Make the most important actions easy to find. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o2p04-page-important/
- Ensure controls and content do not move unexpectedly. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p01-unexpected-movement/
- Let users go back. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p02-back-undo/
- Design forms to prevent mistakes. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p04-supportive-forms/
- Use clear visible labels. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p06-clear-labels/
- Use clear step-by-step instructions. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p07-step-instructions/
- Avoid data loss and timeouts. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p09-data-loss/
- Provide feedback. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p10-status-feedback/
- Limit interruptions. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o5p01-minimal-interruptions/
- Make short critical paths. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o5p02-short-paths/
- Avoid too much content. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o5p03-manageable-quantity/
- Provide information so a user can prepare for a task. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o5p04-task-expectations/
- Do not rely on calculations or memorising. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o6p05-low-cognition/
- Provide human help. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o7p01-human-help/
- State the results of actions and options. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o7p03-supported-choice/
- Provide help for forms and non-standard controls. https://www.w3.org/WAI/WCAG2/supplemental/patterns/o7p04-described-interactions/
- Older users and web accessibility. https://www.w3.org/WAI/older-users/
- Developing websites for older people. https://www.w3.org/WAI/older-users/developing/
- User story: Elias (low vision, tremor, memory loss). https://www.w3.org/WAI/people-use-web/user-stories/story-nine/
- Writing for web accessibility. https://www.w3.org/WAI/tips/writing/
- Understanding SC 3.3.2 Labels or instructions. https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html
- Understanding SC 2.4.6 Headings and labels. https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html
- Understanding SC 3.2.4 Consistent identification. https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html
- Understanding SC 2.5.8 Target size (minimum). https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- Understanding SC 2.5.5 Target size (enhanced). https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
- Understanding SC 3.3.7 Redundant entry. https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html
- Understanding SC 2.4.8 Location. https://www.w3.org/WAI/WCAG22/Understanding/location.html
- Understanding SC 3.2.3 Consistent navigation. https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html

**Nielsen Norman Group (20)**
- Turn user goals into task scenarios. https://www.nngroup.com/articles/task-scenarios-usability-testing/
- Write better qualitative usability tasks: top 10 mistakes. https://www.nngroup.com/articles/better-usability-tasks/
- Unmoderated user tests. https://www.nngroup.com/articles/unmoderated-usability-testing/
- Remote usability tests. https://www.nngroup.com/articles/remote-usability-tests/
- Pilot testing. https://www.nngroup.com/articles/pilot-testing/
- Usability for older adults: challenges and changes. https://www.nngroup.com/articles/usability-for-senior-citizens/
- Usability for senior citizens: improved, but still lacking. https://www.nngroup.com/articles/usability-seniors-improvements/
- Usability testing with older adults. https://www.nngroup.com/articles/usability-testing-older-adults/
- UX design for seniors (report page; guidelines are paywalled). https://www.nngroup.com/reports/senior-citizens-on-the-web/
- Plain language is for everyone, even experts. https://www.nngroup.com/articles/plain-language-experts/
- Lower-literacy users. https://www.nngroup.com/articles/writing-for-lower-literacy-users/
- Wizards. https://www.nngroup.com/articles/wizards/
- Progress indicators. https://www.nngroup.com/articles/progress-indicators/
- 4 principles to reduce cognitive load in forms. https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/
- Navigation: you are here. https://www.nngroup.com/articles/navigation-you-are-here/
- Measuring perceived usability (SUS, NASA-TLX, SEQ). https://www.nngroup.com/articles/measuring-perceived-usability/
- Quantitative UX glossary. https://www.nngroup.com/articles/quant-ux-glossary/
- Rating scales in UX research. https://www.nngroup.com/articles/rating-scales/
- Avoid leading questions. https://www.nngroup.com/articles/leading-questions/
- Memory recognition and recall. https://www.nngroup.com/articles/recognition-and-recall/

**MeasuringU (16)**
- Difficult–easy or easy–difficult: does it matter? https://measuringu.com/reversing-seq-endpoints-means/
- Difficult–easy or easy–difficult: response distributions. https://measuringu.com/reversing-seq-endpoints-response-distributions/
- Evaluation of three SEQ variants (also at https://measuringu.com/?p=34376). https://measuringu.com/evaluation-of-three-seq-variants/
- The evolution of the SEQ. https://measuringu.com/evolution-of-seq/
- Survey respondents prefer the left side of a rating scale. https://measuringu.com/left-side-bias/
- Rating scale best practices: 8 topics. https://measuringu.com/rating-scale-best-practices-8-topics-examined/
- Can you change a standardized questionnaire? https://measuringu.com/change-standardized/
- When designing usability questionnaires, does it hurt to be positive? (CHI 2011 paper) https://measuringu.com/papers/sauro_lewisCHI2011.pdf
- Are both positive and negative items necessary? https://measuringu.com/positive-negative/
- Is the SUS too antiquated? https://measuringu.com/is-the-sus-too-antiquated/
- Should you use 5 or 7 point scales? https://measuringu.com/scale-points/
- Does changing the number of response options affect rating behavior? https://measuringu.com/changing-the-number-of-response-options/
- Converting rating scales to 0–100 points. https://measuringu.com/converting-scales-to-100-points/
- Fully vs partially labeled scales. https://measuringu.com/labeling-scales/
- Measuring usability with the SUS. https://measuringu.com/sus/
- 10 things to know about the SUS. https://measuringu.com/10-things-sus/

**Other guidance and research (3)**
- Pew Research Center: Writing survey questions. https://www.pewresearch.org/writing-survey-questions/
- Digital.gov: Writing for understanding (plain language). https://digital.gov/guides/plain-language/writing
- Mailchimp Content Style Guide: Writing for accessibility. https://styleguide.mailchimp.com/writing-for-accessibility/

### Blog and Medium articles (16)

**Medium (4)**
- Kinneret Yifrah and Michal Halperin Ben Zvi, "11 guidelines for writing microcopy that helps older adults use your product", UX Collective, 14 December 2020. https://uxdesign.cc/golden-microcopy-helping-older-users-use-your-product-f0f1b173aa3e
- Cameron Chapman, "A guide to interface design for older adults", UX Collective, 11 September 2019. https://uxdesign.cc/a-guide-to-interface-design-for-older-adults-31109468d46d
- Andrés Ochoa, "Mastering UX surveys: best practices and how to avoid biases", Bootcamp, 14 July 2023. Its advice on reverse-worded items is weak and not followed here. https://medium.com/design-bootcamp/mastering-ux-surveys-best-practices-and-how-to-avoid-biases-ac9be20709e5
- Mystic, "These 15 phrases prove you used ChatGPT", Everyday AI, 10 August 2025. https://medium.com/everyday-ai/these-15-phrases-prove-you-used-chatgpt-and-everyone-can-tell-53accf90a742

**Other blogs (12)**
- Vitaly Friedman, "A guide to designing for older adults", Smashing Magazine, 6 February 2024. https://www.smashingmagazine.com/2024/02/guide-designing-older-adults/
- Ollie Campbell, "Designing for the elderly", Smashing Magazine, 5 February 2015. https://www.smashingmagazine.com/2015/02/designing-digital-technology-for-the-elderly/
- Vitaly Friedman, "A guide for designing for older adults", Smart Interface Design Patterns, 25 July 2023. https://smart-interface-design-patterns.com/articles/design-older-adults/
- Sara Vincent, "Sentence length: why 25 words is our limit", Inside GOV.UK blog, 4 August 2014. https://insidegovuk.blog.gov.uk/2014/08/04/sentence-length-why-25-words-is-our-limit/
- Karwai Pun, "Dos and don'ts on designing for accessibility", GDS Accessibility blog, 2 September 2016. https://accessibility.blog.gov.uk/2016/09/02/dos-and-donts-on-designing-for-accessibility/
- DfE informed consent group, "Creating 3 principles of informed consent for user research", DfE Digital blog, 16 July 2025. https://dfedigital.blog.gov.uk/2025/07/16/creating-3-principles-of-informed-consent-for-user-research
- Section508.gov team, "Plain language improves accessibility", Section508.gov blog. https://www.section508.gov/blog/plain-language-improves-accessibility/
- Stefan Rössler, "How to write better tasks to improve your usability testing", Userbrain blog. https://userbrain.com/blog/write-better-tasks-to-improve-usability-testing
- Lilach Bullock, "Patterns that give away AI writing". https://www.lilachbullock.com/patterns-that-give-away-ai-writing/
- Pasquale Pillitteri, "The new em-dash: 9 signs of AI writing", 14 August 2026. https://pasqualepillitteri.it/en/news/11195/new-em-dash-9-ai-writing-tells
- Blake Stockton, "Don't write like AI: red flag phrases", 7 July 2025. https://www.blakestockton.com/red-flag-phrases/
- Blake Stockton, "Don't write like AI: 10 takeaways from Wikipedia's signs of AI writing", 7 August 2025. https://www.blakestockton.com/takeaways-from-wikipedias-signs-of-ai-writing-2/

### Tried but not used
- Medium articles that are for members only and were cut off: https://uxdesign.cc/use-plain-language-in-ux-writing-d7d5b0ea35f1 ; https://uxdesign.cc/tips-and-tricks-for-writing-remote-unmoderated-test-scripts-d8c38b8dde6b
- NIA/NLM "Making your website senior-friendly": the page returned 405 and the PDF timed out.
- The Atlassian page returned 404. The Shopify Polaris page redirects to an index page.
- GOV.UK hint pages /components/hint/ and /components/hint-text/ returned 404. The hint rules are on the Text input page.
- NN/g's older-adults testing video page had no readable content.
