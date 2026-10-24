// Owner: D2. Toolbar popup: on/off, pause on this site, the fitting, demo fits, the current fit, this page, server status.
import { render } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { DEMO_FITS, describeFit, type FitProfile, type Settings, type TabReport } from '@webable/core';
import {
  activeTab,
  checkHealth,
  readLocal,
  readReport,
  writeFit,
  writeSettings,
  type ActiveTab,
  type Health,
  type TodayMeter,
} from './data';
import './popup.css';

type DemoName = 'rosa' | 'typical' | 'reader';
const DEMOS: Array<{ name: DemoName; label: string; hint: string }> = [
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

function ServerLine({ health, checked, origin }: { health: Health | null; checked: boolean; origin: string }) {
  const host = origin.replace(/^https?:\/\//, '');
  if (!checked) return <span class="p-status" data-state="wait">Checking the server…</span>;
  if (!health) {
    return (
      <span class="p-status" data-state="bad" title={`Nothing answered at ${host}. Start it with: pnpm dev:server`}>
        Server offline
      </span>
    );
  }
  if (!health.ok) return <span class="p-status" data-state="wait">Server is starting</span>;
  const warm = health.jev?.warm;
  return (
    <span class="p-status" data-state={warm ? 'ok' : 'wait'}>
      {health.jev?.model ?? 'Jev'} {warm ? 'ready' : 'warming up'}
      {health.openai === false ? ' · AI layouts off' : ''}
    </span>
  );
}

function Popup() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [fit, setFit] = useState<FitProfile | null>(null);
  const [today, setToday] = useState<TodayMeter | null>(null);
  const [tab, setTab] = useState<ActiveTab>({ id: null, url: '', origin: null });
  const [report, setReport] = useState<TabReport | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthChecked, setHealthChecked] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [allRows, setAllRows] = useState(false);
  const [options, setOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [local, t] = await Promise.all([readLocal(), activeTab()]);
      setSettings(local.settings);
      setFit(local.fit);
      setToday(local.today);
      setTab(t);
      setReport(await readReport(t.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

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
    setDirty(true);
    try {
      await writeSettings(next, patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const useDemo = async (name: DemoName) => {
    const demo = DEMO_FITS?.[name];
    if (!demo) {
      setError('Demo fits are not available in this build.');
      return;
    }
    const next: FitProfile = { ...demo, createdAt: new Date().toISOString() };
    setFit(next);
    setDirty(true);
    try {
      await writeFit(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const openFitting = async () => {
    await chrome.tabs.create({ url: chrome.runtime.getURL('/fitting.html') });
    window.close();
  };

  const reload = async () => {
    if (tab.id == null) return;
    await chrome.tabs.reload(tab.id);
    setDirty(false);
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
  let rows: Array<{ label: string; from: string; to: string }> = [];
  try {
    rows = fit ? describeFit(fit) : [];
  } catch {
    rows = [];
  }
  const changes = rows.filter((r) => r.to !== 'No change');
  const u = report?.understanding ?? null;
  const applied = report?.ops.filter((o) => o.status === 'applied').length ?? 0;
  const reversed = report?.ops.filter((o) => o.status === 'reversed').length ?? 0;
  const failed = report?.checks.filter((c) => !c.pass).length ?? 0;

  return (
    <main class="p">
      <header class="p-head">
        <h1>
          <span class="p-dot" data-on={String(settings.enabled && !paused)} /> WebAble
        </h1>
        <ServerLine health={health} checked={healthChecked} origin={settings.serverOrigin} />
      </header>

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

      {dirty && tab.id != null && tab.origin && (
        <div class="p-banner" role="status">
          <span>Saved. Reload the page to apply.</span>
          <button class="p-btn p-btn-sm p-btn-primary" onClick={() => void reload()}>
            Reload page
          </button>
        </div>
      )}

      {report && tab.origin && (
        <section class="p-card p-pad">
          <h2 class="p-title">
            This page <span class="p-badge">{PHASE[report.phase] ?? report.phase}</span>
          </h2>
          {u ? (
            <div class="p-stats">
              <div>
                <b>{u.metrics.questions.toLocaleString('en-US')}</b>
                <span>decisions</span>
              </div>
              <div>
                <b>{fmtMs(u.metrics.wallMs)}</b>
                <span>Jev</span>
              </div>
              <div>
                <b>{fmtCost(u.metrics.costUsd)}</b>
                <span>cost</span>
              </div>
            </div>
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

      <section class="p-card p-pad">
        <h2 class="p-title">
          Your fit
          {demo && <span class="p-badge">Demo: {DEMOS.find((d) => d.name === demo)?.label}</span>}
        </h2>
        {fit ? (
          changes.length > 0 ? (
            <dl class="p-fit">
              {(allRows ? changes : changes.slice(0, 4)).map((r) => (
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
          ) : (
            <p class="p-muted">Your fit keeps pages as they are made.</p>
          )
        ) : (
          <p class="p-muted">No fit yet. The fitting takes about two minutes and every part can be skipped.</p>
        )}
        {fit && changes.length > 4 && (
          <button class="p-link" aria-expanded={allRows} onClick={() => setAllRows(!allRows)}>
            {allRows ? 'Show fewer' : `Show all ${changes.length}`}
          </button>
        )}
        <button class="p-btn p-btn-primary p-btn-block" onClick={() => void openFitting()}>
          {fit ? 'Run the fitting again' : 'Run the fitting'}
        </button>
        <div class="p-demo">
          <span class="p-demo-label">Use a demo fit</span>
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
          sub="Show Jev's decisions on every page. Alt+J toggles it anytime."
          onChange={(v) => void save({ lens: v })}
        />
          </>
        )}
      </section>

      {error && <p class="p-error">{error}</p>}

      <footer class="p-foot">
        <span>
          {today && today.decisions > 0
            ? `Today: ${today.decisions.toLocaleString('en-US')} decisions · ${fmtCost(today.usd)}`
            : 'Nothing you type is sent anywhere.'}
        </span>
        <span>{settings.serverOrigin.replace(/^https?:\/\//, '')}</span>
      </footer>
    </main>
  );
}

const root = document.getElementById('app');
if (root) render(<Popup />, root);
