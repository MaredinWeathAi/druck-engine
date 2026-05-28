/**
 * Market Intelligence System — News Anomaly Detection Engine
 * ===========================================================
 * Expectation-based market shift detection across multiple data sources.
 * Identifies surprise events (positive/negative) and classifies impact potential.
 *
 * Translated from Python prototype into TypeScript for the Druck Engine.
 *
 * Features:
 * - Signal types: earnings, regulatory, macro, sentiment, guru, etc.
 * - Impact levels: noise → monitor → significant → major → critical
 * - Expectation-based surprise magnitude (0-100)
 * - Cascade potential analysis
 * - Searchable headline cache (10k)
 * - Daily digest generation (11:30am & 3:30pm ET)
 * - Guru holdings from CSV (Q1 2026 13F data)
 * - REST API endpoints for Druck Engine integration
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=market-intel.d.ts.map