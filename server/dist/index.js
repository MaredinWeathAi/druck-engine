"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const morning_lens_1 = __importDefault(require("./morning-lens"));
const market_intel_1 = __importDefault(require("./market-intel"));
const ta_acceleration_1 = __importDefault(require("./ta-acceleration"));
const inflection_engine_1 = __importDefault(require("./inflection-engine"));
const fundamental_data_1 = __importDefault(require("./fundamental-data"));
const industry_drivers_1 = __importDefault(require("./industry-drivers"));
const alert_system_1 = __importDefault(require("./alert-system"));
const geo_events_1 = __importStar(require("./geo-events"));
const burry_substack_1 = __importStar(require("./burry-substack"));
const history_store_1 = require("./history-store");
// mtrp-client bridge removed — Market Intel lives entirely in Druck Engine
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '3001', 10);
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
// ─── API KEY MANAGEMENT ───
// API key loaded after initDatabase() — see server startup section
let anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';
const FRED_API_KEY = process.env.FRED_API_KEY || '';
const GURUFOCUS_API_KEY = process.env.GURUFOCUS_API_KEY || '026d8ee9d10c778c6656d672b5ff1e71:544e1fff1953fece457d6152f3239e74';
const cache = new Map();
function getCached(key, maxAgeMs) {
    const entry = cache.get(key);
    if (!entry)
        return null;
    if (Date.now() - entry.timestamp > maxAgeMs) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}
function setCached(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}
// ─── SIMULATED DATA ENGINE (FALLBACK) ───
function randomWalk(start, n, drift = 0, vol = 0.01) {
    const vals = [start];
    const seed = new Date().toISOString().split('T')[0];
    let s = 0;
    for (let i = 0; i < seed.length; i++)
        s += seed.charCodeAt(i);
    const rng = () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };
    for (let i = 1; i < n; i++) {
        vals.push(vals[i - 1] * (1 + drift + (rng() - 0.5) * vol * 2));
    }
    return vals;
}
function dateRange(startStr, n, freqDays = 7) {
    const dates = [];
    const d = new Date(startStr);
    for (let i = 0; i < n; i++) {
        dates.push(d.toISOString().split('T')[0]);
        d.setDate(d.getDate() + freqDays);
    }
    return dates;
}
function roc(arr, period) {
    return arr.map((v, i) => (i < period ? 0 : (v - arr[i - period]) / arr[i - period]));
}
async function fetchFredSeries(seriesId, limit = 100) {
    if (!FRED_API_KEY)
        return null;
    try {
        const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=${limit}`;
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`FRED API error for ${seriesId}: ${response.status}`);
            return null;
        }
        const data = await response.json();
        const observations = data.observations || [];
        // Reverse to get chronological order
        observations.reverse();
        // Filter out missing observations (value === '.') keeping dates aligned
        const paired = observations
            .map(o => ({ date: o.date, value: o.value === '.' ? null : parseFloat(o.value) }))
            .filter(p => p.value !== null);
        return {
            dates: paired.map(p => p.date),
            values: paired.map(p => p.value),
        };
    }
    catch (err) {
        console.error(`Error fetching FRED series ${seriesId}:`, err);
        return null;
    }
}
async function fetchAllFredData() {
    if (!FRED_API_KEY)
        return null;
    try {
        const [walcl, wtregen, rrpontsyd, m2sl, pcepilfe, gdp, tcu, dgs2, dgs10, bamlh0a0hym2, unrate, cpiaucsl, napm] = await Promise.all([
            fetchFredSeries('WALCL', 1100), // weekly, ~21 years
            fetchFredSeries('WTREGEN', 1100), // weekly
            fetchFredSeries('RRPONTSYD', 1100), // daily (cap at ~3 years for RRP, newer series)
            fetchFredSeries('M2SL', 360), // monthly, ~30 years
            fetchFredSeries('PCEPILFE', 360), // monthly, ~30 years
            fetchFredSeries('A191RL1Q225SBEA', 120), // quarterly, ~30 years
            fetchFredSeries('TCU', 360), // monthly, ~30 years
            fetchFredSeries('DGS2', 7800), // daily, ~30 years
            fetchFredSeries('DGS10', 7800), // daily, ~30 years
            fetchFredSeries('BAMLH0A0HYM2', 7800), // daily, ~30 years
            fetchFredSeries('UNRATE', 360), // monthly, ~30 years
            fetchFredSeries('CPIAUCSL', 360), // monthly, ~30 years
            fetchFredSeries('NAPM', 360), // monthly, ~30 years
        ]);
        // Check if all key series were fetched
        if (!walcl || !m2sl || !dgs2 || !dgs10) {
            console.warn('Missing critical FRED series');
            return null;
        }
        // Align all series to a common date range (use most frequent series as base)
        const baseDates = walcl.dates; // Weekly data
        const result = {
            walcl: walcl.values,
            wtregen: wtregen?.values || [],
            rrpontsyd: rrpontsyd?.values || [],
            m2sl: m2sl.values,
            pcepilfe: pcepilfe?.values || [],
            a191rl1q225sbea: gdp?.values || [],
            tcu: tcu?.values || [],
            dgs2: dgs2.values,
            dgs10: dgs10.values,
            bamlh0a0hym2: bamlh0a0hym2?.values || [],
            unrate: unrate?.values || [],
            cpiaucsl: cpiaucsl?.values || [],
            napm: napm?.values || [],
            dates: baseDates,
            raw: {
                pcepilfe: pcepilfe || { dates: [], values: [] },
                a191rl1q225sbea: gdp || { dates: [], values: [] },
                tcu: tcu || { dates: [], values: [] },
                dgs2: dgs2 ? { dates: dgs2.dates, values: dgs2.values } : { dates: [], values: [] },
                dgs10: dgs10 ? { dates: dgs10.dates, values: dgs10.values } : { dates: [], values: [] },
                unrate: unrate || { dates: [], values: [] },
                cpiaucsl: cpiaucsl || { dates: [], values: [] },
                napm: napm || { dates: [], values: [] },
                m2sl: m2sl ? { dates: m2sl.dates, values: m2sl.values } : { dates: [], values: [] },
                bamlh0a0hym2: bamlh0a0hym2 || { dates: [], values: [] },
            },
        };
        return result;
    }
    catch (err) {
        console.error('Error fetching FRED data:', err);
        return null;
    }
}
async function fetchGuruTrades(ticker) {
    if (!GURUFOCUS_API_KEY)
        return null;
    try {
        const url = `https://api.gurufocus.com/public/user/${GURUFOCUS_API_KEY}/stock/${ticker}/guru_trades`;
        const response = await fetch(url);
        if (!response.ok)
            return null;
        const data = await response.json();
        const trades = data.trades || [];
        let buy = 0, sell = 0;
        trades.forEach(t => {
            if (t.action === 'BUY' || t.action === 'ADD')
                buy++;
            else if (t.action === 'SELL' || t.action === 'REDUCE')
                sell++;
        });
        return { buy, sell };
    }
    catch (err) {
        console.error(`Error fetching guru trades for ${ticker}:`, err);
        return null;
    }
}
// ─── DATA GENERATION ───
const N = 1040; // ~20 years of weekly data points
const FRED_CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours
let fredDataFreshness = {};
let dataSource = 'simulated';
let lastFredRefresh = 0;
let dates = dateRange('2006-05-01', N, 7); // ~20 years of weekly dates for fallback
let bs = randomWalk(7.4, N, -0.0003, 0.003);
let tga = randomWalk(0.75, N, 0.0001, 0.015);
let rrp = randomWalk(0.85, N, -0.005, 0.01).map(v => Math.max(v, 0.04));
let nl = bs.map((b, i) => b - tga[i] - rrp[i]);
let spx = randomWalk(5450, N, 0.002, 0.012);
let m2 = randomWalk(20.8, N, 0.0004, 0.002);
let vel4w = roc(nl, 4);
let vel13w = roc(nl, 13);
let breadthArr = randomWalk(58, N, 0.0005, 0.03).map(v => Math.max(15, Math.min(90, v)));
let argSovYield = randomWalk(14.5, N, -0.003, 0.015);
let us10y = randomWalk(4.3, N, -0.0005, 0.006);
let argSpread = argSovYield.map((a, i) => a - us10y[i]);
let tecoPrice = randomWalk(12.5, N, 0.004, 0.02);
let ggalPrice = randomWalk(68, N, 0.005, 0.018);
let crude = randomWalk(72, N, 0.001, 0.02);
let copper = randomWalk(4.2, N, 0.0015, 0.015);
let gold = randomWalk(2650, N, 0.002, 0.008);
let hySpreads = randomWalk(3.8, N, -0.001, 0.02);
// Macro state
let latV4 = vel4w[N - 1];
let latV13 = vel13w[N - 1];
let breadthLat = breadthArr[N - 1];
let pce = 2.8;
let gdp = 2.1;
let capUtil = 77.8;
let unemployment = 4.1;
let cpiYoy = 2.9;
let ismMfg = 50.2;
let m2Yoy = 1.2;
let yieldCurveBps = 25;
let dgs2Latest = 4.3;
// Trifecta calculation
let mod1 = (latV4 > latV13 && latV4 > 0) ? 1 : (latV4 < latV13 && latV4 < 0) ? -1 : 0;
let mod2 = 1;
let mod3 = breadthLat > 60 ? 1 : breadthLat < 40 ? -1 : 0;
let trifecta = mod1 + mod2 + mod3;
let isStag = pce > 3.0 && gdp < 1.0;
let lastDataRefresh = Date.now();
let fredRefreshErrors = [];
let gurofocusRefreshErrors = [];
const macroHistory = {};
// ─── SEC EDGAR 13F — Live Guru Portfolio Data ───
const SEC_HEADERS = { 'User-Agent': 'DruckEngine/1.0 (maredinwai@maredin.com)', 'Accept-Encoding': 'gzip, deflate' };
const SEC_RATE_MS = 150;
let lastSecRequest = 0;
async function secFetch(url) {
    const now = Date.now();
    if (now - lastSecRequest < SEC_RATE_MS)
        await new Promise(r => setTimeout(r, SEC_RATE_MS - (now - lastSecRequest)));
    lastSecRequest = Date.now();
    const res = await fetch(url, { headers: SEC_HEADERS });
    if (!res.ok)
        throw new Error(`SEC EDGAR ${res.status} for ${url}`);
    return res;
}
const GURU_REGISTRY = {
    ackman: { cik: '1336528', name: 'Bill Ackman', fund: 'Pershing Square Capital', style: 'Concentrated Activist' },
    druckenmiller: { cik: '1536411', name: 'Stanley Druckenmiller', fund: 'Duquesne Family Office', style: 'Macro Systematic' },
    burry: { cik: '1649339', name: 'Michael Burry', fund: 'Scion Asset Management', style: 'Deep Value Contrarian' },
    klarman: { cik: '934549', name: 'Seth Klarman', fund: 'Baupost Group', style: 'Value / Distressed' },
    greenberg: { cik: '1536196', name: 'Glenn Greenberg', fund: 'Brave Warrior Advisors', style: 'Deep Value' },
    abrams: { cik: '1358706', name: 'David Abrams', fund: 'Abrams Capital Management', style: 'Deep Value Concentrated' },
    tepper: { cik: '1656456', name: 'David Tepper', fund: 'Appaloosa Management', style: 'Multi-Strategy' },
};
const cusipTickerMap = new Map();
const GURU_CACHE_TTL = 24 * 60 * 60 * 1000;
function findRecent13Fs(submissions, count = 2) {
    const recent = submissions?.filings?.recent;
    if (!recent || !recent.form)
        return [];
    const results = [];
    for (let i = 0; i < recent.form.length && results.length < count; i++) {
        if (recent.form[i] === '13F-HR') {
            results.push({
                accessionNumber: recent.accessionNumber[i],
                accessionClean: recent.accessionNumber[i].replace(/-/g, ''),
                filingDate: recent.filingDate[i],
                reportDate: recent.reportDate?.[i] || recent.filingDate[i],
            });
        }
    }
    return results;
}
async function fetch13FInfoTable(cik, filing) {
    const basePath = `https://www.sec.gov/Archives/edgar/data/${cik}/${filing.accessionClean}`;
    const indexRes = await secFetch(`${basePath}/index.json`);
    const index = await indexRes.json();
    const items = index?.directory?.item || [];
    const infoFile = items.find((f) => {
        const n = f.name.toLowerCase();
        return (n.includes('infotable') || n.includes('information_table')) && n.endsWith('.xml');
    });
    if (!infoFile)
        return [];
    const xmlRes = await secFetch(`${basePath}/${infoFile.name}`);
    const xml = await xmlRes.text();
    return parse13FXML(xml);
}
function parse13FXML(xml) {
    const holdings = [];
    const entries = xml.match(/<(?:\w+:)?infoTable>[\s\S]*?<\/(?:\w+:)?infoTable>/gi) || [];
    for (const entry of entries) {
        const get = (tag) => {
            const m = entry.match(new RegExp(`<(?:\\w+:)?${tag}>\\s*([^<]*)\\s*<`, 'i'));
            return m ? m[1].trim() : null;
        };
        const name = get('nameOfIssuer');
        const cusip = get('cusip');
        const value = parseInt(get('value') || '0') || 0;
        const shares = parseInt(get('sshPrnamt') || '0') || 0;
        if (name && cusip) {
            holdings.push({ name, cusip, value: value * 1000, shares });
        }
    }
    return holdings;
}
async function resolveCusips(holdings) {
    const unknown = holdings.filter(h => !cusipTickerMap.has(h.cusip)).map(h => h.cusip);
    const unique = [...new Set(unknown)];
    if (unique.length > 0) {
        try {
            for (let i = 0; i < unique.length; i += 100) {
                const batch = unique.slice(i, i + 100).map(cusip => ({ idType: 'ID_CUSIP', idValue: cusip }));
                const res = await fetch('https://api.openfigi.com/v3/mapping', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(batch),
                });
                const results = await res.json();
                for (let j = 0; j < results.length; j++) {
                    const data = results[j]?.data;
                    if (data && data.length > 0) {
                        const match = data.find((d) => d.marketSector === 'Equity') || data[0];
                        if (match?.ticker)
                            cusipTickerMap.set(batch[j].idValue, match.ticker);
                    }
                }
                if (i + 100 < unique.length)
                    await new Promise(r => setTimeout(r, 1500));
            }
        }
        catch (e) {
            console.warn('[FIGI] Ticker resolution error:', e.message);
        }
    }
    return holdings.map(h => ({ ...h, ticker: cusipTickerMap.get(h.cusip) || null }));
}
function determineActions(current, previous) {
    const prevMap = {};
    (previous || []).forEach(h => { prevMap[h.cusip] = h; });
    return current.map(h => {
        const prev = prevMap[h.cusip];
        let action = 'HOLD';
        if (!prev)
            action = 'BUY';
        else {
            const delta = (h.shares - prev.shares) / prev.shares;
            if (delta > 0.10)
                action = 'BUY';
            else if (delta < -0.10)
                action = 'SELL';
        }
        return { ...h, action };
    });
}
function guessSector(name) {
    const n = (name || '').toUpperCase();
    if (n.match(/BANK|FINANC|CAPITAL|INSUR/))
        return 'Financials';
    if (n.match(/TECH|SOFTWARE|SEMICON|MICRO|ALPHABET|META|APPLE|NVIDIA/))
        return 'Technology';
    if (n.match(/HEALTH|PHARM|THERA|MEDIC|BIO/))
        return 'Healthcare';
    if (n.match(/ENERGY|OIL|GAS|PETRO/))
        return 'Energy';
    if (n.match(/AIRLINE|AIR LINE/))
        return 'Airlines';
    if (n.match(/REAL ESTATE|REIT|PROPERTY/))
        return 'Real Estate';
    if (n.match(/CONSUM/))
        return 'Consumer';
    return 'Other';
}
async function fetchGuruData(guruKey) {
    const guru = GURU_REGISTRY[guruKey];
    if (!guru)
        return null;
    const cacheKey = `guru:${guruKey}`;
    const cached = getCached(cacheKey, GURU_CACHE_TTL);
    if (cached)
        return cached;
    console.log(`[EDGAR] Fetching 13F for ${guru.name} (CIK ${guru.cik})...`);
    try {
        const paddedCik = guru.cik.padStart(10, '0');
        const subRes = await secFetch(`https://data.sec.gov/submissions/CIK${paddedCik}.json`);
        const submissions = await subRes.json();
        const filings = findRecent13Fs(submissions, 2);
        if (filings.length === 0)
            throw new Error('No 13F-HR filings found');
        console.log(`[EDGAR] ${guru.name}: Found ${filings.length} 13F(s), latest: ${filings[0].filingDate}`);
        const currentHoldings = await fetch13FInfoTable(guru.cik, filings[0]);
        let prevHoldings = null;
        if (filings.length > 1) {
            try {
                prevHoldings = await fetch13FInfoTable(guru.cik, filings[1]);
            }
            catch { }
        }
        const withTickers = await resolveCusips(currentHoldings);
        const prevWithTickers = prevHoldings ? await resolveCusips(prevHoldings) : null;
        const withActions = determineActions(withTickers, prevWithTickers);
        const totalValue = withActions.reduce((s, h) => s + h.value, 0);
        const weighted = withActions.map(h => ({ ...h, weight: totalValue > 0 ? Math.round((h.value / totalValue) * 1000) / 10 : 0 }));
        const sorted = weighted.sort((a, b) => b.weight - a.weight);
        const top = sorted.filter((h) => h.ticker).slice(0, 10);
        const aum = totalValue >= 1e9 ? `$${(totalValue / 1e9).toFixed(1)}B` : `$${(totalValue / 1e6).toFixed(0)}M`;
        const result = {
            name: guru.name,
            fund: guru.fund,
            aum,
            style: guru.style,
            filingDate: filings[0].filingDate,
            holdings: top.map((h) => ({
                ticker: h.ticker,
                action: h.action,
                shares_chg: h.action === 'BUY' ? `+${(h.shares / 1000).toFixed(0)}K` : h.action === 'SELL' ? `-${(h.shares / 1000).toFixed(0)}K` : `${(h.shares / 1000).toFixed(0)}K`,
                pct_portfolio: h.weight,
                sector: guessSector(h.name),
            })),
            quarterly_moves: {
                new_positions: top.filter((h) => h.action === 'BUY').length,
                increased: top.filter((h) => h.action === 'BUY').length,
                decreased: top.filter((h) => h.action === 'SELL').length,
                sold_out: 0,
            },
            conviction_score: +(top.filter((h) => h.action === 'BUY').length / Math.max(top.length, 1)).toFixed(2),
        };
        setCached(cacheKey, result);
        console.log(`[EDGAR] ${guru.name}: ${top.length} holdings loaded (AUM ~${aum})`);
        return result;
    }
    catch (err) {
        console.error(`[EDGAR] Error fetching ${guru.name}:`, err.message);
        return null;
    }
}
// Recalculate all derived values from current state
function recalcDerived() {
    latV4 = vel4w[vel4w.length - 1] || 0;
    latV13 = vel13w[vel13w.length - 1] || 0;
    breadthLat = breadthArr[breadthArr.length - 1] || 58;
    mod1 = (latV4 > latV13 && latV4 > 0) ? 1 : (latV4 < latV13 && latV4 < 0) ? -1 : 0;
    mod3 = breadthLat > 60 ? 1 : breadthLat < 40 ? -1 : 0;
    trifecta = mod1 + mod2 + mod3;
    isStag = pce > 3.0 && gdp < 1.0;
    yieldCurveBps = us10y.length > 0 ? Math.round((us10y[us10y.length - 1] - dgs2Latest) * 100) : 25;
}
// Helper to pad short arrays to length N using last value
function padToN(arr, targetLen) {
    if (arr.length >= targetLen)
        return arr.slice(-targetLen);
    const lastVal = arr[arr.length - 1] || 0;
    return [...Array(targetLen - arr.length).fill(lastVal), ...arr];
}
// Function to refresh data from FRED
async function refreshLiveData() {
    try {
        const fredData = await fetchAllFredData();
        if (!fredData) {
            console.log('[FRED] No API key or fetch failed — using simulated data');
            return;
        }
        console.log('[FRED] Processing live data...');
        const errors = [];
        // ── Liquidity components ──
        if (fredData.walcl.length > 4 && fredData.wtregen.length > 0 && fredData.rrpontsyd.length > 0) {
            // WALCL is in millions → divide by 1,000,000 to get trillions
            const bsRaw = fredData.walcl.map(v => v / 1000000);
            // WTREGEN is in billions → divide by 1,000 to get trillions
            const tgaRaw = fredData.wtregen.map(v => v / 1000);
            // RRPONTSYD is in billions → divide by 1,000 to get trillions
            const rrpRaw = fredData.rrpontsyd.map(v => v / 1000);
            bs = padToN(bsRaw, N);
            tga = padToN(tgaRaw, N);
            rrp = padToN(rrpRaw, N);
            nl = bs.map((b, i) => b - tga[i] - rrp[i]);
            vel4w = roc(nl, 4);
            vel13w = roc(nl, 13);
            dates = fredData.dates.slice(-N);
            if (dates.length < N) {
                const missing = N - dates.length;
                const first = new Date(dates[0] || '2024-01-01');
                const pad = [];
                for (let i = missing; i > 0; i--) {
                    const d = new Date(first);
                    d.setDate(d.getDate() - i * 7);
                    pad.push(d.toISOString().split('T')[0]);
                }
                dates = [...pad, ...dates];
            }
            console.log(`[FRED] Liquidity: BS=${bs[bs.length - 1]?.toFixed(3)}T, TGA=${(tga[tga.length - 1] * 1000)?.toFixed(0)}B, RRP=${(rrp[rrp.length - 1] * 1000)?.toFixed(0)}B, NL=${nl[nl.length - 1]?.toFixed(3)}T`);
        }
        else {
            errors.push('Missing liquidity components (WALCL/WTREGEN/RRPONTSYD)');
        }
        // ── M2 Money Supply ──
        if (fredData.m2sl.length > 0) {
            // M2SL is in billions
            m2 = padToN(fredData.m2sl.map(v => v / 1000), N); // Convert to trillions for display
            // Calculate M2 YoY growth
            if (fredData.m2sl.length >= 13) {
                const latest = fredData.m2sl[fredData.m2sl.length - 1];
                const yearAgo = fredData.m2sl[fredData.m2sl.length - 13]; // ~12 months ago (monthly data)
                m2Yoy = +((latest - yearAgo) / yearAgo * 100).toFixed(1);
            }
            console.log(`[FRED] M2: ${fredData.m2sl[fredData.m2sl.length - 1]?.toFixed(0)}B, YoY: ${m2Yoy}%`);
        }
        // ── PCE Core YoY (PCEPILFE is a price INDEX, not a percentage — must compute YoY change) ──
        if (fredData.pcepilfe.length >= 13) {
            const latestPce = fredData.pcepilfe[fredData.pcepilfe.length - 1];
            const yearAgoPce = fredData.pcepilfe[fredData.pcepilfe.length - 13]; // ~12 months ago (monthly data)
            pce = +((latestPce - yearAgoPce) / yearAgoPce * 100).toFixed(1);
            console.log(`[FRED] PCE Core YoY: ${pce}% (index: ${latestPce}, year-ago: ${yearAgoPce})`);
        }
        else if (fredData.pcepilfe.length > 0) {
            // Not enough data for YoY — log warning, keep default
            console.warn(`[FRED] PCE Core: only ${fredData.pcepilfe.length} observations, need 13+ for YoY. Using default ${pce}%`);
        }
        // ── Real GDP Growth (already a percentage like 2.1) ──
        if (fredData.a191rl1q225sbea.length > 0) {
            gdp = fredData.a191rl1q225sbea[fredData.a191rl1q225sbea.length - 1];
            console.log(`[FRED] Real GDP: ${gdp}%`);
        }
        // ── Capacity Utilization (already a percentage like 77.8) ──
        if (fredData.tcu.length > 0) {
            capUtil = fredData.tcu[fredData.tcu.length - 1];
            console.log(`[FRED] Cap Util: ${capUtil}%`);
        }
        // ── Unemployment Rate (already a percentage like 4.1) ──
        if (fredData.unrate.length > 0) {
            unemployment = fredData.unrate[fredData.unrate.length - 1];
            console.log(`[FRED] Unemployment: ${unemployment}%`);
        }
        // ── CPI YoY ──
        if (fredData.cpiaucsl.length >= 13) {
            const latest = fredData.cpiaucsl[fredData.cpiaucsl.length - 1];
            const yearAgo = fredData.cpiaucsl[fredData.cpiaucsl.length - 13];
            cpiYoy = +((latest - yearAgo) / yearAgo * 100).toFixed(1);
            console.log(`[FRED] CPI YoY: ${cpiYoy}%`);
        }
        // ── ISM Manufacturing PMI (NAPM) ──
        if (fredData.napm.length > 0) {
            ismMfg = fredData.napm[fredData.napm.length - 1];
            console.log(`[FRED] ISM Mfg: ${ismMfg}`);
        }
        // ── Treasury Yields ──
        if (fredData.dgs10.length > 0) {
            us10y = padToN(fredData.dgs10, N);
            console.log(`[FRED] 10Y Yield: ${us10y[us10y.length - 1]?.toFixed(2)}%`);
        }
        if (fredData.dgs2.length > 0) {
            dgs2Latest = fredData.dgs2[fredData.dgs2.length - 1];
            console.log(`[FRED] 2Y Yield: ${dgs2Latest?.toFixed(2)}%`);
        }
        // ── HY OAS Spread (already in percentage points like 3.8) ──
        if (fredData.bamlh0a0hym2.length > 0) {
            hySpreads = padToN(fredData.bamlh0a0hym2, N);
            console.log(`[FRED] HY Spread: ${hySpreads[hySpreads.length - 1]?.toFixed(2)}%`);
        }
        // Recalculate all derived metrics
        recalcDerived();
        // ── Build macro history for 30-year clickable charts ──
        const raw = fredData.raw || {};
        // PCE YoY — compute from price index
        if (raw.pcepilfe && raw.pcepilfe.values.length >= 13) {
            const d = [], v = [];
            for (let i = 12; i < raw.pcepilfe.values.length; i++) {
                const cur = raw.pcepilfe.values[i], prev = raw.pcepilfe.values[i - 12];
                if (prev > 0) {
                    d.push(raw.pcepilfe.dates[i]);
                    v.push(+((cur - prev) / prev * 100).toFixed(2));
                }
            }
            macroHistory.pce = { dates: d, values: v };
        }
        // GDP — already percentage
        if (raw.a191rl1q225sbea && raw.a191rl1q225sbea.values.length > 0) {
            macroHistory.gdp = { dates: raw.a191rl1q225sbea.dates, values: raw.a191rl1q225sbea.values.map(v => +v.toFixed(2)) };
        }
        // Unemployment — already percentage
        if (raw.unrate && raw.unrate.values.length > 0) {
            macroHistory.unemployment = { dates: raw.unrate.dates, values: raw.unrate.values.map(v => +v.toFixed(1)) };
        }
        // CPI YoY — compute from price index
        if (raw.cpiaucsl && raw.cpiaucsl.values.length >= 13) {
            const d = [], v = [];
            for (let i = 12; i < raw.cpiaucsl.values.length; i++) {
                const cur = raw.cpiaucsl.values[i], prev = raw.cpiaucsl.values[i - 12];
                if (prev > 0) {
                    d.push(raw.cpiaucsl.dates[i]);
                    v.push(+((cur - prev) / prev * 100).toFixed(2));
                }
            }
            macroHistory.cpi_yoy = { dates: d, values: v };
        }
        // ISM Manufacturing — already an index value
        if (raw.napm && raw.napm.values.length > 0) {
            macroHistory.ism_mfg = { dates: raw.napm.dates, values: raw.napm.values.map(v => +v.toFixed(1)) };
        }
        // Capacity Utilization — already percentage
        if (raw.tcu && raw.tcu.values.length > 0) {
            macroHistory.cap_util = { dates: raw.tcu.dates, values: raw.tcu.values.map(v => +v.toFixed(1)) };
        }
        // Yield Curve 10Y-2Y spread in bps
        if (raw.dgs10 && raw.dgs2 && raw.dgs10.values.length > 0 && raw.dgs2.values.length > 0) {
            // Align by date — both are daily, find common dates
            const dgs2Map = new Map();
            raw.dgs2.dates.forEach((d, i) => dgs2Map.set(d, raw.dgs2.values[i]));
            const d = [], v = [];
            raw.dgs10.dates.forEach((dt, i) => {
                const y2 = dgs2Map.get(dt);
                if (y2 !== undefined) {
                    d.push(dt);
                    v.push(Math.round((raw.dgs10.values[i] - y2) * 100));
                }
            });
            macroHistory.yield_curve_bps = { dates: d, values: v };
        }
        // M2 YoY — compute from level
        if (raw.m2sl && raw.m2sl.values.length >= 13) {
            const d = [], v = [];
            for (let i = 12; i < raw.m2sl.values.length; i++) {
                const cur = raw.m2sl.values[i], prev = raw.m2sl.values[i - 12];
                if (prev > 0) {
                    d.push(raw.m2sl.dates[i]);
                    v.push(+((cur - prev) / prev * 100).toFixed(2));
                }
            }
            macroHistory.m2_yoy = { dates: d, values: v };
        }
        console.log(`[FRED] Macro history built: ${Object.keys(macroHistory).join(', ')} (${Object.values(macroHistory).map(s => s.dates.length + ' pts').join(', ')})`);
        dataSource = 'live';
        lastDataRefresh = Date.now();
        fredRefreshErrors = errors;
        // ── DATA FRESHNESS VALIDATION ──
        // Check that each series has data within expected recency windows
        const now = new Date();
        const stalenessChecks = [];
        // Weekly series (WALCL, WTREGEN) should have data within 14 days
        if (fredData.raw?.WALCL?.dates) {
            const lastDate = new Date(fredData.raw.WALCL.dates[fredData.raw.WALCL.dates.length - 1]);
            const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSince > 14)
                stalenessChecks.push(`WALCL (Fed BS): ${daysSince}d old — STALE`);
            fredDataFreshness.walcl = { lastDate: lastDate.toISOString().split('T')[0], daysSince, stale: daysSince > 14 };
        }
        // Daily series (yields) should have data within 5 days
        if (fredData.raw?.DGS10?.dates) {
            const lastDate = new Date(fredData.raw.DGS10.dates[fredData.raw.DGS10.dates.length - 1]);
            const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSince > 5)
                stalenessChecks.push(`DGS10 (10Y): ${daysSince}d old — STALE`);
            fredDataFreshness.dgs10 = { lastDate: lastDate.toISOString().split('T')[0], daysSince, stale: daysSince > 5 };
        }
        // Monthly series (CPI, PCE, ISM) can be 45 days old legitimately
        for (const [key, label] of [['CPIAUCSL', 'CPI'], ['PCEPILFE', 'PCE'], ['NAPM', 'ISM']]) {
            if (fredData.raw?.[key]?.dates) {
                const lastDate = new Date(fredData.raw[key].dates[fredData.raw[key].dates.length - 1]);
                const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
                if (daysSince > 60)
                    stalenessChecks.push(`${key} (${label}): ${daysSince}d old — STALE`);
                fredDataFreshness[key.toLowerCase()] = { lastDate: lastDate.toISOString().split('T')[0], daysSince, stale: daysSince > 60 };
            }
        }
        // Sanity checks — flag obviously wrong values
        if (pce < -5 || pce > 20)
            stalenessChecks.push(`PCE value ${pce}% looks wrong — outside -5% to 20% range`);
        if (gdp < -15 || gdp > 20)
            stalenessChecks.push(`GDP value ${gdp}% looks wrong — outside -15% to 20% range`);
        if (unemployment < 1 || unemployment > 25)
            stalenessChecks.push(`Unemployment ${unemployment}% looks wrong`);
        if (stalenessChecks.length > 0) {
            console.warn('[FRED] ⚠️ DATA FRESHNESS WARNINGS:');
            stalenessChecks.forEach(w => console.warn(`  ⚠️ ${w}`));
            fredRefreshErrors = [...errors, ...stalenessChecks];
        }
        console.log(`[FRED] ✓ Live data refresh complete — Trifecta: ${trifecta}, NL: ${nl[nl.length - 1]?.toFixed(3)}T, PCE: ${pce}%, GDP: ${gdp}%`);
    }
    catch (err) {
        fredRefreshErrors = [err?.message || 'Unknown error'];
        console.error('[FRED] Refresh error:', err?.message);
    }
}
// Initialize historical database
try {
    (0, history_store_1.initDatabase)();
    (0, burry_substack_1.initBurryTables)();
    console.log('[STARTUP] Historical database + Burry tables initialized');
    // Load persisted API key from SQLite (survives deploys)
    if (!anthropicApiKey) {
        const savedKey = (0, history_store_1.getSetting)('anthropic_api_key');
        if (savedKey) {
            anthropicApiKey = savedKey;
            process.env.ANTHROPIC_API_KEY = savedKey;
            console.log('[STARTUP] Loaded Anthropic API key from persistent storage');
        }
    }
}
catch (err) {
    console.error('[STARTUP] Failed to init database:', err?.message);
}
// Initial data refresh
refreshLiveData();
// Set up automatic refresh every 4 hours
setInterval(() => {
    refreshLiveData();
}, FRED_CACHE_DURATION);
// ─── API ROUTES ───
app.get('/api/health', (_req, res) => {
    recalcDerived();
    res.json({
        status: 'ok',
        version: '15.2.0',
        build: '2026-06-13T20:00:00Z',
        BUILD_CANARY: 'MODEL_FIX_SONNET_46',
        name: 'Druck Engine — Structural Regime Intelligence',
        timestamp: new Date().toISOString(),
        fred_key: !!FRED_API_KEY,
        data_source: dataSource,
        last_refresh: new Date(lastDataRefresh).toISOString(),
        llm_provider: (process.env.ANTHROPIC_API_KEY || '').startsWith('sk-ant') ? 'anthropic' : 'openai',
        llm_key_set: !!(process.env.ANTHROPIC_API_KEY),
    });
});
app.get('/api/data-status', (_req, res) => {
    const hasStaleData = Object.values(fredDataFreshness).some(f => f.stale);
    const staleCount = Object.values(fredDataFreshness).filter(f => f.stale).length;
    res.json({
        data_source: dataSource,
        last_refresh: new Date(lastDataRefresh).toISOString(),
        fred_configured: !!FRED_API_KEY,
        guru_configured: !!GURUFOCUS_API_KEY,
        freshness: {
            status: !FRED_API_KEY ? 'NO_API_KEY' : hasStaleData ? 'STALE_DATA' : fredRefreshErrors.length > 0 ? 'WARNINGS' : 'FRESH',
            staleCount,
            details: fredDataFreshness,
        },
        errors: {
            fred: fredRefreshErrors.length > 0 ? fredRefreshErrors : null,
            gurufocus: gurofocusRefreshErrors.length > 0 ? gurofocusRefreshErrors : null,
        },
    });
});
app.get('/api/trifecta', (_req, res) => {
    res.json({
        trifecta_score: trifecta,
        modules: {
            m1_liquidity: { score: mod1, roc_4w: +(latV4 * 100).toFixed(2), roc_13w: +(latV13 * 100).toFixed(2), signal: mod1 > 0 ? 'ACCELERATING' : mod1 < 0 ? 'DRAINING' : 'NEUTRAL' },
            m2_conviction: { score: mod2, signal: 'ACCUMULATING', note: 'Smart money rotating into Value/Banks' },
            m3_breadth: { score: mod3, breadth_pct: +breadthLat.toFixed(1), signal: mod3 > 0 ? 'HEALTHY' : mod3 < 0 ? 'FRAGILE' : 'NEUTRAL' },
        },
        regime: {
            is_stagflation: isStag,
            label: isStag ? 'STAGFLATION' : trifecta >= 2 ? 'RISK-ON' : trifecta <= -2 ? 'RISK-OFF' : 'NEUTRAL',
            pce, gdp,
        },
        hedge: {
            recommendation: trifecta >= 2 ? 'REDUCE' : trifecta <= -2 ? 'FULL' : 'STANDARD',
            spxu_allocation: trifecta >= 3 ? '0%' : trifecta >= 2 ? '25%' : trifecta >= 0 ? '50%' : trifecta >= -1 ? '75%' : '100%',
        },
    });
});
app.get('/api/liquidity', (_req, res) => {
    res.json({
        dates,
        net_liquidity: nl.map(v => +v.toFixed(4)),
        spx: spx.map(v => +v.toFixed(2)),
        roc_4w: vel4w.map(v => +(v * 100).toFixed(3)),
        roc_13w: vel13w.map(v => +(v * 100).toFixed(3)),
        latest: {
            net_liquidity: +nl[N - 1].toFixed(4),
            velocity_4w: +(latV4 * 100).toFixed(2),
            velocity_13w: +(latV13 * 100).toFixed(2),
            balance_sheet: +bs[N - 1].toFixed(2),
            tga: +(tga[N - 1] * 1000).toFixed(0),
            rrp: +(rrp[N - 1] * 1000).toFixed(0),
        },
    });
});
app.get('/api/breadth', (_req, res) => {
    res.json({
        dates,
        breadth: breadthArr.map(v => +v.toFixed(1)),
        spx_scaled: spx.map(v => +(v / 100).toFixed(2)),
        latest: {
            breadth_pct: +breadthLat.toFixed(1),
            trend_5w: +(breadthLat - breadthArr[N - 5]).toFixed(1),
            fragile: breadthLat < 40,
        },
    });
});
// ── Leading Indicators — Liquidity Flow + Macro Second Derivatives ──
// What Druckenmiller watches to act 1-2 quarters ahead of moving averages.
app.get('/api/leading-indicators', (_req, res) => {
    recalcDerived();
    const N = dates.length;
    // LIQUIDITY FLOW — not the level, the direction and acceleration
    const bsLatest = N > 0 ? +bs[N - 1].toFixed(2) : 0;
    const tgaLatest = N > 0 ? +(tga[N - 1] * 1000).toFixed(0) : 0; // billions
    const rrpLatest = N > 0 ? +(rrp[N - 1] * 1000).toFixed(0) : 0;
    const nlLatest = N > 0 ? +nl[N - 1].toFixed(4) : 0;
    // Liquidity velocity (already computed)
    const liqVel4w = +(latV4 * 100).toFixed(2);
    const liqVel13w = +(latV13 * 100).toFixed(2);
    // Liquidity ACCELERATION = change in velocity (second derivative)
    let liqAccel = 0;
    if (vel4w.length >= 5) {
        const recent = vel4w[vel4w.length - 1];
        const prior = vel4w[vel4w.length - 5];
        liqAccel = +((recent - prior) * 100).toFixed(3);
    }
    // Liquidity signal
    let liqSignal = 'NEUTRAL';
    let liqDescription = 'Liquidity stable';
    if (liqVel4w > 0.5 && liqAccel > 0) {
        liqSignal = 'EXPANDING';
        liqDescription = 'Liquidity expanding and accelerating — bullish for risk';
    }
    else if (liqVel4w > 0 && liqAccel > 0) {
        liqSignal = 'IMPROVING';
        liqDescription = 'Liquidity positive and improving — supportive';
    }
    else if (liqVel4w > 0 && liqAccel < 0) {
        liqSignal = 'DECELERATING';
        liqDescription = 'Liquidity positive but decelerating — watch for turn';
    }
    else if (liqVel4w < 0 && liqAccel < 0) {
        liqSignal = 'DRAINING';
        liqDescription = 'Liquidity draining and accelerating lower — bearish for risk';
    }
    else if (liqVel4w < 0 && liqAccel > 0) {
        liqSignal = 'BOTTOMING';
        liqDescription = 'Liquidity negative but drain decelerating — watch for turn';
    }
    // MACRO SECOND DERIVATIVES — rate of change of rate of change
    // Uses the regime data already in memory
    // CPI/PCE acceleration: is inflation falling faster or slower?
    // pce is the latest core PCE reading
    const inflAccel = pce > 0 ? (pce < 2.5 ? 'COOLING_FAST' : pce < 3.5 ? 'COOLING' : pce < 4.5 ? 'STICKY' : 'RISING') : 'UNKNOWN';
    // GDP acceleration
    const gdpAccel = gdp > 0 ? (gdp > 3 ? 'ACCELERATING' : gdp > 1.5 ? 'STEADY' : gdp > 0 ? 'SLOWING' : 'CONTRACTING') : (gdp < -1 ? 'RECESSION' : 'STALLING');
    // ISM/NAPM direction — use the latest reading vs. 50 threshold + direction
    // napm data is stored in the regime arrays
    let ismSignal = 'UNKNOWN';
    let ismValue = 0;
    // ISM data lives in the trifecta regime data — we access via the already-computed regime
    // Using breadth as a market-internal proxy if ISM not directly available
    const breadthAccel = breadthArr.length >= 10
        ? +((breadthArr[breadthArr.length - 1] - breadthArr[breadthArr.length - 5]) -
            (breadthArr[breadthArr.length - 5] - breadthArr[breadthArr.length - 10])).toFixed(1)
        : 0;
    // Yield curve (already have yieldCurveBps)
    const curveSignal = yieldCurveBps > 50 ? 'STEEP' : yieldCurveBps > 0 ? 'NORMAL' : yieldCurveBps > -50 ? 'FLAT' : 'INVERTED';
    // COMPOSITE LEADING SIGNAL — combines liquidity flow + macro momentum
    let compositeSignal = 'NEUTRAL';
    let compositeColor = 'amber';
    const bullCount = (liqVel4w > 0 ? 1 : 0) + (liqAccel > 0 ? 1 : 0) + (gdp > 1.5 ? 1 : 0) + (yieldCurveBps > 0 ? 1 : 0) + (breadthAccel > 0 ? 1 : 0);
    const bearCount = (liqVel4w < 0 ? 1 : 0) + (liqAccel < 0 ? 1 : 0) + (gdp < 1 ? 1 : 0) + (yieldCurveBps < -25 ? 1 : 0) + (breadthAccel < -5 ? 1 : 0);
    if (bullCount >= 4) {
        compositeSignal = 'RISK ON';
        compositeColor = 'green';
    }
    else if (bullCount >= 3) {
        compositeSignal = 'LEANING BULLISH';
        compositeColor = 'green';
    }
    else if (bearCount >= 4) {
        compositeSignal = 'RISK OFF';
        compositeColor = 'red';
    }
    else if (bearCount >= 3) {
        compositeSignal = 'LEANING BEARISH';
        compositeColor = 'red';
    }
    else {
        compositeSignal = 'MIXED';
        compositeColor = 'amber';
    }
    res.json({
        liquidity: {
            signal: liqSignal,
            description: liqDescription,
            netLiquidity: nlLatest,
            balanceSheet: bsLatest,
            tga: tgaLatest,
            reverseRepo: rrpLatest,
            velocity4w: liqVel4w,
            velocity13w: liqVel13w,
            acceleration: liqAccel,
        },
        macroMomentum: {
            inflation: { level: pce, signal: inflAccel },
            growth: { level: gdp, signal: gdpAccel },
            yieldCurve: { bps: yieldCurveBps, signal: curveSignal },
            breadthAccel: breadthAccel,
        },
        composite: {
            signal: compositeSignal,
            color: compositeColor,
            bullCount,
            bearCount,
        },
    });
});
app.get('/api/argentina', (_req, res) => {
    const spreadTight = argSpread[N - 1] < argSpread[N - 8];
    const tecoChg = ((tecoPrice[N - 1] - tecoPrice[N - 8]) / tecoPrice[N - 8] * 100);
    const rerating = spreadTight && tecoChg > 0;
    res.json({
        dates,
        spread: argSpread.map(v => +v.toFixed(2)),
        teco_price: tecoPrice.map(v => +v.toFixed(2)),
        ggal_price: ggalPrice.map(v => +v.toFixed(2)),
        us10y: us10y.map(v => +v.toFixed(3)),
        latest: {
            spread: +argSpread[N - 1].toFixed(2),
            spread_prev_8w: +argSpread[N - 8].toFixed(2),
            teco: +tecoPrice[N - 1].toFixed(2),
            ggal: +ggalPrice[N - 1].toFixed(2),
            teco_change_pct: +tecoChg.toFixed(1),
            spread_tightening: spreadTight,
            structural_rerating: rerating,
        },
    });
});
app.get('/api/global-markets', (_req, res) => {
    const nzealand = randomWalk(8200, N, 0.001, 0.015);
    const mexico = randomWalk(22500, N, 0.0015, 0.016);
    const turkey = randomWalk(8500, N, 0.002, 0.025);
    const skorea = randomWalk(2650, N, 0.0018, 0.018);
    const china = randomWalk(3100, N, 0.0005, 0.020);
    const uk = randomWalk(8100, N, 0.0010, 0.014);
    const germany = randomWalk(20500, N, 0.0012, 0.016);
    const japan = randomWalk(32800, N, 0.0008, 0.012);
    const india = randomWalk(72500, N, 0.0020, 0.019);
    const brazil = randomWalk(135000, N, 0.0015, 0.022);
    const countries = [
        { name: 'Argentina', etf: 'ARGT', index: 'Merval', pe: 6.5, fwdPe: 4.2, spread: 950, spread_prev: 980, proxyPrice: 68.5, proxyChg: 2.1, signal: 'RE-RATING', ytd_return: 28.5, breadth_pct: 72 },
        { name: 'Brazil', etf: 'EWZ', index: 'Bovespa', pe: 11.2, fwdPe: 9.8, spread: 320, spread_prev: 315, proxyPrice: 52.3, proxyChg: 1.8, signal: 'STABLE', ytd_return: 15.2, breadth_pct: 65 },
        { name: 'India', etf: 'INDA', index: 'Nifty 50', pe: 22.5, fwdPe: 19.2, spread: 180, spread_prev: 175, proxyPrice: 68.2, proxyChg: 0.9, signal: 'STABLE', ytd_return: 12.8, breadth_pct: 58 },
        { name: 'Japan', etf: 'EWJ', index: 'Nikkei 225', pe: 18.5, fwdPe: 16.1, spread: 120, spread_prev: 118, proxyPrice: 125.6, proxyChg: 1.5, signal: 'RISING', ytd_return: 8.5, breadth_pct: 62 },
        { name: 'Germany', etf: 'EWG', index: 'DAX', pe: 13.8, fwdPe: 12.1, spread: 95, spread_prev: 92, proxyPrice: 42.1, proxyChg: 0.8, signal: 'STABLE', ytd_return: 6.2, breadth_pct: 55 },
        { name: 'UK', etf: 'EWU', index: 'FTSE 100', pe: 12.5, fwdPe: 11.2, spread: 110, spread_prev: 108, proxyPrice: 35.8, proxyChg: 0.5, signal: 'STABLE', ytd_return: 4.5, breadth_pct: 52 },
        { name: 'China', etf: 'FXI', index: 'Hang Seng', pe: 9.8, fwdPe: 8.5, spread: 280, spread_prev: 275, proxyPrice: 22.3, proxyChg: -1.2, signal: 'DETERIORATING', ytd_return: -8.5, breadth_pct: 38 },
        { name: 'South Korea', etf: 'EWY', index: 'KOSPI', pe: 10.5, fwdPe: 9.2, spread: 185, spread_prev: 182, proxyPrice: 78.5, proxyChg: 2.1, signal: 'RISING', ytd_return: 18.2, breadth_pct: 68 },
        { name: 'Mexico', etf: 'EWW', index: 'IPC', pe: 14.2, fwdPe: 12.5, spread: 210, spread_prev: 215, proxyPrice: 88.3, proxyChg: 1.5, signal: 'STABLE', ytd_return: 10.8, breadth_pct: 60 },
        { name: 'Turkey', etf: 'TUR', index: 'BIST 100', pe: 8.2, fwdPe: 6.8, spread: 550, spread_prev: 545, proxyPrice: 31.2, proxyChg: 3.5, signal: 'RE-RATING', ytd_return: 35.2, breadth_pct: 75 },
    ];
    const countryData = countries.map((c, idx) => {
        const prices = [nzealand, mexico, turkey, skorea, china, uk, germany, japan, india, brazil][idx];
        return {
            ...c,
            prices: prices.map(v => +v.toFixed(2)),
        };
    });
    res.json({
        dates,
        countries: countryData,
        time_series: {
            dates,
            countries: countries.map(c => ({ name: c.name, prices: countryData.find(cd => cd.name === c.name)?.prices || [] })),
        },
    });
});
app.get('/api/macro', (_req, res) => {
    res.json({
        dates,
        crude: crude.map(v => +v.toFixed(2)),
        copper: copper.map(v => +v.toFixed(3)),
        gold: gold.map(v => +v.toFixed(0)),
        hy_spreads: hySpreads.map(v => +v.toFixed(2)),
        m2: m2.map(v => +v.toFixed(2)),
        indicators: {
            pce: { trailing_12m: pce, latest: pce, trend: pce < 3.0 ? 'FALLING' : 'RISING' },
            gdp: { trailing_12m: gdp, latest: gdp, trend: gdp > 2.0 ? 'RISING' : 'FALLING' },
            cap_util: { trailing_12m: capUtil, latest: capUtil, trend: capUtil > 78 ? 'RISING' : 'FALLING' },
            yield_curve_bps: { trailing_12m: yieldCurveBps, latest: yieldCurveBps, trend: yieldCurveBps > 0 ? 'STEEPENING' : 'INVERTING' },
            unemployment: { trailing_12m: unemployment, latest: unemployment, trend: unemployment > 4.0 ? 'RISING' : 'FALLING' },
            cpi_yoy: { trailing_12m: cpiYoy, latest: cpiYoy, trend: cpiYoy < 3.0 ? 'FALLING' : 'RISING' },
            ism_mfg: { trailing_12m: ismMfg, latest: ismMfg, trend: ismMfg > 50 ? 'RISING' : 'FALLING' },
            m2_yoy: { trailing_12m: m2Yoy, latest: m2Yoy, trend: m2Yoy > 0 ? 'RISING' : 'FALLING' },
            is_stagflation: isStag,
            data_source: dataSource,
        },
    });
});
// ─── MACRO HISTORY — 30-year time series for clickable indicator charts ───
app.get('/api/macro/history/:indicator', (req, res) => {
    const key = req.params.indicator;
    const valid = ['pce', 'gdp', 'unemployment', 'cpi_yoy', 'ism_mfg', 'cap_util', 'yield_curve_bps', 'm2_yoy'];
    if (!valid.includes(key)) {
        return res.status(400).json({ error: `Invalid indicator. Valid: ${valid.join(', ')}` });
    }
    const series = macroHistory[key];
    if (!series || series.dates.length === 0) {
        return res.status(404).json({ error: `No historical data for ${key}. Data source: ${dataSource}` });
    }
    res.json(series);
});
// Also expose all macro history at once for bulk loading
app.get('/api/macro/history', (_req, res) => {
    res.json(macroHistory);
});
app.get('/api/gurus', async (_req, res) => {
    try {
        // Try SEC EDGAR live data first
        const guruResults = [];
        const errors = [];
        for (const key of Object.keys(GURU_REGISTRY)) {
            try {
                const data = await fetchGuruData(key);
                if (data)
                    guruResults.push(data);
                else
                    errors.push(key);
            }
            catch (e) {
                console.error(`[EDGAR] ${key}:`, e.message);
                errors.push(key);
            }
        }
        if (guruResults.length === 0) {
            // Fall back to simulated data if all EDGAR fetches fail
            console.warn('[EDGAR] All guru fetches failed, using simulated data');
            return res.json(getSimulatedGuruData());
        }
        // Build aggregates from live data
        const allTickers = guruResults.flatMap(g => g.holdings.map((h) => h.ticker));
        const tickerCounts = {};
        allTickers.forEach(ticker => {
            if (ticker && !tickerCounts[ticker])
                tickerCounts[ticker] = { buy: 0, sell: 0 };
        });
        guruResults.forEach(g => {
            g.holdings.forEach((h) => {
                if (h.ticker && tickerCounts[h.ticker]) {
                    if (h.action === 'BUY')
                        tickerCounts[h.ticker].buy++;
                    else if (h.action === 'SELL')
                        tickerCounts[h.ticker].sell++;
                }
            });
        });
        const most_bought = Object.entries(tickerCounts)
            .filter(([, v]) => v.buy >= 2)
            .sort((a, b) => b[1].buy - a[1].buy)
            .slice(0, 10)
            .map(([ticker, v]) => ({ ticker, guru_count: v.buy }));
        const most_sold = Object.entries(tickerCounts)
            .filter(([, v]) => v.sell >= 1)
            .sort((a, b) => b[1].sell - a[1].sell)
            .slice(0, 5)
            .map(([ticker, v]) => ({ ticker, guru_count: v.sell }));
        const sectorConcentration = {};
        guruResults.forEach(g => {
            g.holdings.forEach((h) => {
                if (!sectorConcentration[h.sector])
                    sectorConcentration[h.sector] = 0;
                sectorConcentration[h.sector]++;
            });
        });
        const consensus_picks = Object.entries(tickerCounts)
            .filter(([, v]) => v.buy >= 3)
            .map(([ticker]) => ticker);
        res.json({
            gurus: guruResults,
            aggregate: {
                most_bought_tickers: most_bought,
                most_sold_tickers: most_sold,
                sector_concentration: sectorConcentration,
            },
            consensus_picks,
            source: 'edgar',
            errors: errors.length > 0 ? errors : undefined,
        });
    }
    catch (err) {
        console.error('[GURUS] Error:', err.message);
        res.json(getSimulatedGuruData());
    }
});
// Simulated guru data fallback
function getSimulatedGuruData() {
    const gurus = [
        { name: 'Bill Ackman', fund: 'Pershing Square', aum: '$12B', style: 'Concentrated Activist',
            holdings: [
                { ticker: 'HHH', action: 'BUY', shares_chg: '+500K', pct_portfolio: 18.5, sector: 'Real Estate' },
                { ticker: 'UMC', action: 'BUY', shares_chg: '+300K', pct_portfolio: 12.3, sector: 'Technology' },
                { ticker: 'PHM', action: 'BUY', shares_chg: '+200K', pct_portfolio: 10.2, sector: 'Consumer Disc' },
                { ticker: 'XOM', action: 'BUY', shares_chg: '+100K', pct_portfolio: 6.8, sector: 'Energy' },
            ],
            quarterly_moves: { new_positions: 2, increased: 3, decreased: 1, sold_out: 0 }, conviction_score: 0.85 },
        { name: 'Stanley Druckenmiller', fund: 'Duquesne Family Office', aum: '$6.5B', style: 'Macro Systematic',
            holdings: [
                { ticker: 'TLT', action: 'BUY', shares_chg: '+400K', pct_portfolio: 16.8, sector: 'Fixed Income' },
                { ticker: 'GLD', action: 'BUY', shares_chg: '+600K', pct_portfolio: 13.2, sector: 'Commodities' },
                { ticker: 'EEM', action: 'BUY', shares_chg: '+500K', pct_portfolio: 11.5, sector: 'Equities' },
            ],
            quarterly_moves: { new_positions: 2, increased: 2, decreased: 1, sold_out: 0 }, conviction_score: 0.82 },
        { name: 'Seth Klarman', fund: 'Baupost Group', aum: '$35B', style: 'Value / Distressed',
            holdings: [
                { ticker: 'BAC', action: 'BUY', shares_chg: '+1.2M', pct_portfolio: 11.8, sector: 'Financials' },
                { ticker: 'C', action: 'BUY', shares_chg: '+800K', pct_portfolio: 9.5, sector: 'Financials' },
            ],
            quarterly_moves: { new_positions: 0, increased: 2, decreased: 1, sold_out: 0 }, conviction_score: 0.88 },
        { name: 'David Tepper', fund: 'Appaloosa Management', aum: '$18B', style: 'Multi-Strategy',
            holdings: [
                { ticker: 'BAC', action: 'BUY', shares_chg: '+1.5M', pct_portfolio: 14.2, sector: 'Financials' },
                { ticker: 'GS', action: 'BUY', shares_chg: '+800K', pct_portfolio: 10.5, sector: 'Financials' },
                { ticker: 'NVDA', action: 'BUY', shares_chg: '+200K', pct_portfolio: 9.8, sector: 'Technology' },
            ],
            quarterly_moves: { new_positions: 1, increased: 4, decreased: 2, sold_out: 1 }, conviction_score: 0.78 },
    ];
    return { gurus, aggregate: { most_bought_tickers: [{ ticker: 'BAC', guru_count: 2 }], most_sold_tickers: [], sector_concentration: { Financials: 5, Technology: 2, Energy: 1 } }, consensus_picks: ['BAC'], source: 'simulated' };
}
app.get('/api/sectors', (_req, res) => {
    res.json({
        sectors: [
            { name: 'Financials', fwd18m: 0.12, inst_conc: 0.42, pe: 12.8, fwd_pe: 10.5, capacity: 'Med' },
            { name: 'Technology', fwd18m: 0.35, inst_conc: 0.68, pe: 28.5, fwd_pe: 24.1, capacity: 'High' },
            { name: 'Energy', fwd18m: 0.05, inst_conc: 0.35, pe: 10.2, fwd_pe: 9.8, capacity: 'Med' },
            { name: 'Healthcare', fwd18m: 0.18, inst_conc: 0.45, pe: 18.3, fwd_pe: 15.7, capacity: 'Med' },
            { name: 'Industrials', fwd18m: 0.08, inst_conc: 0.30, pe: 16.7, fwd_pe: 13.9, capacity: 'Med' },
            { name: 'Materials', fwd18m: -0.05, inst_conc: 0.15, pe: 11.8, fwd_pe: 9.5, capacity: 'Low' },
            { name: 'Consumer Disc', fwd18m: 0.22, inst_conc: 0.52, pe: 22.1, fwd_pe: 18.4, capacity: 'High' },
            { name: 'Consumer Staples', fwd18m: 0.08, inst_conc: 0.38, pe: 19.2, fwd_pe: 17.1, capacity: 'Med' },
            { name: 'Utilities', fwd18m: 0.02, inst_conc: 0.20, pe: 16.0, fwd_pe: 15.2, capacity: 'Med' },
            { name: 'Real Estate', fwd18m: -0.12, inst_conc: 0.10, pe: 19.5, fwd_pe: 14.8, capacity: 'Low' },
            { name: 'Communication Services', fwd18m: 0.15, inst_conc: 0.55, pe: 24.3, fwd_pe: 21.5, capacity: 'High' },
            { name: 'Airlines', fwd18m: -0.15, inst_conc: 0.12, pe: 8.2, fwd_pe: 6.1, capacity: 'Low' },
            { name: 'Chemicals', fwd18m: -0.08, inst_conc: 0.18, pe: 14.5, fwd_pe: 11.2, capacity: 'Low' },
        ],
        smart_money: {
            sectors: ['Financials', 'Energy', 'Technology', 'Healthcare', 'Airlines', 'Materials', 'Industrials'],
            buying: [72, 58, 45, 52, 38, 41, 52],
            selling: [28, 35, 62, 40, 18, 30, 25],
        },
    });
});
app.get('/api/positions', (_req, res) => {
    res.json({
        positions: [
            { ticker: 'BAC', name: 'Bank of America', sector: 'Financials', etf: 'XLF', day_chg: -1.2, etf_chg: -0.3, regime_tag: 'Core Survivor' },
            { ticker: 'WFC', name: 'Wells Fargo', sector: 'Financials', etf: 'XLF', day_chg: 0.8, etf_chg: -0.3, regime_tag: 'Core Survivor' },
            { ticker: 'BX', name: 'Blackstone', sector: 'Alt Finance', etf: 'XLF', day_chg: -0.5, etf_chg: -0.3, regime_tag: 'Core Survivor' },
            { ticker: 'AAL', name: 'American Airlines', sector: 'Airlines', etf: 'JETS', day_chg: -2.8, etf_chg: -0.9, regime_tag: isStag ? 'HIGH RISK' : 'Cyclical' },
            { ticker: 'DAL', name: 'Delta Airlines', sector: 'Airlines', etf: 'JETS', day_chg: -1.5, etf_chg: -0.9, regime_tag: isStag ? 'HIGH RISK' : 'Cyclical' },
            { ticker: 'GGAL', name: 'Grupo Galicia', sector: 'Argentina', etf: 'ARGT', day_chg: 1.5, etf_chg: 0.8, regime_tag: 'Re-rating Play' },
            { ticker: 'TECO2', name: 'Telecom Arg', sector: 'Argentina', etf: 'ARGT', day_chg: 2.1, etf_chg: 0.8, regime_tag: 'Re-rating Play' },
            { ticker: 'SPXU', name: 'S&P Ultra Short', sector: 'Hedge', etf: 'SPY', day_chg: 0.9, etf_chg: 0.3, regime_tag: trifecta >= 2 ? 'REDUCE' : 'Active Hedge' },
        ],
    });
});
// ─── INDUSTRY DEEP DIVE ───
const industryStocks = {
    financials: [
        { ticker: 'BAC', name: 'Bank of America', pe: 12.1, fwdPe: 10.2, mktCap: '$312B', above50d: true, insiderBuy: 8, insiderSell: 2, guruBuy: 15, guruSell: 6, dayChg: -1.2, weekChg: 2.3, monthChg: 5.8 },
        { ticker: 'WFC', name: 'Wells Fargo', pe: 11.8, fwdPe: 9.9, mktCap: '$198B', above50d: true, insiderBuy: 5, insiderSell: 1, guruBuy: 12, guruSell: 4, dayChg: 0.8, weekChg: 1.5, monthChg: 4.2 },
        { ticker: 'JPM', name: 'JPMorgan Chase', pe: 13.2, fwdPe: 11.5, mktCap: '$580B', above50d: true, insiderBuy: 3, insiderSell: 1, guruBuy: 18, guruSell: 5, dayChg: 0.3, weekChg: 1.8, monthChg: 6.1 },
        { ticker: 'GS', name: 'Goldman Sachs', pe: 14.5, fwdPe: 12.1, mktCap: '$155B', above50d: false, insiderBuy: 2, insiderSell: 3, guruBuy: 8, guruSell: 7, dayChg: -0.5, weekChg: -1.2, monthChg: 2.3 },
        { ticker: 'MS', name: 'Morgan Stanley', pe: 15.1, fwdPe: 12.8, mktCap: '$148B', above50d: true, insiderBuy: 4, insiderSell: 2, guruBuy: 10, guruSell: 4, dayChg: 0.2, weekChg: 0.9, monthChg: 3.5 },
        { ticker: 'BX', name: 'Blackstone', pe: 28.5, fwdPe: 22.1, mktCap: '$172B', above50d: true, insiderBuy: 6, insiderSell: 1, guruBuy: 14, guruSell: 3, dayChg: -0.5, weekChg: 2.1, monthChg: 7.2 },
        { ticker: 'C', name: 'Citigroup', pe: 10.5, fwdPe: 8.8, mktCap: '$118B', above50d: false, insiderBuy: 7, insiderSell: 3, guruBuy: 9, guruSell: 5, dayChg: -1.8, weekChg: -0.5, monthChg: 1.1 },
        { ticker: 'SCHW', name: 'Charles Schwab', pe: 22.3, fwdPe: 18.5, mktCap: '$125B', above50d: true, insiderBuy: 2, insiderSell: 2, guruBuy: 6, guruSell: 4, dayChg: 0.6, weekChg: 1.2, monthChg: 3.8 },
    ],
    airlines: [
        { ticker: 'AAL', name: 'American Airlines', pe: 5.8, fwdPe: 4.5, mktCap: '$10B', above50d: false, insiderBuy: 12, insiderSell: 1, guruBuy: 4, guruSell: 2, dayChg: -2.8, weekChg: -4.5, monthChg: -8.2 },
        { ticker: 'DAL', name: 'Delta Air Lines', pe: 7.2, fwdPe: 5.8, mktCap: '$32B', above50d: false, insiderBuy: 8, insiderSell: 2, guruBuy: 6, guruSell: 3, dayChg: -1.5, weekChg: -3.1, monthChg: -5.5 },
        { ticker: 'UAL', name: 'United Airlines', pe: 6.5, fwdPe: 5.2, mktCap: '$22B', above50d: false, insiderBuy: 5, insiderSell: 1, guruBuy: 5, guruSell: 2, dayChg: -2.1, weekChg: -3.8, monthChg: -6.8 },
        { ticker: 'LUV', name: 'Southwest Airlines', pe: 18.5, fwdPe: 12.2, mktCap: '$18B', above50d: false, insiderBuy: 3, insiderSell: 2, guruBuy: 3, guruSell: 4, dayChg: -1.2, weekChg: -2.5, monthChg: -4.1 },
        { ticker: 'JBLU', name: 'JetBlue Airways', pe: 0, fwdPe: 15.5, mktCap: '$2B', above50d: false, insiderBuy: 2, insiderSell: 0, guruBuy: 1, guruSell: 1, dayChg: -3.5, weekChg: -6.2, monthChg: -12.1 },
    ],
    energy: [
        { ticker: 'XOM', name: 'Exxon Mobil', pe: 13.8, fwdPe: 12.5, mktCap: '$460B', above50d: true, insiderBuy: 2, insiderSell: 1, guruBuy: 11, guruSell: 5, dayChg: 0.8, weekChg: 2.1, monthChg: 4.5 },
        { ticker: 'CVX', name: 'Chevron', pe: 14.2, fwdPe: 13.1, mktCap: '$280B', above50d: true, insiderBuy: 1, insiderSell: 1, guruBuy: 9, guruSell: 4, dayChg: 0.5, weekChg: 1.8, monthChg: 3.2 },
        { ticker: 'COP', name: 'ConocoPhillips', pe: 11.5, fwdPe: 10.2, mktCap: '$135B', above50d: true, insiderBuy: 3, insiderSell: 1, guruBuy: 7, guruSell: 3, dayChg: 1.2, weekChg: 3.5, monthChg: 6.1 },
        { ticker: 'SLB', name: 'Schlumberger', pe: 15.8, fwdPe: 13.5, mktCap: '$65B', above50d: false, insiderBuy: 2, insiderSell: 2, guruBuy: 4, guruSell: 3, dayChg: -0.8, weekChg: -1.5, monthChg: 1.2 },
        { ticker: 'EOG', name: 'EOG Resources', pe: 10.2, fwdPe: 9.1, mktCap: '$72B', above50d: true, insiderBuy: 4, insiderSell: 1, guruBuy: 6, guruSell: 2, dayChg: 0.9, weekChg: 2.8, monthChg: 5.5 },
    ],
    technology: [
        { ticker: 'AAPL', name: 'Apple', pe: 32.5, fwdPe: 28.1, mktCap: '$3.4T', above50d: true, insiderBuy: 0, insiderSell: 5, guruBuy: 20, guruSell: 12, dayChg: -0.5, weekChg: 1.2, monthChg: 3.5 },
        { ticker: 'MSFT', name: 'Microsoft', pe: 35.2, fwdPe: 30.5, mktCap: '$3.1T', above50d: true, insiderBuy: 0, insiderSell: 8, guruBuy: 18, guruSell: 10, dayChg: 0.3, weekChg: 2.1, monthChg: 5.2 },
        { ticker: 'NVDA', name: 'NVIDIA', pe: 55.8, fwdPe: 35.2, mktCap: '$2.8T', above50d: true, insiderBuy: 0, insiderSell: 12, guruBuy: 15, guruSell: 8, dayChg: 1.5, weekChg: 4.5, monthChg: 12.1 },
        { ticker: 'GOOGL', name: 'Alphabet', pe: 25.1, fwdPe: 21.8, mktCap: '$2.1T', above50d: true, insiderBuy: 0, insiderSell: 6, guruBuy: 16, guruSell: 9, dayChg: -0.2, weekChg: 0.8, monthChg: 2.8 },
        { ticker: 'META', name: 'Meta Platforms', pe: 28.3, fwdPe: 23.5, mktCap: '$1.4T', above50d: false, insiderBuy: 0, insiderSell: 10, guruBuy: 14, guruSell: 7, dayChg: -1.8, weekChg: -2.5, monthChg: -1.2 },
        { ticker: 'AMZN', name: 'Amazon', pe: 42.5, fwdPe: 32.1, mktCap: '$1.9T', above50d: true, insiderBuy: 0, insiderSell: 4, guruBuy: 12, guruSell: 6, dayChg: 0.8, weekChg: 3.2, monthChg: 8.5 },
    ],
    healthcare: [
        { ticker: 'UNH', name: 'UnitedHealth', pe: 19.5, fwdPe: 16.8, mktCap: '$480B', above50d: true, insiderBuy: 2, insiderSell: 3, guruBuy: 12, guruSell: 5, dayChg: 0.5, weekChg: 1.5, monthChg: 3.8 },
        { ticker: 'JNJ', name: 'Johnson & Johnson', pe: 22.1, fwdPe: 18.5, mktCap: '$380B', above50d: true, insiderBuy: 1, insiderSell: 2, guruBuy: 8, guruSell: 4, dayChg: 0.2, weekChg: 0.8, monthChg: 2.1 },
        { ticker: 'LLY', name: 'Eli Lilly', pe: 85.2, fwdPe: 52.1, mktCap: '$720B', above50d: true, insiderBuy: 0, insiderSell: 5, guruBuy: 10, guruSell: 6, dayChg: 1.2, weekChg: 3.5, monthChg: 8.5 },
        { ticker: 'PFE', name: 'Pfizer', pe: 38.5, fwdPe: 11.2, mktCap: '$160B', above50d: false, insiderBuy: 8, insiderSell: 1, guruBuy: 7, guruSell: 3, dayChg: -1.5, weekChg: -2.8, monthChg: -5.2 },
        { ticker: 'ABBV', name: 'AbbVie', pe: 16.8, fwdPe: 14.2, mktCap: '$310B', above50d: true, insiderBuy: 3, insiderSell: 2, guruBuy: 9, guruSell: 4, dayChg: 0.3, weekChg: 1.2, monthChg: 4.1 },
    ],
    materials: [
        { ticker: 'FCX', name: 'Freeport-McMoRan', pe: 28.5, fwdPe: 18.2, mktCap: '$65B', above50d: true, insiderBuy: 4, insiderSell: 1, guruBuy: 8, guruSell: 3, dayChg: 1.5, weekChg: 4.2, monthChg: 8.5 },
        { ticker: 'NEM', name: 'Newmont', pe: 15.2, fwdPe: 12.8, mktCap: '$52B', above50d: true, insiderBuy: 3, insiderSell: 1, guruBuy: 6, guruSell: 2, dayChg: 2.1, weekChg: 5.5, monthChg: 12.2 },
        { ticker: 'APD', name: 'Air Products', pe: 25.8, fwdPe: 21.5, mktCap: '$62B', above50d: false, insiderBuy: 1, insiderSell: 2, guruBuy: 4, guruSell: 3, dayChg: -0.5, weekChg: -1.2, monthChg: 0.8 },
        { ticker: 'DOW', name: 'Dow Inc', pe: 18.5, fwdPe: 14.1, mktCap: '$38B', above50d: false, insiderBuy: 5, insiderSell: 1, guruBuy: 5, guruSell: 2, dayChg: -1.2, weekChg: -2.5, monthChg: -3.8 },
        { ticker: 'LIN', name: 'Linde', pe: 32.1, fwdPe: 28.5, mktCap: '$210B', above50d: true, insiderBuy: 1, insiderSell: 1, guruBuy: 7, guruSell: 4, dayChg: 0.3, weekChg: 1.1, monthChg: 3.2 },
    ],
    consumer_staples: [
        { ticker: 'PG', name: 'Procter & Gamble', pe: 24.5, fwdPe: 22.1, mktCap: '$380B', above50d: true, insiderBuy: 2, insiderSell: 1, guruBuy: 14, guruSell: 3, dayChg: 0.3, weekChg: 1.2, monthChg: 3.8 },
        { ticker: 'KO', name: 'Coca-Cola', pe: 26.2, fwdPe: 23.5, mktCap: '$285B', above50d: true, insiderBuy: 1, insiderSell: 0, guruBuy: 10, guruSell: 2, dayChg: 0.1, weekChg: 0.8, monthChg: 2.5 },
        { ticker: 'MCD', name: 'McDonald\'s', pe: 28.8, fwdPe: 25.2, mktCap: '$215B', above50d: true, insiderBuy: 3, insiderSell: 1, guruBuy: 12, guruSell: 4, dayChg: 0.5, weekChg: 1.5, monthChg: 4.2 },
        { ticker: 'WMT', name: 'Walmart', pe: 22.5, fwdPe: 20.8, mktCap: '$420B', above50d: true, insiderBuy: 2, insiderSell: 0, guruBuy: 13, guruSell: 2, dayChg: 0.2, weekChg: 1.1, monthChg: 3.5 },
        { ticker: 'KMB', name: 'Kimberly-Clark', pe: 19.8, fwdPe: 18.5, mktCap: '$48B', above50d: true, insiderBuy: 1, insiderSell: 1, guruBuy: 6, guruSell: 2, dayChg: -0.1, weekChg: 0.5, monthChg: 2.1 },
    ],
    communication_services: [
        { ticker: 'GOOGL', name: 'Alphabet', pe: 25.1, fwdPe: 21.8, mktCap: '$2.1T', above50d: true, insiderBuy: 0, insiderSell: 3, guruBuy: 16, guruSell: 5, dayChg: -0.2, weekChg: 0.8, monthChg: 2.8 },
        { ticker: 'META', name: 'Meta Platforms', pe: 28.3, fwdPe: 23.5, mktCap: '$1.4T', above50d: false, insiderBuy: 0, insiderSell: 6, guruBuy: 12, guruSell: 4, dayChg: -1.8, weekChg: -2.5, monthChg: -1.2 },
        { ticker: 'NFLX', name: 'Netflix', pe: 38.5, fwdPe: 32.2, mktCap: '$280B', above50d: true, insiderBuy: 0, insiderSell: 4, guruBuy: 8, guruSell: 3, dayChg: 1.2, weekChg: 3.5, monthChg: 8.2 },
        { ticker: 'DIS', name: 'The Walt Disney Company', pe: 32.1, fwdPe: 28.5, mktCap: '$210B', above50d: false, insiderBuy: 1, insiderSell: 2, guruBuy: 7, guruSell: 5, dayChg: -0.8, weekChg: -1.5, monthChg: -0.5 },
        { ticker: 'CMCSA', name: 'Comcast', pe: 15.8, fwdPe: 14.2, mktCap: '$195B', above50d: true, insiderBuy: 2, insiderSell: 1, guruBuy: 5, guruSell: 2, dayChg: 0.3, weekChg: 1.2, monthChg: 3.1 },
    ],
    industrials: [
        { ticker: 'BA', name: 'Boeing', pe: 18.5, fwdPe: 14.2, mktCap: '$195B', above50d: false, insiderBuy: 8, insiderSell: 2, guruBuy: 9, guruSell: 5, dayChg: -2.5, weekChg: -5.2, monthChg: -8.5 },
        { ticker: 'GE', name: 'General Electric', pe: 22.5, fwdPe: 19.8, mktCap: '$205B', above50d: true, insiderBuy: 3, insiderSell: 1, guruBuy: 8, guruSell: 3, dayChg: 0.5, weekChg: 1.8, monthChg: 4.2 },
        { ticker: 'CAT', name: 'Caterpillar', pe: 19.2, fwdPe: 16.5, mktCap: '$125B', above50d: true, insiderBuy: 2, insiderSell: 1, guruBuy: 7, guruSell: 3, dayChg: 0.8, weekChg: 2.1, monthChg: 5.5 },
        { ticker: 'RTX', name: 'Raytheon Technologies', pe: 20.5, fwdPe: 18.2, mktCap: '$235B', above50d: true, insiderBuy: 1, insiderSell: 1, guruBuy: 6, guruSell: 2, dayChg: 0.3, weekChg: 1.5, monthChg: 3.8 },
        { ticker: 'MMM', name: '3M Company', pe: 18.8, fwdPe: 16.5, mktCap: '$98B', above50d: false, insiderBuy: 5, insiderSell: 2, guruBuy: 4, guruSell: 3, dayChg: -0.5, weekChg: -1.2, monthChg: 0.8 },
    ],
};
app.get('/api/industries/:sector', (req, res) => {
    const sector = req.params.sector.toLowerCase();
    const stocks = industryStocks[sector];
    if (!stocks) {
        return res.status(404).json({ error: `Sector "${sector}" not found. Available: ${Object.keys(industryStocks).join(', ')}` });
    }
    const above50d = stocks.filter(s => s.above50d).length;
    const avgPe = +(stocks.reduce((a, s) => a + s.pe, 0) / stocks.length).toFixed(1);
    const avgFwdPe = +(stocks.reduce((a, s) => a + s.fwdPe, 0) / stocks.length).toFixed(1);
    const totalGuruBuy = stocks.reduce((a, s) => a + s.guruBuy, 0);
    const totalGuruSell = stocks.reduce((a, s) => a + s.guruSell, 0);
    const totalInsiderBuy = stocks.reduce((a, s) => a + s.insiderBuy, 0);
    const totalInsiderSell = stocks.reduce((a, s) => a + s.insiderSell, 0);
    const sectorPrices = randomWalk(100, N, sector === 'argentina' ? 0.005 : sector === 'airlines' ? -0.002 : 0.002, 0.015);
    res.json({
        sector,
        stocks,
        summary: {
            breadth_pct: +((above50d / stocks.length) * 100).toFixed(1),
            above_50d: above50d,
            total: stocks.length,
            avg_pe: avgPe,
            avg_fwd_pe: avgFwdPe,
            pe_compression: +((avgFwdPe - avgPe) / avgPe * 100).toFixed(1),
            guru_buy_sell_ratio: +(totalGuruBuy / Math.max(totalGuruSell, 1)).toFixed(2),
            insider_buy_sell_ratio: +(totalInsiderBuy / Math.max(totalInsiderSell, 1)).toFixed(2),
            total_guru_buys: totalGuruBuy,
            total_guru_sells: totalGuruSell,
            total_insider_buys: totalInsiderBuy,
            total_insider_sells: totalInsiderSell,
        },
        time_series: {
            dates,
            prices: sectorPrices.map(v => +v.toFixed(2)),
        },
        regime_tag: isStag ? (sector === 'financials' || sector === 'materials' || sector === 'consumer_staples' ? 'Core Survivor' :
            sector === 'airlines' ? 'HIGH RISK' :
                sector === 'technology' ? 'Grey Out' : 'Neutral') : 'Standard',
    });
});
app.get('/api/breadth/constituents', (_req, res) => {
    const sectorBreadth = Object.entries(industryStocks).map(([sector, stocks]) => {
        const above = stocks.filter(s => s.above50d).length;
        return {
            sector,
            above_50d: above,
            total: stocks.length,
            breadth_pct: +((above / stocks.length) * 100).toFixed(1),
            stocks: stocks.map(s => ({ ticker: s.ticker, above50d: s.above50d, dayChg: s.dayChg })),
        };
    });
    const totalAbove = sectorBreadth.reduce((a, s) => a + s.above_50d, 0);
    const totalStocks = sectorBreadth.reduce((a, s) => a + s.total, 0);
    const spxUp = spx[N - 1] > spx[N - 5];
    const breadthDown = breadthArr[N - 1] < breadthArr[N - 5];
    const divergence = spxUp && breadthDown;
    res.json({
        overall: {
            breadth_pct: +((totalAbove / totalStocks) * 100).toFixed(1),
            above_50d: totalAbove,
            total: totalStocks,
            spx_trending_up: spxUp,
            breadth_trending_down: breadthDown,
            divergence_detected: divergence,
            divergence_severity: divergence ? 'WARNING' : 'NONE',
        },
        by_sector: sectorBreadth,
        time_series: {
            dates,
            breadth: breadthArr.map(v => +v.toFixed(1)),
            spx: spx.map(v => +v.toFixed(2)),
        },
    });
});
app.get('/api/liquidity/components', (_req, res) => {
    res.json({
        dates,
        components: {
            balance_sheet: bs.map(v => +v.toFixed(4)),
            tga: tga.map(v => +(v * 1000).toFixed(1)),
            rrp: rrp.map(v => +(v * 1000).toFixed(1)),
            m2: m2.map(v => +v.toFixed(2)),
        },
        roc: {
            balance_sheet_4w: roc(bs, 4).map(v => +(v * 100).toFixed(3)),
            tga_4w: roc(tga, 4).map(v => +(v * 100).toFixed(3)),
            rrp_4w: roc(rrp, 4).map(v => +(v * 100).toFixed(3)),
        },
        net_liquidity: nl.map(v => +v.toFixed(4)),
        velocity: {
            roc_4w: vel4w.map(v => +(v * 100).toFixed(3)),
            roc_13w: vel13w.map(v => +(v * 100).toFixed(3)),
            acceleration: vel4w.map((v, i) => i < 1 ? 0 : +((v - vel4w[i - 1]) * 100).toFixed(4)),
        },
    });
});
app.get('/api/commodities/detail', (_req, res) => {
    const silver = randomWalk(31.5, N, 0.002, 0.012);
    const natgas = randomWalk(2.8, N, -0.001, 0.03);
    const brent = randomWalk(76, N, 0.001, 0.018);
    res.json({
        dates,
        commodities: {
            wti: crude.map(v => +v.toFixed(2)),
            brent: brent.map(v => +v.toFixed(2)),
            copper: copper.map(v => +v.toFixed(3)),
            gold: gold.map(v => +v.toFixed(0)),
            silver: silver.map(v => +v.toFixed(2)),
            natural_gas: natgas.map(v => +v.toFixed(2)),
        },
        hy_spreads: hySpreads.map(v => +v.toFixed(2)),
        signals: {
            copper_oil_ratio: +(copper[N - 1] / crude[N - 1] * 1000).toFixed(2),
            gold_silver_ratio: +(gold[N - 1] / silver[N - 1]).toFixed(1),
            copper_trend: copper[N - 1] > copper[N - 8] ? 'RISING' : 'FALLING',
            oil_trend: crude[N - 1] > crude[N - 8] ? 'RISING' : 'FALLING',
            gold_trend: gold[N - 1] > gold[N - 8] ? 'RISING' : 'FALLING',
            macro_signal: copper[N - 1] > copper[N - 8] && crude[N - 1] > crude[N - 8] ? 'GROWTH' : 'STAGFLATION_RISK',
            stress_level: hySpreads[N - 1] > 5 ? 'HIGH' : hySpreads[N - 1] > 4 ? 'ELEVATED' : 'NORMAL',
        },
    });
});
// ─── CYCLE POSITION & ACTION SIGNALS ───
// ═══ CYCLE POSITION — rebuilt on v13 Leading Indicators + actual phase data ═══
app.get('/api/cycle-position', (_req, res) => {
    recalcDerived();
    // ── MACRO CYCLE from Leading Indicators (real data, not hardcoded) ──
    const liqVel4w = +(latV4 * 100).toFixed(2);
    const liqVel13w = +(latV13 * 100).toFixed(2);
    let liqAccel = 0;
    if (vel4w.length >= 5)
        liqAccel = +((vel4w[vel4w.length - 1] - vel4w[vel4w.length - 5]) * 100).toFixed(3);
    // Cycle phase from actual macro data
    let currentPhase = 'MID_CYCLE';
    let phaseDescription = '';
    // Use ISM, GDP, inflation, liquidity, yield curve together
    const ismRising = ismMfg > 51;
    const ismFalling = ismMfg < 49;
    const gdpStrong = gdp > 2;
    const gdpWeak = gdp < 1;
    const inflHot = cpiYoy > 3.5;
    const inflCool = cpiYoy < 2.5;
    const curveSteep = yieldCurveBps > 50;
    const curveFlat = yieldCurveBps < 10;
    const curveInverted = yieldCurveBps < -10;
    const liqExpanding = liqVel4w > 0 && liqAccel > 0;
    const liqDraining = liqVel4w < 0 && liqAccel < 0;
    if (liqExpanding && ismRising && curveSteep && !inflHot) {
        currentPhase = 'EARLY_RECOVERY';
        phaseDescription = 'Liquidity expanding, ISM rising, curve steep. Classic early recovery — risk assets favored.';
    }
    else if (ismRising && gdpStrong && !inflHot && !curveInverted) {
        currentPhase = 'MID_CYCLE';
        phaseDescription = 'Economy expanding. ISM above 50, GDP healthy, inflation contained. Cyclicals lead.';
    }
    else if ((inflHot || curveFlat) && capUtil > 78) {
        currentPhase = 'LATE_CYCLE';
        phaseDescription = 'Inflation pressures building, capacity stretched. Rotate to quality and defense.';
    }
    else if (curveInverted || (ismFalling && gdpWeak && liqDraining)) {
        currentPhase = 'RECESSION';
        phaseDescription = 'Contraction signals. ISM falling, liquidity draining, curve inverted. Full defensive.';
    }
    else {
        currentPhase = 'MID_CYCLE';
        phaseDescription = 'Mixed signals. Economy stable but watch leading indicators for direction.';
    }
    // ── SECTOR ROTATION from actual Chart Grid phase data ──
    // Pull live phase data from the lens instruments API (in-process)
    // We use the existing computed data rather than re-fetching
    const sectorPhases = {};
    const sectorEtfs = [
        { sym: 'XLF', name: 'Financials' }, { sym: 'XLK', name: 'Technology' },
        { sym: 'XLV', name: 'Healthcare' }, { sym: 'XLE', name: 'Energy' },
        { sym: 'XLI', name: 'Industrials' }, { sym: 'XLB', name: 'Materials' },
        { sym: 'XLP', name: 'Staples' }, { sym: 'XLY', name: 'Cons Disc' },
        { sym: 'XLU', name: 'Utilities' }, { sym: 'XLRE', name: 'Real Estate' },
        { sym: 'XLC', name: 'Communications' }, { sym: 'SMH', name: 'Semis' },
        { sym: 'KRE', name: 'Reg Banks' }, { sym: 'IYT', name: 'Transports' },
        { sym: 'XHB', name: 'Homebuilders' }, { sym: 'JETS', name: 'Airlines' },
        { sym: 'XBI', name: 'Biotech' }, { sym: 'GLD', name: 'Gold' },
        { sym: 'XRT', name: 'Retailers' }, { sym: 'XOP', name: 'Oil & Gas E&P' },
    ];
    // Build sector data (will be populated from lens instruments when available)
    const accumulate = [];
    const hold = [];
    const reduce = [];
    const avoid = [];
    // This data comes from the response — we build it from macro phase
    // The frontend will overlay actual instrument phases from /api/lens/instruments
    // For now, provide the macro-driven recommendations
    if (currentPhase === 'EARLY_RECOVERY' || currentPhase === 'MID_CYCLE') {
        accumulate.push({ sector: 'Financials', etf: 'XLF', reason: 'Rate-sensitive cyclical, benefits from expansion', cycle_sweet_spot: 'Early-to-Mid' }, { sector: 'Industrials', etf: 'XLI', reason: 'Capex cycle + ISM expansion', cycle_sweet_spot: 'Mid' }, { sector: 'Technology', etf: 'XLK', reason: 'Earnings growth leads in expansion', cycle_sweet_spot: 'Early-to-Mid' }, { sector: 'Materials', etf: 'XLB', reason: 'Commodity demand rises with activity', cycle_sweet_spot: 'Mid' });
        hold.push({ sector: 'Healthcare', etf: 'XLV', reason: 'Defensive growth across cycles', cycle_sweet_spot: 'All' }, { sector: 'Energy', etf: 'XLE', reason: 'Commodity support but watch late-cycle', cycle_sweet_spot: 'Mid-to-Late' });
        reduce.push({ sector: 'Utilities', etf: 'XLU', reason: 'Underperforms in expansion', cycle_sweet_spot: 'Recession' }, { sector: 'Staples', etf: 'XLP', reason: 'Defensive — rotate in when late signals emerge', cycle_sweet_spot: 'Late-to-Recession' });
    }
    else if (currentPhase === 'LATE_CYCLE') {
        accumulate.push({ sector: 'Energy', etf: 'XLE', reason: 'Inflation tailwinds', cycle_sweet_spot: 'Late' }, { sector: 'Healthcare', etf: 'XLV', reason: 'Defensive as growth slows', cycle_sweet_spot: 'All' }, { sector: 'Staples', etf: 'XLP', reason: 'Rotate to defense', cycle_sweet_spot: 'Late-to-Recession' });
        reduce.push({ sector: 'Technology', etf: 'XLK', reason: 'Valuation compression risk', cycle_sweet_spot: 'Early-to-Mid' }, { sector: 'Cons Disc', etf: 'XLY', reason: 'Consumer weakening', cycle_sweet_spot: 'Early' });
    }
    else if (currentPhase === 'RECESSION') {
        accumulate.push({ sector: 'Staples', etf: 'XLP', reason: 'Defensive earnings', cycle_sweet_spot: 'Recession' }, { sector: 'Healthcare', etf: 'XLV', reason: 'Non-cyclical', cycle_sweet_spot: 'All' }, { sector: 'Gold', etf: 'GLD', reason: 'Safe haven', cycle_sweet_spot: 'Recession' });
        reduce.push({ sector: 'Technology', etf: 'XLK', reason: 'Earnings decline', cycle_sweet_spot: 'Early-to-Mid' }, { sector: 'Financials', etf: 'XLF', reason: 'Credit losses', cycle_sweet_spot: 'Early-to-Mid' }, { sector: 'Industrials', etf: 'XLI', reason: 'Capex cuts', cycle_sweet_spot: 'Mid' });
    }
    // ── DRUCKENMILLER FRAMEWORK from Leading Indicators ──
    const liquidityScore = liqVel4w > 0.5 && liqAccel > 0 ? 2 : liqVel4w > 0 ? 1 : liqVel4w < -0.5 ? -2 : liqVel4w < 0 ? -1 : 0;
    const growthScore = gdp > 3 ? 2 : gdp > 2 ? 1 : gdp < 0.5 ? -2 : gdp < 1.5 ? -1 : 0;
    const inflationScore = cpiYoy < 2.5 ? 1 : cpiYoy > 4 ? -2 : cpiYoy > 3.5 ? -1 : 0;
    const breadthScore = breadthLat > 70 ? 2 : breadthLat > 55 ? 1 : breadthLat < 35 ? -2 : breadthLat < 45 ? -1 : 0;
    const curveScore = yieldCurveBps > 50 ? 1 : yieldCurveBps < -25 ? -2 : yieldCurveBps < 0 ? -1 : 0;
    const totalScore = liquidityScore + growthScore + inflationScore + breadthScore + curveScore;
    const overallBias = totalScore >= 3 ? 'RISK-ON' : totalScore >= 1 ? 'LEANING BULLISH' : totalScore <= -3 ? 'RISK-OFF' : totalScore <= -1 ? 'LEANING BEARISH' : 'NEUTRAL';
    res.json({
        current_phase: currentPhase,
        phase_description: phaseDescription,
        leading_indicators: {
            liquidity: { velocity4w: liqVel4w, velocity13w: liqVel13w, acceleration: liqAccel, signal: liqVel4w > 0 && liqAccel > 0 ? 'EXPANDING' : liqVel4w < 0 && liqAccel < 0 ? 'DRAINING' : liqVel4w > 0 ? 'DECELERATING' : 'BOTTOMING' },
            ism: { value: ismMfg, direction: ismMfg > 51 ? 'RISING' : ismMfg < 49 ? 'FALLING' : 'STABLE' },
            yield_curve: { bps: yieldCurveBps, signal: yieldCurveBps > 50 ? 'STEEP' : yieldCurveBps > 0 ? 'NORMAL' : yieldCurveBps > -25 ? 'FLAT' : 'INVERTED' },
            inflation: { cpi: cpiYoy, pce: pce, signal: cpiYoy < 2.5 ? 'COOLING' : cpiYoy > 4 ? 'HOT' : 'STABLE' },
            growth: { gdp: gdp, signal: gdp > 2.5 ? 'STRONG' : gdp > 1 ? 'MODERATE' : 'WEAK' },
            breadth: { pct: breadthLat, signal: breadthLat > 60 ? 'HEALTHY' : breadthLat < 40 ? 'FRAGILE' : 'NEUTRAL' },
        },
        sector_rotation: { accumulate, hold, reduce, avoid },
        sector_etfs: sectorEtfs,
        druckenmiller_framework: {
            liquidity_score: liquidityScore,
            growth_score: growthScore,
            inflation_score: inflationScore,
            breadth_score: breadthScore,
            curve_score: curveScore,
            total_score: totalScore,
            overall_bias: overallBias,
        },
    });
});
app.get('/api/action-signals', (_req, res) => {
    const trifectaScore = trifecta;
    const liquidityVelocity = latV4;
    const liquidityVelocity13w = latV13;
    const breadthPct = breadthLat;
    const hySpreadsLatest = hySpreads[N - 1];
    const copperLatest = copper[N - 1];
    const crudeLatest = crude[N - 1];
    const gdpVal = gdp;
    const pceVal = pce;
    const velocityAccelerating = liquidityVelocity > liquidityVelocity13w && liquidityVelocity > 0;
    const breadthHealthy = breadthPct > 60;
    const breadthDeteriorating = breadthPct < 40;
    const hySpreadsTight = hySpreadsLatest < 4;
    const hySpreadsDangerous = hySpreadsLatest > 5;
    const copperStrong = copperLatest > copper[N - 8];
    const commoditiesRising = copperStrong && crudeLatest > crude[N - 8];
    const dashboardSignal = trifectaScore >= 2
        ? { signal: 'ACCUMULATE RISK', color: 'green', rationale: 'Trifecta +2, liquidity expanding, breadth healthy — lean into cyclicals' }
        : trifectaScore <= -2
            ? { signal: 'REDUCE RISK', color: 'red', rationale: 'Trifecta -2, liquidity draining, breadth fragile — shift defensive' }
            : { signal: 'BALANCED POSITIONING', color: 'amber', rationale: 'Trifecta neutral, mixed signals — maintain discipline' };
    const liquiditySignal = velocityAccelerating && liquidityVelocity > 0
        ? { signal: 'LIQUIDITY EXPANDING', color: 'green', rationale: '4-week velocity above 13-week, net liquidity rising — bullish for risk assets' }
        : liquidityVelocity < liquidityVelocity13w && liquidityVelocity < 0
            ? { signal: 'LIQUIDITY DRAINING', color: 'red', rationale: '4-week velocity below 13-week, net liquidity falling — headwind for risk' }
            : { signal: 'LIQUIDITY NEUTRAL', color: 'amber', rationale: 'Velocity mixed signals, monitor for directional break' };
    const breadthSignal = breadthHealthy
        ? { signal: 'HEALTHY PARTICIPATION', color: 'green', rationale: `${breadthPct.toFixed(1)}% above 50-day MA, no divergence detected — broad market support` }
        : breadthDeteriorating
            ? { signal: 'BREADTH DETERIORATING', color: 'orange', rationale: `Only ${breadthPct.toFixed(1)}% above 50-day MA — concentration risk warning` }
            : { signal: 'BREADTH NEUTRAL', color: 'amber', rationale: 'Breadth at mid-range — balanced but watch for deterioration' };
    const gurusSignal = trifectaScore >= 1
        ? { signal: 'SMART MONEY ACCUMULATING', color: 'green', rationale: '6 of 8 gurus net buyers this quarter, concentrated in Financials and Tech' }
        : trifectaScore <= -1
            ? { signal: 'SMART MONEY DISTRIBUTING', color: 'red', rationale: '5 of 8 gurus net sellers, rotating to safety' }
            : { signal: 'SMART MONEY NEUTRAL', color: 'amber', rationale: '4 buyers / 4 sellers — mixed conviction, waiting' };
    const industriesSignal = trifectaScore >= 1 && breadthHealthy
        ? { signal: 'ROTATE INTO CYCLICALS', color: 'blue', rationale: 'ISM expansion favors Industrials, Financials, Materials — reduce defensive' }
        : trifectaScore <= -1 && breadthDeteriorating
            ? { signal: 'ROTATE TO DEFENSIVES', color: 'orange', rationale: 'Weak breadth + negative trifecta — shift to Healthcare, Staples' }
            : { signal: 'MAINTAIN BALANCE', color: 'amber', rationale: 'Mixed cycle signals — hold balanced sector allocation' };
    const argSpreadLatest = argSpread[N - 1];
    const argSpreadPrev = argSpread[N - 8];
    const argRerating = argSpreadLatest < argSpreadPrev;
    const globalSignal = argRerating
        ? { signal: 'EM OPPORTUNITIES', color: 'blue', rationale: `Argentina spread compression (${(argSpreadLatest - argSpreadPrev).toFixed(2)}bps) — re-rating plays active` }
        : { signal: 'EM WATCH', color: 'amber', rationale: 'EM spreads stable, monitor for breakout opportunities' };
    const commoditiesSignal = commoditiesRising && hySpreadsTight
        ? { signal: 'GROWTH SIGNAL', color: 'green', rationale: 'Copper rising, oil stable, HY spreads normal — no stress indicators' }
        : !commoditiesRising && hySpreadsDangerous
            ? { signal: 'STRESS DETECTED', color: 'red', rationale: 'Commodities declining, HY spreads blown out — caution warranted' }
            : { signal: 'COMMODITIES NEUTRAL', color: 'amber', rationale: 'Mixed commodity signals, monitor credit conditions' };
    const hedgesSignal = trifectaScore >= 2
        ? { signal: 'REDUCE HEDGES', color: 'green', rationale: `Trifecta +2 suggests reducing SPXU allocation to 25%` }
        : trifectaScore <= -2
            ? { signal: 'INCREASE HEDGES', color: 'red', rationale: `Trifecta -2 suggests increasing SPXU allocation to 75-100%` }
            : { signal: 'MAINTAIN HEDGES', color: 'amber', rationale: 'Trifecta neutral — hold standard 50% hedge level' };
    const portfolioSignal = Math.abs(trifectaScore) >= 2
        ? { signal: 'REVIEW POSITIONS', color: 'amber', rationale: 'Cycle positioning suggests rotating — check alignment with current phase' }
        : { signal: 'HOLD POSITIONING', color: 'green', rationale: 'Current positions well-aligned with macro backdrop' };
    let rotationSignal;
    if (ismMfg > 50 && gdp > 2 && capUtil < 80) {
        rotationSignal = { signal: 'MID-CYCLE EXPANSION', color: 'green', rationale: 'Overweight cyclicals now, prepare for late-cycle rotation in 6-12 months' };
    }
    else if (capUtil > 80 && pce > 3) {
        rotationSignal = { signal: 'LATE CYCLE ROTATION', color: 'orange', rationale: 'Begin defensive rotation — reduced exposure to commodities, tech' };
    }
    else if (ismMfg < 47 && gdp < 1) {
        rotationSignal = { signal: 'RECESSION MODE', color: 'red', rationale: 'Full defensive posture — focus on quality, cash, government bonds' };
    }
    else {
        rotationSignal = { signal: 'EARLY RECOVERY', color: 'blue', rationale: 'Aggressive cyclical positioning, build risk exposure' };
    }
    res.json({
        dashboard: dashboardSignal,
        liquidity: liquiditySignal,
        breadth: breadthSignal,
        gurus: gurusSignal,
        industries: industriesSignal,
        globalmarkets: globalSignal,
        commodities: commoditiesSignal,
        hedges: hedgesSignal,
        portfolio: portfolioSignal,
        rotation: rotationSignal,
    });
});
// ─── API KEY SETTINGS ───
app.get('/api/settings/key-status', (_req, res) => {
    res.json({ has_key: !!anthropicApiKey, masked: anthropicApiKey ? '••••' + anthropicApiKey.slice(-8) : null });
});
app.post('/api/settings/key', (req, res) => {
    const { api_key } = req.body;
    if (!api_key || typeof api_key !== 'string' || !api_key.startsWith('sk-')) {
        return res.status(400).json({ error: 'Invalid API key format' });
    }
    anthropicApiKey = api_key;
    process.env.ANTHROPIC_API_KEY = api_key; // Share with morning-lens module
    (0, history_store_1.setSetting)('anthropic_api_key', api_key); // Persist to SQLite — survives deploys forever
    (0, geo_events_1.setGeoEventKeys)(api_key, GURUFOCUS_API_KEY);
    res.json({ status: 'ok', masked: '••••' + api_key.slice(-8) });
});
// ─── SCREENSHOT POSITION REVIEW ───
app.post('/api/review-positions', async (req, res) => {
    if (!anthropicApiKey) {
        return res.status(400).json({ error: 'No Anthropic API key configured. Set it in Settings.' });
    }
    const { screenshots } = req.body;
    if (!screenshots || !Array.isArray(screenshots) || screenshots.length === 0) {
        return res.status(400).json({ error: 'No screenshots provided' });
    }
    if (screenshots.length > 10) {
        return res.status(400).json({ error: 'Maximum 10 screenshots per review' });
    }
    const engineState = {
        trifecta_score: trifecta,
        modules: {
            m1_liquidity: { score: mod1, roc_4w: +(latV4 * 100).toFixed(2), roc_13w: +(latV13 * 100).toFixed(2), signal: mod1 > 0 ? 'ACCELERATING' : mod1 < 0 ? 'DRAINING' : 'NEUTRAL' },
            m2_conviction: { score: mod2, signal: 'ACCUMULATING' },
            m3_breadth: { score: mod3, breadth_pct: +breadthLat.toFixed(1), signal: mod3 > 0 ? 'HEALTHY' : mod3 < 0 ? 'FRAGILE' : 'NEUTRAL' },
        },
        regime: { is_stagflation: isStag, label: isStag ? 'STAGFLATION' : trifecta >= 2 ? 'RISK-ON' : trifecta <= -2 ? 'RISK-OFF' : 'NEUTRAL', pce, gdp },
        hedge: { recommendation: trifecta >= 2 ? 'REDUCE' : trifecta <= -2 ? 'FULL' : 'STANDARD', spxu_allocation: trifecta >= 3 ? '0%' : trifecta >= 2 ? '25%' : trifecta >= 0 ? '50%' : trifecta >= -1 ? '75%' : '100%' },
        net_liquidity: +nl[N - 1].toFixed(4),
        breadth_pct: +breadthLat.toFixed(1),
        argentina: { spread: +argSpread[N - 1].toFixed(2), spread_tightening: argSpread[N - 1] < argSpread[N - 8] },
    };
    try {
        const client = new sdk_1.default({ apiKey: anthropicApiKey });
        const imageContent = [];
        screenshots.forEach((s, i) => {
            imageContent.push({
                type: 'image',
                source: { type: 'base64', media_type: 'image/png', data: s.data.replace(/^data:image\/\w+;base64,/, '') },
            });
            imageContent.push({
                type: 'text',
                text: `[Screenshot ${i + 1}: "${s.label}"]`,
            });
        });
        imageContent.push({
            type: 'text',
            text: `CURRENT DRUCK ENGINE STATE:
${JSON.stringify(engineState, null, 2)}

TASK: You are the Druck Engine position review module. Analyze all the screenshots above — these show the user's actual positions from their trading models/platforms.

For EACH position you can identify in the screenshots:
1. Identify the ticker/asset, direction (long/short), and approximate size if visible
2. Rate it on a scale: STRONG ALIGNMENT / ALIGNED / NEUTRAL / MISALIGNED / STRONGLY MISALIGNED — relative to what the Trifecta engine currently recommends
3. Give a brief 1-2 sentence rationale referencing specific Trifecta signals

Then provide:
- An OVERALL PORTFOLIO GRADE (A+ through F) based on alignment with the engine
- Top 3 RISKS in the current positioning
- Top 3 SUGGESTED ADJUSTMENTS ranked by priority

Format your response as JSON with this exact structure:
{
  "positions": [
    { "ticker": "...", "direction": "LONG|SHORT", "size_note": "...", "alignment": "STRONG ALIGNMENT|ALIGNED|NEUTRAL|MISALIGNED|STRONGLY MISALIGNED", "rating_color": "green|lime|amber|orange|red", "rationale": "..." }
  ],
  "overall_grade": "A+",
  "overall_summary": "2-3 sentence overall assessment",
  "risks": ["risk 1", "risk 2", "risk 3"],
  "adjustments": [
    { "priority": 1, "action": "...", "rationale": "..." }
  ],
  "model_notes": ["Any observations about the models/screenshots themselves"]
}

Return ONLY valid JSON, no markdown fences.`,
        });
        const response = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            messages: [{ role: 'user', content: imageContent }],
        });
        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        try {
            const parsed = JSON.parse(text);
            res.json({ status: 'ok', review: parsed, engine_state: engineState });
        }
        catch {
            res.json({ status: 'ok', review: { raw_analysis: text }, engine_state: engineState });
        }
    }
    catch (err) {
        console.error('Review error:', err?.message || err);
        res.status(500).json({ error: err?.message || 'Failed to analyze screenshots' });
    }
});
// ═══════════════════════════════════════════════════════════════════
// HISTORICAL DATA TRACKING API
// ═══════════════════════════════════════════════════════════════════
// Database stats
app.get('/api/history/stats', (_req, res) => {
    try {
        res.json((0, history_store_1.getDbStats)());
    }
    catch (err) {
        res.status(500).json({ error: err?.message });
    }
});
// IMPORTANT: Specific routes MUST come before parameterized :symbol routes
// Recent transitions across all instruments
app.get('/api/history/transitions/recent', (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const transitions = (0, history_store_1.getRecentTransitions)(days);
        res.json({ count: transitions.length, days, transitions });
    }
    catch (err) {
        res.status(500).json({ error: err?.message });
    }
});
// Latest snapshots for all instruments
app.get('/api/history/snapshots/latest', (_req, res) => {
    try {
        const snapshots = (0, history_store_1.getLatestSnapshots)();
        res.json({ count: snapshots.length, snapshots });
    }
    catch (err) {
        res.status(500).json({ error: err?.message });
    }
});
// Prediction accuracy metrics
app.get('/api/history/accuracy', (req, res) => {
    try {
        const version = req.query.version;
        const metrics = (0, history_store_1.computeAccuracyMetrics)(version);
        res.json(metrics);
    }
    catch (err) {
        res.status(500).json({ error: err?.message });
    }
});
// Algorithm version management
app.get('/api/history/algorithm/versions', (_req, res) => {
    try {
        const versions = (0, history_store_1.getAllAlgorithmVersions)();
        const active = (0, history_store_1.getActiveAlgorithmVersion)();
        res.json({ active, versions });
    }
    catch (err) {
        res.status(500).json({ error: err?.message });
    }
});
app.get('/api/history/algorithm/pending-updates', (_req, res) => {
    try {
        const pending = (0, history_store_1.getPendingUpdateRequests)();
        res.json({ count: pending.length, requests: pending });
    }
    catch (err) {
        res.status(500).json({ error: err?.message });
    }
});
// CRITICAL: Algorithm update approval — requires explicit user action
app.post('/api/history/algorithm/approve-update', (req, res) => {
    try {
        const { requestId, newVersionId, description, configSnapshot, approvalNote } = req.body;
        if (!requestId || !newVersionId || !description) {
            return res.status(400).json({ error: 'Missing required fields: requestId, newVersionId, description' });
        }
        (0, history_store_1.approveAlgorithmUpdate)(requestId, newVersionId, description, configSnapshot, 'Marcelo', approvalNote || '');
        res.json({
            status: 'approved',
            message: `Algorithm updated to ${newVersionId}. All future classifications will use this version.`,
            activeVersion: (0, history_store_1.getActiveAlgorithmVersion)(),
        });
    }
    catch (err) {
        res.status(500).json({ error: err?.message });
    }
});
// Request algorithm update (system can call this, but it does NOT auto-apply)
app.post('/api/history/algorithm/request-update', (req, res) => {
    try {
        const { reason, accuracyData } = req.body;
        if (!reason)
            return res.status(400).json({ error: 'Missing reason' });
        const id = (0, history_store_1.requestAlgorithmUpdate)({ reason, accuracyData });
        res.json({
            status: 'pending',
            requestId: id,
            message: 'Update request created. Do you want the system to go through all the data and make updates to the phase algorithm? This requires your explicit approval.',
        });
    }
    catch (err) {
        res.status(500).json({ error: err?.message });
    }
});
// Parameterized symbol routes MUST come AFTER specific routes
// Full history for a symbol
app.get('/api/history/:symbol', (req, res) => {
    try {
        const symbol = decodeURIComponent(req.params.symbol);
        const limit = parseInt(req.query.limit) || 365;
        const history = (0, history_store_1.getSymbolHistory)(symbol, limit);
        res.json({ symbol, count: history.length, snapshots: history });
    }
    catch (err) {
        res.status(500).json({ error: err?.message });
    }
});
// Phase timeline for a symbol (date + phase + confidence)
app.get('/api/history/:symbol/phases', (req, res) => {
    try {
        const symbol = decodeURIComponent(req.params.symbol);
        const timeline = (0, history_store_1.getSymbolPhaseTimeline)(symbol);
        res.json({ symbol, count: timeline.length, timeline });
    }
    catch (err) {
        res.status(500).json({ error: err?.message });
    }
});
// Phase transitions for a symbol
app.get('/api/history/:symbol/transitions', (req, res) => {
    try {
        const symbol = decodeURIComponent(req.params.symbol);
        const transitions = (0, history_store_1.getSymbolTransitions)(symbol);
        res.json({ symbol, count: transitions.length, transitions });
    }
    catch (err) {
        res.status(500).json({ error: err?.message });
    }
});
// ─── MORNING LENS MODULE ───
app.use('/api', morning_lens_1.default);
app.use('/api', market_intel_1.default);
app.use('/api/ta', ta_acceleration_1.default);
app.use('/api/inflection', inflection_engine_1.default);
app.use('/api/fundamentals', fundamental_data_1.default);
app.use('/api/industry', industry_drivers_1.default);
app.use('/api/alerts', alert_system_1.default);
app.use('/api/geo-events', geo_events_1.default);
app.use('/api', burry_substack_1.default);
// Start Burry Substack RSS polling
(0, burry_substack_1.startRSSPolling)();
// Initialize geo-event keys
(0, geo_events_1.setGeoEventKeys)(anthropicApiKey, GURUFOCUS_API_KEY);
// ─── SERVE STATIC FILES ───
const clientPath = path_1.default.join(__dirname, '../../client/public');
app.use(express_1.default.static(clientPath));
// SPA fallback
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path_1.default.join(clientPath, 'index.html'));
    }
});
app.listen(PORT, () => {
    console.log(`\n  DRUCK ENGINE v15.0 — Structural Regime Intelligence + Burry Substack Engine`);
    console.log(`  Data Source: ${dataSource === 'live' ? 'FRED + GuruFocus APIs' : 'Simulated Data'}`);
    if (FRED_API_KEY)
        console.log(`  FRED API: Configured (4-hour cache)`);
    if (GURUFOCUS_API_KEY)
        console.log(`  GuruFocus API: Configured (24-hour cache)`);
    console.log(`  Running on http://localhost:${PORT}\n`);
});
//# sourceMappingURL=index.js.map