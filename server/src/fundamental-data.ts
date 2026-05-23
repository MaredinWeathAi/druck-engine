/**
 * Fundamental & Valuation Data Module
 * =====================================
 * GuruFocus API integration for fundamental metrics, valuation multiples,
 * and financial data. Also pulls select data from Yahoo Finance as fallback.
 *
 * Covers:
 *   - Revenue growth, operating/net margins, ROIC, FCF yield
 *   - Forward P/E, EV/EBITDA, EV/Sales, PEG ratio
 *   - Historical multiple ranges (current vs 5yr avg/high/low)
 *   - Earnings surprise history
 *   - Insider activity
 *
 * Caching: 24-hour cache per ticker to respect API rate limits
 */

import { Router, Request, Response } from 'express';

const router = Router();

const GURUFOCUS_API_KEY = process.env.GURUFOCUS_API_KEY || '';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// CACHING
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const fundamentalCache: Map<string, CacheEntry<any>> = new Map();

function getCached<T>(key: string): T | null {
  const entry = fundamentalCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_DURATION) return entry.data;
  return null;
}

function setCache<T>(key: string, data: T): void {
  fundamentalCache.set(key, { data, timestamp: Date.now() });
}

// ============================================================================
// GURUFOCUS API HELPERS
// ============================================================================

async function gfFetch(endpoint: string): Promise<any | null> {
  if (!GURUFOCUS_API_KEY) return null;
  try {
    const url = `https://api.gurufocus.com/public/user/${GURUFOCUS_API_KEY}${endpoint}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`GuruFocus API error ${response.status} for ${endpoint}`);
      return null;
    }
    return await response.json();
  } catch (err) {
    console.error(`GuruFocus fetch error for ${endpoint}:`, err);
    return null;
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface FundamentalData {
  ticker: string;
  company: string;
  sector: string;
  industry: string;
  marketCap: number | null;        // billions
  // Growth
  revenueGrowthYoY: number | null;
  revenueGrowth3yr: number | null;
  epsGrowthYoY: number | null;
  epsGrowth3yr: number | null;
  // Profitability
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  roic: number | null;
  roe: number | null;
  roa: number | null;
  // Cash Flow
  fcfYield: number | null;
  fcfMargin: number | null;
  fcfPerShare: number | null;
  // Balance Sheet
  debtToEquity: number | null;
  currentRatio: number | null;
  interestCoverage: number | null;
  // Quality
  piotroskiFScore: number | null;
  altmanZScore: number | null;
  // Insider Activity
  insiderBuys3m: number;
  insiderSells3m: number;
  insiderNetPct: number | null;
}

export interface ValuationData {
  ticker: string;
  // Current multiples
  peTrailing: number | null;
  peForward: number | null;
  evToEbitda: number | null;
  evToSales: number | null;
  priceToBook: number | null;
  priceToFcf: number | null;
  pegRatio: number | null;
  dividendYield: number | null;
  // Historical context (5yr)
  pe5yrAvg: number | null;
  pe5yrHigh: number | null;
  pe5yrLow: number | null;
  evEbitda5yrAvg: number | null;
  // Relative valuation
  pePctile: number | null;       // where current PE sits in 5yr range (0-100)
  evEbitdaPctile: number | null;
  // GF Value
  gfValue: number | null;        // GuruFocus intrinsic value estimate
  gfValueMargin: number | null;  // % above/below GF Value (negative = undervalued)
}

export interface EarningsSurprise {
  quarter: string;
  date: string;
  estimatedEps: number;
  actualEps: number;
  surprisePct: number;
  revenueEstimate: number | null;
  revenueActual: number | null;
  revenueSurprisePct: number | null;
}

export interface FullFundamentalResult {
  ticker: string;
  fundamentals: FundamentalData;
  valuation: ValuationData;
  earningsSurprises: EarningsSurprise[];
  lastUpdated: string;
  dataSource: 'gurufocus' | 'yahoo' | 'fallback';
}

// ============================================================================
// GURUFOCUS DATA FETCHERS
// ============================================================================

async function fetchFundamentals(ticker: string): Promise<FundamentalData> {
  const defaults: FundamentalData = {
    ticker, company: ticker, sector: '', industry: '',
    marketCap: null,
    revenueGrowthYoY: null, revenueGrowth3yr: null,
    epsGrowthYoY: null, epsGrowth3yr: null,
    grossMargin: null, operatingMargin: null, netMargin: null,
    roic: null, roe: null, roa: null,
    fcfYield: null, fcfMargin: null, fcfPerShare: null,
    debtToEquity: null, currentRatio: null, interestCoverage: null,
    piotroskiFScore: null, altmanZScore: null,
    insiderBuys3m: 0, insiderSells3m: 0, insiderNetPct: null,
  };

  // Try GuruFocus summary endpoint
  const summary = await gfFetch(`/stock/${ticker}/summary`);
  if (!summary) return defaults;

  const s = summary?.summary ?? summary;

  try {
    return {
      ticker,
      company: s?.general?.company ?? ticker,
      sector: s?.general?.sector ?? '',
      industry: s?.general?.industry ?? '',
      marketCap: safeNum(s?.general?.mktcap, 1e9), // convert to billions
      // Growth
      revenueGrowthYoY: safeNum(s?.growth?.revenue_growth),
      revenueGrowth3yr: safeNum(s?.growth?.revenue_3y_growth),
      epsGrowthYoY: safeNum(s?.growth?.eps_growth),
      epsGrowth3yr: safeNum(s?.growth?.eps_3y_growth),
      // Profitability
      grossMargin: safeNum(s?.profitability?.grossmargin),
      operatingMargin: safeNum(s?.profitability?.operatingmargin),
      netMargin: safeNum(s?.profitability?.netmargin),
      roic: safeNum(s?.profitability?.roic),
      roe: safeNum(s?.profitability?.roe),
      roa: safeNum(s?.profitability?.roa),
      // Cash Flow
      fcfYield: safeNum(s?.valuation?.fcf_yield),
      fcfMargin: safeNum(s?.profitability?.fcf_margin),
      fcfPerShare: safeNum(s?.per_share?.fcf_per_share),
      // Balance Sheet
      debtToEquity: safeNum(s?.financial_strength?.debt_to_equity),
      currentRatio: safeNum(s?.financial_strength?.current_ratio),
      interestCoverage: safeNum(s?.financial_strength?.interest_coverage),
      // Quality
      piotroskiFScore: safeNum(s?.financial_strength?.piotroski_f_score),
      altmanZScore: safeNum(s?.financial_strength?.altman_z_score),
      // Insider — filled from separate endpoint
      insiderBuys3m: 0,
      insiderSells3m: 0,
      insiderNetPct: null,
    };
  } catch (err) {
    console.error(`Error parsing GuruFocus fundamentals for ${ticker}:`, err);
    return defaults;
  }
}

async function fetchValuation(ticker: string): Promise<ValuationData> {
  const defaults: ValuationData = {
    ticker,
    peTrailing: null, peForward: null, evToEbitda: null, evToSales: null,
    priceToBook: null, priceToFcf: null, pegRatio: null, dividendYield: null,
    pe5yrAvg: null, pe5yrHigh: null, pe5yrLow: null, evEbitda5yrAvg: null,
    pePctile: null, evEbitdaPctile: null,
    gfValue: null, gfValueMargin: null,
  };

  const summary = await gfFetch(`/stock/${ticker}/summary`);
  if (!summary) return defaults;

  const s = summary?.summary ?? summary;

  try {
    const pe = safeNum(s?.valuation?.pe);
    const peForward = safeNum(s?.valuation?.forward_pe);
    const evEbitda = safeNum(s?.valuation?.ev_to_ebitda);
    const pe5yrHigh = safeNum(s?.valuation?.pe_high_5y);
    const pe5yrLow = safeNum(s?.valuation?.pe_low_5y);
    const pe5yrAvg = pe5yrHigh !== null && pe5yrLow !== null
      ? Math.round(((pe5yrHigh + pe5yrLow) / 2) * 100) / 100 : null;

    // PE percentile within 5yr range
    let pePctile = null;
    if (pe !== null && pe5yrHigh !== null && pe5yrLow !== null && pe5yrHigh > pe5yrLow) {
      pePctile = Math.round(((pe - pe5yrLow) / (pe5yrHigh - pe5yrLow)) * 100);
      pePctile = Math.max(0, Math.min(100, pePctile));
    }

    return {
      ticker,
      peTrailing: pe,
      peForward,
      evToEbitda: evEbitda,
      evToSales: safeNum(s?.valuation?.ev_to_revenue),
      priceToBook: safeNum(s?.valuation?.pb),
      priceToFcf: safeNum(s?.valuation?.price_to_fcf),
      pegRatio: safeNum(s?.valuation?.peg),
      dividendYield: safeNum(s?.dividend?.yield),
      pe5yrAvg,
      pe5yrHigh,
      pe5yrLow,
      evEbitda5yrAvg: safeNum(s?.valuation?.ev_to_ebitda_5y_avg),
      pePctile,
      evEbitdaPctile: null, // computed if we get historical EV/EBITDA
      gfValue: safeNum(s?.valuation?.gf_value),
      gfValueMargin: safeNum(s?.valuation?.gf_value_margin),
    };
  } catch (err) {
    console.error(`Error parsing GuruFocus valuation for ${ticker}:`, err);
    return defaults;
  }
}

async function fetchEarningsSurprises(ticker: string): Promise<EarningsSurprise[]> {
  // GuruFocus earnings data
  const data = await gfFetch(`/stock/${ticker}/earnings`);
  if (!data) return [];

  try {
    const quarterly = data?.annual_data ?? data?.quarterly ?? data;
    if (!Array.isArray(quarterly)) return [];

    return quarterly.slice(0, 8).map((q: any) => ({
      quarter: q?.quarter ?? q?.fiscal_quarter ?? '',
      date: q?.date ?? q?.report_date ?? '',
      estimatedEps: parseFloat(q?.estimated_eps ?? q?.eps_estimate ?? 0),
      actualEps: parseFloat(q?.actual_eps ?? q?.eps_actual ?? 0),
      surprisePct: parseFloat(q?.surprise_pct ?? q?.eps_surprise_pct ?? 0),
      revenueEstimate: safeNum(q?.revenue_estimate),
      revenueActual: safeNum(q?.revenue_actual),
      revenueSurprisePct: safeNum(q?.revenue_surprise_pct),
    }));
  } catch (err) {
    console.error(`Error parsing earnings for ${ticker}:`, err);
    return [];
  }
}

async function fetchInsiderActivity(ticker: string): Promise<{ buys: number; sells: number; netPct: number | null }> {
  const data = await gfFetch(`/stock/${ticker}/insider`);
  if (!data) return { buys: 0, sells: 0, netPct: null };

  try {
    const trades = Array.isArray(data) ? data : data?.trades ?? [];
    const threeMonthsAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    let buys = 0, sells = 0;

    for (const t of trades) {
      const tradeDate = new Date(t?.date ?? t?.filing_date ?? 0).getTime();
      if (tradeDate < threeMonthsAgo) continue;
      const action = (t?.type ?? t?.action ?? '').toLowerCase();
      if (action.includes('buy') || action.includes('purchase')) buys++;
      else if (action.includes('sell') || action.includes('sale')) sells++;
    }

    const total = buys + sells;
    return { buys, sells, netPct: total > 0 ? Math.round(((buys - sells) / total) * 100) : null };
  } catch (err) {
    return { buys: 0, sells: 0, netPct: null };
  }
}


// ============================================================================
// FULL FUNDAMENTAL + VALUATION ANALYSIS
// ============================================================================

export async function getFullFundamentals(ticker: string): Promise<FullFundamentalResult> {
  const cacheKey = `fundamentals_${ticker}`;
  const cached = getCached<FullFundamentalResult>(cacheKey);
  if (cached) return cached;

  // Fetch all in parallel
  const [fundamentals, valuation, earnings, insider] = await Promise.all([
    fetchFundamentals(ticker),
    fetchValuation(ticker),
    fetchEarningsSurprises(ticker),
    fetchInsiderActivity(ticker),
  ]);

  // Merge insider data into fundamentals
  fundamentals.insiderBuys3m = insider.buys;
  fundamentals.insiderSells3m = insider.sells;
  fundamentals.insiderNetPct = insider.netPct;

  const result: FullFundamentalResult = {
    ticker,
    fundamentals,
    valuation,
    earningsSurprises: earnings,
    lastUpdated: new Date().toISOString(),
    dataSource: GURUFOCUS_API_KEY ? 'gurufocus' : 'fallback',
  };

  setCache(cacheKey, result);
  return result;
}


// ============================================================================
// REST ENDPOINTS
// ============================================================================

// GET /api/fundamentals/status
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    module: 'Fundamental & Valuation Data',
    version: '1.0.0',
    gurufocusConfigured: !!GURUFOCUS_API_KEY,
    cacheDuration: '24 hours',
    cacheSize: fundamentalCache.size,
    metrics: {
      fundamental: [
        'revenueGrowthYoY', 'epsGrowthYoY', 'grossMargin', 'operatingMargin',
        'netMargin', 'roic', 'roe', 'fcfYield', 'fcfMargin', 'debtToEquity',
        'piotroskiFScore', 'altmanZScore',
      ],
      valuation: [
        'peTrailing', 'peForward', 'evToEbitda', 'evToSales', 'priceToBook',
        'priceToFcf', 'pegRatio', 'pe5yrRange', 'pePctile', 'gfValue',
      ],
    },
  });
});

// GET /api/fundamentals/:ticker — Full fundamental + valuation data for a ticker
router.get('/:ticker', async (req: Request, res: Response) => {
  const ticker = (req.params.ticker as string).toUpperCase();
  try {
    const result = await getFullFundamentals(ticker);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch fundamental data' });
  }
});

// POST /api/fundamentals/batch — Batch fundamental data
router.post('/batch', async (req: Request, res: Response) => {
  const { tickers } = req.body;
  if (!Array.isArray(tickers)) {
    return res.status(400).json({ error: 'Required: tickers[] array of strings' });
  }

  // Sequential to respect API rate limits (max 1 per second)
  const results: FullFundamentalResult[] = [];
  for (const ticker of tickers.slice(0, 20)) { // Max 20 per batch
    try {
      const result = await getFullFundamentals(ticker.toUpperCase());
      results.push(result);
      // Small delay between API calls
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`Error fetching fundamentals for ${ticker}:`, err);
    }
  }

  res.json({ fetched: results.length, results });
});

// GET /api/fundamentals/:ticker/earnings — Earnings surprise history
router.get('/:ticker/earnings', async (req: Request, res: Response) => {
  const ticker = (req.params.ticker as string).toUpperCase();
  try {
    const full = await getFullFundamentals(ticker);
    res.json({
      ticker,
      surprises: full.earningsSurprises,
      summary: {
        beatRate: full.earningsSurprises.length > 0
          ? Math.round((full.earningsSurprises.filter(e => e.surprisePct > 0).length / full.earningsSurprises.length) * 100) : null,
        avgSurprise: full.earningsSurprises.length > 0
          ? Math.round((full.earningsSurprises.reduce((s, e) => s + e.surprisePct, 0) / full.earningsSurprises.length) * 100) / 100 : null,
        recentTrend: getEarningsTrend(full.earningsSurprises),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch earnings data' });
  }
});

// GET /api/fundamentals/:ticker/valuation — Valuation only
router.get('/:ticker/valuation', async (req: Request, res: Response) => {
  const ticker = (req.params.ticker as string).toUpperCase();
  try {
    const full = await getFullFundamentals(ticker);
    res.json({ ticker, valuation: full.valuation });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch valuation data' });
  }
});

export default router;


// ============================================================================
// HELPERS
// ============================================================================

function safeNum(val: any, divisor = 1): number | null {
  if (val === null || val === undefined || val === '' || val === 'N/A') return null;
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n) || !isFinite(n)) return null;
  return divisor !== 1 ? Math.round((n / divisor) * 100) / 100 : Math.round(n * 100) / 100;
}

function getEarningsTrend(surprises: EarningsSurprise[]): 'improving' | 'deteriorating' | 'stable' | 'insufficient' {
  if (surprises.length < 4) return 'insufficient';
  const recent2 = surprises.slice(0, 2).reduce((s, e) => s + e.surprisePct, 0) / 2;
  const prior2 = surprises.slice(2, 4).reduce((s, e) => s + e.surprisePct, 0) / 2;
  if (recent2 > prior2 + 1) return 'improving';
  if (recent2 < prior2 - 1) return 'deteriorating';
  return 'stable';
}
