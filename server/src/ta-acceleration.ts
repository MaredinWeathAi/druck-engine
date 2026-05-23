/**
 * Technical Analysis — Second Derivative Acceleration Engine
 * ==========================================================
 * Ported from Stock Master ta-engine.js into Druck Engine.
 * Druckenmiller-inspired framework: detect momentum shifts BEFORE price confirms.
 *
 * Algorithms:
 *   1. ROC-of-ROC (Rate of Change acceleration)
 *   2. Log Return Acceleration (smoothed)
 *   3. EMA Slope Acceleration (20-period)
 *   4. Divergence Signal Detection (2/3 confirmation)
 *
 * Regime Signals:
 *   Macro regime interpretation layer from Stock Master macro.js
 */

import { Router, Request, Response } from 'express';

const router = Router();

// ============================================================================
// TYPES
// ============================================================================

interface PriceBar {
  date: string;
  close: number;
  volume?: number;
}

interface NormalizedBar {
  day: number;
  date: string;
  close: number;
  volume: number;
}

interface TAResult {
  ticker: string;
  name: string;
  data: MergedBar[];
  signals: DivergenceSignal[];
  summary: TASummary;
}

interface MergedBar {
  day: number;
  date: string;
  close: number;
  volume: number;
  roc_20: number | null;
  roc_accel: number | null;
  log_ret: number | null;
  log_accel: number | null;
  ema_20: number | null;
  ema_slope: number | null;
  ema_accel: number | null;
}

interface DivergenceSignal {
  day: number;
  date: string;
  price: number;
  type: 'DECEL_DIVERGENCE' | 'ACCEL_DIVERGENCE';
  strength: number;  // 2 or 3 out of 3 confirmations
  label: string;
}

interface TASummary {
  ticker: string;
  currentPrice: number;
  roc20: number | null;
  rocAccel: number | null;
  logAccelSmooth: number | null;
  emaAccel: number | null;
  trend: 'accelerating' | 'decelerating' | 'neutral';
  recentSignals: DivergenceSignal[];
  signalCount: number;
}

// ============================================================================
// REGIME SIGNALS — Macro regime interpretation
// ============================================================================

export const REGIME_SIGNALS = [
  {
    signal: 'Fed cutting into sticky inflation',
    impact: 'Mixed — easing supports risk but reflation risk limits downside protection',
    bias: 'neutral' as const,
  },
  {
    signal: 'Yield curve re-steepened positive',
    impact: 'Historically bullish for banks & cyclicals 6-12mo after un-inversion',
    bias: 'bullish' as const,
  },
  {
    signal: 'Net liquidity expanding',
    impact: 'Supportive for risk assets, especially growth & mega-cap',
    bias: 'bullish' as const,
  },
  {
    signal: 'CPI stuck above 2% target',
    impact: 'Limits Fed flexibility, favors pricing power / value names',
    bias: 'cautious' as const,
  },
];

// ============================================================================
// ALGORITHM #1: Rate of Change of Rate of Change (ROC of ROC)
// ============================================================================

function calcRocOfRoc(prices: NormalizedBar[], n = 20, m = 5) {
  const result: (NormalizedBar & { roc_20: number | null; roc_accel: number | null })[] = [];
  for (let i = 0; i < prices.length; i++) {
    const roc = i >= n ? (prices[i].close / prices[i - n].close - 1) * 100 : null;
    const rocLag = i >= n + m
      ? (prices[i - m].close / prices[i - m - n].close - 1) * 100 : null;
    const accel = roc !== null && rocLag !== null ? roc - rocLag : null;
    result.push({
      ...prices[i],
      roc_20: roc !== null ? Math.round(roc * 1000) / 1000 : null,
      roc_accel: accel !== null ? Math.round(accel * 1000) / 1000 : null,
    });
  }
  return result;
}

// ============================================================================
// ALGORITHM #2: Log Return Acceleration (5-day smoothed)
// ============================================================================

function calcLogReturnAccel(prices: NormalizedBar[]) {
  const result: (NormalizedBar & { log_ret: number | null; log_accel: number | null; log_accel_smooth: number | null })[] = [];
  for (let i = 0; i < prices.length; i++) {
    const logRet = i >= 1
      ? (Math.log(prices[i].close) - Math.log(prices[i - 1].close)) * 100 : null;
    const logRetPrev = i >= 2
      ? (Math.log(prices[i - 1].close) - Math.log(prices[i - 2].close)) * 100 : null;
    const accel = logRet !== null && logRetPrev !== null ? logRet - logRetPrev : null;
    let smoothAccel: number | null = null;
    if (i >= 6) {
      let sum = 0;
      for (let j = 0; j < 5; j++) {
        const lr = (Math.log(prices[i - j].close) - Math.log(prices[i - j - 1].close)) * 100;
        const lrp = (Math.log(prices[i - j - 1].close) - Math.log(prices[i - j - 2].close)) * 100;
        sum += lr - lrp;
      }
      smoothAccel = sum / 5;
    }
    result.push({
      ...prices[i],
      log_ret: logRet !== null ? Math.round(logRet * 1000) / 1000 : null,
      log_accel: accel !== null ? Math.round(accel * 1000) / 1000 : null,
      log_accel_smooth: smoothAccel !== null ? Math.round(smoothAccel * 1000) / 1000 : null,
    });
  }
  return result;
}

// ============================================================================
// ALGORITHM #3: EMA Slope Acceleration
// ============================================================================

function calcEmaSlopeAccel(prices: NormalizedBar[], period = 20) {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  const result: (NormalizedBar & { ema_20: number; ema_slope: number | null; ema_accel: number | null })[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i === 0) { ema.push(prices[i].close); }
    else { ema.push(prices[i].close * k + ema[i - 1] * (1 - k)); }
    const slope = i >= 1 ? ema[i] - ema[i - 1] : null;
    const slopePrev = i >= 2 ? ema[i - 1] - ema[i - 2] : null;
    const accel = slope !== null && slopePrev !== null ? slope - slopePrev : null;
    result.push({
      ...prices[i],
      ema_20: Math.round(ema[i] * 100) / 100,
      ema_slope: slope !== null ? Math.round(slope * 1000) / 1000 : null,
      ema_accel: accel !== null ? Math.round(accel * 1000) / 1000 : null,
    });
  }
  return result;
}

// ============================================================================
// SIGNAL DETECTION: Divergence Detector (Druckenmiller's Edge)
// ============================================================================

function detectSignals(
  rocData: ReturnType<typeof calcRocOfRoc>,
  logData: ReturnType<typeof calcLogReturnAccel>,
  emaData: ReturnType<typeof calcEmaSlopeAccel>,
): DivergenceSignal[] {
  const signals: DivergenceSignal[] = [];
  for (let i = 25; i < rocData.length; i++) {
    // DECELERATION: price rising but momentum fading (bearish divergence)
    const priceRising = rocData[i].close > rocData[i - 5].close;
    const rocAccelNeg = rocData[i].roc_accel !== null && rocData[i].roc_accel! < -0.5;
    const logAccelNeg = logData[i].log_accel_smooth !== null && logData[i].log_accel_smooth! < -0.08;
    const emaAccelNeg = emaData[i].ema_accel !== null && emaData[i].ema_accel! < -0.1;
    const confirmations = [rocAccelNeg, logAccelNeg, emaAccelNeg].filter(Boolean).length;

    if (priceRising && confirmations >= 2) {
      signals.push({
        day: i, date: rocData[i].date, price: rocData[i].close,
        type: 'DECEL_DIVERGENCE', strength: confirmations,
        label: `Deceleration divergence (${confirmations}/3 confirm)`,
      });
    }

    // ACCELERATION: price falling but momentum building (bullish divergence)
    const priceFalling = rocData[i].close < rocData[i - 5].close;
    const rocAccelPos = rocData[i].roc_accel !== null && rocData[i].roc_accel! > 0.5;
    const logAccelPos = logData[i].log_accel_smooth !== null && logData[i].log_accel_smooth! > 0.08;
    const emaAccelPos = emaData[i].ema_accel !== null && emaData[i].ema_accel! > 0.1;
    const posConfirmations = [rocAccelPos, logAccelPos, emaAccelPos].filter(Boolean).length;

    if (priceFalling && posConfirmations >= 2) {
      signals.push({
        day: i, date: rocData[i].date, price: rocData[i].close,
        type: 'ACCEL_DIVERGENCE', strength: posConfirmations,
        label: `Acceleration divergence (${posConfirmations}/3 confirm)`,
      });
    }
  }
  // Deduplicate: only keep signals at least 5 days apart
  const deduped: DivergenceSignal[] = [];
  signals.forEach((s) => {
    if (deduped.length === 0 || s.day - deduped[deduped.length - 1].day >= 5) {
      deduped.push(s);
    }
  });
  return deduped;
}

// ============================================================================
// FULL TA COMPUTATION
// ============================================================================

export function computeFullTA(ticker: string, name: string, priceArray: PriceBar[]): TAResult | null {
  if (!priceArray || priceArray.length < 30) return null;

  const prices: NormalizedBar[] = priceArray.map((p, i) => ({
    day: i,
    date: formatDate(p.date),
    close: p.close,
    volume: p.volume || 0,
  }));

  const roc = calcRocOfRoc(prices);
  const log = calcLogReturnAccel(prices);
  const ema = calcEmaSlopeAccel(prices);
  const signals = detectSignals(roc, log, ema);

  const merged: MergedBar[] = prices.map((p, i) => ({
    ...p,
    roc_20: roc[i].roc_20,
    roc_accel: roc[i].roc_accel,
    log_ret: log[i].log_ret,
    log_accel: log[i].log_accel_smooth,
    ema_20: ema[i].ema_20,
    ema_slope: ema[i].ema_slope,
    ema_accel: ema[i].ema_accel,
  }));

  const last = merged[merged.length - 1];
  const recentSignals = signals.filter(s => s.day >= prices.length - 20);

  let trend: 'accelerating' | 'decelerating' | 'neutral' = 'neutral';
  const accelValues = [last.roc_accel, last.log_accel, last.ema_accel].filter(v => v !== null) as number[];
  if (accelValues.length > 0) {
    const avgAccel = accelValues.reduce((s, v) => s + v, 0) / accelValues.length;
    if (avgAccel > 0.1) trend = 'accelerating';
    else if (avgAccel < -0.1) trend = 'decelerating';
  }

  const summary: TASummary = {
    ticker,
    currentPrice: last.close,
    roc20: last.roc_20,
    rocAccel: last.roc_accel,
    logAccelSmooth: last.log_accel,
    emaAccel: last.ema_accel,
    trend,
    recentSignals,
    signalCount: signals.length,
  };

  return { ticker, name, data: merged, signals, summary };
}

// ============================================================================
// CONSENSUS BUILDER — Multi-guru overlap analysis
// ============================================================================

interface GuruHolding {
  ticker: string;
  guruCount: number;
  consensusWeight: number;
  holders: string[];
}

export function buildConsensus(positions: Array<{
  ticker: string;
  burryPct: number;
  klarmanPct: number;
  druckenmillerPct: number;
  einhornPct: number;
  greenbergPct: number;
  ackmanPct: number;
  abramsPct: number;
  tepperPct: number;
}>): GuruHolding[] {
  const guruNames = ['Burry', 'Klarman', 'Druckenmiller', 'Einhorn', 'Greenberg', 'Ackman', 'Abrams', 'Tepper'];
  const guruKeys = ['burryPct', 'klarmanPct', 'druckenmillerPct', 'einhornPct', 'greenbergPct', 'ackmanPct', 'abramsPct', 'tepperPct'] as const;

  return positions
    .map(p => {
      const holders: string[] = [];
      let weight = 0;
      guruKeys.forEach((key, idx) => {
        const val = (p as any)[key];
        if (val > 0) {
          holders.push(guruNames[idx]);
          weight += val;
        }
      });
      return {
        ticker: p.ticker,
        guruCount: holders.length,
        consensusWeight: Math.round(weight * 100) / 100,
        holders,
      };
    })
    .filter(h => h.guruCount >= 2)
    .sort((a, b) => b.guruCount - a.guruCount || b.consensusWeight - a.consensusWeight);
}

// ============================================================================
// REST ENDPOINTS
// ============================================================================

// GET /api/ta/status
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    module: 'TA Acceleration Engine',
    version: '1.0.0',
    algorithms: ['ROC-of-ROC', 'Log Return Acceleration', 'EMA Slope Acceleration'],
    signalTypes: ['DECEL_DIVERGENCE', 'ACCEL_DIVERGENCE'],
    regimeSignals: REGIME_SIGNALS.length,
  });
});

// GET /api/ta/regime — Current macro regime signals
router.get('/regime', (_req: Request, res: Response) => {
  const bullish = REGIME_SIGNALS.filter(s => s.bias === 'bullish').length;
  const cautious = REGIME_SIGNALS.filter(s => s.bias === 'cautious').length;
  const neutral = REGIME_SIGNALS.filter(s => s.bias === 'neutral').length;

  res.json({
    signals: REGIME_SIGNALS,
    summary: {
      bullish,
      cautious,
      neutral,
      netBias: bullish > cautious ? 'bullish' : cautious > bullish ? 'cautious' : 'mixed',
    },
  });
});

// GET /api/ta/consensus — Multi-guru consensus holdings
router.get('/consensus', (_req: Request, res: Response) => {
  // Import guru positions from market-intel at runtime
  try {
    // We'll rely on the guru data being passed in from index.ts
    res.json({
      message: 'Use /api/intel/guru endpoint for guru data, then compute consensus client-side or call /api/ta/consensus with positions body',
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to compute consensus' });
  }
});

// POST /api/ta/analyze — Run full TA on provided price data
router.post('/analyze', (req: Request, res: Response) => {
  const { ticker, name, prices } = req.body;
  if (!ticker || !prices || !Array.isArray(prices)) {
    return res.status(400).json({ error: 'Required: ticker, name, prices[]' });
  }

  const result = computeFullTA(ticker, name || ticker, prices);
  if (!result) {
    return res.status(400).json({ error: 'Insufficient price data (need 30+ bars)' });
  }

  res.json(result);
});

// POST /api/ta/batch — Run TA on multiple tickers
router.post('/batch', (req: Request, res: Response) => {
  const { tickers } = req.body; // Array of { ticker, name, prices[] }
  if (!Array.isArray(tickers)) {
    return res.status(400).json({ error: 'Required: tickers[] array' });
  }

  const results: TAResult[] = [];
  for (const t of tickers) {
    const result = computeFullTA(t.ticker, t.name || t.ticker, t.prices);
    if (result) results.push(result);
  }

  res.json({
    analyzed: results.length,
    results: results.map(r => r.summary),
    fullData: results,
  });
});

export default router;

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
