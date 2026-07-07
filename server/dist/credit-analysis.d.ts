interface CreditSpreadSeries {
    current: number;
    weekAgo: number;
    monthAgo: number;
    threeMonthAgo: number;
    weekChange: number;
    monthChange: number;
    trend: 'TIGHTENING' | 'STABLE' | 'WIDENING' | 'WIDENING_FAST';
    zone: string;
    zoneColor: string;
    history: {
        date: string;
        value: number;
    }[];
}
interface BellwetherCompany {
    symbol: string;
    name: string;
    sector: string;
    interestCoverage: number | null;
    debt2ebitda: number | null;
    debt2equity: number | null;
    zscore: number | null;
    cash2debt: number | null;
    currentRatio: number | null;
    creditHealthScore: number;
}
interface SectorGroup {
    name: string;
    avgScore: number;
    companies: BellwetherCompany[];
    weakestLink: string | null;
}
interface BellwetherBasket {
    avgScore: number;
    weekChange: number | null;
    monthChange: number | null;
    sectorGroups: SectorGroup[];
    companies: BellwetherCompany[];
    weakestLink: string | null;
    strongestLink: string | null;
    weakestSector: string | null;
}
interface DivergenceAlert {
    detected: boolean;
    alerts: DivergenceItem[];
    worstSeverity: 'NONE' | 'WATCH' | 'WARNING' | 'CRITICAL';
}
interface DivergenceItem {
    type: string;
    message: string;
    severity: 'WATCH' | 'WARNING' | 'CRITICAL';
}
export interface CreditDashboardData {
    igOAS: CreditSpreadSeries;
    hyOAS: CreditSpreadSeries;
    cccOAS: CreditSpreadSeries;
    bellwetherBasket: BellwetherBasket;
    divergence: DivergenceAlert;
    creditRiskScore: number;
    creditRiskLabel: string;
    creditRiskColor: string;
    healthStatus: string;
    healthEmoji: string;
    summary: string;
    lastUpdated: string;
    aiBasket?: any;
}
export declare function initCreditTables(): void;
export interface CreditCommandCenterData {
    healthStatus: string;
    healthEmoji: string;
    creditRiskScore: number;
    creditRiskLabel: string;
    creditRiskColor: string;
    igCurrent: number;
    igTrend: string;
    hyCurrent: number;
    hyTrend: string;
    cccCurrent: number;
    cccTrend: string;
    basketAvg: number;
    weakestSector: string | null;
    divergenceDetected: boolean;
    divergenceWorstSeverity: string;
    divergenceTopMessage: string | null;
    oneLiner: string;
}
export declare function getCreditForCommandCenter(): CreditCommandCenterData | null;
export declare function fetchCreditDashboard(fredKey: string, gfKey: string): Promise<CreditDashboardData | null>;
export {};
//# sourceMappingURL=credit-analysis.d.ts.map