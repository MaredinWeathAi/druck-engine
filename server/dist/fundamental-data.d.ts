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
declare const router: import("express-serve-static-core").Router;
export interface FundamentalData {
    ticker: string;
    company: string;
    sector: string;
    industry: string;
    marketCap: number | null;
    revenueGrowthYoY: number | null;
    revenueGrowth3yr: number | null;
    epsGrowthYoY: number | null;
    epsGrowth3yr: number | null;
    grossMargin: number | null;
    operatingMargin: number | null;
    netMargin: number | null;
    roic: number | null;
    roe: number | null;
    roa: number | null;
    fcfYield: number | null;
    fcfMargin: number | null;
    fcfPerShare: number | null;
    debtToEquity: number | null;
    currentRatio: number | null;
    interestCoverage: number | null;
    piotroskiFScore: number | null;
    altmanZScore: number | null;
    insiderBuys3m: number;
    insiderSells3m: number;
    insiderNetPct: number | null;
}
export interface ValuationData {
    ticker: string;
    peTrailing: number | null;
    peForward: number | null;
    evToEbitda: number | null;
    evToSales: number | null;
    priceToBook: number | null;
    priceToFcf: number | null;
    pegRatio: number | null;
    dividendYield: number | null;
    pe5yrAvg: number | null;
    pe5yrHigh: number | null;
    pe5yrLow: number | null;
    evEbitda5yrAvg: number | null;
    pePctile: number | null;
    evEbitdaPctile: number | null;
    gfValue: number | null;
    gfValueMargin: number | null;
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
export declare function getFullFundamentals(ticker: string): Promise<FullFundamentalResult>;
export default router;
//# sourceMappingURL=fundamental-data.d.ts.map