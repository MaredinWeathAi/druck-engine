declare const router: import("express-serve-static-core").Router;
export declare function initBurryTables(): void;
export declare function startRSSPolling(): void;
export declare function stopRSSPolling(): void;
export interface BurryFrameworkInput {
    symbol: string;
    price: number;
    priceVs200d: number | null;
    pctFrom52wHigh: number | null;
    upDownRatio: number | null;
    sma50Above200: boolean;
    rsi14: number | null;
    volumeBreakdown: {
        shareholderTurnover?: {
            turnoverPct: number;
            turnoverLabel: string;
            [key: string]: any;
        } | null;
        peak?: {
            declineFromPeak: number;
            [key: string]: any;
        } | null;
        [key: string]: any;
    } | null;
}
export interface BurryFrameworkResult {
    overallVerdict: 'ATTRACTIVE' | 'INTERESTING' | 'NEUTRAL' | 'UNATTRACTIVE' | 'AVOID';
    overallScore: number;
    summary: string;
    valuation: {
        score: number;
        grade: string;
        detail: string;
        metrics: Record<string, any>;
    };
    balanceSheet: {
        score: number;
        grade: string;
        detail: string;
        hardSellTriggered: boolean;
        metrics: Record<string, any>;
    };
    volumeSignal: {
        score: number;
        detail: string;
    };
    contrarianOpportunity: {
        score: number;
        detail: string;
    };
    capitalCycle: {
        position: string;
        detail: string;
        score: number;
    };
    sbcDilution: {
        score: number;
        detail: string;
        metrics: Record<string, any>;
    };
    principlesTriggered: Array<{
        principle: string;
        applies: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
        quote: string;
    }>;
    hardSells: string[];
    redFlags: string[];
    greenFlags: string[];
    dataAvailable: boolean;
}
export declare function evaluateBurryFramework(input: BurryFrameworkInput): Promise<BurryFrameworkResult>;
export interface BurryTickerInsight {
    symbol: string;
    hasPosition: boolean;
    latestDirection: string | null;
    latestAction: string | null;
    latestPrice: number | null;
    latestDate: string | null;
    instrumentType: string | null;
    optionDetails: string | null;
    rationale: string | null;
    positionHistory: Array<{
        action: string;
        direction: string;
        price: number | null;
        instrumentType: string;
        optionDetails: string | null;
        postDate: string;
        postTitle: string;
    }>;
    postMentions: Array<{
        title: string;
        postDate: string;
        sentiment: string;
        postType: string;
    }>;
    totalMentions: number;
    authorComments: Array<{
        text: string;
        date: string;
        postTitle: string;
        isReply: boolean;
        subscriberQuestion: string | null;
    }>;
    relatedThemes: Array<{
        theme: string;
        count: number;
        lastSeen: string;
    }>;
    narrative: string;
}
export declare function getBurryTickerInsight(symbol: string): Promise<BurryTickerInsight>;
export default router;
//# sourceMappingURL=burry-substack.d.ts.map