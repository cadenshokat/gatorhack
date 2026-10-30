# WebAble mobile study (`apps/study`)

A website people open on their own phone. It runs the study in `docs/STUDY.md` (protocol 2.0.0, for people aged 50 or
over who say websites often give them trouble): two questions on who the study is for, the agreement, a warm-up (the
onboarding's Reading and Pointing steps), a practice website, then two rounds of three websites, one as the sites made
them and one adapted by WebAble's real engine (the person's warm-up settings plus the AI's page decisions, recorded once
and replayed), with the SEQ after each website and the SUS (1–7) and an optional comment after each round. Open
decisions: `docs/STUDY-DECISIONS.md`.

## Run it

```sh
pnpm install
pnpm --filter @webable/study dev          # http://127.0.0.1:5190/  (a preview: answers stay on the device)
```

- `http://127.0.0.1:5190/?seq=2` previews sequence 2 (0–3).
- A participant opens `https://<host>/#i=<code>.<sequence>.<p|m>`; the fragment is read once and removed.
- On a phone on the same network: `pnpm --filter @webable/study dev:lan`, then open `http://<mac-ip>:5190/`. Answers
  can't be sent from plain http on a LAN address (no Web Crypto there); that's fine for previews.
- The iOS Simulator's Safari reaches the dev server at `http://127.0.0.1:5190/`.

## How it fits together

| Part | Where | What it does |
|---|---|---|
| Shell | `src/shell` | The participant flow, the task runner (iframe host, imitated tab zoom, clock, answer sheet, SEQ), the SUS and final questions. Built from the onboarding's own components and tokens (`apps/extension/entrypoints/fitting`). |
| Plan | `src/experiment` | Sequences, matched pairs from `replicas/*/task.json`, SUS scoring. |
| Store | `src/store` | Session saved on the phone after every step (a reload resumes), an outbox to Supabase that retries until acknowledged, invitations, withdrawal. |
| Frame runtime | `src/frame` | Loaded first by every copy (`/_study/frame.js`). Measures taps, misses, scrolling, "answer seen"; blocks links the same way in both conditions; in the adapted condition starts the real engine and UI from `apps/extension/src`. |
| Stand-in | `src/shim`, `src/replay` | `globalThis.chrome` for the engine: messaging answered locally, storage in memory, zoom passed to the shell, model answers replayed from `replicas/<id>/fixtures.json`. |
| Copies | `replicas/<id>` | `manifest.json`, `task.json`, `site/` (served at the original path and under `/_r/<id>/`), `fixtures.json`. `reference/` holds the live captures and is never served or committed. |
| Tools | `scripts/` | `capture/` (copy a live page), `record.mjs` / `replay-check.mjs` (model answers), `invites.mjs`, `export.mjs`. |

Build with `--mode e2e` (the scripts do): the in-page UI then uses open shadow roots so taps and scrolling inside the
simplified page can be measured.

## Before collecting data

1. **Model answers.** With the server running on 127.0.0.1:41741 and the dev server on 127.0.0.1:5190:
   `node scripts/record.mjs <replica ids>`, then `node scripts/replay-check.mjs <replica ids>` (no misses allowed in the
   canonical setting). Re-record after any change to `apps/extension/src` or `packages/core/src`.
2. **Storage.** `supabase/migrations/*.sql` lives in the existing WebAble Supabase project (applied 27 Oct 2026; checked
   with the public key: insert only, no read/update/delete, forged withdrawals refused, withdrawal needs the session's
   secret). Put the URL and publishable key in `.env.local` (see `.env.example`) along with the agreement details;
   collection stays off until all are set.
3. **Deploy** to the Vercel project `webable-gatorhack-study` (https://webable-gatorhack-study.vercel.app; not
   `webable-study`, which is the semester repo's app). Build here, so the workspace and `.env.local` are used and the
   engine commit is stamped from git: `vite build --mode e2e --outDir <dir>`, copy `cleanUrls`, `trailingSlash` and
   `headers` from `vercel.json` into `<dir>/vercel.json`, then `vercel deploy --prod --yes` from a folder named
   `webable-gatorhack-study`.
   **Or GitHub Pages** (https://cadenshokat.github.io/gatorhack/): `.github/workflows/study-pages.yml` builds and
   publishes on every push to `study/mobile-sandbox` (allowed under Settings → Environments → github-pages). It builds with `STUDY_PAGES_BASE=/gatorhack/`, which puts the site under that
   path and turns `vercel.json`'s headers into meta tags (Pages can't send headers). Collection needs the `.env.local`
   names set as the repo's Actions variables; without them the Pages site is a preview.
4. **Invitations:** `node scripts/invites.mjs --count 4 --cohort pilot --base https://<host> --out <private dir>/pilot.csv`.
5. **Export:** `STUDY_SUPABASE_URL=… STUDY_SUPABASE_SERVICE_KEY=… node scripts/export.mjs --cohort pilot --out <dir>`.
   Never commit the service key or an export.
