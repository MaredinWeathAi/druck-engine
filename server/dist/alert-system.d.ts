/**
 * Inflection Alert System
 * ========================
 * Generates, stores, and manages alerts from the Inflection Engine.
 *
 * Features:
 *   - Alert generation from phase transitions, exhaustion triggers, divergence signals
 *   - Confidence scoring (based on pillar agreement + signal strength)
 *   - Cooldown logic (no repeat alerts within configurable window)
 *   - Alert history with expiry
 *   - Priority classification (CRITICAL / HIGH / MEDIUM / LOW)
 *
 * Alert Types:
 *   - PHASE_TRANSITION: Stock moving between lifecycle phases
 *   - BUY_NOW: Selling exhaustion threshold met
 *   - SHORT_NOW: Buying exhaustion threshold met
 *   - DIVERGENCE: Technical divergence detected
 *   - EARNINGS_REACTION: Unusual earnings reaction
 *   - INDUSTRY_SHIFT: Industry-level inflection signal
 *   - PILLAR_EXTREME: Any pillar hits extreme (>85 or <15)
 */
import type { InflectionPhase, PillarScores, ExhaustionScore, PhaseClassification } from './inflection-engine';
declare const router: import("express-serve-static-core").Router;
export type AlertType = 'PHASE_TRANSITION' | 'BUY_NOW' | 'SHORT_NOW' | 'DIVERGENCE' | 'EARNINGS_REACTION' | 'INDUSTRY_SHIFT' | 'PILLAR_EXTREME';
export type AlertPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export interface InflectionAlert {
    id: string;
    timestamp: string;
    ticker: string;
    type: AlertType;
    priority: AlertPriority;
    title: string;
    description: string;
    confidence: number;
    phase: InflectionPhase | null;
    pillars: PillarScores | null;
    actionBias: string;
    expiresAt: string;
    acknowledged: boolean;
    metadata: Record<string, any>;
}
export declare function generatePhaseTransitionAlert(ticker: string, previousPhase: InflectionPhase | null, currentPhase: PhaseClassification, pillars: PillarScores): InflectionAlert | null;
export declare function generateExhaustionAlert(ticker: string, exhaustion: ExhaustionScore, pillars: PillarScores, phase: InflectionPhase): InflectionAlert | null;
export declare function generateDivergenceAlert(ticker: string, divergenceType: 'DECEL_DIVERGENCE' | 'ACCEL_DIVERGENCE', strength: number, price: number, pillars: PillarScores | null): InflectionAlert | null;
export declare function generatePillarExtremeAlert(ticker: string, pillars: PillarScores, phase: InflectionPhase): InflectionAlert | null;
export declare function generateEarningsReactionAlert(ticker: string, reactionType: 'positive_surprise_flat' | 'negative_surprise_recovery', description: string, pillars: PillarScores | null): InflectionAlert | null;
export declare function generateIndustryShiftAlert(industry: string, inflectionScore: number, cyclicalPosition: string, activeSignals: number, totalDrivers: number, recommendation: string): InflectionAlert | null;
export default router;
//# sourceMappingURL=alert-system.d.ts.map