/**
 * Industry-Specific Inflection Drivers
 * ======================================
 * Each industry has unique leading indicators that signal inflection points
 * before they show up in standard technical or fundamental analysis.
 *
 * Industries covered:
 *   1. Airlines — load factors, fuel hedging, capacity discipline
 *   2. Semiconductors — book-to-bill, inventory cycles, design wins
 *   3. Payments / Fintech — cross-border volumes, take rate, TPV growth
 *   4. SaaS / Cloud — net retention, Rule of 40, ARR growth
 *   5. Healthcare / Biotech — pipeline catalysts, FDA decisions, patent cliffs
 *   6. Banks / Financials — NIM, loan growth, credit quality, yield curve
 *   7. Energy — rig counts, breakeven prices, OPEC discipline
 *   8. Retail / Consumer — same-store sales, inventory-to-sales, consumer confidence
 *
 * Data sources: GuruFocus fundamentals, Yahoo Finance, manual inputs
 */

import { Router, Request, Response } from 'express';

const router = Router();

// ============================================================================
// TYPES
// ============================================================================

export type IndustryType =
  | 'airlines' | 'semiconductors' | 'payments' | 'saas'
  | 'healthcare' | 'banks' | 'energy' | 'retail';

export interface IndustryDriver {
  name: string;
  value: number | string | null;
  direction: 'improving' | 'stable' | 'deteriorating' | 'unknown';
  inflectionSignal: boolean;  // true if this driver is signaling an inflection
  weight: number;             // 0-1 importance
  description: string;
}

export interface IndustryAnalysis {
  industry: IndustryType;
  industryLabel: string;
  drivers: IndustryDriver[];
  inflectionScore: number;     // 0-100 composite
  activeSignals: number;       // count of drivers signaling inflection
  totalDrivers: number;
  constituents: string[];      // representative ETFs/tickers
  cyclicalPosition: 'early_cycle' | 'mid_cycle' | 'late_cycle' | 'downturn';
  recommendation: string;
}

// ============================================================================
// INDUSTRY DRIVER CONFIGURATIONS
// ============================================================================

const INDUSTRY_CONFIG: Record<IndustryType, {
  label: string;
  constituents: string[];
  etf: string;
  drivers: Array<{ name: string; weight: number; description: string }>;
}> = {
  airlines: {
    label: 'Airlines',
    constituents: ['DAL', 'UAL', 'LUV', 'AAL', 'JBLU', 'ALK'],
    etf: 'JETS',
    drivers: [
      { name: 'Load Factor', weight: 0.2, description: 'Percentage of available seats filled — above 85% signals pricing power' },
      { name: 'Revenue per ASM (RASM)', weight: 0.2, description: 'Revenue efficiency — rising RASM = demand outpacing capacity' },
      { name: 'Fuel Cost Trend', weight: 0.15, description: 'Jet fuel as % of revenue — declining = margin expansion' },
      { name: 'Capacity Discipline', weight: 0.15, description: 'Industry ASM growth vs GDP — below GDP = supply discipline' },
      { name: 'Forward Bookings', weight: 0.15, description: 'Advance booking trends — rising curve = demand acceleration' },
      { name: 'Ancillary Revenue Growth', weight: 0.15, description: 'Non-ticket revenue growth — high growth = revenue diversification' },
    ],
  },
  semiconductors: {
    label: 'Semiconductors',
    constituents: ['NVDA', 'AMD', 'AVGO', 'INTC', 'QCOM', 'TXN', 'MRVL', 'MU'],
    etf: 'SMH',
    drivers: [
      { name: 'Book-to-Bill Ratio', weight: 0.25, description: 'Orders vs shipments — above 1.0 signals demand acceleration' },
      { name: 'Inventory Cycle', weight: 0.2, description: 'Channel inventory days — declining from peak = restocking phase' },
      { name: 'Capex Cycle', weight: 0.15, description: 'Foundry capex trends — rising = confidence in future demand' },
      { name: 'ASP Trend', weight: 0.15, description: 'Average selling price direction — rising = mix shift to premium' },
      { name: 'Design Win Pipeline', weight: 0.15, description: 'New design win announcements — accelerating = future revenue' },
      { name: 'End Market Demand', weight: 0.1, description: 'AI/DC/Auto/Mobile demand mix — AI acceleration = secular tailwind' },
    ],
  },
  payments: {
    label: 'Payments & Fintech',
    constituents: ['V', 'MA', 'PYPL', 'SQ', 'FIS', 'FISV', 'GPN'],
    etf: 'IPAY',
    drivers: [
      { name: 'Cross-Border Volume Growth', weight: 0.2, description: 'International transaction growth — proxy for travel/trade recovery' },
      { name: 'Total Payment Volume (TPV)', weight: 0.2, description: 'Aggregate payment volume growth — core demand indicator' },
      { name: 'Take Rate', weight: 0.15, description: 'Revenue per dollar processed — stable/rising = pricing power' },
      { name: 'Active Account Growth', weight: 0.15, description: 'Net new accounts — accelerating = platform expansion' },
      { name: 'Value-Added Services', weight: 0.15, description: 'Non-transaction revenue growth — higher margin business mix' },
      { name: 'Cash-to-Digital Shift', weight: 0.15, description: 'Digital penetration rate — secular growth driver' },
    ],
  },
  saas: {
    label: 'SaaS & Cloud',
    constituents: ['CRM', 'NOW', 'DDOG', 'SNOW', 'NET', 'ZS', 'CRWD', 'MDB'],
    etf: 'IGV',
    drivers: [
      { name: 'Net Revenue Retention (NRR)', weight: 0.25, description: 'Dollar-based NRR — above 120% = strong expansion' },
      { name: 'Rule of 40', weight: 0.2, description: 'Revenue growth + FCF margin — above 40 = elite status' },
      { name: 'ARR Growth', weight: 0.2, description: 'Annual recurring revenue growth — the core SaaS metric' },
      { name: 'RPO Growth', weight: 0.15, description: 'Remaining performance obligations — forward revenue visibility' },
      { name: 'Customer Count Growth', weight: 0.1, description: 'New logo additions — land-and-expand velocity' },
      { name: 'Gross Margin Trend', weight: 0.1, description: 'Software gross margins — stable 75%+ = sustainable model' },
    ],
  },
  healthcare: {
    label: 'Healthcare & Biotech',
    constituents: ['LLY', 'UNH', 'JNJ', 'ABBV', 'MRK', 'PFE', 'AMGN', 'GILD'],
    etf: 'XBI',
    drivers: [
      { name: 'Pipeline Catalysts', weight: 0.25, description: 'Phase 3 readouts, FDA decisions — binary events drive re-rating' },
      { name: 'Patent Cliff Exposure', weight: 0.2, description: 'Revenue at risk from patent expirations — quantified LOE impact' },
      { name: 'Pricing Power', weight: 0.15, description: 'Net price realization — IRA/rebate impact on realized pricing' },
      { name: 'M&A Activity', weight: 0.15, description: 'Sector M&A pace — rising = large pharma filling pipelines' },
      { name: 'Reimbursement Trends', weight: 0.15, description: 'Payer mix and reimbursement rates — government policy impact' },
      { name: 'Clinical Trial Starts', weight: 0.1, description: 'New IND filings — leading indicator of future pipeline' },
    ],
  },
  banks: {
    label: 'Banks & Financials',
    constituents: ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'USB', 'PNC'],
    etf: 'XLF',
    drivers: [
      { name: 'Net Interest Margin (NIM)', weight: 0.25, description: 'Spread between lending/deposit rates — Fed rate sensitivity' },
      { name: 'Loan Growth', weight: 0.2, description: 'Total loan book growth — demand for credit = economic confidence' },
      { name: 'Credit Quality (NCOs)', weight: 0.2, description: 'Net charge-off rate — rising NCOs = deteriorating credit' },
      { name: 'Yield Curve Shape', weight: 0.15, description: '10Y-2Y spread — positive slope = profitable maturity transformation' },
      { name: 'Capital Markets Revenue', weight: 0.1, description: 'Trading + IB revenue — M&A/IPO pipeline activity' },
      { name: 'Deposit Beta', weight: 0.1, description: 'Rate paid on deposits vs Fed rate — lower beta = wider NIM' },
    ],
  },
  energy: {
    label: 'Energy',
    constituents: ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'PXD', 'OXY', 'HAL'],
    etf: 'XLE',
    drivers: [
      { name: 'Rig Count Trend', weight: 0.2, description: 'Baker Hughes rig count — declining = supply discipline' },
      { name: 'Breakeven Price', weight: 0.15, description: 'Marginal cost of production — below spot = profitable growth' },
      { name: 'OPEC+ Discipline', weight: 0.2, description: 'Compliance with production targets — high compliance = price support' },
      { name: 'Inventory Draws', weight: 0.15, description: 'Weekly EIA inventory changes — sustained draws = tightening market' },
      { name: 'Refining Margins', weight: 0.15, description: 'Crack spreads — widening = downstream profitability' },
      { name: 'Capital Discipline', weight: 0.15, description: 'Capex as % of cash flow — lower = shareholder returns priority' },
    ],
  },
  retail: {
    label: 'Retail & Consumer',
    constituents: ['AMZN', 'WMT', 'COST', 'TGT', 'HD', 'LOW', 'TJX', 'ROST'],
    etf: 'XRT',
    drivers: [
      { name: 'Same-Store Sales', weight: 0.25, description: 'Comp sales growth — organic demand indicator excluding new stores' },
      { name: 'Inventory-to-Sales Ratio', weight: 0.2, description: 'Inventory health — rising ratio = potential markdowns ahead' },
      { name: 'Consumer Confidence', weight: 0.15, description: 'Conference Board or Michigan index — leading spending indicator' },
      { name: 'Traffic Trends', weight: 0.15, description: 'Store/website traffic — volume proxy before it hits revenue' },
      { name: 'Gross Margin Trend', weight: 0.15, description: 'Pricing power vs cost inflation — expanding = healthy demand' },
      { name: 'Digital Mix', weight: 0.1, description: 'E-commerce as % of total — structural shift indicator' },
    ],
  },
};

// ============================================================================
// INDUSTRY ANALYSIS — Score drivers from available data
// ============================================================================

export function analyzeIndustry(
  industry: IndustryType,
  driverInputs: Partial<Record<string, { value: number | string | null; direction: IndustryDriver['direction'] }>>,
): IndustryAnalysis {
  const config = INDUSTRY_CONFIG[industry];
  if (!config) {
    return {
      industry, industryLabel: industry,
      drivers: [], inflectionScore: 50, activeSignals: 0, totalDrivers: 0,
      constituents: [], cyclicalPosition: 'mid_cycle', recommendation: 'No industry configuration found',
    };
  }

  const drivers: IndustryDriver[] = config.drivers.map(d => {
    const input = driverInputs[d.name];
    const direction = input?.direction ?? 'unknown';
    const inflectionSignal = direction === 'improving';

    return {
      name: d.name,
      value: input?.value ?? null,
      direction,
      inflectionSignal,
      weight: d.weight,
      description: d.description,
    };
  });

  // Composite inflection score
  let weightedScore = 0;
  let totalWeight = 0;
  for (const d of drivers) {
    if (d.direction === 'unknown') continue;
    const dirScore = d.direction === 'improving' ? 80 : d.direction === 'stable' ? 50 : 20;
    weightedScore += dirScore * d.weight;
    totalWeight += d.weight;
  }
  const inflectionScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 50;

  const activeSignals = drivers.filter(d => d.inflectionSignal).length;

  // Cyclical position heuristic
  let cyclicalPosition: IndustryAnalysis['cyclicalPosition'] = 'mid_cycle';
  if (inflectionScore > 70 && activeSignals >= drivers.length * 0.5) cyclicalPosition = 'early_cycle';
  else if (inflectionScore > 55) cyclicalPosition = 'mid_cycle';
  else if (inflectionScore > 35) cyclicalPosition = 'late_cycle';
  else cyclicalPosition = 'downturn';

  // Recommendation
  let recommendation = '';
  if (cyclicalPosition === 'early_cycle') recommendation = `${config.label} showing early-cycle recovery signals — ${activeSignals}/${drivers.length} drivers improving. Consider overweight.`;
  else if (cyclicalPosition === 'mid_cycle') recommendation = `${config.label} in mid-cycle — mixed signals. Selective positioning in best-in-class names.`;
  else if (cyclicalPosition === 'late_cycle') recommendation = `${config.label} showing late-cycle dynamics — watch for deterioration. Reduce to quality names only.`;
  else recommendation = `${config.label} in downturn — most drivers deteriorating. Avoid or position for recovery.`;

  return {
    industry,
    industryLabel: config.label,
    drivers,
    inflectionScore,
    activeSignals,
    totalDrivers: drivers.length,
    constituents: config.constituents,
    cyclicalPosition,
    recommendation,
  };
}


// ============================================================================
// REST ENDPOINTS
// ============================================================================

// GET /api/industry/status
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    module: 'Industry-Specific Drivers',
    version: '1.0.0',
    industries: Object.entries(INDUSTRY_CONFIG).map(([key, cfg]) => ({
      key, label: cfg.label, etf: cfg.etf,
      constituents: cfg.constituents.length,
      drivers: cfg.drivers.length,
    })),
  });
});

// GET /api/industry/list
router.get('/list', (_req: Request, res: Response) => {
  res.json(Object.entries(INDUSTRY_CONFIG).map(([key, cfg]) => ({
    industry: key,
    label: cfg.label,
    etf: cfg.etf,
    constituents: cfg.constituents,
    driverCount: cfg.drivers.length,
    driverNames: cfg.drivers.map(d => d.name),
  })));
});

// GET /api/industry/:industry — Get industry config and driver definitions
router.get('/:industry', (req: Request, res: Response) => {
  const industry = (req.params.industry as string).toLowerCase() as IndustryType;
  const config = INDUSTRY_CONFIG[industry];
  if (!config) {
    return res.status(404).json({ error: `Unknown industry: ${industry}. Available: ${Object.keys(INDUSTRY_CONFIG).join(', ')}` });
  }
  res.json({ industry, ...config });
});

// POST /api/industry/:industry/analyze — Analyze with provided driver data
router.post('/:industry/analyze', (req: Request, res: Response) => {
  const industry = (req.params.industry as string).toLowerCase() as IndustryType;
  const { drivers: driverInputs } = req.body;

  if (!INDUSTRY_CONFIG[industry]) {
    return res.status(404).json({ error: `Unknown industry: ${industry}` });
  }

  const result = analyzeIndustry(industry, driverInputs || {});
  res.json(result);
});

// POST /api/industry/batch — Analyze multiple industries
router.post('/batch', (req: Request, res: Response) => {
  const { analyses } = req.body; // Array of { industry, drivers }
  if (!Array.isArray(analyses)) {
    return res.status(400).json({ error: 'Required: analyses[] array of { industry, drivers }' });
  }

  const results = analyses.map((a: any) => analyzeIndustry(a.industry, a.drivers || {}));
  res.json({ analyzed: results.length, results });
});


export default router;
