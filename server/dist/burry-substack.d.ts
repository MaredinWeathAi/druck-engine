declare const router: import("express-serve-static-core").Router;
export declare function initBurryTables(): void;
export declare function startRSSPolling(): void;
export declare function stopRSSPolling(): void;
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