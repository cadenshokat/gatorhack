// Owner: P, F. Toolbar popup: what helps you (what WebAble has learned, with "Not right" and "Forget this"), the
// optional 70-second warm-up, on/off and pause on this site, this page, demo tools (a week of learning, start fresh,
// demo fits), server status and options.
import { render } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  DEMO_FITS,
  describeFit,
  type FitProfile,
  type JevMetrics,
  type PassiveFitState,
  type Settings,
  type TabReport,
} from '@webable/core';
import { isMac } from '../../src/ui/panel/hooks';
import { hasWarmup, helpRows, settingsLine, type HelpRow } from '../../src/ui/panel/learned';
import {
  EMPTY_HELPS,
  feedbackNote,
  HelpList,
  HowItLearns,
  useNoteTimer,
  withNoted,
  type FeedbackAction,
} from '../../src/ui/panel/WhatHelps';
import {
  activeTab,
  checkHealth,
  readLocal,
  readPassive,
  readReport,
  resetPassive,
  seedDemoHistory,
  sendPassiveFeedback,
  writeFit,
  writeSettings,
  type ActiveTab,
  type AiState,
  type Health,
  type TodayMeter,
} from './data';
import './popup.css';

type DemoName = 'none' | 'rosa' | 'typical' | 'reader';
const DEMOS: Array<{ name: DemoName; label: string; hint: string }> = [
  { name: 'none', label: 'None', hint: 'No warm-up: fit from browser settings and what WebAble learns' },
  { name: 'rosa', label: 'Rosa', hint: 'Large text, big steady clicks, calm pages' },
  { name: 'typical', label: 'Typical', hint: 'Default sizes' },
  { name: 'reader', label: 'Reader', hint: 'Very large text, stronger contrast' },
];

const PHASE: Record<TabReport['phase'], string> = {
  idle: 'Waiting',
  reading: 'Reading the page',
  tailored: 'Fitted, asking Jev',
  understood: 'Fitted and understood',
  calm: 'Calm view open',
  error: 'Some steps did not finish',
};

function fmtCost(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return '$0';
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  const digits = Math.min(7, Math.max(4, 1 - Math.floor(Math.log10(usd))));
  return `$${usd.toFixed(digits).replace(/(\.\d*?[1-9])0+$/, '$1')}`;
}
function fmtMs(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

function demoOf(fit: FitProfile | null): DemoName | null {
  if (!fit) return 'none';
  const v = fit?.calibration?.version ?? '';
  const hit = DEMOS.find((d) => v === `demo-${d.name}`);
  return hit ? hit.name : null;
}

function Switch(props: { checked: boolean; label: string; sub?: string; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      class="p-switch"
      role="switch"
      aria-checked={props.checked}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
    >
      <span class="p-switch-text">
        <span class="p-switch-title">{props.label}</span>
        {props.sub && <span class="p-switch-sub">{props.sub}</span>}
      </span>
      <span class="p-track" aria-hidden="true" />
    </button>
  );
}

type Dot = 'ok' | 'wait' | 'bad' | 'off';

function HeadStatus({ health, checked }: { health: Health | null; checked: boolean }) {
  if (!checked) return <span class="p-status" data-state="wait">Checking…</span>;
  if (!health) return <span class="p-status" data-state="bad">Server offline</span>;
  if (!health.ok) return <span class="p-status" data-state="wait">Server starting</span>;
  return (
    <span class="p-status" data-state={health.jev?.warm ? 'ok' : 'wait'}>
      {health.jev?.warm ? 'Ready' : 'Warming up'}
    </span>
  );
}

const AI_TEXT: Record<AiState, { value: string; dot: Dot; sub: string | null }> = {
  on: { value: 'On', dot: 'ok', sub: null },
  off: {
    value: 'Off',
    dot: 'off',
    sub: 'Calm view uses layouts made on this device, and Jev still picks between them.',
  },
  no_credits: {
    value: 'Off: no credits',
    dot: 'wait',
    sub: 'Calm view uses layouts made on this device, and Jev still picks between them. AI comes back on its own when credits return.',
  },
};

/** The server's HealthStatus: is Jev warm, and are the AI layouts on, off or out of credits. */
function ServerStatus({ health, checked, origin }: { health: Health | null; checked: boolean; origin: string }) {
  const host = origin.replace(/^https?:\/\//, '');
  if (!checked) {
    return (
      <section class="p-card p-rows" aria-label="Server">
        <div class="p-row">
          <span class="p-row-dot" data-state="wait" aria-hidden="true" />
          <span class="p-row-label">Checking the server at {host}…</span>
        </div>
      </section>
    );
  }
  if (!health) {
    return (
      <section class="p-card p-rows" aria-label="Server">
        <div class="p-row">
          <span class="p-row-dot" data-state="bad" aria-hidden="true" />
          <span class="p-row-label">Server offline</span>
          <span class="p-row-val">{host}</span>
        </div>
        <p class="p-row-sub">Pages are still fitted to your settings. Jev answers come back when the server is running.</p>
      </section>
    );
  }
  const warm = Boolean(health.jev?.warm);
  const model = health.jev?.model || 'Jev';
  const ai = AI_TEXT[health.ai ?? (health.openai === false ? 'off' : 'on')];
  return (
    <section class="p-card p-rows" aria-label="Server">
      <div class="p-row">
        <span class="p-row-dot" data-state={!health.ok ? 'wait' : warm ? 'ok' : 'wait'} aria-hidden="true" />
        <span class="p-row-label">Jev</span>
        <span class="p-row-val">
          {model} · {!health.ok ? 'starting' : warm ? 'warm' : 'warming up'}
        </span>
      </div>
      <div class="p-hr" />
      <div class="p-row">
        <span class="p-row-dot" data-state={ai.dot} aria-hidden="true" />
        <span class="p-row-label">AI layouts and Explain</span>
        <span class="p-row-val">{ai.value}</span>
      </div>
      {ai.sub && <p class="p-row-sub">{ai.sub}</p>}
    </section>
  );
}

interface PopNote {
  text: string;
  row: HelpRow;
  index: number;
  at: number;
}

/** "What helps you": the same rows as the in-page panel, from the background's passive state. */
function LearnedCard(props: {
  passive: PassiveFitState | null;
  loaded: boolean;
  fit: FitProfile | null;
  onFeedback: (row: HelpRow, action: FeedbackAction) => Promise<void>;
}) {
  const { passive, loaded, fit, onFeedback } = props;
  const [notes, setNotes] = useState<Record<string, PopNote>>({});
  const [open, setOpen] = useState(false);
  const [allRows, setAllRows] = useState(false);
  const headRef = useRef<HTMLHeadingElement>(null);
  useNoteTimer(notes, setNotes);

  const mac = isMac();
  const rows = passive ? withNoted(helpRows(passive, new Date(), mac), notes) : [];
  const on = rows.filter((r) => r.status === 'on').length;
  const maybe = rows.length - on;
  const act = (row: HelpRow, index: number, action: FeedbackAction) => {
    setNotes((cur) => ({ ...cur, [row.dim]: { text: feedbackNote(row, action), row, index, at: Date.now() } }));
    void onFeedback(row, action);
  };

  // An older background (no passive state): show the stored fit as before.
  let fitRows: Array<{ label: string; from: string; to: string }> = [];
  if (!passive && fit) {
    try {
      fitRows = describeFit(fit).filter((r) => r.to !== 'No change');
    } catch {
      fitRows = [];
    }
  }
  const settings = passive ? settingsLine(passive, mac) : null;

  return (
    <section class="p-card p-helps" aria-labelledby="p-helps-title">
      <div class="p-helps-head">
        <h2 class="p-title" id="p-helps-title" ref={headRef} tabIndex={-1}>
          What helps you
        </h2>
        {rows.length > 0 && (
          <span class="p-helps-count">
            {on > 0 ? `${on} on` : ''}
            {on > 0 && maybe > 0 ? ' · ' : ''}
            {maybe > 0 ? `${maybe} suggested` : ''}
          </span>
        )}
      </div>
      {!loaded ? (
        <p class="p-muted p-helps-pad">Loading…</p>
      ) : passive ? (
        rows.length > 0 ? (
          <HelpList rows={rows} notes={notes} onAct={act} onFocusLost={() => headRef.current?.focus({ preventScroll: true })} compact />
        ) : (
          <div class="wa-helps-empty">
            <p class="wa-helps-empty-title">{EMPTY_HELPS.title}</p>
            <p>{EMPTY_HELPS.body}</p>
            {settings && <p class="p-helps-settings">{settings}</p>}
          </div>
        )
      ) : fitRows.length > 0 ? (
        <>
          <dl class="p-fit p-helps-pad">
            {(allRows ? fitRows : fitRows.slice(0, 4)).map((r) => (
              <div key={r.label}>
                <dt>{r.label}</dt>
                <dd>
                  <span class="p-from">{r.from}</span>
                  <span class="p-arrow" aria-hidden="true">→</span>
                  <span class="sr">to</span>
                  <b>{r.to}</b>
                </dd>
              </div>
            ))}
          </dl>
          {fitRows.length > 4 && (
            <button class="p-link p-helps-pad" aria-expanded={allRows} onClick={() => setAllRows(!allRows)}>
              {allRows ? 'Show fewer' : `Show all ${fitRows.length}`}
            </button>
          )}
        </>
      ) : (
        <div class="wa-helps-empty">
          <p class="wa-helps-empty-title">{EMPTY_HELPS.title}</p>
          <p>{EMPTY_HELPS.body}</p>
        </div>
      )}
      <HowItLearns open={open} onToggle={() => setOpen(!open)} />
    </section>
  );
}

function Popup() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [fit, setFit] = useState<FitProfile | null>(null);
  const [today, setToday] = useState<TodayMeter | null>(null);
  const [tab, setTab] = useState<ActiveTab>({ id: null, url: '', origin: null });
  const [report, setReport] = useState<TabReport | null>(null);
  const [passive, setPassive] = useState<PassiveFitState | null>(null);
  const [passiveLoaded, setPassiveLoaded] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthChecked, setHealthChecked] = useState(false);
  // `reload`: the change needs a reload to show; fits and what WebAble learned refit open pages on their own.
  const [banner, setBanner] = useState<{ text: string; reload: boolean } | null>(null);
  const [busy, setBusy] = useState<'seed' | 'reset' | null>(null);
  const [options, setOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loading = useRef(false);

  const loadPassive = useCallback(async () => {
    const p = await readPassive();
    setPassive(p);
    setPassiveLoaded(true);
  }, []);

  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const [local, t] = await Promise.all([readLocal(), activeTab()]);
      setSettings(local.settings);
      setFit(local.fit);
      setToday(local.today);
      setTab(t);
      setReport(await readReport(t.id));
      await loadPassive();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      loading.current = false;
    }
  }, [loadPassive]);

  useEffect(() => {
    void load();
    const onChanged = () => void load();
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, [load]);

  const serverOrigin = settings?.serverOrigin ?? '';
  useEffect(() => {
    if (!serverOrigin) return;
    let alive = true;
    const run = async () => {
      const h = await checkHealth(serverOrigin);
      if (!alive) return;
      setHealth(h);
      setHealthChecked(true);
    };
    void run();
    const iv = setInterval(run, 5000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [serverOrigin]);

  const save = async (patch: Partial<Settings>) => {
    if (!settings) return;
    const next: Settings = { ...settings, ...patch };
    setSettings(next);
    setBanner({ text: 'Saved. Reload the page to apply.', reload: true });
    try {
      await writeSettings(next, patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const useDemo = async (name: DemoName) => {
    if (name === 'none') {
      setFit(null);
      setBanner({ text: 'Warm-up cleared. Open pages now fit from your settings and what WebAble learned.', reload: false });
      try {
        await writeFit(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      return;
    }
    const demo = DEMO_FITS?.[name];
    if (!demo) {
      setError('Demo fits are not available in this build.');
      return;
    }
    const next: FitProfile = { ...demo, createdAt: new Date().toISOString() };
    setFit(next);
    setBanner({ text: `${DEMOS.find((d) => d.name === name)?.label ?? 'Demo'} fit saved. Open pages fit again on their own.`, reload: false });
    try {
      await writeFit(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const feedback = async (row: HelpRow, action: FeedbackAction) => {
    const ok = await sendPassiveFeedback(row.dim, action);
    if (!ok) setError('WebAble could not save that. Try again in a moment.');
    await loadPassive();
  };

  const seed = async () => {
    setBusy('seed');
    setError(null);
    const ok = await seedDemoHistory();
    await loadPassive();
    setBusy(null);
    if (ok) {
      setBanner({ text: 'A week of learning added. Open pages fit again on their own.', reload: false });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    else setError('The demo week could not be added. Is WebAble running in this window?');
  };

  const fresh = async () => {
    setBusy('reset');
    setError(null);
    const ok = await resetPassive();
    await loadPassive();
    setBusy(null);
    if (ok) {
      setBanner({ text: 'Learning cleared. Open pages go back to your settings.', reload: false });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    else setError('WebAble could not start fresh. Try again in a moment.');
  };

  const openFitting = async () => {
    await chrome.tabs.create({ url: chrome.runtime.getURL('/fitting.html') });
    window.close();
  };

  const reload = async () => {
    if (tab.id == null) return;
    await chrome.tabs.reload(tab.id);
    setBanner(null);
    window.close();
  };

  if (!settings) {
    return (
      <main class="p">
        <header class="p-head">
          <h1>
            <span class="p-dot" /> WebAble
          </h1>
        </header>
        {error ? <p class="p-error">{error}</p> : <p class="p-muted">Loading…</p>}
      </main>
    );
  }

  const paused = tab.origin ? settings.pausedOrigins.includes(tab.origin) : false;
  const host = tab.origin ? tab.origin.replace(/^https?:\/\//, '') : null;
  const demo = demoOf(fit);
  const tookWarmup = hasWarmup(passive) || Boolean(fit && fit.calibration?.durationSec > 0 && !String(fit.calibration?.version ?? '').startsWith('demo-'));
  // The report's understanding summary; `cached` and `firstRead` are read if the engine includes them.
  const u = (report?.understanding ?? null) as
    | (NonNullable<TabReport['understanding']> & { cached?: boolean; firstRead?: JevMetrics })
    | null;
  const applied = report?.ops.filter((o) => o.status === 'applied').length ?? 0;
  const reversed = report?.ops.filter((o) => o.status === 'reversed').length ?? 0;
  const failed = report?.checks.filter((c) => !c.pass).length ?? 0;

  return (
    <main class="p">
      <header class="p-head">
        <h1>
          <span class="p-dot" data-on={String(settings.enabled && !paused)} /> WebAble
        </h1>
        <HeadStatus health={health} checked={healthChecked} />
      </header>

      {banner && (
        <div class="p-banner" role="status">
          <span>{banner.text}</span>
          {banner.reload && tab.id != null && tab.origin && (
            <button class="p-btn p-btn-sm p-btn-primary" onClick={() => void reload()}>
              Reload page
            </button>
          )}
        </div>
      )}

      <LearnedCard passive={passive} loaded={passiveLoaded} fit={fit} onFeedback={feedback} />

      <section class="p-warm">
        <button class="p-btn p-btn-primary p-btn-block" onClick={() => void openFitting()}>
          {tookWarmup ? 'Redo the warm-up' : 'Take the 70-second warm-up'}
        </button>
        <p class="p-warm-sub">
          {tookWarmup
            ? 'Tap along on a short news page and WebAble fits it again.'
            : 'Optional. WebAble already fits pages from your settings and learns as you go.'}
        </p>
      </section>

      <section class="p-card">
        <Switch
          checked={settings.enabled}
          label={settings.enabled ? 'WebAble is on' : 'WebAble is off'}
          sub="The original page is always one click away."
          onChange={(v) => void save({ enabled: v })}
        />
        <div class="p-hr" />
        <Switch
          checked={paused}
          disabled={!tab.origin}
          label={host ? `Pause on ${host}` : 'Pause on this site'}
          sub={tab.origin ? 'Show this site exactly as it is made.' : 'Not available on this page.'}
          onChange={(v) => {
            if (!tab.origin) return;
            const set = new Set(settings.pausedOrigins);
            if (v) set.add(tab.origin);
            else set.delete(tab.origin);
            void save({ pausedOrigins: [...set] });
          }}
        />
      </section>

      {report && tab.origin && (
        <section class="p-card p-pad">
          <h2 class="p-title">
            This page <span class="p-badge">{PHASE[report.phase] ?? report.phase}</span>
          </h2>
          {u ? (
            <>
              <div class="p-stats">
                <div>
                  <b>{(u.metrics.questions || u.firstRead?.questions || 0).toLocaleString('en-US')}</b>
                  <span>decisions</span>
                </div>
                <div>
                  <b>{fmtMs(u.metrics.wallMs)}</b>
                  <span>{u.cached ? 'this view' : 'page read'}</span>
                </div>
                <div>
                  <b>{u.cached ? '$0' : fmtCost(u.metrics.costUsd)}</b>
                  <span>{u.cached ? 'this view' : 'cost'}</span>
                </div>
              </div>
              {u.cached && (
                <p class="p-muted p-small">
                  From cache
                  {u.firstRead ? ` · first read ${fmtMs(u.firstRead.wallMs)}, ${fmtCost(u.firstRead.costUsd)}` : ''} · this view $0
                </p>
              )}
            </>
          ) : (
            <p class="p-muted">No Jev answers for this page yet.</p>
          )}
          <p class="p-muted p-small">
            {applied} {applied === 1 ? 'change' : 'changes'} on
            {reversed > 0 ? ` · ${reversed} reversed` : ''}
            {u ? ` · ${u.folded} folded · ${u.protected} protected` : ''}
            {failed > 0 ? ` · ${failed} ${failed === 1 ? 'check' : 'checks'} caught a problem` : ''}
          </p>
        </section>
      )}

      <section class="p-card p-pad p-demo-card" aria-labelledby="p-demo-title">
        <h2 class="p-title" id="p-demo-title">
          For demos
        </h2>
        <div class="p-demo-btns">
          <button class="p-btn p-btn-sm" disabled={busy !== null} onClick={() => void seed()}>
            {busy === 'seed' ? 'Adding…' : 'Show a week of learning'}
          </button>
          <button class="p-btn p-btn-sm" disabled={busy !== null} onClick={() => void fresh()}>
            {busy === 'reset' ? 'Clearing…' : 'Start fresh'}
          </button>
        </div>
        <p class="p-muted p-small">
          Adds zooms held on 4 sites over 3 days, and clicks that landed beside a button on 3 sites. Start fresh
          forgets what WebAble learned; your settings stay.
        </p>
        <div class="p-demo">
          <span class="p-demo-label">Demo fit</span>
          <div class="p-seg" role="group" aria-label="Demo fits">
            {DEMOS.map((d) => (
              <button
                key={d.name}
                class="p-seg-btn"
                aria-pressed={demo === d.name}
                title={d.hint}
                onClick={() => void useDemo(d.name)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <ServerStatus health={health} checked={healthChecked} origin={settings.serverOrigin} />

      <section class="p-card">
        <button class="p-disclosure" aria-expanded={options} onClick={() => setOptions(!options)}>
          <span>Options</span>
          <span class="p-chev" aria-hidden="true">›</span>
        </button>
        {options && (
          <>
            <div class="p-hr" />
            <Switch
              checked={settings.aiLayouts}
              label="AI layouts for Calm view"
              sub="Sends the page's structure and common interface words, never personal text, to OpenAI. Jev checks every layout."
              onChange={(v) => void save({ aiLayouts: v })}
            />
            <div class="p-hr" />
            <Switch
              checked={settings.explain}
              label="Explain on request"
              sub="Select a long passage to see it in plain words. Personal details are removed first."
              onChange={(v) => void save({ explain: v })}
            />
            <div class="p-hr" />
            <Switch
              checked={settings.lens}
              label="Start with Jev Lens on"
              sub="Show Jev's decisions on every page. Alt+Shift+L turns it on or off."
              onChange={(v) => void save({ lens: v })}
            />
          </>
        )}
      </section>

      {error && <p class="p-error">{error}</p>}

      <footer class="p-foot">
        <span>
          {today && today.decisions > 0
            ? `Today, new answers only: ${today.decisions.toLocaleString('en-US')} · ${fmtCost(today.usd)}`
            : 'Nothing you type is sent anywhere.'}
        </span>
        <span>{settings.serverOrigin.replace(/^https?:\/\//, '')}</span>
      </footer>
    </main>
  );
}

const root = document.getElementById('app');
if (root) render(<Popup />, root);
