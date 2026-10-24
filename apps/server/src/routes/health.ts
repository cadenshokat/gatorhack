// GET /health and GET /v1/stats.
import type { Hono } from 'hono';
import { fitSpecJsonSchema } from '@webable/core';
import { DEEP_ENABLED, OPENAI_BUDGET_USD } from '../config';
import { jevCacheInfo, jevHealth } from '../jev';
import { openAiAvailable } from '../openai';
import { openAiSpentUsd, statsSnapshot } from '../stats';
import { round } from '../util';

export function registerHealth(app: Hono): void {
  app.get('/health', (c) => {
    const jev = jevHealth();
    return c.json({
      ok: jev.key,
      jev: { warm: jev.warm, model: jev.model, served: jev.served, key: jev.key, lastError: jev.lastError },
      openai: openAiAvailable(),
      layouts: {
        schema: !!fitSpecJsonSchema && Object.keys(fitSpecJsonSchema).length > 0,
        deep: DEEP_ENABLED && openAiAvailable(),
        budgetLeftUsd: round(Math.max(0, OPENAI_BUDGET_USD - openAiSpentUsd()), 4),
      },
      version: 'webable-server.1',
    });
  });

  app.get('/v1/stats', (c) => c.json({ ...statsSnapshot(), jevCache: jevCacheInfo() }));
}
