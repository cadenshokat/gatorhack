# OpenAI's Intelligent UI: how it structures elements, picks components and designs them

Research for Caden, by Wren (Sid's Claude), 2026-10-25. What OpenAI shipped, how it works as far as anyone outside
OpenAI can tell, and what WebAble's simplified page should take from it.

**Sources and how much to trust them.** OpenAI's own announcement (`openai.com/index/gpt-6-for-everyone/`) refused our
fetch (HTTP 403), so OpenAI's words below are as quoted by 9to5Mac and MacRumors. The internals come from third-party
teardowns of ChatGPT's web client, mainly the OpenUI/Thesys team's write-up the day after launch, and are **not
confirmed by OpenAI**. The design rules come from OpenAI's official Apps SDK UI guidelines, which are first-party.

---

## In short

1. **A fixed catalogue, not free drawing.** ChatGPT's Intelligent UI (launched 7 October 2026 with GPT-6) lets the model
   build answers from a library of about 70 native components. It doesn't let the model design arbitrary interfaces.
   That's the opposite of Google's 2025 Gemini experiments, which generate a custom interface per prompt.
2. **The model writes a description, code checks it.** The model writes markup naming components and their properties;
   a compiler validates it against the catalogue, drops anything invalid, and renders native components.
3. **It streams and never shows a broken state.** The interface recompiles every few hundred milliseconds as the answer
   streams; if an update fails, the last working version stays on screen, and controls keep their state.
4. **Text is always the fallback.** Every answer also gets a plain-Markdown version for clients that can't run it.
5. **"The smallest presentation that does the job."** OpenAI's guidelines default to an inline card, cap actions at two
   per card, ban nested scrolling and custom fonts, and require WCAG AA contrast and text that can be resized.

WebAble is already built the same way: Jev reads the page, code decides, and Alfred's components render. The ideas worth
borrowing are listed at the end.

---

## What OpenAI shipped

- **When and where:** ChatGPT, 7 October 2026, with the GPT-6 models (paid plans first; Free and Go from 8 October).
- **What it is:** answers that mix text with "graphics, tappable buttons, forms, charts, and interactive experiences"
  (OpenAI, as quoted by 9to5Mac). Examples in coverage: side-by-side comparisons, interactive diagrams, maps, small tools
  built in the conversation (calculators, bill splitters), and "an interactive recipe widget that can automatically
  tweak quantities based on guest count" (MacRumors).
- **When it uses UI:** "The format depends on what you're asking"; a plain text answer is used when that's most useful.
  OpenAI hasn't published how the model makes that choice.
- **How it's built, in OpenAI's words (via MacRumors):** "a library of native, streamable components with a compiler
  that processes the interface as the model generates it."
- **Developers:** no public API for Intelligent UI itself yet. Third-party apps use the separate Apps SDK (below).

## How it structures elements (third-party teardown)

The OpenUI team reconstructed the system from chatgpt.com's public code and traffic (Thesys Engineering Team, 8 October
2026). A second, independent teardown reported the same component counts.

**Four layers:**

| Layer | What it does |
|---|---|
| Model | Writes the answer in a markup called **DIL**: Markdown for prose, JSX-like tags for components (`<box>`, `<slider>`, `<form>`…), and small JavaScript blocks for state (`useState(8)` for a seat count). |
| Server | Compiles DIL into a JavaScript program plus a JSON document, and validates every property against the catalogue. Invalid properties are removed and logged (`unknown_prop`, `invalid_literal`). Unclosed tags are closed automatically, so partial output still compiles. |
| Client runtime | Runs the program in a sandboxed worker with no network, timers or messaging. A program that stops responding is quarantined. |
| Renderer | Applies the result to ChatGPT's **native** components, so "generated interfaces look like the rest of ChatGPT on every platform." |

**The catalogue:** about 70 components in the client registry, 39 of them seen in captured answers. They include
primitives (title, text, box, slider, icon, form) and composites (AsyncImage, AsyncImageGroup, Entity, Cite). The model
used OpenAI's composites but never defined its own.

**Escape hatch:** for things the catalogue can't draw, the model can write a small self-contained HTML/CSS/JS app (an
"AppBlock") that runs in a locked-down sandboxed frame and uses ChatGPT's theme variables, so it still follows light
and dark mode.

**Streaming:** full recompiles about every 290 ms (a median of 230 ms between updates in one capture). If a new version
fails, the last working one stays. Control state survives recompiles through state keys.

**Fallback:** the server also produces plain Markdown for every answer. Interactive parts become static text.

A separate teardown of the Codex desktop app (RuntimeWire, August 2026) found a larger first-party "GenUI" registry, 467
block types and versions, where the **server** picks the block and the client renders it only if it has a matching,
permitted implementation, falling back otherwise. Widgets can keep updating after the answer finishes. That's a different
system from chat's Intelligent UI and shouldn't be mixed up with the 70-component figure.

## How it picks the right component at the right time

OpenAI hasn't published the selection logic. What's known:

- **Constrained choice.** The model picks from the catalogue and describes how pieces fit; it can't invent a component.
  Choice is a language decision, and correctness is enforced by the compiler.
- **Format follows the question.** Comparisons go side by side, explanations become diagrams, simple questions stay text.
- **For third-party apps, the rules are explicit** (Apps SDK, first-party):
  - **Inline card** for one decision, a little structured data, or a self-contained tool: confirmations, order
    summaries, status. Every app starts inline.
  - **Inline carousel** for scanning similar items: **3 to 8 items**, each with an image, a title and at most three lines
    of metadata.
  - **Fullscreen** only for rich multi-step work: maps, editing canvases, detailed browsing.
  - **Picture-in-picture** for something live that should stay visible: games, quizzes, live sessions.
  - "Start with inline UI and request more space only when the workflow needs it": the **smallest presentation** that
    lets people understand the result or finish the task.
  - Data tools and render tools are separate: one tool fetches, another renders a template from prepared data.
  - "Language-first filtering": instead of filter sidebars, let the model map plain words to parameters.

## How the components are designed (Apps SDK guidelines, first-party)

- **Colour:** system colours for text, icons and dividers; brand colour only on accents, badges and the primary button.
  No custom gradients or patterns, and no colour behind text.
- **Type:** inherit the system font stack, even fullscreen; limit size variation and prefer body sizes.
- **Layout:** the system grid, consistent padding, the system corner radius, and a clear order: headline, supporting
  text, then the action.
- **Icons and images:** monochrome outlined icons; fixed aspect ratios; no logos in the content.
- **Actions:** **at most two per card** (one primary, one optional secondary) at the bottom; one optional action per
  carousel item.
- **Avoid:** multiple drill-ins, tabs or deep navigation in one card; **nested scrolling** (cards size to their content);
  rebuilding things the host already does; ads, upsells and irrelevant messages.
- **Accessibility:** WCAG AA contrast, alt text on every image, and **support text resizing without breaking layouts**.
- **Tokens:** spacing and size come from tokens (`padding={3}`, size `xl`), not raw values, so every generated interface
  matches the host.

---

## What WebAble should take from this

We're on the same side of the main choice already: a fixed set of components (StatGrid, Scoreboard, DataTable,
ScheduleList, Recipe, LogoMark), chosen from Jev's reading of the page, with code deciding. These are the gaps worth
closing, in order of value:

1. **Validate before rendering, and keep the last good view.** Treat the planner's output like DIL: check each
   component's props against its schema, drop what's invalid, log why, and if a late Jev result produces a worse or
   broken plan, keep the view the person is already reading. This fits the round-8 rule that WebAble never swaps the
   page once someone scrolls or clicks.
2. **One fallback that always works.** OpenAI ships Markdown with every answer; our equivalent is the original page,
   adjusted in place. Every component should degrade to its source content as plain, readable text if extraction is
   unsure, never to a placeholder ("Never print fallbacks such as 'Related card'", `SIMPLIFIED.md` §2).
3. **Smallest presentation first.** OpenAI defaults to the smallest view that does the job; ours is in-place adjustment,
   with the simplified page only on busy reading pages. Keep that order, and keep rich components (a scoreboard, a data
   table) for pages whose purpose Jev is sure of.
4. **Adopt their numbers where they fit:** carousels and "More from {site}" grids of **3 to 8 items** with a title and at
   most three lines of meta; **at most two actions** per card; **no nested scrolling** except a wide table in its own
   box (already `SIMPLIFIED.md` §4).
5. **Tokens, one font, system colours.** `SIMPLIFIED.md` already has one spacing scale (8 / 16 / 24 / 40 / 64). Add
   the rest of OpenAI's discipline: the person's chosen text size drives one type scale, colour only for accents and
   the primary action, never behind text.
6. **Accessibility is table stakes for them and the product for us.** Their bar is WCAG AA and resizable text; ours
   should be the person's own text size and contrast, with layouts tested at the largest sizes the onboarding can set.
7. **Don't copy the recipe scaler.** Scaling quantities is computing new information. Round 8's rule is to add only what
   the page already says (`ROUND8.md` §5), so WebAble should show the recipe's own servings and never recalculate them.
8. **For the pitch:** "Like ChatGPT's Intelligent UI, WebAble builds from a fixed set of components and lets code, not
   the model, decide what's allowed. The difference is that WebAble rebuilds pages people already use, around what each
   one is for, at the size and contrast that person needs."

---

## Sources

- 9to5Mac, "OpenAI brings GPT-6 to ChatGPT and debuts Intelligent UI", 7 Oct 2026.
  <https://9to5mac.com/2026/10/07/openai-brings-gpt-6-to-chatgpt-and-debuts-intelligent-ui/>
- MacRumors, "ChatGPT Gets GPT-6 and New Intelligent UI With Visual Answers", 7 Oct 2026.
  <https://www.macrumors.com/2026/10/07/chatgpt-intelligent-ui/>
- OpenAI, "GPT-6 for everyone" (not readable from here: 403). <https://openai.com/index/gpt-6-for-everyone/>
- Thesys Engineering Team (OpenUI), "How ChatGPT's Intelligent UI works and how to build it", 8 Oct 2026. Third party.
  <https://www.openui.com/blog/how-chatgpt-intelligent-ui-works>
- The Gradient, "Generative UI Runs on Your Design System" (OpenAI's catalogue vs Google's per-prompt generation).
  <https://thegradient.com/thinking/generative-ui-design-system>
- R. Merket, RuntimeWire, "OpenAI built ChatGPT interfaces that keep running after answers appear", 26 Aug 2026. Third
  party. <https://runtimewire.com/article/openai-is-building-an-interface-platform-inside-chatgpt>
- OpenAI Apps SDK, "UI guidelines". <https://developers.openai.com/plugins/concepts/ui-guidelines>
- OpenAI Apps SDK, "Add UI to your MCP server". <https://developers.openai.com/apps-sdk/plan/components>
- OpenAI Developers blog, "15 lessons learned building ChatGPT Apps".
  <https://developers.openai.com/blog/15-lessons-building-chatgpt-apps>
