// Dev-only host for one replica (dev.html): the FrameHost the shell gives a trial, without the rest of the shell.
//   /dev.html?r=<replicaId>&c=original|adapted|practice&fit=typical|rosa|reader|large|calm&h=664&mode=replay|record
//   optional: &fresh=1 (record: the canonical pass), &manifest=<url> and &task=<url> (a replica outside replicas/), &w=<px> (a wider frame),
//   &debounce=1 (the fit's repeat-click filter on)
// The replica loads in a same-origin iframe at its servePath. Zoom resizes the iframe to 390/f x h/f and scales it by
// f from the top-left (Option B). A cover hides the frame until it is ready. Begin, End and Delivery print JSON.
// window.__devHost exposes the same for scripts/record.mjs and scripts/replay-check.mjs.

import type { FrameHost, ReplicaManifest, TaskSpec, TrialConfig } from '../contracts';
import { LAYOUT_WIDTH } from '../contracts';
import type { StudyFrameApi, StudyTrial } from '../frame/types';
import { fitByName } from './fits';


interface DevState {
  trial: StudyTrial | null;
  ready: { settleMs: number; late: boolean; at: number } | null;
  notes: Array<{ at: number; kind: string; detail?: string }>;
  zoom: number;
  error: string | null;
  frame(): StudyFrameApi | null;
}

const q = new URLSearchParams(location.search);
// Dev only: &w=<px> runs the frame wider than the study's phone (desktop behaviour checks); the study uses LAYOUT_WIDTH.
const W = Math.max(320, Math.min(1600, Number(q.get('w')) || LAYOUT_WIDTH));
const H = Math.max(320, Math.min(1200, Number(q.get('h')) || 664));

const state: DevState = {
  trial: null,
  ready: null,
  notes: [],
  zoom: 1,
  error: null,
  frame: () => {
    try {
      return (iframe.contentWindow as unknown as { __studyFrame?: StudyFrameApi } | null)?.__studyFrame ?? null;
    } catch {
      return null;
    }
  },
};
(window as unknown as { __devHost: DevState }).__devHost = state;

const CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; background: #ffffff; color: #16150f; font: 400 15px/22px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; -webkit-text-size-adjust: 100%; }
.stage { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; background: #ffffff; border-bottom: 1px solid #e6e3dc; }
.stage iframe { position: absolute; left: 0; top: 0; border: 0; width: ${W}px; height: ${H}px; transform-origin: 0 0; background: #ffffff; }
.cover { position: absolute; inset: 0; background: #ffffff; display: grid; place-items: center; color: #5e5c55; z-index: 2; }
.cover[hidden] { display: none; }
.panel { width: ${W}px; padding: 12px 16px 32px; display: grid; gap: 10px; }
.row { display: flex; gap: 8px; flex-wrap: wrap; }
button { font: 600 15px/1 inherit; font-family: inherit; height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid #d4d0c6; background: #ffffff; color: #16150f; }
button.primary { background: #16150f; color: #ffffff; border-color: #16150f; }
.meta { color: #5e5c55; font-size: 15px; }
pre { margin: 0; padding: 12px; background: #f6f5f2; border-radius: 12px; font: 12px/16px ui-monospace, Menlo, monospace; white-space: pre-wrap; word-break: break-word; max-height: 60vh; overflow: auto; }
`;

const style = document.createElement('style');
style.textContent = CSS;
document.head.append(style);

const stage = document.createElement('div');
stage.className = 'stage';
const iframe = document.createElement('iframe');
iframe.title = 'Replica';
const cover = document.createElement('div');
cover.className = 'cover';
cover.textContent = 'Loading…';
stage.append(iframe, cover);

const panel = document.createElement('div');
panel.className = 'panel';
const meta = document.createElement('div');
meta.className = 'meta';
const row = document.createElement('div');
row.className = 'row';
const out = document.createElement('pre');
const button = (label: string, run: () => unknown, primary = false) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  if (primary) b.className = 'primary';
  b.addEventListener('click', () => {
    try {
      out.textContent = JSON.stringify(run(), null, 2);
    } catch (err) {
      out.textContent = String(err);
    }
  });
  row.append(b);
};
button('Begin', () => {
  state.frame()?.begin();
  return { begun: true };
}, true);
button('End', () => state.frame()?.end() ?? null, true);
button('Delivery', () => state.frame()?.delivery() ?? null);
button('Status', () => state.frame()?.status() ?? null);
button('Notes', () => state.notes);
panel.append(meta, row, out);
document.body.append(stage, panel);

function showMeta(): void {
  const t = state.trial;
  const r = state.ready;
  meta.textContent = t
    ? `${t.task.replicaId} · ${t.condition} · ${q.get('fit') ?? 'typical'} · ${W}×${H} · ${t.mode} · zoom ${state.zoom}` +
      (r ? ` · ready ${r.settleMs} ms${r.late ? ' (late)' : ''}` : ' · loading')
    : state.error ?? '';
}

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Vite serves files under the app's root in dev, so replicas/<id>/*.json can be read as they are (no import, so a
 *  replica being rewritten never reloads this page). */
async function maybeJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok || !/json/i.test(res.headers.get('content-type') ?? '')) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function start(): Promise<void> {
  const id = q.get('r') ?? '';
  const manifest = q.get('manifest') ? await json<ReplicaManifest>(q.get('manifest') as string) : await maybeJson<ReplicaManifest>(`/replicas/${encodeURIComponent(id)}/manifest.json`);
  if (!manifest) throw new Error(`No replica "${id}" (replicas/${id}/manifest.json)`);
  const rid = manifest.id;
  const task: TaskSpec = q.get('task') ? await json<TaskSpec>(q.get('task') as string) : await maybeJson<TaskSpec>(`/replicas/${encodeURIComponent(rid)}/task.json`) ?? {
    id: `${rid}-dev`, replicaId: rid, family: 'practice', set: 'practice', prompt: '(no task.json)', short: '', choices: [],
    correct: 0, answerText: '', answerSelector: 'h1',
  };
  const fitName = q.get('fit') ?? 'typical';
  const fit = fitByName(fitName);
  if (!fit) throw new Error(`Unknown fit "${fitName}"`);
  // Dev only: switch the fit's repeat-click filter on, to test the debounce count.
  if (q.get('debounce') === '1') fit.clicks.debounce = true;
  const c = q.get('c');
  const condition: TrialConfig['condition'] = c === 'adapted' || c === 'practice' ? c : 'original';
  const trial: StudyTrial = {
    trialId: `dev-${rid}-${condition}-${fitName}-${H}-${Date.now().toString(36)}`,
    task,
    condition,
    fit,
    frame: { w: W, h: H },
    fixturesUrl: `/_r/${rid}/fixtures.json`,
    mode: q.get('mode') === 'record' ? 'record' : 'replay',
    recordFresh: q.get('fresh') === '1',
    originalHost: manifest.originalHost,
    fitName,
  };
  state.trial = trial;

  const host: FrameHost = {
    trial: () => trial,
    zoom(f: number): number {
      const z = Number.isFinite(f) && f > 0 ? f : 1;
      iframe.style.width = `${W / z}px`;
      iframe.style.height = `${H / z}px`;
      iframe.style.transform = z === 1 ? '' : `scale(${z})`;
      state.zoom = z;
      showMeta();
      return z;
    },
    ready(info) {
      state.ready = { ...info, at: Math.round(performance.now()) };
      cover.hidden = true;
      showMeta();
    },
    note(kind, detail) {
      state.notes.push({ at: Math.round(performance.now()), kind, ...(detail !== undefined ? { detail } : {}) });
    },
  };
  (window as unknown as { __studyHost: FrameHost }).__studyHost = host;
  showMeta();
  iframe.src = manifest.servePath;
}

start().catch((err: unknown) => {
  state.error = err instanceof Error ? err.message : String(err);
  cover.textContent = state.error;
  showMeta();
});
