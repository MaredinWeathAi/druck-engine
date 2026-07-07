"use strict";
// ═══════════════════════════════════════════════════════════════════
// CREDIT MARKET ANALYSIS MODULE
// Fetches credit spread data from FRED (IG, HY, CCC OAS)
// Computes AI Credit Basket from GuruFocus balance sheet metrics
// Produces Credit Risk Score, Divergence Detector, Health Status
// ═══════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchCreditDashboard = fetchCreditDashboard;
// ─── CONSTANTS ───
const AI_CREDIT_COMPANIES = [
    { symbol: 'MSFT', name: 'Microsoft' },
    { symbol: 'AMZN', name: 'Amazon' },
    { symbol: 'GOOGL', name: 'Alphabet' },
    { symbol: 'META', name: 'Meta' },
    { symbol: 'ORCL', name: 'Oracle' },
    { symbol: 'NVDA', name: 'NVIDIA' },
    { symbol: 'AVGO', name: 'Broadcom' },
];
// FRED Series IDs for credit spreads
const FRED_IG_OAS = 'BAMLC0A0CM'; // ICE BofA US Corporate Index OAS
const FRED_HY_OAS = 'BAMLH0A0HYM2'; // ICE BofA US High Yield Index OAS
const FRED_CCC_OAS = 'BAMLH0A3HY'; // ICE BofA CCC & Lower US High Yield Index OAS
// Zone classifications per user spec
function classifyIG(spread) {
    if (spread < 70)
        return { zone: 'Extremely Bullish / Expensive', color: '#22c55e' };
    if (spread <= 100)
        return { zone: 'Healthy', color: '#1D9E75' };
    if (spread <= 150)
        return { zone: 'Caution', color: '#f59e0b' };
    if (spread <= 250)
        return { zone: 'Stress', color: '#f97316' };
    return { zone: 'Credit Crisis', color: '#dc2626' };
}
function classifyHY(spread) {
    if (spread < 300)
        return { zone: 'Very Bullish', color: '#22c55e' };
    if (spread <= 450)
        return { zone: 'Normal', color: '#1D9E75' };
    if (spread <= 700)
        return { zone: 'Risk Increasing', color: '#f97316' };
    return { zone: 'Recession / Major Stress', color: '#dc2626' };
}
function classifyCCC(spread) {
    if (spread < 800)
        return { zone: 'Bullish', color: '#22c55e' };
    if (spread <= 1200)
        return { zone: 'Normal', color: '#1D9E75' };
    if (spread <= 1500)
        return { zone: 'Concern', color: '#f97316' };
    return { zone: 'Severe Distress', color: '#dc2626' };
}
// ─── CACHE ───
let creditCache = null;
let creditCacheTime = 0;
const CREDIT_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours (FRED updates daily)
// AI basket score history for computing changes
let aiBasketHistory = [];
// ─── FRED FETCHER ───
async function fetchFredCredit(seriesId, fredKey, limit = 120) {
    if (!fredKey)
        return null;
    try {
        const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${fredKey}&file_type=json&sort_order=desc&limit=${limit}`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!resp.ok) {
            console.warn(`[CREDIT] FRED error for ${seriesId}: ${resp.status}`);
            return null;
        }
        const data = await resp.json();
        const obs = (data.observations || []);
        // Filter out missing values, keep chronological order (reverse since desc)
        return obs
            .filter(o => o.value !== '.')
            .map(o => ({ date: o.date, value: parseFloat(o.value) }))
            .reverse();
    }
    catch (err) {
        console.error(`[CREDIT] FRED fetch failed for ${seriesId}:`, err.message);
        return null;
    }
}
function buildSpreadSeries(data, classifyFn) {
    if (!data || data.length === 0) {
        return {
            current: 0, weekAgo: 0, monthAgo: 0, threeMonthAgo: 0,
            weekChange: 0, monthChange: 0,
            trend: 'STABLE', zone: 'No Data', zoneColor: '#6b7280',
            history: [],
        };
    }
    const current = data[data.length - 1].value;
    const len = data.length;
    // Find values at approximate time offsets (daily data, ~5 trading days/week)
    const weekAgo = len > 5 ? data[len - 6].value : current;
    const monthAgo = len > 22 ? data[len - 23].value : (len > 5 ? data[0].value : current);
    const threeMonthAgo = len > 65 ? data[len - 66].value : (len > 22 ? data[0].value : current);
    const weekChange = current - weekAgo;
    const monthChange = current - monthAgo;
    // Determine trend
    let trend = 'STABLE';
    if (monthChange > 30)
        trend = 'WIDENING_FAST';
    else if (monthChange > 10)
        trend = 'WIDENING';
    else if (monthChange < -10)
        trend = 'TIGHTENING';
    const { zone, color } = classifyFn(current);
    // Keep last 90 days for chart
    const history = data.slice(-90).map(d => ({ date: d.date, value: d.value }));
    return {
        current, weekAgo, monthAgo, threeMonthAgo,
        weekChange, monthChange, trend, zone, zoneColor: color,
        history,
    };
}
// ─── GURUFOCUS AI BASKET ───
async function fetchAICompanyCredit(symbol, gfKey) {
    try {
        const resp = await fetch(`https://api.gurufocus.com/public/user/${gfKey}/stock/${symbol}/summary`, { signal: AbortSignal.timeout(8000) });
        if (!resp.ok)
            return null;
        const data = await resp.json();
        const cd = data?.summary?.company_data;
        if (!cd)
            return null;
        const ic = parseFloat(cd.interest_coverage) || null;
        const d2e = parseFloat(cd.debt2ebitda) || null;
        const deq = parseFloat(cd.debt2equity) || null;
        const zs = parseFloat(cd.zscore) || null;
        const c2d = parseFloat(cd.cash2debt) || null;
        const cr = parseFloat(cd.current_ratio) || null;
        // Compute credit health score (0-100)
        // Weights: Interest Coverage 30%, Debt/EBITDA 25%, Z-Score 20%, Cash/Debt 15%, D/E 10%
        let score = 0;
        let weight = 0;
        if (ic !== null) {
            // IC > 20 = 100, IC 10-20 = 80, IC 5-10 = 60, IC 3-5 = 40, IC < 3 = 20
            const icScore = ic > 20 ? 100 : ic > 10 ? 80 : ic > 5 ? 60 : ic > 3 ? 40 : 20;
            score += icScore * 0.30;
            weight += 0.30;
        }
        if (d2e !== null) {
            // D/EBITDA < 1 = 100, 1-2 = 80, 2-3 = 60, 3-5 = 40, > 5 = 20
            const d2eScore = d2e < 1 ? 100 : d2e < 2 ? 80 : d2e < 3 ? 60 : d2e < 5 ? 40 : 20;
            score += d2eScore * 0.25;
            weight += 0.25;
        }
        if (zs !== null) {
            // Z > 3 = 100 (safe), 1.8-3 = 60 (grey zone), < 1.8 = 20 (distress)
            const zsScore = zs > 3 ? 100 : zs > 1.8 ? 60 : 20;
            score += zsScore * 0.20;
            weight += 0.20;
        }
        if (c2d !== null) {
            // Cash/Debt > 1 = 100, 0.5-1 = 70, 0.25-0.5 = 40, < 0.25 = 20
            const c2dScore = c2d > 1 ? 100 : c2d > 0.5 ? 70 : c2d > 0.25 ? 40 : 20;
            score += c2dScore * 0.15;
            weight += 0.15;
        }
        if (deq !== null) {
            // D/E < 0.5 = 100, 0.5-1 = 75, 1-2 = 50, > 2 = 25
            const deqScore = deq < 0.5 ? 100 : deq < 1 ? 75 : deq < 2 ? 50 : 25;
            score += deqScore * 0.10;
            weight += 0.10;
        }
        // Normalize if not all weights present
        const creditHealthScore = weight > 0 ? Math.round(score / weight) : 50;
        const companyName = AI_CREDIT_COMPANIES.find(c => c.symbol === symbol)?.name || symbol;
        return {
            symbol,
            name: companyName,
            interestCoverage: ic,
            debt2ebitda: d2e,
            debt2equity: deq,
            zscore: zs,
            cash2debt: c2d,
            currentRatio: cr,
            creditHealthScore,
        };
    }
    catch (err) {
        console.warn(`[CREDIT] GF fetch failed for ${symbol}:`, err.message);
        return null;
    }
}
async function fetchAIBasket(gfKey) {
    const results = await Promise.all(AI_CREDIT_COMPANIES.map(c => fetchAICompanyCredit(c.symbol, gfKey)));
    const companies = results.filter(Boolean);
    if (companies.length === 0) {
        return {
            avgScore: 0, weekChange: null, monthChange: null,
            companies: [], weakestLink: null, strongestLink: null,
        };
    }
    const avgScore = Math.round(companies.reduce((sum, c) => sum + c.creditHealthScore, 0) / companies.length);
    // Sort to find weakest/strongest
    const sorted = [...companies].sort((a, b) => a.creditHealthScore - b.creditHealthScore);
    const weakestLink = sorted[0].symbol;
    const strongestLink = sorted[sorted.length - 1].symbol;
    // Track history for change computation
    const today = new Date().toISOString().slice(0, 10);
    const existing = aiBasketHistory.find(h => h.date === today);
    if (!existing) {
        aiBasketHistory.push({ date: today, avgScore });
        // Keep last 90 days
        if (aiBasketHistory.length > 90)
            aiBasketHistory = aiBasketHistory.slice(-90);
    }
    // Compute changes from history
    let weekChange = null;
    let monthChange = null;
    if (aiBasketHistory.length > 1) {
        // Week ago (approximately 7 days back)
        const weekTarget = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        const weekEntry = aiBasketHistory.find(h => h.date <= weekTarget);
        if (weekEntry)
            weekChange = avgScore - weekEntry.avgScore;
        // Month ago
        const monthTarget = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        const monthEntry = aiBasketHistory.find(h => h.date <= monthTarget);
        if (monthEntry)
            monthChange = avgScore - monthEntry.avgScore;
    }
    return { avgScore, weekChange, monthChange, companies, weakestLink, strongestLink };
}
// ─── CREDIT RISK SCORE ───
function computeCreditRiskScore(ig, hy, ccc, aiBasket) {
    // Score 0-100 where 100 = healthy, 0 = crisis
    // Weights: IG 30%, HY 30%, CCC 20%, AI Basket 20%
    // IG: <70 = 100, 70-100 = 85, 100-150 = 60, 150-250 = 35, >250 = 10
    const igScore = ig.current < 70 ? 100 :
        ig.current <= 100 ? 85 :
            ig.current <= 150 ? 60 :
                ig.current <= 250 ? 35 : 10;
    // HY: <300 = 100, 300-450 = 75, 450-700 = 45, >700 = 10
    const hyScore = hy.current < 300 ? 100 :
        hy.current <= 450 ? 75 :
            hy.current <= 700 ? 45 : 10;
    // CCC: <800 = 100, 800-1200 = 70, 1200-1500 = 35, >1500 = 10
    const cccScore = ccc.current < 800 ? 100 :
        ccc.current <= 1200 ? 70 :
            ccc.current <= 1500 ? 35 : 10;
    // AI Basket score is already 0-100
    const aiScore = aiBasket.avgScore;
    const composite = Math.round(igScore * 0.30 + hyScore * 0.30 + cccScore * 0.20 + aiScore * 0.20);
    let label, color;
    if (composite >= 80) {
        label = 'Healthy';
        color = '#1D9E75';
    }
    else if (composite >= 60) {
        label = 'Watch';
        color = '#f59e0b';
    }
    else if (composite >= 40) {
        label = 'Defensive';
        color = '#f97316';
    }
    else {
        label = 'High Risk';
        color = '#dc2626';
    }
    return { score: composite, label, color };
}
// ─── DIVERGENCE DETECTOR ───
function detectDivergence(ig, aiBasket) {
    // Check: IG stable but AI basket deteriorating
    const igStable = Math.abs(ig.monthChange) < 15; // IG hasn't moved much
    if (aiBasket.monthChange !== null && aiBasket.monthChange < -5 && igStable) {
        const severity = aiBasket.monthChange < -15 ? 'CRITICAL' :
            aiBasket.monthChange < -10 ? 'WARNING' : 'WATCH';
        return {
            detected: true,
            message: `AI credit health is weakening (${aiBasket.monthChange > 0 ? '+' : ''}${aiBasket.monthChange} pts over past month) while the broader IG market remains stable (${ig.monthChange > 0 ? '+' : ''}${ig.monthChange.toFixed(0)} bp). Investors may be demanding higher compensation for AI-related risk before it shows in the broader credit market.`,
            severity,
        };
    }
    // Check: broad credit stress (everything widening)
    if (ig.monthChange > 20 && ig.trend === 'WIDENING_FAST') {
        return {
            detected: true,
            message: `Broad credit stress: IG spreads have widened ${ig.monthChange.toFixed(0)} bp in the past month. High yield and CCC likely under more pressure. This is a systemic risk signal.`,
            severity: 'CRITICAL',
        };
    }
    return { detected: false, message: 'No significant divergence detected.', severity: 'NONE' };
}
// ─── HEALTH STATUS ───
function computeHealthStatus(ig, hy, ccc, riskScore) {
    // Credit Crisis: IG > 250 OR HY > 700 OR CCC > 1500 OR riskScore < 30
    if (ig.current > 250 || hy.current > 700 || ccc.current > 1500 || riskScore < 30) {
        return { status: 'Credit Crisis', emoji: '🔴' };
    }
    // Credit Deteriorating: IG > 150 OR HY > 450 OR CCC > 1200 OR riskScore < 50
    if (ig.current > 150 || hy.current > 450 || ccc.current > 1200 || riskScore < 50) {
        return { status: 'Credit Deteriorating', emoji: '🟠' };
    }
    // Early Warning: spreads widening OR riskScore 50-70
    const anyWidening = ig.trend === 'WIDENING' || ig.trend === 'WIDENING_FAST' ||
        hy.trend === 'WIDENING' || hy.trend === 'WIDENING_FAST';
    if (anyWidening || riskScore < 70) {
        return { status: 'Early Warning', emoji: '🟡' };
    }
    return { status: 'Healthy', emoji: '🟢' };
}
// ─── SUMMARY GENERATOR ───
function generateSummary(ig, hy, ccc, aiBasket, divergence, healthStatus) {
    const parts = [];
    // IG/HY narrative
    parts.push(`Investment-grade credit ${ig.current < 100 ? 'remains healthy' : ig.current < 150 ? 'is showing caution' : 'is under stress'} at ${ig.current.toFixed(0)} bp`
        + (ig.monthChange !== 0 ? ` (${ig.monthChange > 0 ? '+' : ''}${ig.monthChange.toFixed(0)} bp vs month ago)` : '')
        + `, and high-yield spreads ${hy.current < 450 ? 'remain manageable' : 'are elevated'} at ${hy.current.toFixed(0)} bp.`);
    // CCC
    if (ccc.current > 1200) {
        parts.push(`CCC-rated debt is flashing concern at ${ccc.current.toFixed(0)} bp — the weakest credits are feeling pressure.`);
    }
    else if (ccc.current > 800) {
        parts.push(`CCC spreads at ${ccc.current.toFixed(0)} bp remain in normal territory.`);
    }
    // AI basket
    if (aiBasket.companies.length > 0) {
        const weakest = aiBasket.companies.reduce((a, b) => a.creditHealthScore < b.creditHealthScore ? a : b);
        parts.push(`The AI credit basket scores ${aiBasket.avgScore}/100 on balance sheet health` +
            (aiBasket.weekChange !== null ? ` (${aiBasket.weekChange > 0 ? '+' : ''}${aiBasket.weekChange} week-over-week)` : '') +
            `. ${weakest.symbol} is the weakest link at ${weakest.creditHealthScore}/100.`);
    }
    // Divergence
    if (divergence.detected) {
        parts.push(divergence.message);
    }
    else {
        parts.push(`No systemic credit stress is evident — credit conditions are ${healthStatus === 'Healthy' ? 'supportive of risk assets' : 'worth monitoring'}.`);
    }
    return parts.join(' ');
}
// ─── MAIN EXPORT ───
async function fetchCreditDashboard(fredKey, gfKey) {
    // Check cache
    if (creditCache && Date.now() - creditCacheTime < CREDIT_CACHE_TTL) {
        return creditCache;
    }
    console.log('[CREDIT] Fetching credit dashboard data...');
    try {
        // Fetch FRED series and GF data in parallel
        const [igRaw, hyRaw, cccRaw, aiBasket] = await Promise.all([
            fetchFredCredit(FRED_IG_OAS, fredKey),
            fetchFredCredit(FRED_HY_OAS, fredKey),
            fetchFredCredit(FRED_CCC_OAS, fredKey),
            fetchAIBasket(gfKey),
        ]);
        if (!igRaw && !hyRaw) {
            console.warn('[CREDIT] No FRED data available — FRED key may be missing');
            return null;
        }
        // Build spread series
        const igOAS = buildSpreadSeries(igRaw || [], classifyIG);
        const hyOAS = buildSpreadSeries(hyRaw || [], classifyHY);
        const cccOAS = buildSpreadSeries(cccRaw || [], classifyCCC);
        // Credit Risk Score
        const { score: creditRiskScore, label: creditRiskLabel, color: creditRiskColor } = computeCreditRiskScore(igOAS, hyOAS, cccOAS, aiBasket);
        // Divergence
        const divergence = detectDivergence(igOAS, aiBasket);
        // Health status
        const { status: healthStatus, emoji: healthEmoji } = computeHealthStatus(igOAS, hyOAS, cccOAS, creditRiskScore);
        // Summary
        const summary = generateSummary(igOAS, hyOAS, cccOAS, aiBasket, divergence, healthStatus);
        const result = {
            igOAS, hyOAS, cccOAS, aiBasket,
            divergence, creditRiskScore, creditRiskLabel, creditRiskColor,
            healthStatus, healthEmoji, summary,
            lastUpdated: new Date().toISOString(),
        };
        // Cache
        creditCache = result;
        creditCacheTime = Date.now();
        console.log(`[CREDIT] Dashboard ready — IG: ${igOAS.current.toFixed(0)}bp, HY: ${hyOAS.current.toFixed(0)}bp, CCC: ${cccOAS.current.toFixed(0)}bp, AI Basket: ${aiBasket.avgScore}/100, Risk Score: ${creditRiskScore}, Status: ${healthStatus}`);
        return result;
    }
    catch (err) {
        console.error('[CREDIT] Dashboard build failed:', err.message);
        return null;
    }
}
//# sourceMappingURL=credit-analysis.js.map