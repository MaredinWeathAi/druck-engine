export declare function initDatabase(): void;
export declare function getActiveAlgorithmVersion(): string;
export declare function getAllAlgorithmVersions(): any[];
export interface AlgorithmUpdateRequest {
    reason: string;
    accuracyData?: any;
}
export declare function requestAlgorithmUpdate(req: AlgorithmUpdateRequest): number;
export declare function approveAlgorithmUpdate(requestId: number, newVersionId: string, description: string, configSnapshot: any, approvedBy: string, approvalNote: string): void;
export declare function getPendingUpdateRequests(): any[];
export interface SnapshotRecord {
    symbol: string;
    date: string;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
    changePct1d: number | null;
    changePct30d: number | null;
    dailyTrend: string | null;
    weeklyTrend: string | null;
    monthlyTrend: string | null;
    phaseNum: number | null;
    phaseShort: string | null;
    actionBias: string | null;
    confidence: number | null;
    overallSignal: string | null;
    technicalData?: any;
    pillarScores?: any;
}
export declare function recordSnapshot(record: SnapshotRecord): void;
export declare function recordSnapshotBatch(records: SnapshotRecord[]): void;
export interface TransitionRecord {
    symbol: string;
    date: string;
    fromPhase: number;
    toPhase: number;
    fromPhaseShort: string;
    toPhaseShort: string;
    fromBias: string;
    toBias: string;
    biasFlipped: boolean;
    direction: string;
    severity: string;
    priceAtTransition: number | null;
}
export declare function recordTransition(record: TransitionRecord): void;
export declare function recordTransitionBatch(records: TransitionRecord[]): void;
export declare function getSymbolHistory(symbol: string, limit?: number): any[];
export declare function getSymbolPhaseTimeline(symbol: string): any[];
export declare function getSymbolTransitions(symbol: string): any[];
export declare function getRecentTransitions(days?: number): any[];
export declare function getLatestSnapshots(): any[];
export declare function getSnapshotsByDate(date: string): any[];
export declare function updateTransitionOutcomes(): number;
export declare function computeAccuracyMetrics(algorithmVersion?: string): any;
export declare function getDbStats(): any;
export declare function initWatchlistTable(): void;
export declare function getWatchlist(): any[];
export declare function addWatchlistTicker(symbol: string): void;
export declare function removeWatchlistTicker(symbol: string): void;
export declare function getWatchlistPhaseLog(symbol?: string): any[];
export declare function updateWatchlistAnalysis(symbol: string, data: any): void;
export declare function recordPhaseVerdictSnapshot(symbol: string, source: string, data: {
    price: number;
    phaseNum: number;
    phaseShort: string;
    verdict: string;
    archetype: string;
    extensionPct: number;
    upDownRatio: number | null;
    failedBreakdowns: number;
    confidence: number;
}): void;
export declare function getPhaseVerdictHistory(symbol?: string, limit?: number): any[];
export declare function recordForeshadowSnapshot(inputs: {
    fed: number;
    oil: number;
    growth: number;
    dollar: number;
    inflation: number;
    credit: number;
    gold: number;
}, phaseShifts: string, notes?: string): void;
export declare function getForeshadowHistory(limit?: number): any[];
export declare function recordDruckenmiller13F(entry: {
    filingDate: string;
    reportDate: string;
    symbol: string;
    action: string;
    sharesDeltaPct: number;
    positionValue: number;
    portfolioPct: number;
    ourPhase: number;
    ourVerdict: string;
    sector: string;
    notes: string;
}): void;
export declare function getDruckenmiller13FHistory(): any[];
export declare function closeDatabase(): void;
//# sourceMappingURL=history-store.d.ts.map