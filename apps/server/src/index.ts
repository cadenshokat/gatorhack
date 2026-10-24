// WebAble local server: holds the keys, talks to Jev and OpenAI, serves the demo pages. 127.0.0.1:41741 only.
import { serve } from '@hono/node-server';
import { JEV_MODEL } from '@webable/core';
import { createApp } from './app';
import { HOST, PORT, jevKey, openAiKey } from './config';
import { startKeepWarm, warmJev } from './jev';
import { log } from './util';

const app = createApp();

const server = serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
  log('listening', { url: `http://${HOST}:${info.port}`, jevKey: jevKey() !== null, openaiKey: openAiKey() !== null, model: JEV_MODEL });
  void warmJev().then((r) => log('jev warm-up', { ok: r.ok, ms: r.ms, server: r.serverMs }));
});

const stopKeepWarm = startKeepWarm();

server.on('error', (e: NodeJS.ErrnoException) => {
  if (e.code === 'EADDRINUSE') log('port in use; is another WebAble server running?', { port: PORT });
  else log('server error', { code: e.code ?? 'unknown' });
  process.exit(1);
});

function shutdown(signal: string): void {
  log('shutting down', { signal });
  stopKeepWarm();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1_500).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
