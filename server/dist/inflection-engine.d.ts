/**
 * Investment Inflection Engine v10.0 — Smart Money Cycle
 * ======================================================
 * Comprehensive inflection detection framework calibrated to how the BEST
 * investors (Tepper, Druckenmiller) actually trade — not crowd behavior.
 *
 * Smart Money Cycle (v10.0):
 *   BULLISH ARC (Enter → Distribute → Exit):
 *     Phase 1: NARRATIVE_EXPANSION   — New story, smart money enters early (BUY)
 *     Phase 2: INSTITUTIONAL_ACCUMULATION — Crowd piles in, smart money SELLS (DISTRIBUTE)
 *     Phase 3: BUYING_EXHAUSTION     — No marginal buyer, smart money exits (SELL)
 *   BEARISH ARC (Trim → Load → Bottom-fish):
 *     Phase 4: NARRATIVE_REVERSAL    — Story breaks, smart money trims (SELL)
 *     Phase 5: SELLING_EXHAUSTION    — Panic overdone, highest conviction BUY zone
 *     Phase 6: NARRATIVE_COLLAPSE    — Full capitulation, deep value BUY
 *
 * Architecture:
 *   - Phase 1: Extended Technical Indicators (RSI, MACD, ATR, SMAs, relative strength)
 *   - Phase 2: Volume Analysis (green/red ratio, climax, exhaustion)
 *   - Phase 3: Fundamental Data (GuruFocus integration)
 *   - Phase 4: Valuation Scoring (multiples, percentiles)
 *   - Phase 5: Five-Pillar Scoring (0-100 normalization)
 *   - Phase 6: Six-Phase Classification — Smart Money Cycle mapping
 *   - Phase 7: Exhaustion Models & BUY NOW / SHORT NOW Triggers
 *   - Phase 8: Industry-Specific Drivers
 *   - Phase 9: Alert System
 *
 * Data flow: Yahoo Finance OHLCV → TA calculations → Pillar scores → Phase classification → Alerts
 */
declare const router: import("express-serve-static-core").Router;
export interface OHLCVBar {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
interface NormalizedOHLCV {
    day: number;
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
export declare function calcSMA(closes: number[], period: number): (number | null)[];
export declare function calcEMA(closes: number[], period: number): (number | null)[];
export declare function calcRSI(closes: number[], period?: number): (number | null)[];
export interface MACDResult {
    macd: number | null;
    signal: number | null;
    histogram: number | null;
}
export declare function calcMACD(closes: number[], fast?: number, slow?: number, sig?: number): MACDResult[];
export declare function calcATR(bars: NormalizedOHLCV[], period?: number): (number | null)[];
export interface HighLowData {
    high52w: number;
    low52w: number;
    pctFromHigh: number;
    pctFromLow: number;
    daysFromHigh: number;
    daysFromLow: number;
}
export declare function calc52WeekHighLow(bars: NormalizedOHLCV[]): HighLowData | null;
export declare function calcRelativeStrength(tickerCloses: number[], benchmarkCloses: number[], period?: number): (number | null)[];
export interface SupportResistance {
    level: number;
    type: 'support' | 'resistance';
    touches: number;
    strength: 'weak' | 'moderate' | 'strong';
    lastTouchDay: number;
}
export declare function detectSupportResistance(bars: NormalizedOHLCV[], tolerance?: number, // 1.5% price band
minTouches?: number): SupportResistance[];
export interface FailedBreak {
    day: number;
    date: string;
    type: 'failed_breakout' | 'failed_breakdown';
    level: number;
    price: number;
    description: string;
}
export declare function detectFailedBreaks(bars: NormalizedOHLCV[], supportResistance: SupportResistance[]): FailedBreak[];
export interface VolumeAnalysis {
    avgVolume20d: number;
    avgVolume50d: number;
    greenDayVolRatio: number;
    redDayVolRatio: number;
    climaxVolume: boolean;
    volumeExhaustion: 'buying' | 'selling' | 'none';
    volumeTrend: 'expanding' | 'contracting' | 'flat';
    obv: number;
    obvSlope: number | null;
}
export declare function analyzeVolume(bars: NormalizedOHLCV[]): VolumeAnalysis | null;
export interface EarningsReaction {
    date: string;
    priceChangePct: number;
    volumeVsAvg: number;
    type: 'positive_surprise_flat' | 'negative_surprise_recovery' | 'normal';
    description: string;
}
export declare function analyzeEarningsReaction(bars: NormalizedOHLCV[], earningsDate: string, surprisePct: number): EarningsReaction | null;
export interface ExtendedTAResult {
    ticker: string;
    name: string;
    sma20: number | null;
    sma50: number | null;
    sma100: number | null;
    sma200: number | null;
    priceVsSma20: number | null;
    priceVsSma50: number | null;
    priceVsSma200: number | null;
    goldenCross: boolean;
    deathCross: boolean;
    sma50Above200: boolean;
    rsi14: number | null;
    macd: MACDResult;
    macdHistSlope: number | null;
    atr14: number | null;
    atrPct: number | null;
    highLow: HighLowData | null;
    rsVsSpy20d: number | null;
    rsVsSpy60d: number | null;
    volume: VolumeAnalysis | null;
    supportResistance: SupportResistance[];
    failedBreaks: FailedBreak[];
}
export declare function computeExtendedTA(ticker: string, name: string, bars: OHLCVBar[], spyCloses?: number[]): ExtendedTAResult | null;
export interface PillarScores {
    technical: number;
    fundamental: number;
    valuation: number;
    inflection: number;
    narrative: number;
    composite: number;
    weights: {
        technical: number;
        fundamental: number;
        valuation: number;
        inflection: number;
        narrative: number;
    };
}
export declare function scoreTechnical(ta: ExtendedTAResult): number;
export declare function scoreFundamental(f: {
    revenueGrowthYoY: number | null;
    epsGrowthYoY: number | null;
    operatingMargin: number | null;
    netMargin: number | null;
    roic: number | null;
    fcfYield: number | null;
    debtToEquity: number | null;
    piotroskiFScore: number | null;
    currentRatio: number | null;
}): number;
export declare function scoreValuation(v: {
    peForward: number | null;
    evToEbitda: number | null;
    pegRatio: number | null;
    fcfYield: number | null;
    pePctile: number | null;
    gfValueMargin: number | null;
}): number;
export declare function scoreInflection(accel: {
    rocAccel: number | null;
    logAccelSmooth: number | null;
    emaAccel: number | null;
    trend: 'accelerating' | 'decelerating' | 'neutral';
    recentSignalCount: number;
    recentSignalType?: 'DECEL_DIVERGENCE' | 'ACCEL_DIVERGENCE' | null;
}, ta: ExtendedTAResult): number;
export declare function scoreNarrative(input: {
    manualSentiment?: number;
    earningsBeatRate?: number | null;
    insiderNetPct?: number | null;
    analystRevisionsUp?: number;
    analystRevisionsDown?: number;
}): number;
export declare function computePillarScores(technical: number, fundamental: number, valuation: number, inflection: number, narrative: number, weights?: {
    technical: number;
    fundamental: number;
    valuation: number;
    inflection: number;
    narrative: number;
}): PillarScores;
export type InflectionPhase = 'NARRATIVE_EXPANSION' | 'BUYING_EXHAUSTION' | 'NARRATIVE_COLLAPSE' | 'SELLING_EXHAUSTION' | 'INSTITUTIONAL_ACCUMULATION' | 'NARRATIVE_REVERSAL';
export type AccumulationSubPhase = 'EARLY_STEALTH' | 'LATE_BREAKOUT_IMMINENT';
export interface PhaseClassification {
    phase: InflectionPhase;
    confidence: number;
    description: string;
    actionBias: 'BUY' | 'HOLD' | 'REDUCE' | 'SHORT' | 'ACCUMULATE';
    riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
    nextPhase: InflectionPhase;
    transitionSignals: string[];
    accumulationSubPhase?: AccumulationSubPhase;
    guruSignals?: GuruBehaviorPrediction;
}
export interface GuruBehaviorPrediction {
    tepperLikely: 'BUYING' | 'TRIMMING' | 'EXITING' | 'HOLDING' | 'LOADING';
    tepperConfidence: number;
    tepperRationale: string;
    druckLikely: 'BUYING' | 'TRIMMING' | 'ROTATING' | 'HOLDING' | 'BOTTOM_FISHING';
    druckConfidence: number;
    druckRationale: string;
    convergenceScore: number;
    convergenceSignal: string;
}
/**
 * Predict likely guru positioning based on current phase and market conditions.
 *
 * TEPPER PATTERNS (v10.0 Smart Money mapping, 61.3% alignment):
 * - Distributes into institutional demand (56.6% sell rate in INST_ACCUM)
 * - 85.7% sell rate in BUYING_EXHAUSTION — his standout signal
 * - Loads massively in SELLING_EXHAUSTION / early NARRATIVE_EXPANSION
 * - Prefers mega-cap liquid names; avg new position = 2.4% of portfolio
 * - Sectors: Airlines (entered BULL_LATE), China (BEAR contrarian), AI/Semis (BULL trim)
 *
 * DRUCKENMILLER PATTERNS (v10.0, 59.3% alignment):
 * - Distributes into institutional demand (59.2% sell rate in INST_ACCUM)
 * - Extraordinary bottom-fisher in NARRATIVE_COLLAPSE (80% buy rate)
 * - Q4-2022: 47 new positions at bear market bottom
 * - Short holding periods (1-3 quarters typical)
 * - AI/Semis: aggressive rotator, entered early, trimmed fast
 */
export declare function predictGuruBehavior(phase: InflectionPhase, pillars: PillarScores, ta: ExtendedTAResult, accelTrend: 'accelerating' | 'decelerating' | 'neutral'): GuruBehaviorPrediction;
export declare function classifyPhase(pillars: PillarScores, ta: ExtendedTAResult, accelTrend: 'accelerating' | 'decelerating' | 'neutral', currentPhase?: InflectionPhase, hasRealFundamentals?: boolean): PhaseClassification;
export interface ExhaustionScore {
    type: 'BUYING_EXHAUSTION' | 'SELLING_EXHAUSTION';
    points: number;
    maxPoints: number;
    triggered: boolean;
    triggerLabel: string;
    criteria: Array<{
        label: string;
        met: boolean;
        points: number;
    }>;
}
export declare function scoreBuyingExhaustion(ta: ExtendedTAResult, accel: {
    rocAccel: number | null;
    trend: string;
}, valuation: {
    pePctile: number | null;
    peForward: number | null;
}): ExhaustionScore;
export declare function scoreSellingExhaustion(ta: ExtendedTAResult, accel: {
    rocAccel: number | null;
    trend: string;
}, valuation: {
    pePctile: number | null;
    peForward: number | null;
    gfValueMargin: number | null;
}, fundamental: {
    piotroskiFScore: number | null;
}): ExhaustionScore;
export interface FullInflectionResult {
    ticker: string;
    name: string;
    extendedTA: ExtendedTAResult;
    pillars: PillarScores;
    phase: PhaseClassification;
    buyingExhaustion: ExhaustionScore;
    sellingExhaustion: ExhaustionScore;
    overallSignal: 'STRONG_BUY' | 'BUY' | 'ACCUMULATE' | 'HOLD' | 'REDUCE' | 'SELL' | 'STRONG_SELL';
    timestamp: string;
}
export declare function computeFullInflection(ticker: string, name: string, bars: OHLCVBar[], spyCloses: number[] | undefined, accelData: {
    rocAccel: number | null;
    logAccelSmooth: number | null;
    emaAccel: number | null;
    trend: 'accelerating' | 'decelerating' | 'neutral';
    recentSignals: any[];
}, fundamentalData: {
    revenueGrowthYoY: number | null;
    epsGrowthYoY: number | null;
    operatingMargin: number | null;
    netMargin: number | null;
    roic: number | null;
    fcfYield: number | null;
    debtToEquity: number | null;
    piotroskiFScore: number | null;
    currentRatio: number | null;
}, valuationData: {
    peForward: number | null;
    evToEbitda: number | null;
    pegRatio: number | null;
    fcfYield: number | null;
    pePctile: number | null;
    gfValueMargin: number | null;
}, narrativeInput: {
    manualSentiment?: number;
    earningsBeatRate?: number | null;
    insiderNetPct?: number | null;
    analystRevisionsUp?: number;
    analystRevisionsDown?: number;
}, currentPhase?: InflectionPhase): FullInflectionResult | null;
export default router;
//# sourceMappingURL=inflection-engine.d.ts.map