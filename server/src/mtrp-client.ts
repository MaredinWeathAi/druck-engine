/**
 * MTRP Market Intelligence Client
 * ================================
 * Druck Engine's bridge to the MTRP anomaly engine — single source of truth
 * for signals/headlines across the whole Maredin platform.
 *
 * Why this exists:
 *   - MTRP already runs SEC Edgar polling + signal classification + cache
 *   - Druck-engine should consume that data rather than duplicate the work
 *   - One auth (MTRP_SERVICE_API_KEY) — bidirectional
 *
 * Configure via env:
 *   MTRP_URL             default: https://web-production-54c10.up.railway.app
 *   MTRP_SERVICE_API_KEY required (shared with MTRP)
 *
 * Exposes:
 *   - Router with proxy routes (/api/mtrp/*)
 *   - Helper functions for server-side use (getCriticalAlerts, getSignal, etc.)
 */

import { Router, Request, Response } from 'express';

const MTRP_URL = process.env.MTRP_URL || 'https://web-production-54c10.up.railway.app';
const MTRP_API_KEY = process.env.MTRP_SERVICE_API_KEY || '';

// ─── Shared types (match MTRP shape) ───────────────────────────────

export interface MTRPSignal {
  id: string;
  source: 'sec' | 'news' | 'social' | 'guru' | 'macro' | 'manual';
  sourceDetail: string;
  ticker: string;
  relatedTickers: string[];
  headline: string;
  url?: string;
  timestamp: string;
  impact: 'critical' | 'major' | 'significant' | 'noise';
  direction: 'positive' | 'negative' | 'mixed' | 'neutral';
  urgency: 'immediate' | 'today' | 'this_week' | 'monitor';
  cascade: 'high' | 'monitor' | 'low' | 'none';
  surpriseMagnitude: number;
  expectationVsActual?: { expected: number | string; actual: number | string };
  action: string;
  actionReason: string;
  isPortfolioHolding: boolean;
  isGuruHolding: boolean;
  deepDiveLink?: string;
}

// ─── Helper for server-side calls ──────────────────────────────────

async function mtrpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!MTRP_API_KEY) {
    throw new Error('MTRP_SERVICE_API_KEY env var not configured');
  }
  const res = await fetch(`${MTRP_URL}/api/v1/market-intel${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      'x-api-key': MTRP_API_KEY,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`MTRP ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export async function getMTRPCriticalAlerts(): Promise<MTRPSignal[]> {
  const { alerts } = await mtrpFetch<{ alerts: MTRPSignal[] }>('/critical');
  return alerts;
}

export async function getMTRPSignal(id: string): Promise<MTRPSignal | null> {
  try {
    const { signal } = await mtrpFetch<{ signal: MTRPSignal }>(`/signal/${id}`);
    return signal;
  } catch {
    return null;
  }
}

export async function searchMTRPHeadlines(params: {
  ticker?: string;
  impact?: string;
  source?: string;
  q?: string;
  portfolioOnly?: boolean;
  limit?: number;
}): Promise<MTRPSignal[]> {
  const qs = new URLSearchParams();
  if (params.ticker) qs.set('ticker', params.ticker);
  if (params.impact) qs.set('impact', params.impact);
  if (params.source) qs.set('source', params.source);
  if (params.q) qs.set('q', params.q);
  if (params.portfolioOnly) qs.set('portfolioOnly', '1');
  if (params.limit) qs.set('limit', String(params.limit));
  const { headlines } = await mtrpFetch<{ headlines: MTRPSignal[] }>(`/headlines?${qs}`);
  return headlines;
}

export async function getMTRPDigest(sinceISO?: string): Promise<unknown> {
  const qs = sinceISO ? `?since=${encodeURIComponent(sinceISO)}` : '';
  return mtrpFetch(`/digest${qs}`);
}

export async function getMTRPMonitorStatus(): Promise<unknown> {
  return mtrpFetch('/monitors');
}

/** Push a manually-discovered signal back to MTRP (so it appears in the unified feed). */
export async function publishMTRPSignal(detection: {
  ticker: string;
  headline: string;
  source?: string;
  sourceDetail?: string;
  url?: string;
  timestamp?: string;
  surpriseMagnitude?: number;
  cascade?: string;
}): Promise<MTRPSignal> {
  const { signal } = await mtrpFetch<{ signal: MTRPSignal }>('/signal', {
    method: 'POST',
    body: JSON.stringify(detection),
  });
  return signal;
}

// ─── Express router (proxies MTRP through druck-engine's API) ──────

const router = Router();

/** GET /api/mtrp/status — is the MTRP connection configured? */
router.get('/status', async (_req: Request, res: Response) => {
  if (!MTRP_API_KEY) {
    res.json({ configured: false, message: 'MTRP_SERVICE_API_KEY not set' });
    return;
  }
  try {
    const monitors = await getMTRPMonitorStatus();
    res.json({ configured: true, mtrpUrl: MTRP_URL, monitors });
  } catch (err) {
    res.json({ configured: false, error: (err as Error).message });
  }
});

/** GET /api/mtrp/headlines — proxied headline search */
router.get('/headlines', async (req: Request, res: Response) => {
  try {
    const headlines = await searchMTRPHeadlines({
      ticker: req.query.ticker as string | undefined,
      impact: req.query.impact as string | undefined,
      source: req.query.source as string | undefined,
      q: req.query.q as string | undefined,
      portfolioOnly: req.query.portfolioOnly === '1' || req.query.portfolioOnly === 'true',
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ headlines });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

/** GET /api/mtrp/critical — urgent alerts from MTRP */
router.get('/critical', async (_req: Request, res: Response) => {
  try {
    const alerts = await getMTRPCriticalAlerts();
    res.json({ alerts });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

/** GET /api/mtrp/signal/:id — fetch a specific signal for deep-dive */
router.get('/signal/:id', async (req: Request, res: Response) => {
  try {
    const signal = await getMTRPSignal(String(req.params.id));
    if (!signal) {
      res.status(404).json({ error: 'Signal not found' });
      return;
    }
    res.json({ signal });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

/** GET /api/mtrp/digest — proxy digest */
router.get('/digest', async (req: Request, res: Response) => {
  try {
    const since = typeof req.query.since === 'string' ? req.query.since : undefined;
    const digest = await getMTRPDigest(since);
    res.json(digest);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

export default router;
