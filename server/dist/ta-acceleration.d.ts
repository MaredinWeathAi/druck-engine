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
declare const router: import("express-serve-static-core").Router;
interface PriceBar {
    date: string;
    close: number;
    volume?: number;
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
    strength: number;
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
export declare const REGIME_SIGNALS: ({
    signal: string;
    impact: string;
    bias: "neutral";
} | {
    signal: string;
    impact: string;
    bias: "bullish";
} | {
    signal: string;
    impact: string;
    bias: "cautious";
})[];
export declare function computeFullTA(ticker: string, name: string, priceArray: PriceBar[]): TAResult | null;
interface GuruHolding {
    ticker: string;
    guruCount: number;
    consensusWeight: number;
    holders: string[];
}
export declare function buildConsensus(positions: Array<{
    ticker: string;
    burryPct: number;
    klarmanPct: number;
    druckenmillerPct: number;
    einhornPct: number;
    greenbergPct: number;
    ackmanPct: number;
    abramsPct: number;
    tepperPct: number;
}>): GuruHolding[];
export default router;
//# sourceMappingURL=ta-acceleration.d.ts.map