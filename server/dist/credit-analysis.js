"use strict";
// ═══════════════════════════════════════════════════════════════════
// CREDIT MARKET ANALYSIS MODULE — v16.5.0
// Fetches credit spread data from FRED (IG, HY, CCC OAS)
// Computes Credit Bellwether Basket from GuruFocus balance sheet metrics
//   across 4 sectors: Financials, Cyclicals, Consumer, AI/Tech
// Produces Credit Risk Score, Multi-Divergence Detector, Health Status
// Persists daily snapshots to SQLite for trend detection
// ═══════════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCreditTables = initCreditTables;
exports.getCreditForCommandCenter = getCreditForCommandCenter;
exports.fetchCreditDashboard = fetchCreditDashboard;
// ─── CONSTANTS ───
// Credit Bellwether Basket — 4 sectors, ~14 companies
const BELLWETHER_COMPANIES = [
    // Financials — they ARE the credit market
    { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Financials' },
    { symbol: 'BAC', name: 'Bank of America', sector: 'Financials' },
    { symbol: 'GS', name: 'Goldman Sachs', sector: 'Financials' },
    { symbol: 'C', name: 'Citigroup', sector: 'Financials' },
    // Cyclicals — capex & leverage canaries
    { symbol: 'CAT', name: 'Caterpillar', sector: 'Cyclicals' },
    { symbol: 'DE', name: 'Deere & Co', sector: 'Cyclicals' },
    { symbol: 'F', name: 'Ford Motor', sector: 'Cyclicals' },
    { symbol: 'DAL', name: 'Delta Air Lines', sector: 'Cyclicals' },
    // Consumer — household credit stress
    { symbol: 'HD', name: 'Home Depot', sector: 'Consumer' },
    { symbol: 'TGT', name: 'Target', sector: 'Consumer' },
    // AI/Tech — canary tier (where cracks may show first)
    { symbol: 'MSFT', name: 'Microsoft', sector: 'AI/Tech' },
    { symbol: 'NVDA', name: 'NVIDIA', sector: 'AI/Tech' },
    { symbol: 'AMZN', name: 'Amazon', sector: 'AI/Tech' },
    { symbol: 'META', name: 'Meta', sector: 'AI/Tech' },
];
// FRED Series IDs for credit spreads
const FRED_IG_OAS = 'BAMLC0A0CM'; // ICE BofA US Corporate Index OAS
const FRED_HY_OAS = 'BAMLH0A0HYM2'; // ICE BofA US High Yield Index OAS
const FRED_CCC_OAS = 'BAMLH0A3HY'; // ICE BofA CCC & Lower US High Yield Index OAS
// Zone classifications
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
// Basket score history for computing changes (in-memory fallback)
let basketHistory = [];
// ─── SQLITE PERSISTENCE ───
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const DATA_DIR = process.env.DATA_DIR || path_1.default.join(process.cwd(), 'data');
if (!fs_1.default.existsSync(DATA_DIR))
    fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
const CREDIT_DB_PATH = path_1.default.join(DATA_DIR, 'druck-history.db');
let creditDb = null;
function getCreditDb() {
    if (!creditDb) {
        creditDb = new better_sqlite3_1.default(CREDIT_DB_PATH);
        creditDb.pragma('journal_mode = WAL');
    }
    return creditDb;
}
function initCreditTables() {
    const db = getCreditDb();
    db.exec(`
    CREATE TABLE IF NOT EXISTS credit_snapshots (
      date TEXT NOT NULL,
      ig_oas REAL,
      hy_oas REAL,
      ccc_oas REAL,
      ig_trend TEXT,
      hy_trend TEXT,
      ccc_trend TEXT,
      basket_avg_score REAL,
      financials_avg REAL,
      cyclicals_avg REAL,
      consumer_avg REAL,
      aitech_avg REAL,
      risk_score REAL,
      risk_label TEXT,
      health_status TEXT,
      divergence_detected INTEGER DEFAULT 0,
      divergence_worst TEXT,
      summary TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (date)
    )
  `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_credit_date ON credit_snapshots(date)`);
    console.log('[CREDIT] SQLite credit_snapshots table ready');
}
function persistCreditSnapshot(data) {
    let db;
    try {
        db = getCreditDb();
    }
    catch {
        return;
    }
    const today = new Date().toISOString().slice(0, 10);
    // Compute sector group averages
    const sectorAvgs = {};
    for (const sg of data.bellwetherBasket.sectorGroups) {
        sectorAvgs[sg.name] = sg.avgScore;
    }
    try {
        db.prepare(`
      INSERT OR REPLACE INTO credit_snapshots
        (date, ig_oas, hy_oas, ccc_oas, ig_trend, hy_trend, ccc_trend,
         basket_avg_score, financials_avg, cyclicals_avg, consumer_avg, aitech_avg,
         risk_score, risk_label, health_status,
         divergence_detected, divergence_worst, summary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(today, data.igOAS.current, data.hyOAS.current, data.cccOAS.current, data.igOAS.trend, data.hyOAS.trend, data.cccOAS.trend, data.bellwetherBasket.avgScore, sectorAvgs['Financials'] ?? null, sectorAvgs['Cyclicals'] ?? null, sectorAvgs['Consumer'] ?? null, sectorAvgs['AI/Tech'] ?? null, data.creditRiskScore, data.creditRiskLabel, data.healthStatus, data.divergence.detected ? 1 : 0, data.divergence.worstSeverity, data.summary);
        console.log(`[CREDIT] Snapshot persisted for ${today}`);
    }
    catch (err) {
        console.warn('[CREDIT] Snapshot persist failed:', err.message);
    }
}
function getHistoricalBasketScores() {
    try {
        const db = getCreditDb();
        const rows = db.prepare(`SELECT date, basket_avg_score as avgScore FROM credit_snapshots
       WHERE basket_avg_score IS NOT NULL
       ORDER BY date DESC LIMIT 90`).all();
        return rows.reverse();
    }
    catch {
        return basketHistory;
    }
}
function getHistoricalSpreads(days = 30) {
    try {
        const db = getCreditDb();
        return db.prepare(`SELECT date, ig_oas as ig, hy_oas as hy, ccc_oas as ccc FROM credit_snapshots
       WHERE ig_oas IS NOT NULL
       ORDER BY date DESC LIMIT ?`).all(days);
    }
    catch {
        return [];
    }
}
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
// ─── GURUFOCUS BELLWETHER BASKET ───
async function fetchCompanyCredit(symbol, sectorName, gfKey) {
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
            const icScore = ic > 20 ? 100 : ic > 10 ? 80 : ic > 5 ? 60 : ic > 3 ? 40 : 20;
            score += icScore * 0.30;
            weight += 0.30;
        }
        if (d2e !== null) {
            const d2eScore = d2e < 1 ? 100 : d2e < 2 ? 80 : d2e < 3 ? 60 : d2e < 5 ? 40 : 20;
            score += d2eScore * 0.25;
            weight += 0.25;
        }
        if (zs !== null) {
            const zsScore = zs > 3 ? 100 : zs > 1.8 ? 60 : 20;
            score += zsScore * 0.20;
            weight += 0.20;
        }
        if (c2d !== null) {
            const c2dScore = c2d > 1 ? 100 : c2d > 0.5 ? 70 : c2d > 0.25 ? 40 : 20;
            score += c2dScore * 0.15;
            weight += 0.15;
        }
        if (deq !== null) {
            const deqScore = deq < 0.5 ? 100 : deq < 1 ? 75 : deq < 2 ? 50 : 25;
            score += deqScore * 0.10;
            weight += 0.10;
        }
        const creditHealthScore = weight > 0 ? Math.round(score / weight) : 50;
        const companyName = BELLWETHER_COMPANIES.find(c => c.symbol === symbol)?.name || symbol;
        return {
            symbol,
            name: companyName,
            sector: sectorName,
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
async function fetchBellwetherBasket(gfKey) {
    const results = await Promise.all(BELLWETHER_COMPANIES.map(c => fetchCompanyCredit(c.symbol, c.sector, gfKey)));
    const companies = results.filter(Boolean);
    if (companies.length === 0) {
        return {
            avgScore: 0, weekChange: null, monthChange: null,
            sectorGroups: [], companies: [],
            weakestLink: null, strongestLink: null, weakestSector: null,
        };
    }
    // Build sector groups
    const sectorMap = {};
    for (const c of companies) {
        if (!sectorMap[c.sector])
            sectorMap[c.sector] = [];
        sectorMap[c.sector].push(c);
    }
    const sectorGroups = [];
    const sectorOrder = ['Financials', 'Cyclicals', 'Consumer', 'AI/Tech'];
    for (const sectorName of sectorOrder) {
        const sectorCompanies = sectorMap[sectorName];
        if (!sectorCompanies || sectorCompanies.length === 0)
            continue;
        const avg = Math.round(sectorCompanies.reduce((sum, c) => sum + c.creditHealthScore, 0) / sectorCompanies.length);
        const sorted = [...sectorCompanies].sort((a, b) => a.creditHealthScore - b.creditHealthScore);
        sectorGroups.push({
            name: sectorName,
            avgScore: avg,
            companies: sectorCompanies,
            weakestLink: sorted[0].symbol,
        });
    }
    // Overall average
    const avgScore = Math.round(companies.reduce((sum, c) => sum + c.creditHealthScore, 0) / companies.length);
    // Overall weakest/strongest
    const sorted = [...companies].sort((a, b) => a.creditHealthScore - b.creditHealthScore);
    const weakestLink = sorted[0].symbol;
    const strongestLink = sorted[sorted.length - 1].symbol;
    // Weakest sector
    const weakestSector = sectorGroups.length > 0
        ? [...sectorGroups].sort((a, b) => a.avgScore - b.avgScore)[0].name
        : null;
    // Track history for change computation
    const today = new Date().toISOString().slice(0, 10);
    const existing = basketHistory.find(h => h.date === today);
    if (!existing) {
        basketHistory.push({ date: today, avgScore });
        if (basketHistory.length > 90)
            basketHistory = basketHistory.slice(-90);
    }
    // Compute changes — prefer SQLite history, fall back to in-memory
    const history = getHistoricalBasketScores();
    let weekChange = null;
    let monthChange = null;
    if (history.length > 1) {
        const weekTarget = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        const weekEntry = history.find(h => h.date <= weekTarget);
        if (weekEntry)
            weekChange = avgScore - weekEntry.avgScore;
        const monthTarget = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        const monthEntry = history.find(h => h.date <= monthTarget);
        if (monthEntry)
            monthChange = avgScore - monthEntry.avgScore;
    }
    return {
        avgScore, weekChange, monthChange,
        sectorGroups, companies,
        weakestLink, strongestLink, weakestSector,
    };
}
// ─── CREDIT RISK SCORE ───
function computeCreditRiskScore(ig, hy, ccc, basket) {
    // Score 0-100 where 100 = healthy, 0 = crisis
    // Weights: IG 30%, HY 30%, CCC 20%, Bellwether Basket 20%
    const igScore = ig.current < 70 ? 100 :
        ig.current <= 100 ? 85 :
            ig.current <= 150 ? 60 :
                ig.current <= 250 ? 35 : 10;
    const hyScore = hy.current < 300 ? 100 :
        hy.current <= 450 ? 75 :
            hy.current <= 700 ? 45 : 10;
    const cccScore = ccc.current < 800 ? 100 :
        ccc.current <= 1200 ? 70 :
            ccc.current <= 1500 ? 35 : 10;
    const basketScore = basket.avgScore;
    const composite = Math.round(igScore * 0.30 + hyScore * 0.30 + cccScore * 0.20 + basketScore * 0.20);
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
// ─── MULTI-DIVERGENCE DETECTOR ───
function detectDivergence(ig, hy, ccc, basket) {
    const alerts = [];
    // CHECK 1: HY/IG Spread Ratio — quality flight
    // If HY widens significantly faster than IG, money is fleeing lower-quality credit
    if (ig.current > 0 && hy.current > 0) {
        const currentRatio = hy.current / ig.current;
        const monthAgoRatio = ig.monthAgo > 0 && hy.monthAgo > 0 ? hy.monthAgo / ig.monthAgo : currentRatio;
        const ratioChange = currentRatio - monthAgoRatio;
        if (ratioChange > 0.8) {
            alerts.push({
                type: 'HY_IG_RATIO',
                message: `High-yield spreads are widening faster than investment-grade (HY/IG ratio up ${ratioChange.toFixed(1)} over past month to ${currentRatio.toFixed(1)}x). Money is fleeing lower-quality credit — a classic early warning of credit stress.`,
                severity: ratioChange > 1.5 ? 'CRITICAL' : 'WARNING',
            });
        }
        else if (ratioChange > 0.4) {
            alerts.push({
                type: 'HY_IG_RATIO',
                message: `HY/IG spread ratio has crept up ${ratioChange.toFixed(1)} over the past month (now ${currentRatio.toFixed(1)}x). Lower-quality credit is starting to underperform — worth monitoring.`,
                severity: 'WATCH',
            });
        }
    }
    // CHECK 2: CCC/HY Spread Ratio — junk stress
    // If CCC widens relative to HY, the weakest credits are cracking
    if (hy.current > 0 && ccc.current > 0) {
        const currentRatio = ccc.current / hy.current;
        const monthAgoRatio = hy.monthAgo > 0 && ccc.monthAgo > 0 ? ccc.monthAgo / hy.monthAgo : currentRatio;
        const ratioChange = currentRatio - monthAgoRatio;
        if (ratioChange > 0.5) {
            alerts.push({
                type: 'CCC_HY_RATIO',
                message: `CCC-rated debt is weakening faster than broad high-yield (CCC/HY ratio up ${ratioChange.toFixed(1)} to ${currentRatio.toFixed(1)}x). The weakest credits are under disproportionate pressure — distress is building from the bottom up.`,
                severity: ratioChange > 1.0 ? 'CRITICAL' : 'WARNING',
            });
        }
    }
    // CHECK 3: Sector Group Divergence — where is the crack forming?
    // If one sector group deteriorates while overall basket holds
    if (basket.sectorGroups.length >= 3 && basket.avgScore > 50) {
        for (const sg of basket.sectorGroups) {
            const delta = basket.avgScore - sg.avgScore;
            if (delta > 20) {
                alerts.push({
                    type: 'SECTOR_DIVERGENCE',
                    message: `${sg.name} credit health (${sg.avgScore}/100) is lagging the overall basket (${basket.avgScore}/100) by ${delta} points. ${sg.weakestLink} is the weakest link at the sector level. This sector may be where credit stress surfaces first.`,
                    severity: delta > 35 ? 'CRITICAL' : delta > 25 ? 'WARNING' : 'WATCH',
                });
            }
        }
    }
    // CHECK 4: Broad Credit Stress — everything widening
    if (ig.monthChange > 20 && ig.trend === 'WIDENING_FAST') {
        alerts.push({
            type: 'BROAD_STRESS',
            message: `Broad credit stress: IG spreads have widened ${ig.monthChange.toFixed(0)} bp in the past month. High yield and CCC are likely under more pressure. This is a systemic risk signal.`,
            severity: 'CRITICAL',
        });
    }
    else if (ig.trend === 'WIDENING' && hy.trend === 'WIDENING') {
        alerts.push({
            type: 'BROAD_WIDENING',
            message: `Both IG and HY spreads are widening. IG is up ${ig.monthChange.toFixed(0)} bp and HY up ${hy.monthChange.toFixed(0)} bp over the past month. Credit conditions are tightening across the quality spectrum.`,
            severity: ig.monthChange > 15 || hy.monthChange > 30 ? 'WARNING' : 'WATCH',
        });
    }
    // Determine worst severity
    let worstSeverity = 'NONE';
    const severityOrder = ['WATCH', 'WARNING', 'CRITICAL'];
    for (const a of alerts) {
        const idx = severityOrder.indexOf(a.severity);
        const currentIdx = worstSeverity === 'NONE' ? -1 : severityOrder.indexOf(worstSeverity);
        if (idx > currentIdx)
            worstSeverity = a.severity;
    }
    return {
        detected: alerts.length > 0,
        alerts,
        worstSeverity,
    };
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
function generateSummary(ig, hy, ccc, basket, divergence, healthStatus) {
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
    // Bellwether basket — sector-aware summary
    if (basket.companies.length > 0) {
        const weakest = basket.companies.reduce((a, b) => a.creditHealthScore < b.creditHealthScore ? a : b);
        parts.push(`The credit bellwether basket scores ${basket.avgScore}/100 on balance sheet health` +
            (basket.weekChange !== null ? ` (${basket.weekChange > 0 ? '+' : ''}${basket.weekChange} week-over-week)` : '') +
            `.`);
        // Sector callouts
        if (basket.weakestSector) {
            const weakSg = basket.sectorGroups.find(sg => sg.name === basket.weakestSector);
            if (weakSg && weakSg.avgScore < basket.avgScore - 10) {
                parts.push(`${weakSg.name} is the weakest sector at ${weakSg.avgScore}/100 — ${weakest.symbol} is the weakest link overall at ${weakest.creditHealthScore}/100.`);
            }
            else {
                parts.push(`${weakest.symbol} is the weakest individual name at ${weakest.creditHealthScore}/100.`);
            }
        }
    }
    // Divergence
    if (divergence.detected) {
        // Just mention the worst alert
        const worst = divergence.alerts.reduce((a, b) => {
            const order = { 'WATCH': 0, 'WARNING': 1, 'CRITICAL': 2 };
            return (order[b.severity] || 0) > (order[a.severity] || 0) ? b : a;
        });
        parts.push(worst.message);
    }
    else {
        parts.push(`No systemic credit stress is evident — credit conditions are ${healthStatus === 'Healthy' ? 'supportive of risk assets' : 'worth monitoring'}.`);
    }
    return parts.join(' ');
}
function getCreditForCommandCenter() {
    if (!creditCache)
        return null;
    const d = creditCache;
    const topAlert = d.divergence.detected && d.divergence.alerts.length > 0
        ? d.divergence.alerts.reduce((a, b) => {
            const order = { 'WATCH': 0, 'WARNING': 1, 'CRITICAL': 2 };
            return (order[b.severity] || 0) > (order[a.severity] || 0) ? b : a;
        }).message
        : null;
    // Build one-liner
    let oneLiner;
    if (d.healthStatus === 'Healthy') {
        oneLiner = `Credit healthy — IG ${d.igOAS.current.toFixed(0)}bp, HY ${d.hyOAS.current.toFixed(0)}bp, Basket ${d.bellwetherBasket.avgScore}/100`;
    }
    else if (d.healthStatus === 'Credit Crisis') {
        oneLiner = `CREDIT CRISIS — IG ${d.igOAS.current.toFixed(0)}bp, HY ${d.hyOAS.current.toFixed(0)}bp — immediate risk-off`;
    }
    else {
        oneLiner = `Credit ${d.creditRiskLabel.toLowerCase()} — IG ${d.igOAS.current.toFixed(0)}bp (${d.igOAS.trend.toLowerCase()}), HY ${d.hyOAS.current.toFixed(0)}bp`;
    }
    return {
        healthStatus: d.healthStatus,
        healthEmoji: d.healthEmoji,
        creditRiskScore: d.creditRiskScore,
        creditRiskLabel: d.creditRiskLabel,
        creditRiskColor: d.creditRiskColor,
        igCurrent: d.igOAS.current,
        igTrend: d.igOAS.trend,
        hyCurrent: d.hyOAS.current,
        hyTrend: d.hyOAS.trend,
        cccCurrent: d.cccOAS.current,
        cccTrend: d.cccOAS.trend,
        basketAvg: d.bellwetherBasket.avgScore,
        weakestSector: d.bellwetherBasket.weakestSector,
        divergenceDetected: d.divergence.detected,
        divergenceWorstSeverity: d.divergence.worstSeverity,
        divergenceTopMessage: topAlert,
        oneLiner,
    };
}
// ─── MAIN EXPORT ───
async function fetchCreditDashboard(fredKey, gfKey) {
    // Check cache
    if (creditCache && Date.now() - creditCacheTime < CREDIT_CACHE_TTL) {
        return creditCache;
    }
    console.log('[CREDIT] Fetching credit dashboard data...');
    try {
        // Fetch FRED series and bellwether data in parallel
        const [igRaw, hyRaw, cccRaw, bellwetherBasket] = await Promise.all([
            fetchFredCredit(FRED_IG_OAS, fredKey),
            fetchFredCredit(FRED_HY_OAS, fredKey),
            fetchFredCredit(FRED_CCC_OAS, fredKey),
            fetchBellwetherBasket(gfKey),
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
        const { score: creditRiskScore, label: creditRiskLabel, color: creditRiskColor } = computeCreditRiskScore(igOAS, hyOAS, cccOAS, bellwetherBasket);
        // Multi-Divergence Detector
        const divergence = detectDivergence(igOAS, hyOAS, cccOAS, bellwetherBasket);
        // Health status
        const { status: healthStatus, emoji: healthEmoji } = computeHealthStatus(igOAS, hyOAS, cccOAS, creditRiskScore);
        // Summary
        const summary = generateSummary(igOAS, hyOAS, cccOAS, bellwetherBasket, divergence, healthStatus);
        const result = {
            igOAS, hyOAS, cccOAS,
            bellwetherBasket,
            divergence, creditRiskScore, creditRiskLabel, creditRiskColor,
            healthStatus, healthEmoji, summary,
            lastUpdated: new Date().toISOString(),
            // Backward compat for any old frontend code that references aiBasket
            aiBasket: {
                avgScore: bellwetherBasket.avgScore,
                weekChange: bellwetherBasket.weekChange,
                monthChange: bellwetherBasket.monthChange,
                companies: bellwetherBasket.companies,
                weakestLink: bellwetherBasket.weakestLink,
                strongestLink: bellwetherBasket.strongestLink,
            },
        };
        // Cache
        creditCache = result;
        creditCacheTime = Date.now();
        // Persist to SQLite
        persistCreditSnapshot(result);
        const sectorScores = bellwetherBasket.sectorGroups.map(sg => `${sg.name}: ${sg.avgScore}`).join(', ');
        console.log(`[CREDIT] Dashboard ready — IG: ${igOAS.current.toFixed(0)}bp, HY: ${hyOAS.current.toFixed(0)}bp, CCC: ${cccOAS.current.toFixed(0)}bp, Basket: ${bellwetherBasket.avgScore}/100 [${sectorScores}], Risk Score: ${creditRiskScore}, Status: ${healthStatus}, Divergences: ${divergence.alerts.length}`);
        return result;
    }
    catch (err) {
        console.error('[CREDIT] Dashboard build failed:', err.message);
        return null;
    }
}
//# sourceMappingURL=credit-analysis.js.map