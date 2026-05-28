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
declare const router: import("express-serve-static-core").Router;
export type IndustryType = 'airlines' | 'semiconductors' | 'payments' | 'saas' | 'healthcare' | 'banks' | 'energy' | 'retail';
export interface IndustryDriver {
    name: string;
    value: number | string | null;
    direction: 'improving' | 'stable' | 'deteriorating' | 'unknown';
    inflectionSignal: boolean;
    weight: number;
    description: string;
}
export interface IndustryAnalysis {
    industry: IndustryType;
    industryLabel: string;
    drivers: IndustryDriver[];
    inflectionScore: number;
    activeSignals: number;
    totalDrivers: number;
    constituents: string[];
    cyclicalPosition: 'early_cycle' | 'mid_cycle' | 'late_cycle' | 'downturn';
    recommendation: string;
}
export declare function analyzeIndustry(industry: IndustryType, driverInputs: Partial<Record<string, {
    value: number | string | null;
    direction: IndustryDriver['direction'];
}>>): IndustryAnalysis;
export default router;
//# sourceMappingURL=industry-drivers.d.ts.map