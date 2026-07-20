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
export type AICTTier = 'FORTRESS' | 'CASTLE' | 'CHAPEL' | 'STONE' | 'WOOD';
export type AllMapZone = 'FAT_PITCH' | 'JUST_OUTSIDE' | 'OUT_FIELD';
export type CompositeVerdict = 'ELITE' | 'STRONG' | 'AVERAGE' | 'WEAK' | 'POOR';
export interface TragicAlgebraResult {
    gaapEPS: number | null;
    sbcPerShare: number | null;
    dilutionRate: number;
    trueOwnersEarnings: number | null;
    gaapOverstatement: number | null;
    omega: number | null;
    deltaE: number | null;
    narrative: string;
}
export interface PVWithDilutionResult {
    cashFlow: number | null;
    discountRate: number;
    growthRate: number;
    dilutionRate: number;
    pvWithoutDilution: number | null;
    pvWithDilution: number | null;
    dilutionImpact: number | null;
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
    tierNum: number;
    tierLabel: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    factors: string[];
    narrative: string;
}
export interface IV15DCFResult {
    iv15PerShare: number | null;
    priceToIV15: number | null;
    stages: {
        stage0: {
            years: number;
            growth: number;
            fcf: number | null;
        };
        stage1: {
            years: number;
            growth: number;
            fcf: number | null;
        };
        stage2: {
            years: number;
            growth: number;
            fcf: number | null;
        };
        stage3: {
            years: number;
            growth: number;
            fcf: number | null;
        };
    };
    terminalValue: number | null;
    discountRate: number;
    methodology: string;
    narrative: string;
}
export interface CompositeScoreResult {
    overall: number;
    verdict: CompositeVerdict;
    buckets: {
        shareholders: {
            score: number;
            weight: number;
            components: Record<string, number | null>;
        };
        quality: {
            score: number;
            weight: number;
            components: Record<string, number | null>;
        };
        valuation: {
            score: number;
            weight: number;
            components: Record<string, number | null>;
        };
    };
    narrative: string;
}
export interface AllMapResult {
    zone: AllMapZone;
    zoneLabel: string;
    priceToIV15: number | null;
    aictTier: AICTTier;
    compositeRank: number | null;
    narrative: string;
}
export interface FullIV15Result {
    symbol: string;
    price: number;
    dataAvailable: boolean;
    tragicAlgebra: TragicAlgebraResult;
    pvDilution: PVWithDilutionResult;
    adjustedROIC: AdjustedROICResult;
    aict: AICTClassification;
    iv15: IV15DCFResult;
    composite: CompositeScoreResult;
    allMap: AllMapResult;
    headline: string;
    keyInsights: string[];
    dataGaps: string[];
    fetchedAt: string;
}
export declare function getFullIV15Analysis(symbol: string, price: number): Promise<FullIV15Result>;
//# sourceMappingURL=burry-iv15.d.ts.map