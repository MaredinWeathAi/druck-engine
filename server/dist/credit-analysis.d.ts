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
interface AICompanyCredit {
    symbol: string;
    name: string;
    interestCoverage: number | null;
    debt2ebitda: number | null;
    debt2equity: number | null;
    zscore: number | null;
    cash2debt: number | null;
    currentRatio: number | null;
    creditHealthScore: number;
}
interface AIBasket {
    avgScore: number;
    weekChange: number | null;
    monthChange: number | null;
    companies: AICompanyCredit[];
    weakestLink: string | null;
    strongestLink: string | null;
}
interface DivergenceAlert {
    detected: boolean;
    message: string;
    severity: 'NONE' | 'WATCH' | 'WARNING' | 'CRITICAL';
}
export interface CreditDashboardData {
    igOAS: CreditSpreadSeries;
    hyOAS: CreditSpreadSeries;
    cccOAS: CreditSpreadSeries;
    aiBasket: AIBasket;
    divergence: DivergenceAlert;
    creditRiskScore: number;
    creditRiskLabel: string;
    creditRiskColor: string;
    healthStatus: string;
    healthEmoji: string;
    summary: string;
    lastUpdated: string;
}
export declare function fetchCreditDashboard(fredKey: string, gfKey: string): Promise<CreditDashboardData | null>;
export {};
//# sourceMappingURL=credit-analysis.d.ts.map