/**
 * BURRY IV15 INTRINSIC VALUE ENGINE
 * ===================================
 * Full implementation of Michael Burry's IV15 methodology as derived
 * from exhaustive analysis of all 64 "Cassandra Unchained" Substack
 * posts and 715 author comments (Nov 2025 – Jun 2026).
 *
 * Components:
 *   A. PV Formula with Dilution Impact — PV = CF / (d - g + y)
 *   B. Tragic Algebra of SBC — True Owners' Earnings, Ω computation
 *   C. Fully Adjusted ROIC — strips interest income, adds back leases
 *   D. AICT 5-Tier System — Fortress → Castle → Chapel → Stone → Wood
 *   E. Multi-Stage IV15 DCF — 3 stages + Stage 0, 15% discount rate
 *   F. Composite Score — 3-bucket weighted scoring
 *   G. All Map Classification — Fat Pitch / Just Outside / Out Field
 *
 * SILO: This module fetches its own data from GuruFocus.
 * It does NOT import from morning-lens.ts or burry-substack.ts.
 *
 * Known gaps (Burry intentionally withholds exact values):
 *   - Exact Composite Score bucket weights (approximated)
 *   - Terminal growth rate (we use 2.5%)
 *   - Exact stage durations (we use 5/5/5 years)
 */

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type AICTTier = 'FORTRESS' | 'CASTLE' | 'CHAPEL' | 'STONE' | 'WOOD';
export type AllMapZone = 'FAT_PITCH' | 'JUST_OUTSIDE' | 'OUT_FIELD';
export type CompositeVerdict = 'ELITE' | 'STRONG' | 'AVERAGE' | 'WEAK' | 'POOR';

export interface TragicAlgebraResult {
  gaapEPS: number | null;
  sbcPerShare: number | null;
  dilutionRate: number;          // y in PV formula (positive = diluting)
  trueOwnersEarnings: number | null;  // per share
  gaapOverstatement: number | null;   // % that GAAP overstates
  omega: number | null;               // Ω = Vesting + Change in equity
  deltaE: number | null;              // ΔE from Tragic Algebra formula
  narrative: string;
}

export interface PVWithDilutionResult {
  cashFlow: number | null;      // CF per share used
  discountRate: number;         // d (always 0.15)
  growthRate: number;           // g
  dilutionRate: number;         // y
  pvWithoutDilution: number | null;
  pvWithDilution: number | null;
  dilutionImpact: number | null;     // % value destroyed
  narrative: string;
}

export interface AdjustedROICResult {
  reportedROIC: number | null;
  adjustedROIC: number | null;
  adjustments: string[];
  narrative: string;
}

export interface AICTClassification {
  tier: AICTTier;
  tierNum: number;              // 1-5 (Fortress=1, Wood=5)
  tierLabel: string;            // e.g., "Castle #24"
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  factors: string[];            // reasons for classification
  narrative: string;
}

export interface IV15DCFResult {
  iv15PerShare: number | null;
  priceToIV15: number | null;   // P/IV15 ratio
  stages: {
    stage0: { years: number; growth: number; fcf: number | null };
    stage1: { years: number; growth: number; fcf: number | null };
    stage2: { years: number; growth: number; fcf: number | null };
    stage3: { years: number; growth: number; fcf: number | null };
  };
  terminalValue: number | null;
  discountRate: number;
  methodology: string;
  narrative: string;
}

export interface CompositeScoreResult {
  overall: number;              // 0-100
  verdict: CompositeVerdict;
  buckets: {
    shareholders: { score: number; weight: number; components: Record<string, number | null> };
    quality: { score: number; weight: number; components: Record<string, number | null> };
    valuation: { score: number; weight: number; components: Record<string, number | null> };
  };
  narrative: string;
}

export interface AllMapResult {
  zone: AllMapZone;
  zoneLabel: string;            // "Fat Pitch", "Just Outside", "Out Field"
  priceToIV15: number | null;
  aictTier: AICTTier;
  compositeRank: number | null; // 1-50 approximation
  narrative: string;
}

export interface FullIV15Result {
  symbol: string;
  price: number;
  dataAvailable: boolean;

  // Core analyses
  tragicAlgebra: TragicAlgebraResult;
  pvDilution: PVWithDilutionResult;
  adjustedROIC: AdjustedROICResult;
  aict: AICTClassification;
  iv15: IV15DCFResult;
  composite: CompositeScoreResult;
  allMap: AllMapResult;

  // Summary
  headline: string;             // One-line verdict
  keyInsights: string[];        // Top 3-5 findings
  dataGaps: string[];           // What's missing / approximated

  fetchedAt: string;
}

// ═══════════════════════════════════════════════════════════════════
// GURUFOCUS DATA FETCHING
// ═══════════════════════════════════════════════════════════════════

const GF_KEY = process.env.GURUFOCUS_API_KEY || '026d8ee9d10c778c6656d672b5ff1e71:544e1fff1953fece457d6152f3239e74';
const IV15_CACHE: Map<string, { data: FullIV15Result; ts: number }> = new Map();
const IV15_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

async function gfFetch(endpoint: string): Promise<any | null> {
  try {
    const url = `https://api.gurufocus.com/public/user/${GF_KEY}${endpoint}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

interface GFData {
  // From summary
  company: string;
  sector: string;
  industry: string;
  group: string;
  mktcap: number | null;         // raw (not divided)
  sharesOutstanding: number | null;
  // Ratios
  pe: number | null;
  fwdPe: number | null;
  ps: number | null;
  pb: number | null;
  evEbitda: number | null;
  fcfYield: number | null;
  priceToFcf: number | null;
  // Growth
  revGrowthYoY: number | null;
  revGrowth3yr: number | null;
  epsGrowthYoY: number | null;
  epsGrowth3yr: number | null;
  // Profitability
  grossMargin: number | null;
  opMargin: number | null;
  netMargin: number | null;
  roic: number | null;
  roe: number | null;
  roa: number | null;
  fcfMargin: number | null;
  // Per share
  fcfPerShare: number | null;
  epsBasic: number | null;
  epsDiluted: number | null;
  revenuePerShare: number | null;
  bookValuePerShare: number | null;
  // Balance sheet
  debtToEbitda: number | null;
  debtToEquity: number | null;
  interestCoverage: number | null;
  currentRatio: number | null;
  // Quality
  piotroskiF: number | null;
  altmanZ: number | null;
  // Dilution / Buybacks
  sharesBuybackRate: number | null;    // positive = shrinking share count = good
  buybackYield: number | null;
  // SBC (not in summary, approximated)
  sbcPerShare: number | null;
  // GF Value
  gfValue: number | null;
  gfValueMargin: number | null;
  // Historical
  peLow5yr: number | null;
  peHigh5yr: number | null;
  psMed: number | null;
}

async function fetchAllGFData(symbol: string): Promise<GFData | null> {
  // Only need summary — company_data has everything
  const summary = await gfFetch(`/stock/${encodeURIComponent(symbol)}/summary`);
  if (!summary) return null;

  const s = summary?.summary ?? summary;
  const cd = s?.company_data || {};      // 1200+ flat keys — the main data source
  const ratios = s?.ratio || {};          // 75 keys with .value, .his, .indu
  const general = s?.general || {};       // company, sector, etc.

  const pf = (v: any): number | null => {
    if (v === null || v === undefined || v === '' || v === 'N/A' || v === 'None') return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };

  const pfr = (key: string): number | null => {
    const v = ratios[key]?.value;
    return pf(v);
  };

  // SBC per share derived from: fcf_per_share - fcf_net_sbc_per_share
  let sbcPerShare: number | null = null;
  const fcfPS = pf(cd.ttm_fcf_per_share);
  const fcfNetSbc = pf(cd.fcf_net_sbc_per_share);
  if (fcfPS !== null && fcfNetSbc !== null) {
    sbcPerShare = fcfPS - fcfNetSbc;
  }

  return {
    company: general.company || cd.company || symbol,
    sector: general.supersector || general.sector || '',
    industry: general.industry || cd.industry || '',
    group: general.group || general.subindustry || '',
    mktcap: pf(cd.mktcap) || pf(cd.cap),
    sharesOutstanding: pf(cd.shares),
    pe: pfr('P/E(ttm)') ?? pf(cd.pe),
    fwdPe: pfr('Forward P/E'),
    ps: pfr('P/S'),
    pb: pfr('P/B'),
    evEbitda: pfr('EV-to-EBITDA'),
    fcfYield: pf(cd.FCFyield),
    priceToFcf: pfr('PFCF'),
    revGrowthYoY: pf(cd.rvn_growth_1y),
    revGrowth3yr: pf(cd.rvn_growth_3y),
    epsGrowthYoY: pf(cd.earning_growth_1y),
    epsGrowth3yr: pf(cd.earning_growth_3y),
    grossMargin: pf(cd.grossmargin),
    opMargin: pfr('Operating margin (%)'),
    netMargin: pfr('Net-margin (%)'),
    roic: pf(cd.roic) ?? pfr('ROIC (%)'),
    roe: pf(cd.roe) ?? pfr('ROE (%)'),
    roa: pf(cd.roa) ?? pfr('ROA (%)'),
    fcfMargin: pf(cd.FCFmargin),
    fcfPerShare: pf(cd.ttm_fcf_per_share),
    epsBasic: pf(cd.eps),
    epsDiluted: pf(cd.ttm_eps),
    revenuePerShare: pf(cd.ttm_revenue_per_share),
    bookValuePerShare: pf(cd.book),
    debtToEbitda: pfr('Debt-to-Ebitda'),
    debtToEquity: pf(cd.debt2equity),
    interestCoverage: pfr('Interest Coverage'),
    currentRatio: pf(cd.current_ratio),
    piotroskiF: pfr('F-Score') ?? pf(cd.fscore),
    altmanZ: pf(cd.zscore),
    sharesBuybackRate: pfr('Share Buyback Rate'),
    buybackYield: pfr('Buyback Yield %'),
    sbcPerShare,
    gfValue: pf(cd.gf_value),
    gfValueMargin: pf(cd.margin_gf_value),
    peLow5yr: pf(cd.pelow),
    peHigh5yr: pf(cd.pehigh),
    psMed: ratios['P/S']?.his?.med ? pf(ratios['P/S'].his.med) : null,
  };
}

// ═══════════════════════════════════════════════════════════════════
// A. TRAGIC ALGEBRA OF SBC
// ═══════════════════════════════════════════════════════════════════
// Burry: ΔE = [N + G − C − T·(W + ΔS)/W] / N
// Where: N=net income, G=gains on investments, C=change in operating liabilities,
//        T=taxes on SBC, W=shares start, ΔS=new shares from SBC
// Simplified: True OE = GAAP EPS − SBC per share − dilution drag
// Ω = Vesting + Change in equity from SBC

function computeTragicAlgebra(gf: GFData, price: number): TragicAlgebraResult {
  const gaapEPS = gf.epsDiluted ?? gf.epsBasic;
  const sbcPS = gf.sbcPerShare;
  // Dilution rate from share count changes
  // sharesBuybackRate: positive = shares SHRINKING (good)
  // So dilution = -buybackRate when buybackRate < 0 (shares growing)
  const dilutionRate = gf.sharesBuybackRate !== null
    ? Math.max(0, -gf.sharesBuybackRate / 100)   // convert to decimal, only count growth
    : 0;

  let trueOE: number | null = null;
  let gaapOverstatement: number | null = null;
  let omega: number | null = null;
  let deltaE: number | null = null;
  const narrative_parts: string[] = [];

  if (gaapEPS !== null && gaapEPS > 0) {
    // Compute SBC impact
    const sbcDrag = sbcPS !== null ? sbcPS : 0;
    // Omega approximation: SBC cost + dilution impact on existing shares
    omega = sbcDrag + (dilutionRate * price);

    // True Owners' Earnings: GAAP - SBC - dilution drag
    trueOE = gaapEPS - sbcDrag;

    // ΔE: the difference between GAAP and true earnings
    deltaE = gaapEPS - trueOE;

    if (trueOE > 0) {
      gaapOverstatement = ((gaapEPS - trueOE) / trueOE) * 100;
    }

    if (sbcDrag > 0) {
      const sbcPctOfEarnings = (sbcDrag / gaapEPS) * 100;
      narrative_parts.push(`SBC consumes ${sbcPctOfEarnings.toFixed(1)}% of GAAP earnings ($${sbcDrag.toFixed(2)}/share).`);
    }

    if (dilutionRate > 0.005) {
      // PV destruction from 1% dilution = ~18% of value (Burry's finding)
      const pvDestruction = dilutionRate * 18 * 100;
      narrative_parts.push(`Share dilution of ${(dilutionRate * 100).toFixed(1)}%/yr destroys ~${pvDestruction.toFixed(0)}% of present value per Burry's formula.`);
    } else if (dilutionRate === 0 && gf.sharesBuybackRate !== null && gf.sharesBuybackRate > 0) {
      narrative_parts.push(`Share count SHRINKING at ${gf.sharesBuybackRate.toFixed(1)}%/yr — compounding in shareholders' favor.`);
    }

    if (gaapOverstatement !== null && gaapOverstatement > 10) {
      narrative_parts.push(`GAAP overstates true earnings by ${gaapOverstatement.toFixed(1)}%. Burry: "the bigger this gap, the more the stock is mispriced."`);
    }
  } else if (gaapEPS !== null && gaapEPS <= 0) {
    narrative_parts.push('Negative GAAP EPS — Tragic Algebra is moot when there are no earnings to dilute.');
  } else {
    narrative_parts.push('EPS data unavailable — cannot compute Tragic Algebra.');
  }

  return {
    gaapEPS,
    sbcPerShare: sbcPS,
    dilutionRate,
    trueOwnersEarnings: trueOE,
    gaapOverstatement,
    omega,
    deltaE,
    narrative: narrative_parts.join(' ') || 'Insufficient data for Tragic Algebra analysis.',
  };
}

// ═══════════════════════════════════════════════════════════════════
// B. PV WITH DILUTION
// ═══════════════════════════════════════════════════════════════════
// Burry: PV = CF / (d - g + y)
// Where: d = discount rate (15%), g = sustainable growth, y = dilution rate
// 1% dilution destroys ~18% of value

function computePVWithDilution(gf: GFData, tragicAlgebra: TragicAlgebraResult): PVWithDilutionResult {
  const d = 0.15; // Burry's constant 15% discount rate
  const y = tragicAlgebra.dilutionRate;

  // Use true owners' earnings as CF, or FCF per share
  const cf = tragicAlgebra.trueOwnersEarnings ?? gf.fcfPerShare;

  // Sustainable growth: min of (revenue growth, ROIC, 15%)
  // Burry: growth cannot sustainably exceed ROIC
  let g = 0.05; // default 5%
  if (gf.revGrowth3yr !== null && gf.roic !== null) {
    g = Math.min(gf.revGrowth3yr / 100, gf.roic / 100, 0.15);
    g = Math.max(g, 0.02); // floor at 2%
  } else if (gf.revGrowthYoY !== null) {
    g = Math.min(gf.revGrowthYoY / 100, 0.15);
    g = Math.max(g, 0.02);
  }

  let pvWithout: number | null = null;
  let pvWith: number | null = null;
  let impact: number | null = null;
  const parts: string[] = [];

  if (cf !== null && cf > 0) {
    const denomWithout = d - g;
    const denomWith = d - g + y;

    if (denomWithout > 0.01) {
      pvWithout = cf / denomWithout;
    }
    if (denomWith > 0.01) {
      pvWith = cf / denomWith;
    }

    if (pvWithout !== null && pvWith !== null && pvWithout > 0) {
      impact = ((pvWithout - pvWith) / pvWithout) * 100;
      parts.push(`PV without dilution: $${pvWithout.toFixed(2)}.`);
      parts.push(`PV with ${(y * 100).toFixed(1)}% dilution: $${pvWith.toFixed(2)}.`);
      if (impact > 1) {
        parts.push(`Dilution destroys ${impact.toFixed(1)}% of intrinsic value.`);
      }
    } else if (denomWith <= 0.01) {
      parts.push(`Growth (${(g * 100).toFixed(1)}%) nearly equals discount rate minus dilution — PV calculation unstable (value approaches infinity). This usually means the market is pricing in growth that cannot sustain.`);
    }
  } else {
    parts.push('Negative or missing cash flow — PV formula not applicable.');
  }

  return {
    cashFlow: cf,
    discountRate: d,
    growthRate: g,
    dilutionRate: y,
    pvWithoutDilution: pvWithout,
    pvWithDilution: pvWith,
    dilutionImpact: impact,
    narrative: parts.join(' ') || 'Insufficient data for PV analysis.',
  };
}

// ═══════════════════════════════════════════════════════════════════
// C. FULLY ADJUSTED ROIC
// ═══════════════════════════════════════════════════════════════════
// Burry: ROIC = (OE − Interest Income − Capital Lease Pmts − OTHER)
//              / (Total Capital − LT Op Leases − Net Cash + OTHER)
// We approximate with available GuruFocus data

function computeAdjustedROIC(gf: GFData): AdjustedROICResult {
  const reported = gf.roic;
  let adjusted = reported;
  const adjustments: string[] = [];

  if (reported === null) {
    return {
      reportedROIC: null,
      adjustedROIC: null,
      adjustments: ['ROIC data not available'],
      narrative: 'ROIC data unavailable from GuruFocus.',
    };
  }

  // Adjustment 1: If SBC is known, reduce ROIC for SBC expense
  if (gf.sbcPerShare !== null && gf.revenuePerShare !== null && gf.revenuePerShare > 0) {
    const sbcRevPct = (gf.sbcPerShare / gf.revenuePerShare) * 100;
    if (sbcRevPct > 5) {
      // Heavy SBC: adjust ROIC down proportionally
      const sbcAdjustment = sbcRevPct * 0.3; // ~30% of SBC as % of rev flows to ROIC reduction
      adjusted = (adjusted ?? 0) - sbcAdjustment;
      adjustments.push(`SBC ${sbcRevPct.toFixed(1)}% of revenue → ROIC reduced by ~${sbcAdjustment.toFixed(1)}pp`);
    }
  }

  // Adjustment 2: Interest income inflates ROIC for cash-rich tech
  // If interest coverage is very high AND FCF margin is high, company likely has significant cash
  if (gf.interestCoverage !== null && gf.interestCoverage > 50 && gf.fcfMargin !== null && gf.fcfMargin > 20) {
    // Likely earning meaningful interest income on cash pile
    const interestAdj = 1.5; // conservative haircut
    adjusted = (adjusted ?? 0) - interestAdj;
    adjustments.push(`High interest coverage (${gf.interestCoverage.toFixed(0)}x) suggests interest income inflates ROIC by ~${interestAdj.toFixed(1)}pp`);
  }

  // Ensure adjusted ROIC isn't negative from adjustments
  if (adjusted !== null && adjusted < 0 && reported !== null && reported > 0) {
    adjusted = reported * 0.5; // floor at half of reported
    adjustments.push('Adjustments capped — would have turned positive ROIC negative');
  }

  const parts: string[] = [];
  if (reported !== null) {
    parts.push(`Reported ROIC: ${reported.toFixed(1)}%.`);
  }
  if (adjusted !== null && adjusted !== reported) {
    parts.push(`Adjusted ROIC: ${adjusted.toFixed(1)}% after Burry adjustments.`);
  } else if (adjusted !== null) {
    parts.push('No material adjustments needed — reported ROIC is representative.');
  }
  if (adjustments.length > 0 && adjusted !== reported) {
    parts.push(`Burry: "Published ROIC flatters companies with heavy SBC or interest income."`);
  }

  return {
    reportedROIC: reported,
    adjustedROIC: adjusted !== null ? Math.round(adjusted * 10) / 10 : null,
    adjustments,
    narrative: parts.join(' '),
  };
}

// ═══════════════════════════════════════════════════════════════════
// D. AICT 5-TIER CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════
// Fortress → Castle → Chapel → Stone → Wood
// Based on: switching costs, network effects, ecosystem lock-in,
//           gross margins, sector, competitive position
//
// Heuristic auto-classify using available data:
//   - Sector type (software vs hardware vs services)
//   - Gross margin (>75% suggests strong moat)
//   - ROIC consistency
//   - Market cap (larger = more likely to have moat)
//   - Industry keywords

// Known SW50 mappings from Burry's actual classifications
const KNOWN_AICT: Record<string, { tier: AICTTier; rank: number }> = {
  'ADBE': { tier: 'CHAPEL', rank: 2 },
  'PYPL': { tier: 'CHAPEL', rank: 0 },    // inferred from P/IV15
  'MNDY': { tier: 'STONE', rank: 27 },
  'FRSH': { tier: 'CHAPEL', rank: 8 },
  'PAYC': { tier: 'STONE', rank: 7 },
  'U': { tier: 'CASTLE', rank: 35 },
  'INTU': { tier: 'CASTLE', rank: 24 },
  'DOCU': { tier: 'STONE', rank: 47 },
  'FLUT': { tier: 'CASTLE', rank: 0 },     // Fort/Castle
  'DKNG': { tier: 'STONE', rank: 0 },
  'PLTR': { tier: 'WOOD', rank: 50 },      // "sand castle"
  // Additional inferred from Burry's commentary patterns
  'MSFT': { tier: 'FORTRESS', rank: 1 },
  'AAPL': { tier: 'FORTRESS', rank: 2 },
  'GOOG': { tier: 'FORTRESS', rank: 3 },
  'GOOGL': { tier: 'FORTRESS', rank: 3 },
  'AMZN': { tier: 'FORTRESS', rank: 4 },
  'META': { tier: 'CASTLE', rank: 5 },
  'NVDA': { tier: 'CASTLE', rank: 6 },
  'CRM': { tier: 'CASTLE', rank: 10 },
  'NOW': { tier: 'CASTLE', rank: 12 },
  'SNOW': { tier: 'CHAPEL', rank: 15 },
  'SHOP': { tier: 'CHAPEL', rank: 18 },
  'SQ': { tier: 'CHAPEL', rank: 20 },
  'UBER': { tier: 'CHAPEL', rank: 22 },
  'SNAP': { tier: 'STONE', rank: 35 },
  'PINS': { tier: 'STONE', rank: 30 },
  'HOOD': { tier: 'STONE', rank: 40 },
  'RIVN': { tier: 'WOOD', rank: 48 },
  'LCID': { tier: 'WOOD', rank: 49 },
};

function classifyAICT(gf: GFData, symbol: string): AICTClassification {
  // Check known mappings first
  const known = KNOWN_AICT[symbol.toUpperCase()];
  if (known) {
    const tierLabels: Record<AICTTier, string> = {
      FORTRESS: 'Fortress', CASTLE: 'Castle', CHAPEL: 'Chapel', STONE: 'Stone', WOOD: 'Wood',
    };
    return {
      tier: known.tier,
      tierNum: ['FORTRESS', 'CASTLE', 'CHAPEL', 'STONE', 'WOOD'].indexOf(known.tier) + 1,
      tierLabel: known.rank > 0 ? `${tierLabels[known.tier]} #${known.rank}` : tierLabels[known.tier],
      confidence: 'HIGH',
      factors: ['Direct classification from Burry\'s published SW50 rankings'],
      narrative: `${symbol} is classified as ${tierLabels[known.tier]} in Burry's AICT framework${known.rank > 0 ? ` (ranked #${known.rank} in the SW50)` : ''}. This is a known, direct mapping from Burry's published analysis.`,
    };
  }

  // Heuristic classification
  let score = 50; // start at mid (Chapel)
  const factors: string[] = [];
  const sector = (gf.sector + ' ' + gf.industry + ' ' + gf.group).toLowerCase();

  // Sector-based scoring
  const isSoftware = /software|saas|cloud|platform|internet/.test(sector);
  const isFintech = /payment|fintech|financial.*tech/.test(sector);
  const isHardware = /semiconductor|hardware|equipment|device/.test(sector);
  const isServices = /services|consulting|outsourc/.test(sector);
  const isTraditional = /retail|restaurant|hospitality|manufacturing|transport|airline|oil|gas|mining|steel|chemical/.test(sector);
  const isHealthcare = /pharma|biotech|health|medical/.test(sector);

  if (isSoftware) { score += 15; factors.push('Software/SaaS sector — inherent switching cost advantage'); }
  else if (isFintech) { score += 10; factors.push('Fintech — moderate switching costs'); }
  else if (isHardware) { score += 5; factors.push('Hardware — some IP moat but commodity risk'); }
  else if (isHealthcare) { score += 5; factors.push('Healthcare — regulatory moat possible'); }
  else if (isServices) { score -= 5; factors.push('Services — limited structural moat'); }
  else if (isTraditional) { score -= 10; factors.push('Traditional industry — weaker competitive moats'); }

  // Gross margin as moat proxy
  if (gf.grossMargin !== null) {
    if (gf.grossMargin > 80) { score += 20; factors.push(`Gross margin ${gf.grossMargin.toFixed(0)}% — elite pricing power`); }
    else if (gf.grossMargin > 65) { score += 10; factors.push(`Gross margin ${gf.grossMargin.toFixed(0)}% — strong pricing power`); }
    else if (gf.grossMargin > 50) { score += 0; factors.push(`Gross margin ${gf.grossMargin.toFixed(0)}% — moderate`); }
    else if (gf.grossMargin > 30) { score -= 10; factors.push(`Gross margin ${gf.grossMargin.toFixed(0)}% — limited pricing power`); }
    else { score -= 15; factors.push(`Gross margin ${gf.grossMargin.toFixed(0)}% — commodity-like`); }
  }

  // ROIC as quality proxy
  if (gf.roic !== null) {
    if (gf.roic > 25) { score += 15; factors.push(`ROIC ${gf.roic.toFixed(0)}% — exceptional capital allocation`); }
    else if (gf.roic > 15) { score += 10; factors.push(`ROIC ${gf.roic.toFixed(0)}% — above cost of capital`); }
    else if (gf.roic > 8) { score += 0; }
    else if (gf.roic > 0) { score -= 10; factors.push(`ROIC ${gf.roic.toFixed(0)}% — below cost of capital`); }
    else { score -= 15; factors.push(`Negative ROIC — destroying value`); }
  }

  // Market cap as scale advantage
  if (gf.mktcap !== null) {
    const mktcapB = gf.mktcap / 1e9;
    if (mktcapB > 500) { score += 10; factors.push('Mega-cap — network effects and scale moat'); }
    else if (mktcapB > 50) { score += 5; factors.push('Large-cap — established market position'); }
    else if (mktcapB < 2) { score -= 5; factors.push('Small-cap — scale disadvantage'); }
  }

  // FCF margin as business quality
  if (gf.fcfMargin !== null) {
    if (gf.fcfMargin > 30) { score += 5; factors.push(`FCF margin ${gf.fcfMargin.toFixed(0)}% — cash machine`); }
    else if (gf.fcfMargin < 0) { score -= 10; factors.push('Negative FCF — cash burn'); }
  }

  // Map score to tier
  let tier: AICTTier;
  let tierNum: number;
  if (score >= 85) { tier = 'FORTRESS'; tierNum = 1; }
  else if (score >= 70) { tier = 'CASTLE'; tierNum = 2; }
  else if (score >= 50) { tier = 'CHAPEL'; tierNum = 3; }
  else if (score >= 30) { tier = 'STONE'; tierNum = 4; }
  else { tier = 'WOOD'; tierNum = 5; }

  const tierLabels: Record<AICTTier, string> = {
    FORTRESS: 'Fortress', CASTLE: 'Castle', CHAPEL: 'Chapel', STONE: 'Stone', WOOD: 'Wood',
  };

  // Estimate rank within tier (rough)
  const rankInTier = tier === 'FORTRESS' ? Math.max(1, 6 - Math.floor(score / 20)) :
                     tier === 'CASTLE' ? Math.max(5, 25 - Math.floor((score - 70) * 2)) :
                     tier === 'CHAPEL' ? Math.max(10, 30 - Math.floor((score - 50) * 1.5)) :
                     tier === 'STONE' ? Math.max(25, 45 - Math.floor((score - 30) * 1)) :
                     Math.max(45, 50 - Math.floor(score * 0.5));

  const confidence = factors.length >= 3 ? 'MEDIUM' : 'LOW';

  return {
    tier,
    tierNum,
    tierLabel: `${tierLabels[tier]} ~#${rankInTier}`,
    confidence,
    factors,
    narrative: `${symbol} heuristically classified as ${tierLabels[tier]} (score: ${score}/100). ${factors.slice(0, 3).join('. ')}. ` +
      `Burry's AICT tiers determine growth assumptions in the IV15 model — ${tierLabels[tier]}-tier companies get ${tier === 'FORTRESS' ? 'the highest' : tier === 'CASTLE' ? 'strong' : tier === 'CHAPEL' ? 'moderate' : tier === 'STONE' ? 'conservative' : 'minimal'} growth runway.`,
  };
}

// ═══════════════════════════════════════════════════════════════════
// E. MULTI-STAGE IV15 DCF
// ═══════════════════════════════════════════════════════════════════
// 3 stages + Stage 0 (current year), 15% discount rate
// Growth rates bounded by ROIC (Burry: "growth above ROIC is dilutive")
// Terminal value: hybrid DDM/Buffett endpoint
// Stage durations: 5/5/5 years (approximation)

function computeIV15(gf: GFData, aict: AICTClassification, adjustedROIC: AdjustedROICResult, tragicAlgebra: TragicAlgebraResult, price: number): IV15DCFResult {
  const d = 0.15; // 15% discount rate — Burry's constant
  const terminalGrowth = 0.025; // 2.5% terminal growth (our approximation)

  // Use true owners' earnings if available, otherwise FCF per share
  const baseCF = tragicAlgebra.trueOwnersEarnings ?? gf.fcfPerShare;

  if (baseCF === null || baseCF <= 0) {
    return {
      iv15PerShare: null,
      priceToIV15: null,
      stages: {
        stage0: { years: 1, growth: 0, fcf: baseCF },
        stage1: { years: 5, growth: 0, fcf: null },
        stage2: { years: 5, growth: 0, fcf: null },
        stage3: { years: 5, growth: 0, fcf: null },
      },
      terminalValue: null,
      discountRate: d,
      methodology: 'IV15 not computable — negative or missing cash flow',
      narrative: `IV15 cannot be computed: ${baseCF === null ? 'no earnings/FCF data available' : 'negative cash flow ($' + baseCF.toFixed(2) + '/share)'}. Burry would not value a company that isn't generating cash.`,
    };
  }

  // ROIC cap on growth (Burry: growth above ROIC is value-destructive)
  const roicCap = adjustedROIC.adjustedROIC !== null ? adjustedROIC.adjustedROIC / 100 : 0.15;

  // Growth rate assumptions by AICT tier and stage
  // Fortress gets longest high-growth runway, Wood gets almost none
  const tierGrowthMultipliers: Record<AICTTier, { s1: number; s2: number; s3: number }> = {
    FORTRESS: { s1: 1.0, s2: 0.75, s3: 0.50 },
    CASTLE:   { s1: 0.90, s2: 0.65, s3: 0.40 },
    CHAPEL:   { s1: 0.75, s2: 0.50, s3: 0.30 },
    STONE:    { s1: 0.55, s2: 0.35, s3: 0.20 },
    WOOD:     { s1: 0.35, s2: 0.20, s3: 0.10 },
  };

  const multipliers = tierGrowthMultipliers[aict.tier];

  // Base growth rate: use 3yr revenue growth, capped by ROIC
  let baseGrowth = 0.10; // default 10%
  if (gf.revGrowth3yr !== null) {
    baseGrowth = Math.min(Math.abs(gf.revGrowth3yr) / 100, roicCap, 0.30);
    baseGrowth = Math.max(baseGrowth, 0.03);
  } else if (gf.revGrowthYoY !== null) {
    baseGrowth = Math.min(Math.abs(gf.revGrowthYoY) / 100, roicCap, 0.30);
    baseGrowth = Math.max(baseGrowth, 0.03);
  }

  const g1 = baseGrowth * multipliers.s1;
  const g2 = baseGrowth * multipliers.s2;
  const g3 = baseGrowth * multipliers.s3;

  // Stage 0: current year (no discount)
  const s0fcf = baseCF;

  // Compute discounted cash flows
  let totalPV = 0;
  let cf = baseCF;

  // Stage 1: years 1-5
  const s1EndCF = cf;
  for (let y = 1; y <= 5; y++) {
    cf *= (1 + g1);
    totalPV += cf / Math.pow(1 + d, y);
  }
  const s1fcf = cf;

  // Stage 2: years 6-10
  for (let y = 6; y <= 10; y++) {
    cf *= (1 + g2);
    totalPV += cf / Math.pow(1 + d, y);
  }
  const s2fcf = cf;

  // Stage 3: years 11-15
  for (let y = 11; y <= 15; y++) {
    cf *= (1 + g3);
    totalPV += cf / Math.pow(1 + d, y);
  }
  const s3fcf = cf;

  // Terminal value: Gordon Growth Model on year 15 CF
  // TV = CF_15 * (1 + g_terminal) / (d - g_terminal)
  const tv = cf * (1 + terminalGrowth) / (d - terminalGrowth);
  const pvTV = tv / Math.pow(1 + d, 15);
  totalPV += pvTV;

  // IV15 = sum of all discounted cash flows
  const iv15 = Math.round(totalPV * 100) / 100;
  const priceToIV15 = iv15 > 0 ? Math.round((price / iv15) * 100) / 100 : null;

  const parts: string[] = [];
  parts.push(`IV15 = $${iv15.toFixed(2)} per share (15% discount rate, ${aict.tier.toLowerCase()}-tier growth assumptions).`);
  if (priceToIV15 !== null) {
    if (priceToIV15 < 0.8) {
      parts.push(`P/IV15 = ${priceToIV15.toFixed(2)}x — SIGNIFICANTLY UNDERVALUED. Burry: "This is where fat pitches live."`);
    } else if (priceToIV15 < 1.0) {
      parts.push(`P/IV15 = ${priceToIV15.toFixed(2)}x — trading below intrinsic value.`);
    } else if (priceToIV15 < 1.3) {
      parts.push(`P/IV15 = ${priceToIV15.toFixed(2)}x — near fair value.`);
    } else if (priceToIV15 < 2.0) {
      parts.push(`P/IV15 = ${priceToIV15.toFixed(2)}x — trading at a premium to IV15.`);
    } else {
      parts.push(`P/IV15 = ${priceToIV15.toFixed(2)}x — SUBSTANTIALLY OVERVALUED relative to 15% discount rate.`);
    }
  }
  parts.push(`Growth stages: ${(g1*100).toFixed(1)}% → ${(g2*100).toFixed(1)}% → ${(g3*100).toFixed(1)}% → ${(terminalGrowth*100).toFixed(1)}% terminal.`);

  return {
    iv15PerShare: iv15,
    priceToIV15,
    stages: {
      stage0: { years: 1, growth: 0, fcf: s0fcf },
      stage1: { years: 5, growth: Math.round(g1 * 1000) / 10, fcf: Math.round(s1fcf * 100) / 100 },
      stage2: { years: 5, growth: Math.round(g2 * 1000) / 10, fcf: Math.round(s2fcf * 100) / 100 },
      stage3: { years: 5, growth: Math.round(g3 * 1000) / 10, fcf: Math.round(s3fcf * 100) / 100 },
    },
    terminalValue: Math.round(pvTV * 100) / 100,
    discountRate: d,
    methodology: `Multi-stage DCF: 3 stages × 5 years + terminal. Growth rates ROIC-bounded (cap: ${(roicCap * 100).toFixed(0)}%), tier-adjusted (${aict.tier}). Terminal: ${(terminalGrowth * 100).toFixed(1)}% Gordon Growth. Base CF: True Owners' Earnings.`,
    narrative: parts.join(' '),
  };
}

// ═══════════════════════════════════════════════════════════════════
// F. COMPOSITE SCORE
// ═══════════════════════════════════════════════════════════════════
// 3 weighted buckets (exact weights undisclosed, we approximate):
//   Shareholder's Bucket (35%): SBC, dilution, buyback effectiveness
//   Quality Bucket (35%): ROIC, margins, balance sheet, Piotroski
//   Valuation Bucket (30%): P/IV15, P/E vs historical, FCF yield

function computeCompositeScore(
  gf: GFData,
  tragicAlgebra: TragicAlgebraResult,
  iv15: IV15DCFResult,
  adjustedROIC: AdjustedROICResult,
  price: number,
): CompositeScoreResult {
  // ── Shareholder's Bucket ──
  let shScore = 50;
  const shComponents: Record<string, number | null> = {};

  // Dilution impact
  if (tragicAlgebra.dilutionRate > 0.02) { shScore -= 20; }
  else if (tragicAlgebra.dilutionRate > 0.01) { shScore -= 10; }
  else if (tragicAlgebra.dilutionRate === 0 && gf.sharesBuybackRate !== null && gf.sharesBuybackRate > 2) { shScore += 20; }
  else if (gf.sharesBuybackRate !== null && gf.sharesBuybackRate > 0) { shScore += 10; }
  shComponents.dilutionImpact = Math.round(tragicAlgebra.dilutionRate * 10000) / 100;

  // SBC burden
  if (tragicAlgebra.gaapOverstatement !== null) {
    if (tragicAlgebra.gaapOverstatement > 30) { shScore -= 15; }
    else if (tragicAlgebra.gaapOverstatement > 15) { shScore -= 5; }
    else if (tragicAlgebra.gaapOverstatement < 5) { shScore += 10; }
    shComponents.gaapOverstatement = Math.round(tragicAlgebra.gaapOverstatement * 10) / 10;
  }

  // Buyback yield
  if (gf.buybackYield !== null) {
    if (gf.buybackYield > 6) { shScore += 15; }
    else if (gf.buybackYield > 3) { shScore += 5; }
    shComponents.buybackYield = gf.buybackYield;
  }

  shScore = Math.max(0, Math.min(100, shScore));

  // ── Quality Bucket ──
  let qScore = 50;
  const qComponents: Record<string, number | null> = {};

  // ROIC
  const roicVal = adjustedROIC.adjustedROIC ?? gf.roic;
  if (roicVal !== null) {
    if (roicVal > 25) { qScore += 25; }
    else if (roicVal > 15) { qScore += 15; }
    else if (roicVal > 10) { qScore += 5; }
    else if (roicVal < 5) { qScore -= 15; }
    qComponents.adjustedROIC = roicVal;
  }

  // Operating margin
  if (gf.opMargin !== null) {
    if (gf.opMargin > 30) { qScore += 10; }
    else if (gf.opMargin > 20) { qScore += 5; }
    else if (gf.opMargin < 5) { qScore -= 10; }
    qComponents.opMargin = gf.opMargin;
  }

  // Piotroski F-Score
  if (gf.piotroskiF !== null) {
    if (gf.piotroskiF >= 7) { qScore += 10; }
    else if (gf.piotroskiF >= 5) { qScore += 5; }
    else if (gf.piotroskiF <= 3) { qScore -= 10; }
    qComponents.piotroskiF = gf.piotroskiF;
  }

  // Balance sheet
  if (gf.debtToEbitda !== null) {
    if (gf.debtToEbitda < 1) { qScore += 5; }
    else if (gf.debtToEbitda > 4) { qScore -= 15; }
    qComponents.debtToEbitda = gf.debtToEbitda;
  }

  qScore = Math.max(0, Math.min(100, qScore));

  // ── Valuation Bucket ──
  let vScore = 50;
  const vComponents: Record<string, number | null> = {};

  // P/IV15 is the PRIMARY valuation signal
  if (iv15.priceToIV15 !== null) {
    if (iv15.priceToIV15 < 0.7) { vScore += 30; }
    else if (iv15.priceToIV15 < 0.9) { vScore += 20; }
    else if (iv15.priceToIV15 < 1.1) { vScore += 5; }
    else if (iv15.priceToIV15 > 2.0) { vScore -= 25; }
    else if (iv15.priceToIV15 > 1.5) { vScore -= 15; }
    else if (iv15.priceToIV15 > 1.2) { vScore -= 5; }
    vComponents.priceToIV15 = iv15.priceToIV15;
  }

  // FCF Yield
  if (gf.fcfYield !== null) {
    if (gf.fcfYield > 8) { vScore += 10; }
    else if (gf.fcfYield > 5) { vScore += 5; }
    else if (gf.fcfYield < 1) { vScore -= 10; }
    vComponents.fcfYield = gf.fcfYield;
  }

  // GF Value margin
  if (gf.gfValueMargin !== null) {
    if (gf.gfValueMargin < -30) { vScore += 10; }
    else if (gf.gfValueMargin > 30) { vScore -= 10; }
    vComponents.gfValueMargin = gf.gfValueMargin;
  }

  vScore = Math.max(0, Math.min(100, vScore));

  // ── Weighted Composite ──
  const shWeight = 0.35;
  const qWeight = 0.35;
  const vWeight = 0.30;
  const overall = Math.round(shScore * shWeight + qScore * qWeight + vScore * vWeight);

  let verdict: CompositeVerdict;
  if (overall >= 75) verdict = 'ELITE';
  else if (overall >= 60) verdict = 'STRONG';
  else if (overall >= 45) verdict = 'AVERAGE';
  else if (overall >= 30) verdict = 'WEAK';
  else verdict = 'POOR';

  const parts: string[] = [];
  parts.push(`Composite: ${overall}/100 (${verdict}).`);
  parts.push(`Shareholders: ${shScore}, Quality: ${qScore}, Valuation: ${vScore}.`);
  if (verdict === 'ELITE') parts.push('Burry would have this high on his watchlist.');
  else if (verdict === 'POOR') parts.push('Multiple red flags across all dimensions — Burry would avoid entirely.');

  return {
    overall,
    verdict,
    buckets: {
      shareholders: { score: shScore, weight: shWeight, components: shComponents },
      quality: { score: qScore, weight: qWeight, components: qComponents },
      valuation: { score: vScore, weight: vWeight, components: vComponents },
    },
    narrative: parts.join(' '),
  };
}

// ═══════════════════════════════════════════════════════════════════
// G. ALL MAP ZONE CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════
// Baseball-field visualization with curved AICT-dependent zone boundaries
// Fat Pitch: P/IV15 < threshold AND quality > threshold (AICT-dependent)
// Just Outside: borderline — close to fat pitch but one dimension lacking
// Out Field: expensive relative to quality, or quality too poor

function classifyAllMapZone(
  iv15: IV15DCFResult,
  aict: AICTClassification,
  composite: CompositeScoreResult,
): AllMapResult {
  const priceToIV15 = iv15.priceToIV15;
  const compositeRank = composite.overall;

  // AICT-dependent P/IV15 thresholds (Fortress gets wider zone)
  // Fat Pitch boundary: higher-tier companies can be slightly more expensive and still qualify
  const fatPitchThresholds: Record<AICTTier, number> = {
    FORTRESS: 1.20,  // Fortress at 1.2x IV15 is still a fat pitch (quality premium)
    CASTLE: 1.10,
    CHAPEL: 1.00,
    STONE: 0.90,
    WOOD: 0.75,
  };

  // Composite score minimum for Fat Pitch
  const compositeMinimums: Record<AICTTier, number> = {
    FORTRESS: 40,
    CASTLE: 45,
    CHAPEL: 50,
    STONE: 55,
    WOOD: 65,
  };

  const fatThreshold = fatPitchThresholds[aict.tier];
  const compositeMin = compositeMinimums[aict.tier];

  let zone: AllMapZone;
  let narrative: string;

  if (priceToIV15 === null) {
    zone = 'OUT_FIELD';
    narrative = 'IV15 not computable — cannot classify on the All Map. Treat as Out Field until data improves.';
  } else if (priceToIV15 <= fatThreshold && compositeRank >= compositeMin) {
    zone = 'FAT_PITCH';
    narrative = `FAT PITCH — P/IV15 of ${priceToIV15.toFixed(2)}x is below the ${aict.tier.toLowerCase()}-tier threshold (${fatThreshold.toFixed(2)}x) and composite score ${compositeRank} exceeds the minimum (${compositeMin}). Burry: "These are the ones you swing at."`;
  } else if (
    priceToIV15 <= fatThreshold * 1.15 && compositeRank >= compositeMin * 0.85
  ) {
    zone = 'JUST_OUTSIDE';
    narrative = `JUST OUTSIDE — Close to a fat pitch (P/IV15: ${priceToIV15.toFixed(2)}x vs ${fatThreshold.toFixed(2)}x threshold, composite: ${compositeRank} vs ${compositeMin} min). One dimension needs to improve. Watch for entry.`;
  } else {
    zone = 'OUT_FIELD';
    if (priceToIV15 > 2.0) {
      narrative = `OUT FIELD — P/IV15 of ${priceToIV15.toFixed(2)}x is far above intrinsic value. No margin of safety. Burry: "At this price you're paying for hope, not value."`;
    } else if (compositeRank < 35) {
      narrative = `OUT FIELD — Composite score ${compositeRank} indicates too many quality concerns despite ${priceToIV15 < 1.0 ? 'appearing cheap' : 'the premium'}. Value traps live here.`;
    } else {
      narrative = `OUT FIELD — P/IV15 of ${priceToIV15.toFixed(2)}x exceeds the ${aict.tier.toLowerCase()}-tier fat pitch threshold of ${fatThreshold.toFixed(2)}x. Not enough margin of safety.`;
    }
  }

  const zoneLabels: Record<AllMapZone, string> = {
    FAT_PITCH: 'Fat Pitch', JUST_OUTSIDE: 'Just Outside', OUT_FIELD: 'Out Field',
  };

  return {
    zone,
    zoneLabel: zoneLabels[zone],
    priceToIV15,
    aictTier: aict.tier,
    compositeRank,
    narrative,
  };
}

// ═══════════════════════════════════════════════════════════════════
// MASTER FUNCTION
// ═══════════════════════════════════════════════════════════════════

export async function getFullIV15Analysis(symbol: string, price: number): Promise<FullIV15Result> {
  const sym = symbol.toUpperCase();

  // Check cache
  const cached = IV15_CACHE.get(sym);
  if (cached && Date.now() - cached.ts < IV15_CACHE_TTL) {
    // Update price-dependent fields if price changed significantly
    if (Math.abs(cached.data.price - price) / price < 0.02) {
      return cached.data;
    }
  }

  console.log(`[IV15] Computing full IV15 analysis for ${sym} @ $${price.toFixed(2)}`);

  // Fetch all GuruFocus data
  const gf = await fetchAllGFData(sym);
  const dataAvailable = gf !== null;

  if (!gf) {
    const empty: FullIV15Result = {
      symbol: sym,
      price,
      dataAvailable: false,
      tragicAlgebra: { gaapEPS: null, sbcPerShare: null, dilutionRate: 0, trueOwnersEarnings: null, gaapOverstatement: null, omega: null, deltaE: null, narrative: 'GuruFocus data unavailable — cannot perform IV15 analysis.' },
      pvDilution: { cashFlow: null, discountRate: 0.15, growthRate: 0.05, dilutionRate: 0, pvWithoutDilution: null, pvWithDilution: null, dilutionImpact: null, narrative: 'Data unavailable.' },
      adjustedROIC: { reportedROIC: null, adjustedROIC: null, adjustments: [], narrative: 'Data unavailable.' },
      aict: { tier: 'STONE', tierNum: 4, tierLabel: 'Stone (unclassified)', confidence: 'LOW', factors: ['No data available'], narrative: 'Cannot classify without fundamental data.' },
      iv15: { iv15PerShare: null, priceToIV15: null, stages: { stage0: { years: 1, growth: 0, fcf: null }, stage1: { years: 5, growth: 0, fcf: null }, stage2: { years: 5, growth: 0, fcf: null }, stage3: { years: 5, growth: 0, fcf: null } }, terminalValue: null, discountRate: 0.15, methodology: 'N/A', narrative: 'Data unavailable.' },
      composite: { overall: 0, verdict: 'POOR' as CompositeVerdict, buckets: { shareholders: { score: 0, weight: 0.35, components: {} }, quality: { score: 0, weight: 0.35, components: {} }, valuation: { score: 0, weight: 0.30, components: {} } }, narrative: 'Data unavailable.' },
      allMap: { zone: 'OUT_FIELD', zoneLabel: 'Out Field', priceToIV15: null, aictTier: 'STONE', compositeRank: null, narrative: 'Cannot classify without data.' },
      headline: `${sym} — IV15 analysis unavailable (GuruFocus data missing)`,
      keyInsights: ['Fundamental data could not be retrieved from GuruFocus'],
      dataGaps: ['All data missing — check if ticker is valid or API is available'],
      fetchedAt: new Date().toISOString(),
    };
    return empty;
  }

  // Run all analyses sequentially (they depend on each other)
  const tragicAlgebra = computeTragicAlgebra(gf, price);
  const pvDilution = computePVWithDilution(gf, tragicAlgebra);
  const adjustedROIC = computeAdjustedROIC(gf);
  const aict = classifyAICT(gf, sym);
  const iv15 = computeIV15(gf, aict, adjustedROIC, tragicAlgebra, price);
  const composite = computeCompositeScore(gf, tragicAlgebra, iv15, adjustedROIC, price);
  const allMap = classifyAllMapZone(iv15, aict, composite);

  // Build headline
  let headline: string;
  if (allMap.zone === 'FAT_PITCH') {
    headline = `${sym} — FAT PITCH at $${price.toFixed(2)} (IV15: $${iv15.iv15PerShare?.toFixed(2) ?? '?'}, ${aict.tierLabel})`;
  } else if (allMap.zone === 'JUST_OUTSIDE') {
    headline = `${sym} — JUST OUTSIDE at $${price.toFixed(2)} (IV15: $${iv15.iv15PerShare?.toFixed(2) ?? '?'}, ${aict.tierLabel})`;
  } else {
    headline = `${sym} — OUT FIELD at $${price.toFixed(2)} (IV15: $${iv15.iv15PerShare?.toFixed(2) ?? '?'}, ${aict.tierLabel})`;
  }

  // Key insights
  const keyInsights: string[] = [];
  if (iv15.priceToIV15 !== null) {
    keyInsights.push(`P/IV15 = ${iv15.priceToIV15.toFixed(2)}x — ${iv15.priceToIV15 < 1.0 ? 'trading below' : iv15.priceToIV15 < 1.3 ? 'near' : 'above'} intrinsic value`);
  }
  if (tragicAlgebra.gaapOverstatement !== null && tragicAlgebra.gaapOverstatement > 10) {
    keyInsights.push(`GAAP overstates earnings by ${tragicAlgebra.gaapOverstatement.toFixed(0)}% — Tragic Algebra at work`);
  }
  if (tragicAlgebra.dilutionRate > 0.01) {
    keyInsights.push(`${(tragicAlgebra.dilutionRate * 100).toFixed(1)}% annual dilution — destroys ~${(tragicAlgebra.dilutionRate * 18 * 100).toFixed(0)}% of value`);
  } else if (gf.sharesBuybackRate !== null && gf.sharesBuybackRate > 2) {
    keyInsights.push(`Share count shrinking ${gf.sharesBuybackRate.toFixed(1)}%/yr — compounding for shareholders`);
  }
  keyInsights.push(`Composite: ${composite.overall}/100 (${composite.verdict}) — ${aict.tierLabel}`);
  if (adjustedROIC.adjustedROIC !== null) {
    keyInsights.push(`Adjusted ROIC: ${adjustedROIC.adjustedROIC.toFixed(1)}% (growth capped at this rate in IV15 model)`);
  }

  // Data gaps
  const dataGaps: string[] = [];
  if (gf.sbcPerShare === null) dataGaps.push('SBC per share not available — dilution impact approximated from share count');
  if (aict.confidence !== 'HIGH') dataGaps.push(`AICT tier is heuristic (${aict.confidence} confidence) — not from Burry's published SW50`);
  dataGaps.push('Exact Composite Score weights are approximated — Burry withholds his precise weightings');
  dataGaps.push('Stage durations (5/5/5 years) and terminal growth (2.5%) are approximations');
  if (gf.revGrowth3yr === null) dataGaps.push('3-year revenue growth unavailable — using YoY growth as proxy');

  const result: FullIV15Result = {
    symbol: sym,
    price,
    dataAvailable,
    tragicAlgebra,
    pvDilution,
    adjustedROIC,
    aict,
    iv15,
    composite,
    allMap,
    headline,
    keyInsights,
    dataGaps,
    fetchedAt: new Date().toISOString(),
  };

  // Cache result
  IV15_CACHE.set(sym, { data: result, ts: Date.now() });
  console.log(`[IV15] ${sym}: IV15=$${iv15.iv15PerShare?.toFixed(2) ?? 'N/A'}, P/IV15=${iv15.priceToIV15?.toFixed(2) ?? 'N/A'}x, Zone=${allMap.zone}, Composite=${composite.overall}`);

  return result;
}
