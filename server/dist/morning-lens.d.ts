import { OHLCVBar } from './inflection-engine';
declare const router: import("express-serve-static-core").Router;
interface Instrument {
    symbol: string;
    name: string;
    bucket: 'equities' | 'commodities' | 'fx' | 'fixed_income';
    group: string;
    druckRationale: string;
    isDeathNail?: boolean;
    isLeadingGroup?: boolean;
    isRatio?: boolean;
    ratioComponents?: [string, string];
}
declare const INSTRUMENTS: Instrument[];
declare function refreshMorningLens(): Promise<void>;
declare function fetchTickerBars(symbol: string, years?: number): Promise<OHLCVBar[]>;
export default router;
export { INSTRUMENTS, refreshMorningLens, fetchTickerBars };
//# sourceMappingURL=morning-lens.d.ts.map