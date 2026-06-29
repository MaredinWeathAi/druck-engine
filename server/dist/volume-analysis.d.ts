export interface OHLCVBar {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
export interface VolumeBreakdownResult {
    symbol: string;
    price: number;
    sharesOutstanding: number | null;
    floatShares: number | null;
    peak: {
        date: string;
        price: number;
        declineFromPeak: number;
        daysSincePeak: number;
    } | null;
    shareholderTurnover: {
        cumVolumeSincePeak: number;
        turnoverPct: number;
        turnoverLabel: string;
        floatTurnoverPct: number | null;
    } | null;
    volumeCharacter: {
        avgDailyVolume20d: number;
        avgDailyVolume50d: number;
        volumeVs50dAvg: number;
        recentVolumeSpikes: VolumeSpike[];
        sustainedElevatedDays: number;
        volumeTrend: 'rising' | 'falling' | 'stable';
    } | null;
    pricePhase: 'ACTIVE_DECLINE' | 'STABILIZING' | 'RECOVERING' | 'NEW_HIGHS' | 'NO_DECLINE';
    interpretation: {
        signal: 'DISTRIBUTION' | 'CAPITULATION' | 'ABSORPTION' | 'BOTTOMING' | 'NEUTRAL' | 'UNKNOWN';
        confidence: 'HIGH' | 'MEDIUM' | 'LOW';
        narrative: string;
    };
    volumeConfirmedEntry: {
        triggered: boolean;
        reason: string;
    };
    abnormalEvents: AbnormalVolumeEvent[];
}
export interface VolumeSpike {
    date: string;
    volume: number;
    volumeVsAvg: number;
    priceChange: number;
    type: 'CLIMAX_UP' | 'CLIMAX_DOWN' | 'EXPANSION' | 'EXHAUSTION';
}
export interface AbnormalVolumeEvent {
    date: string;
    volume: number;
    volumeVsAvg: number;
    priceChange: number;
    classification: string;
}
export declare function computeVolumeBreakdown(symbol: string, bars: OHLCVBar[]): Promise<VolumeBreakdownResult>;
export interface WatchlistVolumeBadge {
    symbol: string;
    turnoverPct: number | null;
    declineFromPeak: number | null;
    badgeColor: 'green' | 'amber' | 'red' | 'gray';
    badgeLabel: string;
}
export declare function computeWatchlistVolumeBadge(symbol: string, bars: OHLCVBar[]): Promise<WatchlistVolumeBadge>;
//# sourceMappingURL=volume-analysis.d.ts.map